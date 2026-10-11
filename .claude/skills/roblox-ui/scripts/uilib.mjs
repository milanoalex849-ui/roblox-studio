// Shared helpers for the roblox-ui skill scripts (lint, preview, build).
import fs from "node:fs";
import path from "node:path";

export const GUI_OBJECTS = new Set([
  "Frame", "TextLabel", "TextButton", "TextBox", "ImageLabel", "ImageButton",
  "ScrollingFrame", "CanvasGroup", "ViewportFrame", "VideoFrame",
]);
export const TEXT_OBJECTS = new Set(["TextLabel", "TextButton", "TextBox"]);
export const BUTTONS = new Set(["TextButton", "ImageButton"]);
export const LAYOUTS = new Set(["UIListLayout", "UIGridLayout", "UIPageLayout", "UITableLayout"]);
export const SCRIPTS = new Set(["Script", "LocalScript", "ModuleScript"]);

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${file}: ${err.message}`);
  }
}

/** Finds ui/theme.json by walking up from `start`. Returns null when there is none. */
export function findTheme(start = process.cwd(), explicit) {
  if (explicit) return { file: explicit, theme: readJson(explicit) };
  let dir = path.resolve(start);
  for (;;) {
    const candidate = path.join(dir, "ui", "theme.json");
    if (fs.existsSync(candidate)) return { file: candidate, theme: readJson(candidate) };
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Depth-first walk. visit(node, parent, pathString). The root's name is the file stem. */
export function walk(root, rootName, visit) {
  const rec = (node, parent, p) => {
    visit(node, parent, p);
    for (const child of node.children ?? []) rec(child, node, `${p}.${child.name ?? "?"}`);
  };
  rec(root, null, rootName);
}

export const props = (node) => node.properties ?? {};
export const childOfClass = (node, cls) => (node.children ?? []).find((c) => c.className === cls);
export const childrenOfClass = (node, cls) => (node.children ?? []).filter((c) => c.className === cls);

// ---- value decoding --------------------------------------------------------

/** Returns {xs, xo, ys, yo} or null. Accepts {"UDim2": [[xs,xo],[ys,yo]]}. */
export function udim2(v) {
  const a = v && typeof v === "object" && !Array.isArray(v) ? v.UDim2 : null;
  if (!Array.isArray(a) || a.length !== 2) return null;
  return { xs: a[0][0], xo: a[0][1], ys: a[1][0], yo: a[1][1] };
}

/** Returns {s, o} or null. Accepts {"UDim": [s, o]}. */
export function udim(v) {
  const a = v && typeof v === "object" && !Array.isArray(v) ? v.UDim : null;
  if (!Array.isArray(a) || a.length !== 2) return null;
  return { s: a[0], o: a[1] };
}

export function isColor3(v) {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && n >= 0 && n <= 1);
}

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function hexToColor3(hex) {
  return hexToRgb(hex).map((c) => Math.round((c / 255) * 1000) / 1000);
}

export function color3ToHex(c) {
  return "#" + c.map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance(rgb255) {
  const [r, g, b] = rgb255.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(c1, c2) {
  const a = luminance(c1.map((x) => x * 255));
  const b = luminance(c2.map((x) => x * 255));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Every property that holds a Color3 on GUI classes. */
export function colorProps(node) {
  const out = [];
  for (const [k, v] of Object.entries(props(node))) {
    if (k.endsWith("Color3") || (node.className === "UIStroke" && k === "Color")) out.push([k, v]);
  }
  return out;
}

// Instance defaults that matter for linting and preview (from Instance.new).
export function defaultBackground(cls) {
  return ["Frame", "ScrollingFrame", "CanvasGroup", "ViewportFrame"].includes(cls)
    ? [0.639, 0.635, 0.647]
    : [1, 1, 1];
}

export function stem(file) {
  return path.basename(file).replace(/\.model\.json$/, "").replace(/\.json$/, "");
}
