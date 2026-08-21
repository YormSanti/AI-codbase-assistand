import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = resolve(frontendDir, "../backend");
const venvPython = join(backendDir, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.PYTHON || (existsSync(venvPython) ? venvPython : process.platform === "win32" ? "python" : "python3");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${details}`);
  }
  return result.stdout.trim();
}

let targetTriple;
try {
  const rustVersion = run("rustc", ["-vV"], frontendDir);
  targetTriple = rustVersion.match(/^host: (.+)$/m)?.[1];
} catch (error) {
  throw new Error("Rust is required to prepare the Tauri sidecar. Install it from https://rustup.rs/", { cause: error });
}

if (!targetTriple) throw new Error("Could not determine the Rust host target triple.");

try {
  run(python, ["-m", "PyInstaller", "--version"], backendDir);
} catch (error) {
  throw new Error(
    `PyInstaller is missing. Run: ${python} -m pip install -r backend/requirements-desktop.txt`,
    { cause: error },
  );
}

run(
  python,
  [
    "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--name", "devpilot-backend",
    "desktop_entry.py",
  ],
  backendDir,
);

const executableSuffix = process.platform === "win32" ? ".exe" : "";
const source = join(backendDir, "dist", `devpilot-backend${executableSuffix}`);
const destinationDir = join(frontendDir, "src-tauri", "binaries");
const destination = join(destinationDir, `devpilot-backend-${targetTriple}${executableSuffix}`);
mkdirSync(destinationDir, { recursive: true });
copyFileSync(source, destination);
console.log(`Prepared backend sidecar: ${destination}`);
