import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargoToml.match(/^version = "([^"]+)"/m)?.[1];
const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim().replace(/^v/, "");

const versions = {
  "package.json": packageJson.version,
  "src-tauri/tauri.conf.json": tauriConfig.version,
  "src-tauri/Cargo.toml": cargoVersion,
  "latest git tag": tag,
};

const expected = packageJson.version;
const mismatches = Object.entries(versions).filter(([, version]) => version !== expected);

if (mismatches.length > 0) {
  console.error("Version mismatch:");
  Object.entries(versions).forEach(([source, version]) => {
    console.error(`  ${source}: ${version}`);
  });
  process.exit(1);
}

console.log(`Version OK: ${expected}`);
