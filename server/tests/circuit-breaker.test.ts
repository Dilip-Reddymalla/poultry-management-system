import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  faceAiCircuitBreaker,
} from "../src/services/circuit-breaker.js";

describe("CircuitBreaker Class Unit Tests", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: "Test-Service",
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeoutMs: 100, // Short timeout for unit testing
      requestTimeoutMs: 200,
    });
  });

  it("initializes in CLOSED state with 0 failures", () => {
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.isOpen()).toBe(false);
    const metrics = breaker.getMetrics();
    expect(metrics.consecutiveFailures).toBe(0);
    expect(metrics.fallbackMode).toBeNull();
  });

  it("executes successful operations and stays in CLOSED state", async () => {
    const result = await breaker.execute(async () => "hello world");
    expect(result).toBe("hello world");
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.getMetrics().totalSuccesses).toBe(1);
  });

  it("trips OPEN after reaching consecutive failure threshold", async () => {
    const failingAction = async () => {
      throw new Error("Downstream service failure");
    };

    // Failure 1
    await expect(breaker.execute(failingAction)).rejects.toThrow("Downstream service failure");
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.getMetrics().consecutiveFailures).toBe(1);

    // Failure 2
    await expect(breaker.execute(failingAction)).rejects.toThrow("Downstream service failure");
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.getMetrics().consecutiveFailures).toBe(2);

    // Failure 3 (Threshold = 3) -> Trips to OPEN
    await expect(breaker.execute(failingAction)).rejects.toThrow("Downstream service failure");
    expect(breaker.getState()).toBe("OPEN");
    expect(breaker.isOpen()).toBe(true);
    expect(breaker.getMetrics().fallbackMode).toBe("MANUAL_ATTENDANCE");
  });

  it("fails fast in OPEN state without calling the downstream function", async () => {
    breaker.tripOpen("Testing fail-fast");
    expect(breaker.isOpen()).toBe(true);

    let functionCalled = false;
    await expect(
      breaker.execute(async () => {
        functionCalled = true;
        return "should not be called";
      }),
    ).rejects.toThrow(CircuitBreakerOpenError);

    expect(functionCalled).toBe(false);
  });

  it("transitions to HALF_OPEN after resetTimeoutMs and recovers to CLOSED on success", async () => {
    breaker.tripOpen("Testing half-open transition");
    expect(breaker.getState()).toBe("OPEN");

    // Wait for the 100ms reset timeout to elapse
    await new Promise((r) => setTimeout(r, 120));

    expect(breaker.getState()).toBe("HALF_OPEN");

    // First trial success (successThreshold = 2)
    const res1 = await breaker.execute(async () => "success 1");
    expect(res1).toBe("success 1");
    expect(breaker.getState()).toBe("HALF_OPEN");

    // Second trial success -> Trips back to CLOSED
    const res2 = await breaker.execute(async () => "success 2");
    expect(res2).toBe("success 2");
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.isOpen()).toBe(false);
    expect(breaker.getMetrics().fallbackMode).toBeNull();
  });

  it("re-trips to OPEN if a trial fails in HALF_OPEN state", async () => {
    breaker.tripOpen("Testing half-open re-trip");
    await new Promise((r) => setTimeout(r, 120));
    expect(breaker.getState()).toBe("HALF_OPEN");

    await expect(
      breaker.execute(async () => {
        throw new Error("Probe failed");
      }),
    ).rejects.toThrow("Probe failed");

    expect(breaker.getState()).toBe("OPEN");
    expect(breaker.isOpen()).toBe(true);
  });

  it("probeHealth recovers circuit from OPEN state when health check succeeds", async () => {
    let mockHealthy = false;
    const probeBreaker = new CircuitBreaker({
      name: "Probe-Test",
      failureThreshold: 2,
      resetTimeoutMs: 500,
      healthCheckFn: async () => mockHealthy,
    });

    probeBreaker.tripOpen("Testing health probe");
    expect(probeBreaker.isOpen()).toBe(true);

    // Unhealthy probe does not close circuit
    const probe1 = await probeBreaker.probeHealth();
    expect(probe1).toBe(false);
    expect(probeBreaker.isOpen()).toBe(true);

    // Healthy probe restores circuit to CLOSED
    mockHealthy = true;
    const probe2 = await probeBreaker.probeHealth();
    expect(probe2).toBe(true);
    expect(probeBreaker.getState()).toBe("CLOSED");
    expect(probeBreaker.isOpen()).toBe(false);
  });
});

describe("Face AI Endpoints with Circuit Breaker & Fall-Open", () => {
  beforeEach(() => {
    faceAiCircuitBreaker.reset();
  });

  it("GET /api/face-ai/health reports circuit breaker metrics and serviceStatus", async () => {
    const { app } = await import("./helpers.js");
    const res = await request(app).get("/api/face-ai/health");

    expect(res.body.circuitBreaker).toBeDefined();
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.serviceStatus).toBe("online");
    } else {
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.serviceStatus).toBe("offline");
      expect(res.body.fallbackMode).toBe("MANUAL_ATTENDANCE");
      expect(res.body.circuitBreaker.state).toBe("OPEN");
    }
  });

  it("POST /api/face-ai/analyze fails fast with 503 and fallbackMode when circuit is OPEN", async () => {
    faceAiCircuitBreaker.tripOpen("Simulated test outage");

    const { app } = await import("./helpers.js");
    const res = await request(app)
      .post("/api/face-ai/analyze")
      .attach("image", Buffer.from("fake-image-bytes"), "test.jpg");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.fallbackMode).toBe("MANUAL_ATTENDANCE");
    expect(res.body.code).toBe("FACE_AI_CIRCUIT_OPEN");
    expect(res.body.circuitBreaker.state).toBe("OPEN");
  });

  it("POST /api/attendance/face/process-frame fails fast with 503 and fallbackMode when circuit is OPEN", async () => {
    faceAiCircuitBreaker.tripOpen("FastAPI service crash simulation");

    const { app, loginSystemAdmin } = await import("./helpers.js");
    const cookie = await loginSystemAdmin();
    const res = await request(app)
      .post("/api/attendance/face/process-frame")
      .set("Cookie", cookie)
      .send({ farmId: "any-farm-id" });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("FACE_AI_UNAVAILABLE");
    expect(res.body.code).toBe("FACE_AI_CIRCUIT_OPEN");
    expect(res.body.fallbackMode).toBe("MANUAL_ATTENDANCE");
    expect(res.body.manualAttendanceUrl).toBe("/attendance");
    expect(res.body.circuitBreaker.state).toBe("OPEN");
  });
});
