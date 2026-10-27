import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Builds the FastAPI backend with PyInstaller in --onedir mode and places the
// resulting folder under src-tauri/resources/backend, which tauri.conf.json
// ships as a bundle resource. A directory bundle starts immediately; the
// previous single-file build unpacked ~30 MB to a temp directory on every
// launch before the server could bind its port.
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
    "--onedir",
    "--name", "devpilot-backend",
    "desktop_entry.py",
  ],
  backendDir,
);

const source = join(backendDir, "dist", "devpilot-backend");
const executable = join(source, `devpilot-backend${process.platform === "win32" ? ".exe" : ""}`);
if (!existsSync(executable)) throw new Error(`PyInstaller did not produce ${executable}`);

const destination = join(frontendDir, "src-tauri", "resources", "backend");
rmSync(destination, { recursive: true, force: true });
mkdirSync(dirname(destination), { recursive: true });
cpSync(source, destination, { recursive: true });
console.log(`Prepared backend bundle: ${destination}`);
