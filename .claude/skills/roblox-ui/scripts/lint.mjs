#!/usr/bin/env node
// Lints Roblox UI .model.json files against the roblox-ui skill rules and ui/theme.json.
// Usage: node lint.mjs [--theme ui/theme.json] <file.model.json>...
// Exit code 1 when any error is found.
import path from "node:path";
import {
  GUI_OBJECTS, TEXT_OBJECTS, BUTTONS, LAYOUTS, SCRIPTS,
  readJson, findTheme, walk, props, childOfClass, udim2, udim, isColor3,
  hexToColor3, color3ToHex, contrast, colorProps, defaultBackground, stem,
} from "./uilib.mjs";

const args = process.argv.slice(2);
let themeArg;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--theme") themeArg = args[++i];
  else files.push(args[i]);
}
if (files.length === 0) {
  console.error("usage: node lint.mjs [--theme ui/theme.json] <file.model.json>...");
  process.exit(2);
}

const found = findTheme(process.cwd(), themeArg);
const theme = found?.theme;
const palette = theme
  ? Object.entries(theme.colors).map(([name, hex]) => ({ name, c: hexToColor3(hex) }))
  : [];
palette.push({ name: "white", c: [1, 1, 1] });
const fontKeys = new Set(
  theme ? Object.values(theme.fonts).map((f) => `${f.family}|${f.weight ?? "Regular"}`) : [],
);

const UDIM2_KEYS = new Set(["Size", "Position", "CanvasSize", "CellSize", "CellPadding"]);
const UDIM_KEYS = new Set([
  "CornerRadius", "Padding", "PaddingTop", "PaddingBottom", "PaddingLeft", "PaddingRight",
]);

function nearestToken(c) {
  let best = null;
  for (const p of palette) {
    const d = Math.max(...p.c.map((x, i) => Math.abs(x - c[i])));
    if (!best || d < best.d) best = { ...p, d };
  }
  return best;
}

let errorCount = 0;
let warnCount = 0;

for (const file of files) {
  const issues = [];
  const err = (p, msg) => issues.push(["error", p, msg]);
  const warn = (p, msg) => issues.push(["warn", p, msg]);

  let root;
  try {
    root = readJson(file);
  } catch (e) {
    console.log(`✖ ${e.message}`);
    errorCount++;
    continue;
  }
  const rootName = stem(file);
  const textSizes = new Set();
  const families = new Set();
  const parents = new Map();
  const missingImages = new Set();

  if (root.className !== "ScreenGui") err(rootName, `root must be a ScreenGui (got ${root.className})`);
  const rp = props(root);
  if (rp.ResetOnSpawn !== false) err(rootName, "ScreenGui needs ResetOnSpawn: false");
  if (rp.ZIndexBehavior !== "Sibling") err(rootName, 'ScreenGui needs ZIndexBehavior: "Sibling"');
  if (!("IgnoreGuiInset" in rp)) warn(rootName, "set IgnoreGuiInset deliberately (true for full-screen menus, false for HUDs)");

  walk(root, rootName, (node, parent, p) => {
    parents.set(node, parent);
    const cls = node.className;
    const pr = props(node);

    if (!cls) return err(p, "missing className");
    if (SCRIPTS.has(cls)) err(p, `${cls} inside UI. UI files are instances only; behaviour lives elsewhere`);
    if (parent && !node.name) err(p, "child is missing a name");

    // Sibling names
    const names = (node.children ?? []).map((c) => c.name);
    for (const n of new Set(names)) {
      if (names.filter((x) => x === n).length > 1) err(`${p}.${n}`, "duplicate sibling name");
    }

    // Value encodings
    for (const [k, v] of Object.entries(pr)) {
      if (UDIM2_KEYS.has(k) && !udim2(v)) err(p, `${k} must be {"UDim2": [[xScale, xOffset], [yScale, yOffset]]}`);
      if (UDIM_KEYS.has(k) && !udim(v)) err(p, `${k} must be {"UDim": [scale, offset]}`);
      if (k === "Font") err(p, 'legacy "Font" enum; use FontFace from the theme');
    }
    for (const [k, v] of colorProps(node)) {
      if (!isColor3(v)) {
        err(p, `${k} must be [r, g, b] with floats 0-1 (got ${JSON.stringify(v)})`);
        continue;
      }
      if (theme) {
        const t = nearestToken(v);
        if (t.d > 1.5 / 255) err(p, `${k} ${color3ToHex(v)} is not a theme color (nearest: ${t.name})`);
      }
    }

    if (GUI_OBJECTS.has(cls)) {
      if (parent && node.name === cls) err(p, `default name "${cls}"; give it a meaningful PascalCase name`);
      const bgT = pr.BackgroundTransparency ?? 0;
      if (pr.BorderSizePixel !== 0 && bgT < 1) err(p, "BorderSizePixel must be 0 (use UIStroke for borders)");
      const inGrid = parent && childOfClass(parent, "UIGridLayout");
      if (!("Size" in pr) && !inGrid) warn(p, "Size not set; the Roblox default is an arbitrary fixed pixel size");
      if (bgT < 1 && !("BackgroundColor3" in pr)) err(p, "visible background uses the default color; set BackgroundColor3 or BackgroundTransparency 1");
      if (BUTTONS.has(cls) && pr.AutoButtonColor !== false) err(p, "buttons need AutoButtonColor: false");

      const inLayout = parent && (parent.children ?? []).some((c) => LAYOUTS.has(c.className));
      if (inLayout && "Position" in pr) warn(p, "Position is ignored inside a UIListLayout/UIGridLayout");
      if (inLayout && !("LayoutOrder" in pr)) warn(p, "set LayoutOrder (parent has a layout)");

      // Root-level panels must not stretch freely.
      if (parent === root) {
        const s = udim2(pr.Size);
        const constrained = childOfClass(node, "UIAspectRatioConstraint") || childOfClass(node, "UISizeConstraint");
        const fullScreen = s && s.xs === 1 && s.ys === 1;
        if (s && s.xs > 0 && s.ys > 0 && !constrained && !fullScreen && bgT < 1) {
          warn(p, "scale-sized panel without UIAspectRatioConstraint/UISizeConstraint will stretch on wide or tall screens");
        }
        if (s && s.xs === 0 && s.xo > 600) warn(p, `${s.xo}px wide won't fit a phone (~844px); use scale + UISizeConstraint`);
      }

      if (BUTTONS.has(cls) || cls === "TextBox") {
        const s = udim2(pr.Size);
        if (s && s.ys === 0 && s.yo > 0 && s.yo < 36) warn(p, `${s.yo}px tall is a small touch target (aim for ≥ 44)`);
      }
      if ((cls === "ImageLabel" || cls === "ImageButton") && !pr.Image) missingImages.add(node.name);
    }

    if (TEXT_OBJECTS.has(cls)) {
      const ff = pr.FontFace;
      if (!ff) err(p, "text object without FontFace (it would fall back to Source Sans)");
      else {
        families.add(ff.family);
        if (theme && !fontKeys.has(`${ff.family}|${ff.weight ?? "Regular"}`)) {
          err(p, `font ${path.basename(ff.family)} ${ff.weight ?? "Regular"} is not a theme font`);
        }
      }
      if (pr.TextScaled) {
        if (!childOfClass(node, "UITextSizeConstraint")) err(p, "TextScaled without a UITextSizeConstraint child");
      } else {
        const size = pr.TextSize ?? 14;
        textSizes.add(size);
        if (theme?.textSizes && !theme.textSizes.includes(size)) warn(p, `TextSize ${size} is not on the type scale ${JSON.stringify(theme.textSizes)}`);
      }
      if (pr.Text === undefined && cls !== "TextBox") warn(p, 'Text not set (Roblox default is "Label"/"Button")');

      // Contrast against the nearest opaque background (self or ancestor).
      // A dark Contextual UIStroke (the cartoon outlined-text look) carries its own contrast.
      const outlined = (node.children ?? []).some((c) => c.className === "UIStroke"
        && (props(c).ApplyStrokeMode ?? "Contextual") === "Contextual"
        && (props(c).Thickness ?? 1) >= 1.5 && (props(c).Transparency ?? 0) < 0.5);
      const tc = pr.TextColor3;
      if (!outlined && isColor3(tc) && (pr.TextTransparency ?? 0) < 0.5) {
        let bgNode = node;
        while (bgNode && (props(bgNode).BackgroundTransparency ?? (bgNode === root ? 1 : 0)) >= 0.5) bgNode = parents.get(bgNode);
        if (bgNode && bgNode !== root && !childOfClass(bgNode, "UIGradient")) {
          const bg = props(bgNode).BackgroundColor3 ?? defaultBackground(bgNode.className);
          if (isColor3(bg)) {
            const ratio = contrast(tc, bg);
            const big = (pr.TextSize ?? 14) >= 18 || pr.TextScaled;
            const need = big ? 3 : 4.5;
            if (ratio < need) warn(p, `text contrast ${ratio.toFixed(2)}:1 on ${bgNode.name ?? rootName} (need ${need}:1)`);
          }
        }
      }
    }

    if (LAYOUTS.has(cls) && cls !== "UIPageLayout" && pr.SortOrder !== "LayoutOrder") {
      err(p, 'layouts need SortOrder: "LayoutOrder"');
    }

    if (theme) {
      if (cls === "UICorner") {
        const r = udim(pr.CornerRadius);
        if (r && !(r.s === 0.5 && r.o === 0) && !(r.s === 0 && theme.radius.includes(r.o))) {
          warn(p, `corner radius ${JSON.stringify([r.s, r.o])} is off the theme radius scale ${JSON.stringify(theme.radius)} (or pill [0.5, 0])`);
        }
      }
      const spacingKeys = ["PaddingTop", "PaddingBottom", "PaddingLeft", "PaddingRight", "Padding"];
      if (cls === "UIPadding" || cls === "UIListLayout") {
        for (const k of spacingKeys) {
          const u = udim(pr[k]);
          if (u && u.s === 0 && u.o !== 0 && !theme.spacing.includes(u.o)) {
            warn(p, `${k} ${u.o}px is off the spacing scale ${JSON.stringify(theme.spacing)}`);
          }
        }
      }
      if (cls === "UIStroke" && theme.strokes && pr.Thickness !== undefined && !theme.strokes.includes(pr.Thickness)) {
        warn(p, `stroke ${pr.Thickness}px is off the theme stroke scale ${JSON.stringify(theme.strokes)}`);
      }
    }
  });

  if (textSizes.size > 4) warn(rootName, `${textSizes.size} different text sizes (${[...textSizes].sort((a, b) => a - b).join(", ")}); aim for ≤ 3-4 per screen`);
  if (families.size > 2) warn(rootName, `${families.size} font families; keep it to 2`);

  if (missingImages.size) {
    issues.push(["info", rootName, `images without an asset id (tell the user to upload these): ${[...missingImages].join(", ")}`]);
  }

  const e = issues.filter((i) => i[0] === "error").length;
  const w = issues.filter((i) => i[0] === "warn").length;
  errorCount += e;
  warnCount += w;
  console.log(`${e ? "✖" : "✔"} ${file}: ${e} error(s), ${w} warning(s)${found ? "" : " (no ui/theme.json found; theme checks skipped)"}`);
  for (const [level, p, msg] of issues) console.log(`  ${level.padEnd(5)}  ${p}: ${msg}`);
}

if (files.length > 1) console.log(`\n${errorCount} error(s), ${warnCount} warning(s) total`);
process.exit(errorCount ? 1 : 0);
