import { Router, type Request, type Response } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { analyzeImage } from "../../services/face-ai.service.js";
import { faceAiCircuitBreaker } from "../../services/circuit-breaker.js";
import { faceAiRateLimiter } from "../../middlewares/face-ai-rate-limit.middleware.js";
import { getClientIp, getAuthenticatedUserId } from "../../middlewares/rate-limit.middleware.js";
import { demoEmbeddingStore } from "./demo-embedding-store.js";

const router = Router();

// Track in-flight processing count for busy detection
let inFlightCount = 0;

// Multer memory upload accepting up to 5MB images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max for demo
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Only JPEG, PNG, and WEBP images are supported.", 400));
    }
  },
});

function resolveDemoSessionId(req: Request): string {
  const customHeader = req.headers["x-demo-session"];
  if (typeof customHeader === "string" && customHeader.trim().length > 0) {
    return customHeader.trim();
  }
  const queryParam = req.query.sessionId || req.query.demoSessionId;
  if (typeof queryParam === "string" && queryParam.trim().length > 0) {
    return queryParam.trim();
  }
  if (req.body && typeof req.body.sessionId === "string" && req.body.sessionId.trim().length > 0) {
    return req.body.sessionId.trim();
  }
  const userId = getAuthenticatedUserId(req);
  if (userId) {
    return `user_${userId}`;
  }
  return `ip_${getClientIp(req)}`;
}

/**
 * GET /api/face-ai/health
 * Public health check for the Face AI microservice.
 * Returns pipeline status, busy state, and active concurrency count.
 */
router.get("/health", async (_req: Request, res: Response) => {
  const cbMetrics = faceAiCircuitBreaker.getMetrics();

  try {
    const response = await fetch(`${env.FASTAPI_AI_URL}/health`, {
      signal: AbortSignal.timeout(3500),
    });

    if (response.ok) {
      const data = (await response.json()) as Record<string, any>;
      // If FastAPI is responding healthy, reset circuit breaker if it was tripped
      if (faceAiCircuitBreaker.getState() !== "CLOSED") {
        faceAiCircuitBreaker.reset();
      }

      return res.status(200).json({
        success: true,
        serviceStatus: "online",
        busy: inFlightCount >= 1,
        inFlightCount,
        circuitBreaker: faceAiCircuitBreaker.getMetrics(),
        details: data,
      });
    }

    faceAiCircuitBreaker.tripOpen(`Face AI service returned HTTP ${response.status}`);

    return res.status(503).json({
      success: false,
      serviceStatus: "degraded",
      busy: inFlightCount >= 1,
      inFlightCount,
      circuitBreaker: faceAiCircuitBreaker.getMetrics(),
      fallbackMode: "MANUAL_ATTENDANCE",
      message: `Face AI service returned HTTP ${response.status}`,
    });
  } catch (err: any) {
    faceAiCircuitBreaker.tripOpen(
      `Face AI engine is unreachable: ${err?.message || "ECONNREFUSED"}`,
    );

    return res.status(503).json({
      success: false,
      serviceStatus: "offline",
      busy: inFlightCount >= 1,
      inFlightCount,
      circuitBreaker: faceAiCircuitBreaker.getMetrics(),
      fallbackMode: "MANUAL_ATTENDANCE",
      message: "Face AI engine is currently offline or warming up. Circuit breaker fail-open mode is active.",
    });
  }
});

/**
 * GET /api/face-ai/demo-session
 * Retrieves current active enrolled faces for the session (stored strictly in memory, 10 min TTL).
 */
router.get("/demo-session", (req: Request, res: Response) => {
  const sessionId = resolveDemoSessionId(req);
  const faces = demoEmbeddingStore.listSessionFaces(sessionId);
  const isAuth = !!getAuthenticatedUserId(req);

  res.status(200).json({
    success: true,
    sessionId,
    isAuthenticated: isAuth,
    rateLimitTier: isAuth ? "authenticated (60 req/min)" : "guest (20 req/min)",
    enrolledDemoFaces: faces,
    storeStats: demoEmbeddingStore.getStats(),
  });
});

/**
 * DELETE /api/face-ai/demo-session
 * Clears temporary in-memory enrolled faces for this demo session.
 */
router.delete("/demo-session", (req: Request, res: Response) => {
  const sessionId = resolveDemoSessionId(req);
  demoEmbeddingStore.clearSession(sessionId);
  res.status(200).json({
    success: true,
    message: "Temporary demo session cleared.",
  });
});

/**
 * POST /api/face-ai/analyze
 * Proxies frame to Python Face AI service with:
 * - Tiered rate limiting (6/min auth, 3/min guest)
 * - Busy check: 503 if inFlightCount >= 1
 * - Zero storage in DB / Cloudinary
 * - In-memory temporary demo embedding store with 10-minute TTL
 * - Raw embedding vector is stripped before returning to client
 */
router.post(
  "/analyze",
  faceAiRateLimiter,
  (req, res, next) => {
    // Fail-fast circuit breaker check
    if (faceAiCircuitBreaker.isOpen()) {
      const metrics = faceAiCircuitBreaker.getMetrics();
      return res.status(503).json({
        success: false,
        error: "FACE_AI_UNAVAILABLE",
        code: "FACE_AI_CIRCUIT_OPEN",
        fallbackMode: "MANUAL_ATTENDANCE",
        message: "The Face AI service is currently offline or unhealthy (circuit breaker OPEN). Please use manual attendance mode.",
        circuitBreaker: {
          state: metrics.state,
          consecutiveFailures: metrics.consecutiveFailures,
          nextAttemptInMs: metrics.nextAttemptInMs,
        },
      });
    }

    // Busy check: reject immediately if another frame is already in flight
    if (inFlightCount >= 1) {
      return res.status(503).json({
        success: false,
        error: "SERVICE_BUSY",
        message: "The Face AI pipeline is currently processing another frame. Please wait a moment and try again.",
        busy: true,
        inFlightCount,
      });
    }
    next();
  },
  upload.single("image"),
  async (req: Request, res: Response, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided. Please upload an image under field 'image'.",
      });
    }

    const sessionId = resolveDemoSessionId(req);
    const enrollLabel = typeof req.body.enrollLabel === "string" ? req.body.enrollLabel.trim() : "";

    inFlightCount++;
    try {
      // 1. Call Python microservice
      const aiResult = await analyzeImage(req.file.buffer, req.file.originalname || "demo_capture.jpg");

      let newlyEnrolled: { id: string; label: string; expiresAt: number } | null = null;

      // 2. Process faces: find demo matches and optionally enroll
      const sanitizedFaces = aiResult.faces.map((face) => {
        const rawEmbedding = face.embedding;
        let demoMatches: Array<{ id: string; label: string; similarity: number }> = [];

        if (rawEmbedding && Array.isArray(rawEmbedding) && rawEmbedding.length > 0) {
          // Check for matches against previously enrolled faces in this demo session
          demoMatches = demoEmbeddingStore.findMatches(sessionId, rawEmbedding, 0.45);

          // If caller requested enrollment and face is usable and not already enrolled in this loop
          if (enrollLabel && !newlyEnrolled && face.quality?.usable !== false) {
            newlyEnrolled = demoEmbeddingStore.saveEmbedding(sessionId, enrollLabel, rawEmbedding);
          }
        }

        // CRITICAL: Strip raw embedding array before sending to client
        const { embedding: _stripped, ...safeFace } = face;

        return {
          ...safeFace,
          demoMatches,
        };
      });

      // 3. Return sanitized response
      return res.status(200).json({
        success: true,
        filename: aiResult.filename,
        image_width: aiResult.image_width,
        image_height: aiResult.image_height,
        face_count: aiResult.face_count,
        process_time_ms: aiResult.process_time_ms,
        faces: sanitizedFaces,
        enrolled: newlyEnrolled,
        sessionActiveEnrolledCount: demoEmbeddingStore.listSessionFaces(sessionId).length,
      });
    } catch (error) {
      next(error);
    } finally {
      inFlightCount = Math.max(0, inFlightCount - 1);
    }
  }
);

export const faceAiProxyRouter = router;
