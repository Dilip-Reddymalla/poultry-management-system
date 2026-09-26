import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const faceAiDir = path.join(__dirname, "..", "face-ai");

function setupSystemAndVenv() {
  // 1. On Linux / Docker containers, only run apt-get if python3 or libgl1 is missing
  if (process.platform === "linux") {
    let hasSystemPackages = false;
    try {
      execSync("which python3 && ldconfig -p | grep -q libGL", { stdio: "ignore" });
      hasSystemPackages = true;
    } catch {
      hasSystemPackages = false;
    }

    if (!hasSystemPackages) {
      try {
        console.log(`[Face-AI Setup] 📦 Installing Linux system packages (python3, python3-pip, python3-venv, libgl1, libglib2.0-0)...`);
        execSync(
          `apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv libgl1 libglib2.0-0`,
          { stdio: "inherit" }
        );
      } catch (err) {
        console.warn(`[Face-AI Setup] ⚠️ apt-get notice (non-root or already installed): ${err.message}`);
      }
    } else {
      console.log(`[Face-AI Setup] ✓ Linux system packages already present, skipping apt-get.`);
    }
  }

  // 2. Locate / create .venv
  const winVenv = path.join(faceAiDir, ".venv", "Scripts", "python.exe");
  const nixVenv = path.join(faceAiDir, ".venv", "bin", "python");

  let sysPython = process.platform === "win32" ? "python" : "python3";
  const commonSystemPaths = [
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python",
    "/usr/local/bin/python",
  ];
  for (const sysPath of commonSystemPaths) {
    if (fs.existsSync(sysPath)) {
      sysPython = sysPath;
      break;
    }
  }

  const venvPython = process.platform === "win32" ? winVenv : nixVenv;
  if (!fs.existsSync(venvPython)) {
    try {
      console.log(`[Face-AI Setup] 🐍 Creating virtualenv (.venv) using ${sysPython}...`);
      execSync(`"${sysPython}" -m venv .venv`, { cwd: faceAiDir, stdio: "inherit" });
    } catch (err) {
      console.error(`[Face-AI Setup] ❌ Failed to create virtualenv: ${err.message}`);
    }
  }

  // 3. Check if python dependencies are already installed in .venv
  const venvPip = process.platform === "win32"
    ? path.join(faceAiDir, ".venv", "Scripts", "pip.exe")
    : path.join(faceAiDir, ".venv", "bin", "pip");

  const reqFile = path.join(faceAiDir, "requirements.txt");
  let packagesInstalled = false;
  if (fs.existsSync(venvPython)) {
    try {
      execSync(`"${venvPython}" -c "import fastapi, uvicorn, cv2, onnxruntime, numpy"`, {
        cwd: faceAiDir,
        stdio: "ignore",
      });
      packagesInstalled = true;
    } catch {
      packagesInstalled = false;
    }
  }

  if (!packagesInstalled && fs.existsSync(reqFile) && fs.existsSync(venvPip)) {
    try {
      console.log(`[Face-AI Setup] 📥 Installing python packages from requirements.txt into .venv...`);
      execSync(`"${venvPip}" install -r "${reqFile}"`, { cwd: faceAiDir, stdio: "inherit" });
    } catch (err) {
      console.error(`[Face-AI Setup] ⚠️ Pip install notice: ${err.message}`);
    }
  } else if (packagesInstalled) {
    console.log(`[Face-AI Setup] ✓ Virtualenv packages already installed, skipping pip install.`);
  }

  return fs.existsSync(venvPython) ? venvPython : sysPython;
}

const pythonExecutable = setupSystemAndVenv();
console.log(`[Face-AI Launcher] Using Python executable: ${pythonExecutable}`);

const isProd = process.env.NODE_ENV === "production";
const uvicornArgs = ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"];
if (!isProd) {
  uvicornArgs.push("--reload");
}

const child = spawn(pythonExecutable, uvicornArgs, {
  cwd: faceAiDir,
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    // Limit CPU threads so Face-AI doesn't monopolize container cores and starve Node.js
    OMP_NUM_THREADS: "1",
    OPENBLAS_NUM_THREADS: "1",
    MKL_NUM_THREADS: "1",
    ONNX_NUM_THREADS: "1",
  },
});

child.on("error", (err) => {
  console.error(`[Face-AI Launcher] ❌ Failed to start Face-AI process (${pythonExecutable}):`, err.message);
});

child.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.warn(`[Face-AI Launcher] Face-AI process exited with code ${code}`);
  }
});
