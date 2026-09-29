/**
 * Face-AI Python Process Manager
 *
 * Manages the lifecycle of the uvicorn Python process from within Express.
 * This allows the Node.js server to restart the Face-AI service on-demand
 * (e.g., when the health endpoint detects it is unreachable).
 *
 * NOTE: The primary launcher (scripts/start-face-ai.js) still owns the initial
 * startup when using `npm run dev` / `npm start`.  During a restart, this
 * manager kills the externally-launched process (found by port scan) and spawns
 * a fresh one it controls itself.
 */

import { spawn, execSync, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const faceAiDir = path.join(__dirname, "..", "..", "face-ai");

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let managedChild: ChildProcess | null = null;
let isRestarting = false;
let lastRestartAt: number | null = null;
const RESTART_COOLDOWN_MS = 15_000; // Prevent restart storms — max 1 restart per 15s

// ---------------------------------------------------------------------------
// Python executable discovery
// ---------------------------------------------------------------------------

function resolvePythonExecutable(): string {
  const winVenv = path.join(faceAiDir, ".venv", "Scripts", "python.exe");
  const nixVenv = path.join(faceAiDir, ".venv", "bin", "python");
  const venvPython = process.platform === "win32" ? winVenv : nixVenv;

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  const systemPaths =
    process.platform === "win32"
      ? ["python", "python3"]
      : ["/usr/bin/python3", "/usr/local/bin/python3", "/usr/bin/python", "python3", "python"];

  for (const p of systemPaths) {
    if (p.startsWith("/")) {
      if (fs.existsSync(p)) return p;
    } else {
      try {
        execSync(`${p} --version`, { stdio: "ignore" });
        return p;
      } catch {
        // not found on PATH
      }
    }
  }

  return "python";
}

// ---------------------------------------------------------------------------
// Kill any existing process on port 8000
// ---------------------------------------------------------------------------

async function killProcessOnPort8000(): Promise<void> {
  try {
    if (process.platform === "win32") {
      const output = execSync("netstat -ano | findstr :8000", { encoding: "utf8" }).trim();
      const lines = output.split(/\r?\n/);
      const pids = new Set<string>();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          logger.info({ pid }, "[Face-AI Manager] Killed process on port 8000");
        } catch { /* Already gone */ }
      }
    } else {
      try {
        execSync("fuser -k 8000/tcp", { stdio: "ignore" });
      } catch {
        try {
          const pid = execSync("lsof -ti:8000", { encoding: "utf8" }).trim();
          if (pid) execSync(`kill -9 ${pid}`, { stdio: "ignore" });
        } catch { /* Port already free */ }
      }
    }
  } catch { /* Best-effort */ }

  // Also kill the process we manage
  if (managedChild) {
    try { managedChild.kill("SIGTERM"); } catch { /* Already dead */ }
    managedChild = null;
  }
}

// ---------------------------------------------------------------------------
// Spawn a fresh uvicorn process
// ---------------------------------------------------------------------------

function spawnPython(): ChildProcess {
  const pythonExecutable = resolvePythonExecutable();
  const isProd = env.NODE_ENV === "production";
  const uvicornArgs = ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"];
  if (!isProd) uvicornArgs.push("--reload");

  logger.info(
    { pythonExecutable, cwd: faceAiDir },
    "[Face-AI Manager] 🚀 Spawning Face-AI Python process",
  );

  const proc = spawn(pythonExecutable, uvicornArgs, {
    cwd: faceAiDir,
    stdio: "pipe",
    shell: false,
    env: {
      ...process.env,
      OMP_NUM_THREADS: "1",
      OPENBLAS_NUM_THREADS: "1",
      MKL_NUM_THREADS: "1",
      ONNX_NUM_THREADS: "1",
    },
  });

  proc.stdout?.on("data", (d: Buffer) => process.stdout.write(`[Face-AI] ${d}`));
  proc.stderr?.on("data", (d: Buffer) => process.stderr.write(`[Face-AI] ${d}`));

  proc.on("error", (err: Error) => {
    logger.error({ message: err.message }, "[Face-AI Manager] ❌ Process error");
    managedChild = null;
  });

  proc.on("exit", (code: number | null, signal: string | null) => {
    logger.warn({ code, signal }, "[Face-AI Manager] Process exited");
    managedChild = null;
  });

  managedChild = proc;
  return proc;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Whether a restart is currently in progress. */
export function isFaceAiRestarting(): boolean {
  return isRestarting;
}

/** Timestamp (epoch ms) of the last restart, or null if never restarted. */
export function getLastRestartTime(): number | null {
  return lastRestartAt;
}

/**
 * Trigger a controlled restart of the Face-AI Python process.
 *
 * - Respects a 15-second cooldown between restarts to prevent restart storms.
 * - Kills any existing process on port 8000 (both managed and externally-launched).
 * - Spawns a fresh uvicorn process that this service manages going forward.
 *
 * @returns `"started"` if initiated, `"cooldown"` if cooling down, `"busy"` if already restarting.
 */
export async function triggerFaceAiRestart(): Promise<"started" | "cooldown" | "busy"> {
  if (isRestarting) {
    logger.warn("[Face-AI Manager] ⏳ Restart already in progress.");
    return "busy";
  }

  if (lastRestartAt !== null && Date.now() - lastRestartAt < RESTART_COOLDOWN_MS) {
    const remaining = RESTART_COOLDOWN_MS - (Date.now() - lastRestartAt);
    logger.warn({ remainingMs: remaining }, "[Face-AI Manager] ⏳ Restart cooldown active.");
    return "cooldown";
  }

  isRestarting = true;
  lastRestartAt = Date.now();

  try {
    logger.info("[Face-AI Manager] 🔄 Initiating Face-AI Python process restart…");

    await killProcessOnPort8000();

    // Brief delay so the OS releases port 8000 before rebinding
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    spawnPython();

    logger.info(`[Face-AI Manager] ✅ Face-AI process restarted (PID: ${managedChild?.pid ?? "unknown"})`);
    return "started";
  } finally {
    isRestarting = false;
  }
}
