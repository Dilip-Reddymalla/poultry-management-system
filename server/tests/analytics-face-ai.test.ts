import { describe, expect, it } from "vitest";
import request from "supertest";
import { demoEmbeddingStore } from "../src/modules/face-ai/demo-embedding-store.js";

describe("Face AI Demo - In-Memory Temporary Embedding Store", () => {
  const sessionId = "test-session-123";

  it("saves and lists temporary embeddings without exposing raw vectors", () => {
    demoEmbeddingStore.clearSession(sessionId);

    // Mock 512-D vector (normalized)
    const vecA = new Array(512).fill(0.04419); // norm ≈ 1.0
    const saved = demoEmbeddingStore.saveEmbedding(sessionId, "Jane Doe (Tester)", vecA);

    expect(saved.id).toBeDefined();
    expect(saved.label).toBe("Jane Doe (Tester)");
    expect(saved.expiresAt).toBeGreaterThan(Date.now());

    // List session faces
    const sessionFaces = demoEmbeddingStore.listSessionFaces(sessionId);
    expect(sessionFaces).toHaveLength(1);
    expect(sessionFaces[0]?.label).toBe("Jane Doe (Tester)");
    // Must NOT leak embedding vector to list calls
    expect((sessionFaces[0] as any).embedding).toBeUndefined();
  });

  it("accurately computes cosine similarity matches", () => {
    demoEmbeddingStore.clearSession(sessionId);

    // Create 2 test vectors: vecA and vecB (similar to vecA)
    const vecA = new Array(512).fill(0);
    vecA[0] = 1;
    vecA[1] = 0;

    const vecB = new Array(512).fill(0);
    vecB[0] = 0.95;
    vecB[1] = 0.3122; // length ≈ 1.0

    demoEmbeddingStore.saveEmbedding(sessionId, "Target Subject", vecA);

    // Search with vecB against vecA
    const matches = demoEmbeddingStore.findMatches(sessionId, vecB, 0.5);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]?.label).toBe("Target Subject");
    expect(matches[0]?.similarity).toBeGreaterThan(0.9);
  });

  it("clears temporary demo session on request", () => {
    demoEmbeddingStore.clearSession(sessionId);
    const faces = demoEmbeddingStore.listSessionFaces(sessionId);
    expect(faces).toHaveLength(0);
  });
});

describe("Public Analytics & Face AI Demo Endpoints", () => {
  it("GET /api/face-ai/health returns status and inFlightCount", async () => {
    const { app } = await import("./helpers.js");
    const res = await request(app).get("/api/face-ai/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body.serviceStatus).toBeDefined();
    expect(res.body.inFlightCount).toBe(0);
    expect(res.body.busy).toBe(false);
  });

  it("GET /api/face-ai/demo-session provides session info and empty faces initially", async () => {
    const { app } = await import("./helpers.js");
    const res = await request(app)
      .get("/api/face-ai/demo-session")
      .set("x-demo-session", "session-xyz-99");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionId).toBe("session-xyz-99");
    expect(res.body.enrolledDemoFaces).toEqual([]);
    expect(res.body.rateLimitTier).toContain("guest");
  });

  it("GET /api/analytics/summary returns public aggregate telemetry without PII", async () => {
    const { app } = await import("./helpers.js");
    const res = await request(app).get("/api/analytics/summary");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workforce).toBeDefined();
    expect(res.body.data.infrastructure).toBeDefined();
    expect(res.body.data.attendance).toBeDefined();
    expect(res.body.data.faceAiMetrics).toBeDefined();

    // Verify ZERO PII: No names, emails, phones, or employee/worker identities
    const jsonStr = JSON.stringify(res.body.data);
    expect(jsonStr).not.toContain("password");
    expect(jsonStr).not.toContain("email");
    expect(jsonStr).not.toContain("phone");
    expect(jsonStr).not.toContain("employeeId");
  });
});

