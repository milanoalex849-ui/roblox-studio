#!/usr/bin/env node
// Builds each UI model into its own .rbxmx with Rojo, which also validates every property encoding.
// The result can be inserted in Studio with: right-click StarterGui → Insert from File…
// Usage: node build.mjs [files...]
// Default: src/StarterGui/*.model.json and src/StarterPlayerScripts/*.luau → build/<Name>.rbxmx,
// plus build/Place.rbxlx (the whole default.project.json, openable directly in Studio).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { stem } from "./uilib.mjs";

const rojoCheck = spawnSync("rojo", ["--version"], { encoding: "utf8" });
if (rojoCheck.error) {
  console.error("rojo is not installed. Install it (https://rojo.space/docs/v7/getting-started/installation/) or `cargo install rojo`.");
  process.exit(2);
}

let files = process.argv.slice(2);
const buildPlace = files.length === 0 && fs.existsSync("default.project.json");
if (files.length === 0) {
  const list = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f)) : []);
  files = [...list("src/StarterGui", /\.model\.json$/), ...list("src/StarterPlayerScripts", /\.luau?$/)];
}
if (files.length === 0) {
  console.error("No .model.json files to build.");
  process.exit(2);
}

fs.mkdirSync("build", { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "roblox-ui-build-"));
let failed = 0;
for (const file of files) {
  const name = stem(file).replace(/\.(client|server)?\.?luau?$/, "").replace(/\.(client|server)$/, "");
  const project = path.join(tmp, `${name}.project.json`);
  fs.writeFileSync(project, JSON.stringify({ name, tree: { $path: path.resolve(file) } }));
  const out = path.join("build", `${name}.rbxmx`);
  const r = spawnSync("rojo", ["build", project, "--output", out], { encoding: "utf8" });
  if (r.status === 0) {
    console.log(`✔ ${file} → ${out}`);
  } else {
    failed++;
    const msg = (r.stderr || r.stdout).split("\n").filter((l) => l.trim() && !/^\s+\d+:|Stack backtrace/.test(l)).slice(0, 6).join("\n  ");
    console.log(`✖ ${file}\n  ${msg}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (buildPlace) {
  const r = spawnSync("rojo", ["build", "default.project.json", "--output", path.join("build", "Place.rbxlx")], { encoding: "utf8" });
  if (r.status === 0) console.log("✔ default.project.json → build/Place.rbxlx");
  else {
    failed++;
    console.log(`✖ default.project.json\n  ${(r.stderr || r.stdout).split("\n")[0]}`);
  }
}
process.exit(failed ? 1 : 0);
