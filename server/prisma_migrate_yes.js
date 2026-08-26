const { spawn } = require("child_process");

const child = spawn("npx.cmd", ["prisma", "migrate", "dev", "--name", "shift_location"], {
  stdio: ["pipe", "pipe", "pipe"],
  shell: true
});

child.stdout.on("data", (data) => {
  const output = data.toString();
  console.log(output);
  if (output.includes("We need to reset the PostgreSQL database")) {
    child.stdin.write("y\n");
  }
  if (output.includes("Are you sure you want to create this migration")) {
    child.stdin.write("y\n");
  }
  if (output.toLowerCase().includes("yes")) {
    child.stdin.write("y\n");
  }
});

child.stderr.on("data", (data) => {
  console.error(data.toString());
});

child.on("close", (code) => {
  console.log(`child process exited with code ${code}`);
});
