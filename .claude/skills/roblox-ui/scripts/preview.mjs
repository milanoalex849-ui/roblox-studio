#!/usr/bin/env node
// Renders Roblox UI .model.json files to an HTML preview, plus PNG screenshots when Playwright is available.
// Usage: node preview.mjs <file.model.json>... [--show Name]... [--show-all] [--out .ui-preview]
//        [--sizes phone,tablet,desktop] [--no-png] [--no-chrome] [--labels] [--video]
// Images with an `Asset` attribute render the matching assets/ui/<Asset>.png texture.
// The HTML plays the UIAnimator animations; --video records a short .webm of them (needs Playwright).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readJson, stem } from "./uilib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SIZES = { phone: [844, 390], tablet: [1180, 820], desktop: [1920, 1080] };

// Roblox font family → closest Google Font. `weight` forces a weight for single-weight families.
const FONT_MAP = {
  BuilderSans: { css: "Inter", q: "Inter:wght@100..900" },
  GothamSSm: { css: "Montserrat", q: "Montserrat:wght@100..900" },
  Montserrat: { css: "Montserrat", q: "Montserrat:wght@100..900" },
  FredokaOne: { css: "Fredoka", q: "Fredoka:wght@600", weight: 600 },
  LuckiestGuy: { css: "Luckiest Guy", q: "Luckiest+Guy", weight: 400 },
  Bangers: { css: "Bangers", q: "Bangers", weight: 400 },
  Michroma: { css: "Michroma", q: "Michroma", weight: 400 },
  Oswald: { css: "Oswald", q: "Oswald:wght@200..700" },
  Nunito: { css: "Nunito", q: "Nunito:wght@200..1000" },
  Ubuntu: { css: "Ubuntu", q: "Ubuntu:wght@300;400;500;700" },
  RobotoMono: { css: "Roboto Mono", q: "Roboto+Mono:wght@100..700" },
  Roboto: { css: "Roboto", q: "Roboto:wght@100..900" },
  TitilliumWeb: { css: "Titillium Web", q: "Titillium+Web:wght@200;300;400;600;700;900" },
  PressStart2P: { css: "Press Start 2P", q: "Press+Start+2P", weight: 400 },
  SpecialElite: { css: "Special Elite", q: "Special+Elite", weight: 400 },
  Merriweather: { css: "Merriweather", q: "Merriweather:wght@300..900" },
  SourceSansPro: { css: "Source Sans 3", q: "Source+Sans+3:wght@200..900" },
  Arimo: { css: "Arimo", q: "Arimo:wght@400..700" },
  Jura: { css: "Jura", q: "Jura:wght@300..700" },
  Sarpanch: { css: "Sarpanch", q: "Sarpanch:wght@400;500;600;700;800;900" },
  DenkOne: { css: "Denk One", q: "Denk+One", weight: 400 },
  PermanentMarker: { css: "Permanent Marker", q: "Permanent+Marker", weight: 400 },
  Creepster: { css: "Creepster", q: "Creepster", weight: 400 },
};

const args = process.argv.slice(2);
const opts = { show: [], showAll: false, out: ".ui-preview", sizes: ["phone", "tablet", "desktop"], png: true, chrome: true, labels: false, video: false, animate: true };
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--show") opts.show.push(args[++i]);
  else if (a === "--show-all") opts.showAll = true;
  else if (a === "--out") opts.out = args[++i];
  else if (a === "--sizes") opts.sizes = args[++i].split(",");
  else if (a === "--no-png") opts.png = false;
  else if (a === "--no-chrome") opts.chrome = false;
  else if (a === "--labels") opts.labels = true;
  else if (a === "--video") opts.video = true;
  else files.push(a);
}
if (files.length === 0) {
  console.error("usage: node preview.mjs <file.model.json>... [--show Name] [--show-all] [--no-png]");
  process.exit(2);
}

const runtime = fs.readFileSync(path.join(here, "preview-runtime.js"), "utf8");

// Local textures: assets/ui/<key>.png, found by walking up from the current directory.
function findAssets() {
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "assets", "ui");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
const assetDir = findAssets();
const assets = {};
if (assetDir) {
  for (const f of fs.readdirSync(assetDir)) {
    if (/\.(png|jpe?g)$/i.test(f)) {
      // Inlined as data URIs: Chromium refuses CSS masks from file:// URLs (they count as cross-origin).
      const mime = /\.png$/i.test(f) ? "image/png" : "image/jpeg";
      assets[f.replace(/\.[^.]+$/, "")] = `data:${mime};base64,${fs.readFileSync(path.join(assetDir, f)).toString("base64")}`;
    }
  }
}

function fontsUsed(model) {
  const out = new Set();
  const rec = (n) => {
    const fam = n.properties?.FontFace?.family;
    if (fam) out.add(fam.split("/").pop().replace(".json", ""));
    (n.children ?? []).forEach(rec);
  };
  rec(model);
  return [...out].filter((f) => FONT_MAP[f]);
}

function html(model, name) {
  const fams = fontsUsed(model);
  const link = fams.length
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.map((f) => "family=" + FONT_MAP[f].q).join("&")}&display=block">`
    : "";
  const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} · Roblox UI preview</title>${link}
<style>
  html,body{margin:0;height:100%;overflow:hidden;}
  body{background:
    radial-gradient(ellipse at 50% 120%, #5fae4c 0 35%, transparent 36%),
    linear-gradient(#8fc9ff, #cfe8ff 60%, #77b85f 60.1%, #5d9f48);}
  #stage{position:fixed;inset:0;}
  .rbx{position:absolute;box-sizing:border-box;}
  .txt{position:absolute;display:flex;overflow:visible;pointer-events:none;}
  .txt span{display:block;}
  .img-tex{position:absolute;inset:0;}
  .img-ph,.img-missing{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font:600 10px system-ui;color:rgba(0,0,0,.55);overflow:hidden;}
  .img-ph{background:repeating-linear-gradient(45deg,var(--tint) 0 6px,transparent 6px 12px);opacity:.55;}
  .img-missing{border:1.5px dashed rgba(255,0,140,.85);background:rgba(255,0,140,.12);}
  .chrome{position:absolute;box-sizing:border-box;border:1.5px dashed rgba(255,255,255,.7);
    background:rgba(0,0,0,.12);color:rgba(255,255,255,.85);font:600 11px system-ui;
    display:flex;align-items:flex-start;justify-content:center;padding-top:4px;z-index:0;pointer-events:none;}
</style></head>
<body><div id="stage"></div>
<script>const MODEL=${json(model)};const OPTS=${json({ ...opts, fontMap: FONT_MAP, assets })};
if (location.hash.includes("static")) OPTS.animate = false;</script>
<script>${runtime}</script>
</body></html>`;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    try {
      const root = execSync("npm root -g", { encoding: "utf8" }).trim();
      return createRequire(path.join(root, "noop.js"))("playwright");
    } catch {
      return null;
    }
  }
}

fs.mkdirSync(opts.out, { recursive: true });
const pages = [];
for (const file of files) {
  const name = stem(file);
  const out = path.join(opts.out, `${name}.html`);
  fs.writeFileSync(out, html(readJson(file), name));
  console.log(`html  ${out}  (open in a browser and resize the window to test responsiveness)`);
  pages.push({ name, out });
}

if (opts.png) {
  const pw = await loadPlaywright();
  if (!pw) {
    console.log("Playwright not found: skipped PNG screenshots (install with `npm i -g playwright`).");
  } else {
    const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
    const browser = await pw.chromium.launch(proxy ? { proxy } : {});
    for (const { name, out } of pages) {
      for (const size of opts.sizes) {
        const [w, h] = SIZES[size] ?? size.split("x").map(Number);
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto("file://" + path.resolve(out) + "#static");
        await page.waitForFunction(() => window.__rendered === true, null, { timeout: 15000 });
        await page.waitForTimeout(150);
        const png = path.join(opts.out, `${name}-${size}.png`);
        await page.screenshot({ path: png });
        console.log(`png   ${png}`);
        await page.close();
      }
    }
    if (opts.video) {
      for (const { name, out } of pages) {
        const [w, h] = SIZES.tablet;
        const dir = path.join(opts.out, "video-tmp");
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } } });
        const page = await ctx.newPage();
        await page.goto("file://" + path.resolve(out));
        await page.waitForFunction(() => window.__rendered === true, null, { timeout: 15000 });
        // Demo: hover and press the first animated button, close the window, reopen it.
        const at = async (sel) => (await page.$(sel))?.boundingBox();
        await page.waitForTimeout(1800);
        const fxBox = await at("[data-fx]");
        if (fxBox) {
          await page.mouse.move(fxBox.x + fxBox.width / 2, fxBox.y + fxBox.height / 2, { steps: 8 });
          await page.waitForTimeout(500);
          await page.mouse.down();
          await page.waitForTimeout(180);
          await page.mouse.up();
          await page.waitForTimeout(600);
        }
        const closeBox = await at("[data-closes]");
        if (closeBox) {
          await page.mouse.move(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2, { steps: 8 });
          await page.waitForTimeout(300);
          await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
          await page.waitForTimeout(900);
        }
        const openBox = await at("[data-opens]");
        if (openBox) {
          await page.mouse.move(openBox.x + openBox.width / 2, openBox.y + openBox.height / 2, { steps: 8 });
          await page.mouse.click(openBox.x + openBox.width / 2, openBox.y + openBox.height / 2);
        }
        await page.waitForTimeout(2600);
        const video = page.video();
        await ctx.close();
        const dest = path.join(opts.out, `${name}.webm`);
        fs.renameSync(await video.path(), dest);
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`video ${dest}`);
      }
    }
    await browser.close();
  }
}
