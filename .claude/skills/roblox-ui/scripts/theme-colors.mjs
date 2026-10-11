#!/usr/bin/env node
// Prints the theme's colors as Roblox Color3 JSON arrays, ready to paste into .model.json.
// Usage: node theme-colors.mjs [path/to/theme.json]
import { findTheme, readJson, hexToColor3 } from "./uilib.mjs";

const file = process.argv[2];
const found = file ? { file, theme: readJson(file) } : findTheme();
if (!found) {
  console.error("No ui/theme.json found. Copy one from .claude/skills/roblox-ui/themes/ first.");
  process.exit(1);
}
console.log(`// ${found.theme.style ?? "theme"} (${found.file})`);
const width = Math.max(...Object.keys(found.theme.colors).map((k) => k.length));
for (const [name, hex] of Object.entries(found.theme.colors)) {
  console.log(`${name.padEnd(width)}  ${hex}  ${JSON.stringify(hexToColor3(hex))}`);
}
console.log("\nfonts:");
for (const [role, f] of Object.entries(found.theme.fonts)) {
  console.log(`${role.padEnd(width)}  ${JSON.stringify({ family: f.family, weight: f.weight ?? "Regular", style: "Normal" })}`);
}
