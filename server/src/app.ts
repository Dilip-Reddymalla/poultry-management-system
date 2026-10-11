import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { clientOrigin, env } from "./config/env.js";
import authRouter from "./modules/auth/auth.routes.js";
import employeeRouter from "./modules/employee/employee.routes.js";
import farmRouter from "./modules/farm/farm.routes.js";
import shedRouter from "./modules/shed/shed.routes.js";
import companyRouter from "./modules/company/company.routes.js";
import workerRouter from "./modules/worker/worker.routes.js";
import attendanceRouter from "./modules/attendance/attendance.routes.js";
import auditRouter from "./modules/audit/audit.routes.js";
import {
    designationRouter,
    roleRouter,
    referenceRouter,
} from "./modules/reference/reference.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { tieredRateLimiter } from "./middlewares/rate-limit.middleware.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { faceAiProxyRouter } from "./modules/face-ai/face-ai-proxy.routes.js";
import { notificationRoutes } from "./modules/notifications/notification.routes.js";
import { initializeWebPush } from "./modules/notifications/webpush.config.js";
import { requestIdMiddleware } from "./middlewares/request-id.middleware.js";
import { logger } from "./config/logger.js";

import { systemErrorRouter } from "./modules/system-errors/system-error.routes.js";

initializeWebPush();

const app = express();

// Trust reverse proxy headers (e.g. X-Forwarded-For)
app.set("trust proxy", 1);

// Correlation IDs on all incoming requests
app.use(requestIdMiddleware);

// CORS middleware: Echoes requesting origin to satisfy browser CORS & credential requirements
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Cookie, X-Demo-Session, x-demo-session, X-Request-Id",
    );
  }

  // Preflight OPTIONS requests must terminate immediately with 204 No Content
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

// Request status & IP logger middleware with structured Pino logging & request IDs
app.use((req, res, next) => {
  const start = Date.now();
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const reqLogger = req.log || logger;

    const logPayload = {
      method,
      url,
      statusCode,
      durationMs: duration,
      clientIp,
    };

    if (statusCode >= 500) {
      reqLogger.error(logPayload, `HTTP ${method} ${url} -> ${statusCode} (${duration}ms)`);
    } else if (statusCode >= 400) {
      reqLogger.warn(logPayload, `HTTP ${method} ${url} -> ${statusCode} (${duration}ms)`);
    } else {
      reqLogger.info(logPayload, `HTTP ${method} ${url} -> ${statusCode} (${duration}ms)`);
    }
  });

  next();
});

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Unified Versioned API Router (v1 & backward-compatible /api)
// ---------------------------------------------------------------------------
const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Poultry Management API is running",
        version: "1.0.0",
        apiVersion: "v1",
    });
});

apiRouter.get('/version', (_req, res) => {
    res.status(200).json({
        success: true,
        version: "1.0.0",
        apiVersion: "v1",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// Public / Demo routers mounted before general rate limiter
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/face-ai", faceAiProxyRouter);

// Rate limiting: strict before-login limit, generous after-login limit
apiRouter.use(tieredRateLimiter);

// Business domain routers
apiRouter.use("/auth", authRouter);
apiRouter.use("/companies", companyRouter);
apiRouter.use("/farms", farmRouter);
apiRouter.use("/sheds", shedRouter);
apiRouter.use("/employees", employeeRouter);
apiRouter.use("/workers", workerRouter);
apiRouter.use("/attendance", attendanceRouter);
apiRouter.use("/audit-logs", auditRouter);
apiRouter.use("/system-errors", systemErrorRouter);
apiRouter.use("/reference", referenceRouter);
apiRouter.use("/designations", designationRouter);
apiRouter.use("/roles", roleRouter);
apiRouter.use("/notifications", notificationRoutes);

// Mount API version 1 and root /api
app.use("/api/v1", apiRouter);
app.use("/api", apiRouter);

if (env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const clientBuildPath = path.join(__dirname, "../../../client/dist");
    
    if (fs.existsSync(clientBuildPath)) {
        app.use(express.static(clientBuildPath));
        app.get(/(.*)/, (req, res, next) => {
            if (req.originalUrl.startsWith("/api/")) {
                return next();
            }
            res.sendFile(path.join(clientBuildPath, "index.html"));
        });
    }
}

// Unmatched routes would otherwise fall through to Express' HTML error page;
// an API client should always receive the standard JSON error envelope.
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

app.use(errorMiddleware);

export default app;
