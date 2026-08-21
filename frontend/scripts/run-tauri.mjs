import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cargoHome = process.env.CARGO_HOME || join(homedir(), ".cargo");
const cargoBin = join(cargoHome, "bin");
const tauri = join(
  frontendDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri",
);

const env = {
  ...process.env,
  PATH: [cargoBin, process.env.PATH].filter(Boolean).join(delimiter),
};

const result = spawnSync(tauri, process.argv.slice(2), {
  cwd: frontendDir,
  env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Unable to start Tauri: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
