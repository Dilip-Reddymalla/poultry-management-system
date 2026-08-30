import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const faceAiDir = path.join(__dirname, "..", "face-ai");

function resolvePythonExecutable() {
  const winVenv = path.join(faceAiDir, ".venv", "Scripts", "python.exe");
  const nixVenv = path.join(faceAiDir, ".venv", "bin", "python");

  if (process.platform === "win32" && fs.existsSync(winVenv)) {
    return winVenv;
  }
  if (fs.existsSync(nixVenv)) {
    return nixVenv;
  }

  // Check known Linux system paths
  const commonSystemPaths = [
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python",
    "/usr/local/bin/python",
  ];

  for (const sysPath of commonSystemPaths) {
    if (fs.existsSync(sysPath)) {
      return sysPath;
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}

const pythonExecutable = resolvePythonExecutable();
console.log(`[Face-AI Launcher] Using Python executable: ${pythonExecutable}`);

const isProd = process.env.NODE_ENV === "production";
const uvicornArgs = ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"];
if (!isProd) {
  uvicornArgs.push("--reload");
}

const child = spawn(pythonExecutable, uvicornArgs, {
  cwd: faceAiDir,
  stdio: "inherit",
  // shell: false avoids Node DeprecationWarning (DEP0190) and security risk
  shell: false,
});

child.on("error", (err) => {
  console.error(`[Face-AI Launcher] ❌ Failed to start Face-AI process (${pythonExecutable}):`, err.message);
  if (err.code === "ENOENT") {
    console.error(`
[Face-AI Launcher] ⚠️ Python is not installed or not in PATH in this environment!
To fix this in your Docker container (Debian / Ubuntu):
  1. Add Python installation to your Dockerfile:
     RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
  2. Install requirements:
     RUN cd /app/server/face-ai && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
`);
  }
});

child.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.warn(`[Face-AI Launcher] Face-AI process exited with code ${code}`);
  }
});
