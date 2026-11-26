import { API_BASE_URL, ApiError } from "./client.js";

export interface FaceAiHealthStatus {
  success: boolean;
  serviceStatus: "online" | "degraded" | "offline";
  busy: boolean;
  inFlightCount: number;
  message?: string;
  details?: Record<string, any>;
}

export interface DemoEnrolledFace {
  id: string;
  label: string;
  expiresAt: number;
}

export interface DemoSessionInfo {
  sessionId: string;
  isAuthenticated: boolean;
  rateLimitTier: string;
  enrolledDemoFaces: DemoEnrolledFace[];
  storeStats: { activeSessions: number; totalEmbeddings: number };
}

export interface AnalyzedDemoFace {
  face_index: number;
  bbox: number[];
  detection_confidence: number;
  landmarks: number[][] | null;
  quality: { usable: boolean; decision: string; quality_score: number; reasons: string[] };
  liveness: { decision: string; score: number; scores?: Record<string, number> } | null;
  recognition: { status: string; identity: string | null; similarity: number | null };
  demoMatches: Array<{ id: string; label: string; similarity: number }>;
}

export interface DemoAnalysisResponse {
  success: boolean;
  filename: string;
  image_width: number;
  image_height: number;
  face_count: number;
  process_time_ms: number;
  faces: AnalyzedDemoFace[];
  enrolled: DemoEnrolledFace | null;
  sessionActiveEnrolledCount: number;
}

export async function checkFaceAiHealth(): Promise<FaceAiHealthStatus> {
  const res = await fetch(`${API_BASE_URL}/face-ai/health`);
  return res.json();
}

export async function getDemoSession(
  demoSessionId?: string,
): Promise<DemoSessionInfo> {
  const headers: Record<string, string> = {};
  const query = demoSessionId ? `?sessionId=${encodeURIComponent(demoSessionId)}` : "";
  if (demoSessionId) headers["x-demo-session"] = demoSessionId;
  const res = await fetch(`${API_BASE_URL}/face-ai/demo-session${query}`, {
    headers,
    credentials: "include",
  });
  return res.json();
}

export async function clearDemoSession(demoSessionId?: string): Promise<void> {
  const headers: Record<string, string> = {};
  const query = demoSessionId ? `?sessionId=${encodeURIComponent(demoSessionId)}` : "";
  if (demoSessionId) headers["x-demo-session"] = demoSessionId;
  await fetch(`${API_BASE_URL}/face-ai/demo-session${query}`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });
}

export async function analyzeDemoFrame(
  imageBlob: Blob | File,
  filename = "frame.jpg",
  enrollLabel?: string,
  demoSessionId?: string,
): Promise<DemoAnalysisResponse> {
  const formData = new FormData();
  formData.append("image", imageBlob, filename);
  if (enrollLabel) formData.append("enrollLabel", enrollLabel);
  if (demoSessionId) formData.append("sessionId", demoSessionId);

  const headers: Record<string, string> = {};
  const query = demoSessionId ? `?sessionId=${encodeURIComponent(demoSessionId)}` : "";
  if (demoSessionId) headers["x-demo-session"] = demoSessionId;

  const res = await fetch(`${API_BASE_URL}/face-ai/analyze${query}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retryAfter = res.headers.get("retry-after") || data.retryAfter;
    const error = new ApiError(res.status, data.message || "Face AI analysis failed");
    (error as any).retryAfter = retryAfter ? Number(retryAfter) : undefined;
    (error as any).isBusy = res.status === 503 || data.busy;
    (error as any).isRateLimited = res.status === 429;
    throw error;
  }

  return data;
}
