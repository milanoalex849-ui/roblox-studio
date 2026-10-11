#!/usr/bin/env node
// Formats .model.json files compactly: small values ({"UDim2": [[0.5, 0], [0, 40]]}, colors, short
// property objects) stay on one line, so a UI file reads like the Explorer tree instead of 4000 lines.
// Usage: node format.mjs <file.model.json>...   (rewrites in place)
import fs from "node:fs";

const INLINE_WIDTH = 150;

function oneLine(value) {
  if (Array.isArray(value)) return `[${value.map(oneLine).join(", ")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${oneLine(v)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

function fmt(value, indent) {
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const inline = oneLine(value);
  if (inline.length + indent.length <= INLINE_WIDTH && !("children" in value)) return inline;
  const inner = indent + "  ";
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => inner + fmt(v, inner)).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${fmt(v, inner)}`);
  return `{\n${entries.join(",\n")}\n${indent}}`;
}

for (const file of process.argv.slice(2)) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, fmt(data, "") + "\n");
  console.log(`formatted ${file}`);
}
