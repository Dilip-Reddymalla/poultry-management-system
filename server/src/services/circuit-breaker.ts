import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  name?: string;
  failureThreshold?: number; // Number of consecutive failures before opening (default: 3)
  successThreshold?: number; // Number of consecutive successes in HALF_OPEN before closing (default: 2)
  resetTimeoutMs?: number;   // Time to wait before entering HALF_OPEN trial state (default: 15,000ms)
  requestTimeoutMs?: number; // Timeout per outbound call (default: 5,000ms)
  healthCheckFn?: (() => Promise<boolean>) | undefined;
}

export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  lastStateChangeTime: number;
  lastError: string | null;
  fallbackMode: "MANUAL_ATTENDANCE" | null;
  nextAttemptInMs: number;
}

export class CircuitBreakerOpenError extends AppError {
  public readonly fallbackMode: "MANUAL_ATTENDANCE" = "MANUAL_ATTENDANCE";

  constructor(
    message: string = "Face AI service is unavailable (circuit breaker OPEN). Switched to manual attendance mode.",
    details?: Record<string, any>,
  ) {
    super(
      message,
      503,
      {
        error: "FACE_AI_UNAVAILABLE",
        fallbackMode: "MANUAL_ATTENDANCE",
        manualAttendanceUrl: "/attendance",
        ...details,
      },
      "FACE_AI_CIRCUIT_OPEN",
    );
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly healthCheckFn?: (() => Promise<boolean>) | undefined;

  private state: CircuitBreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private lastStateChangeTime: number = Date.now();
  private lastError: string | null = null;
  private probeActive = false;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name ?? "CircuitBreaker";
    this.failureThreshold = options.failureThreshold ?? 3;
    this.successThreshold = options.successThreshold ?? 2;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 15000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000;
    if (options.healthCheckFn !== undefined) {
      this.healthCheckFn = options.healthCheckFn;
    }
  }

  /**
   * Current circuit state ("CLOSED" | "OPEN" | "HALF_OPEN").
   * Automatically transitions from OPEN to HALF_OPEN if the reset timeout has elapsed.
   */
  public getState(): CircuitBreakerState {
    if (this.state === "OPEN" && this.lastFailureTime !== null) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.transitionTo("HALF_OPEN", "Reset timeout elapsed; attempting trial request");
      }
    }
    return this.state;
  }

  /**
   * Returns true if the circuit is currently blocking requests.
   */
  public isOpen(): boolean {
    return this.getState() === "OPEN";
  }

  /**
   * Execute an asynchronous action through the circuit breaker.
   * If OPEN, fails immediately without calling the action (fail-fast / fail-open).
   */
  public async execute<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.totalRequests++;
    const currentState = this.getState();

    if (currentState === "OPEN") {
      const elapsed = this.lastFailureTime ? Date.now() - this.lastFailureTime : 0;
      const nextAttemptInMs = Math.max(0, this.resetTimeoutMs - elapsed);

      logger.warn(
        {
          name: this.name,
          state: this.state,
          consecutiveFailures: this.consecutiveFailures,
          nextAttemptInMs,
        },
        `[CircuitBreaker] ⛔ Call blocked (Circuit is OPEN). Failing open to manual attendance mode.`,
      );

      throw new CircuitBreakerOpenError(
        `${this.name} service is temporarily unavailable (circuit breaker OPEN). Please use manual attendance mode.`,
        {
          circuitBreaker: {
            state: this.state,
            consecutiveFailures: this.consecutiveFailures,
            nextAttemptInMs,
          },
        },
      );
    }

    // In HALF_OPEN mode, only allow one probe at a time to test service stability
    if (currentState === "HALF_OPEN" && this.probeActive) {
      throw new CircuitBreakerOpenError(
        `${this.name} service is recovering (HALF_OPEN trial in progress). Please wait a moment or use manual attendance mode.`,
        {
          circuitBreaker: {
            state: this.state,
            recovering: true,
          },
        },
      );
    }

    if (currentState === "HALF_OPEN") {
      this.probeActive = true;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Operation timed out after ${this.requestTimeoutMs}ms`));
    }, this.requestTimeoutMs);

    try {
      const result = await action(controller.signal);
      clearTimeout(timeoutId);
      this.onSuccess();
      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.onFailure(err);
      throw err;
    } finally {
      if (currentState === "HALF_OPEN") {
        this.probeActive = false;
      }
    }
  }

  /**
   * Actively probe the health endpoint of the downstream service.
   * If healthy, transitions HALF_OPEN/OPEN back to CLOSED.
   */
  public async probeHealth(): Promise<boolean> {
    if (!this.healthCheckFn) return false;

    try {
      const isHealthy = await this.healthCheckFn();
      if (isHealthy) {
        if (this.state !== "CLOSED") {
          logger.info(
            { name: this.name, prevState: this.state },
            `[CircuitBreaker] ✅ Active health probe succeeded. Restoring circuit to CLOSED.`,
          );
          this.transitionTo("CLOSED", "Health probe succeeded");
          this.consecutiveFailures = 0;
          this.consecutiveSuccesses = 0;
          this.lastSuccessTime = Date.now();
        }
        return true;
      } else {
        this.onFailure(new Error("Health check returned false/unhealthy"));
        return false;
      }
    } catch (err: any) {
      this.onFailure(err);
      return false;
    }
  }

  /**
   * Force the circuit into OPEN state (useful for administrative or graceful degradation testing).
   */
  public tripOpen(reason: string = "Manual override"): void {
    this.consecutiveFailures = this.failureThreshold;
    this.lastFailureTime = Date.now();
    this.transitionTo("OPEN", reason);
  }

  /**
   * Reset the circuit to CLOSED state.
   */
  public reset(): void {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastError = null;
    this.transitionTo("CLOSED", "Manual reset");
  }

  /**
   * Inspect current operational metrics.
   */
  public getMetrics(): CircuitBreakerMetrics {
    const currentState = this.getState();
    const elapsed = this.lastFailureTime ? Date.now() - this.lastFailureTime : 0;
    const nextAttemptInMs =
      currentState === "OPEN" ? Math.max(0, this.resetTimeoutMs - elapsed) : 0;

    return {
      name: this.name,
      state: currentState,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChangeTime: this.lastStateChangeTime,
      lastError: this.lastError,
      fallbackMode: currentState !== "CLOSED" ? "MANUAL_ATTENDANCE" : null,
      nextAttemptInMs,
    };
  }

  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.consecutiveSuccesses++;
      logger.info(
        {
          name: this.name,
          consecutiveSuccesses: this.consecutiveSuccesses,
          threshold: this.successThreshold,
        },
        `[CircuitBreaker] 🧪 HALF_OPEN trial request succeeded`,
      );

      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.transitionTo("CLOSED", "Consecutive trial successes reached threshold");
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
      }
    } else if (this.state === "CLOSED") {
      this.consecutiveFailures = 0;
    }
  }

  private onFailure(err: any): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.lastError = err?.message || String(err);

    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN", `Trial request failed: ${this.lastError}`);
      this.consecutiveSuccesses = 0;
    } else if (this.state === "CLOSED") {
      this.consecutiveFailures++;
      logger.warn(
        {
          name: this.name,
          consecutiveFailures: this.consecutiveFailures,
          failureThreshold: this.failureThreshold,
          error: this.lastError,
        },
        `[CircuitBreaker] ⚠️ Downstream request failed`,
      );

      if (this.consecutiveFailures >= this.failureThreshold) {
        this.transitionTo(
          "OPEN",
          `Failure threshold (${this.failureThreshold}) reached: ${this.lastError}`,
        );
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState, reason: string): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeTime = Date.now();

    logger.warn(
      {
        name: this.name,
        from: oldState,
        to: newState,
        reason,
        fallbackMode: newState !== "CLOSED" ? "MANUAL_ATTENDANCE" : "NONE",
      },
      `[CircuitBreaker] 🔄 State transition: ${oldState} -> ${newState} (${reason})`,
    );
  }
}

/**
 * Singleton instance for Face AI FastAPI microservice
 */
export const faceAiCircuitBreaker = new CircuitBreaker({
  name: "Face-AI",
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeoutMs: 15000,
  requestTimeoutMs: 5000,
  healthCheckFn: async () => {
    try {
      const res = await fetch(`${env.FASTAPI_AI_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
});
