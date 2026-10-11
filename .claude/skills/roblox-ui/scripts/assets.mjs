#!/usr/bin/env node
// Syncs uploaded texture ids into the UI files.
//   1. Textures live in assets/ui/<key>.png. Every ImageLabel/ImageButton that should show one has
//      the attribute  "Asset": "<key>".
//   2. The user uploads each PNG in Studio (Asset Manager → Bulk Import, or Creator Hub) and pastes
//      the id into ui/assets.json:  { "<key>": "rbxassetid://1234567890" }.
//   3. This script writes those ids into the Image property of every matching instance.
// Usage: node assets.mjs [files...]   (default: src/StarterGui/*.model.json)
import fs from "node:fs";
import path from "node:path";
import { readJson, walk, stem } from "./uilib.mjs";
import { formatJson } from "./format.mjs";

const mapFile = path.join("ui", "assets.json");
const map = fs.existsSync(mapFile) ? readJson(mapFile) : {};

// Make sure every local texture has an entry, so the user sees what to fill in.
let added = 0;
if (fs.existsSync("assets/ui")) {
  for (const f of fs.readdirSync("assets/ui")) {
    const key = f.replace(/\.[^.]+$/, "");
    if (/\.(png|jpe?g)$/i.test(f) && !(key in map)) {
      map[key] = "";
      added++;
    }
  }
}
if (added) {
  fs.mkdirSync("ui", { recursive: true });
  fs.writeFileSync(mapFile, JSON.stringify(map, null, 2) + "\n");
  console.log(`added ${added} new key(s) to ${mapFile}`);
}

let files = process.argv.slice(2);
if (files.length === 0 && fs.existsSync("src/StarterGui")) {
  files = fs.readdirSync("src/StarterGui").filter((f) => f.endsWith(".model.json")).map((f) => path.join("src/StarterGui", f));
}

const missing = new Set();
const unknown = new Set();
for (const file of files) {
  const root = readJson(file);
  let changed = 0;
  walk(root, stem(file), (node) => {
    const key = node.attributes?.Asset;
    if (!key) return;
    if (!(key in map)) return unknown.add(key);
    const id = map[key];
    if (!id) return missing.add(key);
    node.properties ??= {};
    if (node.properties.Image !== id) {
      node.properties.Image = id;
      changed++;
    }
  });
  if (changed) fs.writeFileSync(file, formatJson(root));
  console.log(`${file}: ${changed} image(s) updated`);
}
if (unknown.size) console.log(`unknown Asset keys (no assets/ui/<key>.png and no ui/assets.json entry): ${[...unknown].join(", ")}`);
if (missing.size) console.log(`not uploaded yet (fill these in ${mapFile}): ${[...missing].join(", ")}`);
process.exit(unknown.size ? 1 : 0);
