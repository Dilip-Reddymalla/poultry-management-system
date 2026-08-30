import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const faceAiDir = path.join(__dirname, "..", "face-ai");

let pythonExecutable = "python";

const winVenv = path.join(faceAiDir, ".venv", "Scripts", "python.exe");
const nixVenv = path.join(faceAiDir, ".venv", "bin", "python");

if (process.platform === "win32" && fs.existsSync(winVenv)) {
  pythonExecutable = winVenv;
} else if (fs.existsSync(nixVenv)) {
  pythonExecutable = nixVenv;
} else {
  pythonExecutable = process.platform === "win32" ? "python" : "python3";
}

console.log(`[Face-AI Launcher] Using Python: ${pythonExecutable}`);

const child = spawn(
  pythonExecutable,
  ["-m", "uvicorn", "app.main:app", "--port", "8000", "--reload"],
  {
    cwd: faceAiDir,
    stdio: "inherit",
    shell: true,
  },
);

child.on("error", (err) => {
  console.error(`[Face-AI Launcher] Failed to start Face-AI: ${err.message}`);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
