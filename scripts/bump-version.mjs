import { readFileSync, writeFileSync } from "node:fs";

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("Usage: node scripts/bump-version.mjs <new-version>");
  process.exit(1);
}

// 1. Update package.json
const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`Updated ${pkgPath} to ${newVersion}`);

// 2. Update src-tauri/tauri.conf.json
const tauriPath = "src-tauri/tauri.conf.json";
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = newVersion;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n", "utf8");
console.log(`Updated ${tauriPath} to ${newVersion}`);

// 3. Update src-tauri/Cargo.toml
const cargoPath = "src-tauri/Cargo.toml";
let cargo = readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version = "[^"]+"/m, `version = "${newVersion}"`);
writeFileSync(cargoPath, cargo, "utf8");
console.log(`Updated ${cargoPath} to ${newVersion}`);
