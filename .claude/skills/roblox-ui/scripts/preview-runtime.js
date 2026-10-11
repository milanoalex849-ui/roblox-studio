// Browser-side renderer for Roblox UI .model.json trees. Inlined into the preview HTML by preview.mjs.
// It approximates the Roblox layout engine: UDim2 sizing/positioning, AnchorPoint, UIPadding,
// UIListLayout, UIGridLayout, UIAspectRatioConstraint, UISizeConstraint, AutomaticSize,
// UICorner, UIStroke, UIGradient, UIScale, TextScaled and ZIndexBehavior.Sibling.
/* global MODEL, OPTS */
(function () {
  const GUI = new Set(["Frame", "TextLabel", "TextButton", "TextBox", "ImageLabel", "ImageButton",
    "ScrollingFrame", "CanvasGroup", "ViewportFrame", "VideoFrame"]);
  const TEXT = new Set(["TextLabel", "TextButton", "TextBox"]);
  const IMAGE = new Set(["ImageLabel", "ImageButton"]);
  const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Heavy: 900 };
  const FONT_MAP = OPTS.fontMap;

  const P = (n) => n.properties || {};
  const kids = (n) => n.children || [];
  const mod = (n, cls) => kids(n).find((c) => c.className === cls);
  const u2 = (v, d) => (v && v.UDim2 ? { xs: v.UDim2[0][0], xo: v.UDim2[0][1], ys: v.UDim2[1][0], yo: v.UDim2[1][1] } : d);
  const u1 = (v, d) => (v && v.UDim ? { s: v.UDim[0], o: v.UDim[1] } : d);
  const rgba = (c, t = 0) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${(1 - t).toFixed(3)})`;
  const defaultBg = (cls) => (["Frame", "ScrollingFrame", "CanvasGroup", "ViewportFrame"].includes(cls) ? [0.639, 0.635, 0.647] : [1, 1, 1]);
  const DEFAULT_SIZE = { Frame: [100, 100], TextLabel: [200, 50], TextButton: [200, 50], TextBox: [200, 50], ImageLabel: [100, 100], ImageButton: [100, 100], ScrollingFrame: [100, 100] };

  function visible(n) {
    if (P(n).Visible !== false) return true;
    return OPTS.showAll || OPTS.show.includes(n.name);
  }

  function fontCss(ff) {
    const fam = ff && ff.family ? ff.family.split("/").pop().replace(".json", "") : "SourceSansPro";
    const m = FONT_MAP[fam] || { css: "sans-serif" };
    const weight = m.weight || WEIGHTS[(ff && ff.weight) || "Regular"] || 400;
    const style = ff && ff.style === "Italic" ? "italic" : "normal";
    return { family: `'${m.css}', system-ui, sans-serif`, weight, style };
  }

  // ---- measurement (for AutomaticSize and TextScaled) ----
  const meas = document.createElement("span");
  meas.style.cssText = "position:absolute;visibility:hidden;left:-99999px;top:0;white-space:pre;";
  document.body.appendChild(meas);
  function measureText(n, size, maxWidth) {
    const p = P(n);
    const f = fontCss(p.FontFace);
    meas.style.fontFamily = f.family;
    meas.style.fontWeight = f.weight;
    meas.style.fontStyle = f.style;
    meas.style.fontSize = size + "px";
    meas.style.lineHeight = (p.LineHeight || 1) * 1.15 + "";
    meas.style.whiteSpace = maxWidth ? "pre-wrap" : "pre";
    meas.style.width = maxWidth ? maxWidth + "px" : "auto";
    if (p.RichText) meas.innerHTML = richToHtml(p.Text ?? defaultText(n));
    else meas.textContent = p.Text ?? defaultText(n);
    return { w: meas.offsetWidth, h: meas.offsetHeight };
  }
  function defaultText(n) {
    return n.className === "TextButton" ? "Button" : n.className === "TextLabel" ? "Label" : "";
  }
  function richToHtml(s) {
    return String(s).replace(/<(\/?)(stroke|uc|uppercase|sc|smallcaps|mark)[^>]*>/g, "").replace(/\n/g, "<br/>");
  }

  // ---- layout ----
  // build(node, parentContentW, parentContentH) → { node, w, h, kids: [{ b, x, y }], pad }
  function build(n, pw, ph) {
    const p = P(n);
    const ds = DEFAULT_SIZE[n.className] || [0, 0];
    const s = u2(p.Size, { xs: 0, xo: ds[0], ys: 0, yo: ds[1] });
    let w = s.xs * pw + s.xo;
    let h = s.ys * ph + s.yo;

    const ar = mod(n, "UIAspectRatioConstraint");
    if (ar) {
      const ap = P(ar);
      const ratio = ap.AspectRatio ?? 1;
      const type = ap.AspectType || "FitWithinMaxSize";
      const dom = ap.DominantAxis || "Width";
      if (type === "ScaleWithParentSize") {
        if (dom === "Width") h = w / ratio; else w = h * ratio;
      } else if (w / h > ratio) w = h * ratio; else h = w / ratio;
    }
    const sc = mod(n, "UISizeConstraint");
    if (sc) {
      const min = P(sc).MinSize || [0, 0];
      const max = P(sc).MaxSize || [Infinity, Infinity];
      w = Math.min(Math.max(w, min[0]), max[0]);
      h = Math.min(Math.max(h, min[1]), max[1]);
    }

    const b = { node: n, w, h, kids: [] };
    layoutChildren(b);

    // AutomaticSize: grow to fit children / text.
    const auto = p.AutomaticSize || "None";
    if (auto !== "None") {
      let needW = 0, needH = 0;
      for (const k of b.kids) {
        needW = Math.max(needW, k.x + k.b.w + b.pad.r);
        needH = Math.max(needH, k.y + k.b.h + b.pad.b);
      }
      if (TEXT.has(n.className)) {
        const wrapW = auto === "Y" && (p.TextWrapped || p.TextScaled) ? b.w - b.pad.l - b.pad.r : 0;
        const m = measureText(n, p.TextSize ?? 14, wrapW);
        needW = Math.max(needW, m.w + b.pad.l + b.pad.r);
        needH = Math.max(needH, m.h + b.pad.t + b.pad.b);
      }
      const nw = auto.includes("X") ? Math.max(b.w, needW) : b.w;
      const nh = auto.includes("Y") ? Math.max(b.h, needH) : b.h;
      if (nw !== b.w || nh !== b.h) {
        b.w = nw; b.h = nh;
        placeChildren(b);
      }
    }
    return b;
  }

  function layoutChildren(b) {
    const n = b.node;
    const pad = mod(n, "UIPadding");
    const pp = pad ? P(pad) : {};
    const px = (k, base) => { const u = u1(pp[k], { s: 0, o: 0 }); return u.s * base + u.o; };
    b.pad = { l: px("PaddingLeft", b.w), r: px("PaddingRight", b.w), t: px("PaddingTop", b.h), b: px("PaddingBottom", b.h) };
    const cw = Math.max(0, b.w - b.pad.l - b.pad.r);
    const ch = Math.max(0, b.h - b.pad.t - b.pad.b);
    b.kids = kids(n).filter((c) => GUI.has(c.className) && visible(c)).map((c) => ({ b: build(c, cw, ch), x: 0, y: 0 }));
    placeChildren(b);
  }

  function sortKids(list) {
    return list.map((k, i) => ({ k, i })).sort((a, z) => (P(a.k.b.node).LayoutOrder ?? 0) - (P(z.k.b.node).LayoutOrder ?? 0) || a.i - z.i).map((e) => e.k);
  }

  function placeChildren(b) {
    const n = b.node;
    const cw = Math.max(0, b.w - b.pad.l - b.pad.r);
    const ch = Math.max(0, b.h - b.pad.t - b.pad.b);
    const list = mod(n, "UIListLayout");
    const grid = mod(n, "UIGridLayout");

    if (list) {
      const lp = P(list);
      const horiz = lp.FillDirection === "Horizontal";
      const gapU = u1(lp.Padding, { s: 0, o: 0 });
      const gap = gapU.s * (horiz ? cw : ch) + gapU.o;
      const items = sortKids(b.kids);
      const total = items.reduce((a, k) => a + (horiz ? k.b.w : k.b.h), 0) + gap * Math.max(0, items.length - 1);
      const ha = lp.HorizontalAlignment || "Left";
      const va = lp.VerticalAlignment || "Top";
      const flex = horiz ? lp.HorizontalFlex : lp.VerticalFlex;
      let extraGap = 0;
      let cursor;
      const free = (horiz ? cw : ch) - total;
      if (flex === "SpaceBetween" && items.length > 1) { extraGap = free / (items.length - 1); cursor = 0; }
      else if (flex === "SpaceEvenly") { extraGap = free / (items.length + 1); cursor = extraGap; }
      else if (flex === "SpaceAround") { extraGap = free / items.length; cursor = extraGap / 2; }
      else {
        const align = horiz ? ha : va;
        cursor = align === "Center" ? free / 2 : align === "Right" || align === "Bottom" ? free : 0;
      }
      for (const k of items) {
        if (horiz) {
          k.x = b.pad.l + cursor;
          k.y = b.pad.t + (va === "Center" ? (ch - k.b.h) / 2 : va === "Bottom" ? ch - k.b.h : 0);
          cursor += k.b.w + gap + extraGap;
        } else {
          k.y = b.pad.t + cursor;
          k.x = b.pad.l + (ha === "Center" ? (cw - k.b.w) / 2 : ha === "Right" ? cw - k.b.w : 0);
          cursor += k.b.h + gap + extraGap;
        }
      }
      return;
    }

    if (grid) {
      const gp = P(grid);
      const cs = u2(gp.CellSize, { xs: 0, xo: 100, ys: 0, yo: 100 });
      const cp = u2(gp.CellPadding, { xs: 0, xo: 5, ys: 0, yo: 5 });
      const cellW = cs.xs * cw + cs.xo, cellH = cs.ys * ch + cs.yo;
      const gapX = cp.xs * cw + cp.xo, gapY = cp.ys * ch + cp.yo;
      let perRow = Math.max(1, Math.floor((cw + gapX) / (cellW + gapX)));
      if (gp.FillDirectionMaxCells) perRow = Math.min(perRow, gp.FillDirectionMaxCells);
      const items = sortKids(b.kids);
      const rowW = Math.min(items.length, perRow) * (cellW + gapX) - gapX;
      const ha = gp.HorizontalAlignment || "Left";
      const offX = ha === "Center" ? (cw - rowW) / 2 : ha === "Right" ? cw - rowW : 0;
      items.forEach((k, i) => {
        k.b.w = cellW; k.b.h = cellH;
        layoutChildren(k.b);
        k.x = b.pad.l + offX + (i % perRow) * (cellW + gapX);
        k.y = b.pad.t + Math.floor(i / perRow) * (cellH + gapY);
      });
      return;
    }

    for (const k of b.kids) {
      const p = P(k.b.node);
      const pos = u2(p.Position, { xs: 0, xo: 0, ys: 0, yo: 0 });
      const ap = p.AnchorPoint || [0, 0];
      k.x = b.pad.l + pos.xs * cw + pos.xo - ap[0] * k.b.w;
      k.y = b.pad.t + pos.ys * ch + pos.yo - ap[1] * k.b.h;
    }
  }

  // ---- rendering ----
  function gradientCss(g, base, baseT) {
    const gp = P(g);
    const rot = gp.Rotation || 0;
    const cks = (gp.Color && gp.Color.ColorSequence && gp.Color.ColorSequence.keypoints) || [{ time: 0, color: [1, 1, 1] }, { time: 1, color: [1, 1, 1] }];
    const tks = (gp.Transparency && gp.Transparency.NumberSequence && gp.Transparency.NumberSequence.keypoints) || [{ time: 0, value: 0 }, { time: 1, value: 0 }];
    const times = [...new Set([...cks.map((k) => k.time), ...tks.map((k) => k.time)])].sort((a, z) => a - z);
    const sample = (ks, t, get) => {
      for (let i = 0; i < ks.length - 1; i++) {
        if (t >= ks[i].time && t <= ks[i + 1].time) {
          const f = (t - ks[i].time) / (ks[i + 1].time - ks[i].time || 1);
          const a = get(ks[i]), z = get(ks[i + 1]);
          return Array.isArray(a) ? a.map((v, j) => v + (z[j] - v) * f) : a + (z - a) * f;
        }
      }
      return get(ks[t <= ks[0].time ? 0 : ks.length - 1]);
    };
    const offset = gp.Offset || [0, 0];
    const stops = times.map((t) => {
      const c = sample(cks, t, (k) => k.color);
      const tr = sample(tks, t, (k) => k.value);
      const mixed = c.map((v, j) => v * base[j]);
      const alpha = (1 - baseT) * (1 - tr);
      const pos = (t + (rot % 180 === 0 ? offset[0] : offset[1])) * 100;
      return `${rgba(mixed, 1 - alpha)} ${pos.toFixed(1)}%`;
    });
    return `linear-gradient(${90 + rot}deg, ${stops.join(", ")})`;
  }

  function render(b, x, y, parentEl) {
    const n = b.node;
    const p = P(n);
    const el = document.createElement("div");
    el.className = "rbx";
    el.dataset.name = n.name || "";
    el.title = `${n.name} (${n.className})`;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = b.w + "px";
    el.style.height = b.h + "px";
    el.style.zIndex = p.ZIndex ?? 1;

    const transforms = [];
    if (p.Rotation) transforms.push(`rotate(${p.Rotation}deg)`);
    const uiScale = mod(n, "UIScale");
    if (uiScale) {
      const ap = p.AnchorPoint || [0, 0];
      el.style.transformOrigin = `${ap[0] * 100}% ${ap[1] * 100}%`;
      transforms.push(`scale(${P(uiScale).Scale ?? 1})`);
    }
    if (transforms.length) el.style.transform = transforms.join(" ");

    const bgT = p.BackgroundTransparency ?? 0;
    const bg = p.BackgroundColor3 || defaultBg(n.className);
    const grad = mod(n, "UIGradient");
    if (bgT < 1) el.style.background = grad ? gradientCss(grad, bg, bgT) : rgba(bg, bgT);

    const corner = mod(n, "UICorner");
    if (corner) {
      const r = u1(P(corner).CornerRadius, { s: 0, o: 8 });
      el.style.borderRadius = Math.min(r.s * Math.min(b.w, b.h) + r.o, Math.min(b.w, b.h) / 2) + "px";
    }

    const strokes = kids(n).filter((c) => c.className === "UIStroke");
    const shadows = [];
    let textStroke = null;
    for (const s of strokes) {
      const sp = P(s);
      if (sp.Enabled === false) continue;
      const mode = sp.ApplyStrokeMode || "Contextual";
      const col = rgba(sp.Color || [0, 0, 0], sp.Transparency ?? 0);
      const t = sp.Thickness ?? 1;
      if (mode === "Contextual" && TEXT.has(n.className)) textStroke = { col, t };
      else if (sp.BorderStrokePosition === "Inner") shadows.push(`inset 0 0 0 ${t}px ${col}`);
      else if (sp.BorderStrokePosition === "Center") shadows.push(`0 0 0 ${t / 2}px ${col}`, `inset 0 0 0 ${t / 2}px ${col}`);
      else shadows.push(`0 0 0 ${t}px ${col}`);
    }
    if (shadows.length) el.style.boxShadow = shadows.join(", ");

    const border = p.BorderSizePixel ?? 1;
    if (border > 0 && bgT < 1 && GUI.has(n.className)) {
      el.style.outline = `${border}px solid ${rgba(p.BorderColor3 || [0.106, 0.165, 0.208], bgT)}`;
    }
    if (p.ClipsDescendants || n.className === "ScrollingFrame") el.style.overflow = "hidden";
    if (n.className === "CanvasGroup") el.style.opacity = 1 - (p.GroupTransparency ?? 0);

    if (IMAGE.has(n.className)) {
      const img = document.createElement("div");
      img.className = p.Image ? "img-ph" : "img-missing";
      const tint = p.ImageColor3 || [1, 1, 1];
      img.style.setProperty("--tint", rgba(tint, p.ImageTransparency ?? 0));
      if (OPTS.labels) img.textContent = p.Image ? "img" : n.name;
      if (corner) img.style.borderRadius = "inherit";
      el.appendChild(img);
    }

    if (TEXT.has(n.className)) renderText(el, n, b, textStroke, grad && bgT >= 1 ? grad : null);

    for (const k of b.kids) render(k.b, k.x, k.y, el);
    parentEl.appendChild(el);
    return el;
  }

  function renderText(el, n, b, stroke, textGrad) {
    const p = P(n);
    const box = document.createElement("div");
    box.className = "txt";
    const f = fontCss(p.FontFace);
    const xa = { Left: "flex-start", Center: "center", Right: "flex-end" }[p.TextXAlignment || "Center"];
    const ya = { Top: "flex-start", Center: "center", Bottom: "flex-end" }[p.TextYAlignment || "Center"];
    box.style.cssText = `left:${b.pad.l}px;top:${b.pad.t}px;right:${b.pad.r}px;bottom:${b.pad.b}px;justify-content:${xa};align-items:${ya};`;
    const span = document.createElement("span");
    span.style.fontFamily = f.family;
    span.style.fontWeight = f.weight;
    span.style.fontStyle = f.style;
    span.style.textAlign = (p.TextXAlignment || "Center").toLowerCase();
    span.style.lineHeight = (p.LineHeight || 1) * 1.15 + "";
    const color = p.TextColor3 || [0.106, 0.165, 0.208];
    span.style.color = rgba(color, p.TextTransparency ?? 0);
    const wraps = p.TextWrapped || p.TextScaled;
    span.style.whiteSpace = wraps ? "pre-wrap" : "pre";
    if (wraps) span.style.maxWidth = "100%";
    if (p.TextTruncate === "AtEnd") { span.style.overflow = "hidden"; span.style.textOverflow = "ellipsis"; span.style.maxWidth = "100%"; }
    const text = p.Text ?? defaultText(n);
    if (p.RichText) span.innerHTML = richToHtml(text); else span.textContent = text;
    if (n.className === "TextBox" && !p.Text && p.PlaceholderText) {
      span.textContent = p.PlaceholderText;
      span.style.color = rgba(p.PlaceholderColor3 || [0.7, 0.7, 0.7]);
    }
    if (stroke) {
      span.style.webkitTextStroke = `${stroke.t * 2}px ${stroke.col}`;
      span.style.paintOrder = "stroke fill";
    } else if (p.TextStrokeTransparency !== undefined && p.TextStrokeTransparency < 1) {
      span.style.webkitTextStroke = `2px ${rgba(p.TextStrokeColor3 || [0, 0, 0], p.TextStrokeTransparency)}`;
      span.style.paintOrder = "stroke fill";
    }
    if (textGrad) {
      span.style.backgroundImage = gradientCss(textGrad, color, p.TextTransparency ?? 0);
      span.style.webkitBackgroundClip = "text";
      span.style.color = "transparent";
    }
    let size = p.TextSize ?? 14;
    if (p.TextScaled) {
      const lim = mod(n, "UITextSizeConstraint");
      const maxS = Math.min(100, lim ? P(lim).MaxTextSize ?? 100 : 100);
      const minS = lim ? P(lim).MinTextSize ?? 1 : 1;
      const availW = b.w - b.pad.l - b.pad.r, availH = b.h - b.pad.t - b.pad.b;
      size = maxS;
      while (size > minS) {
        const m = measureText(n, size, availW);
        if (m.w <= availW + 0.5 && m.h <= availH + 0.5) break;
        size -= 1;
      }
    }
    span.style.fontSize = size + "px";
    box.appendChild(span);
    el.appendChild(box);
  }

  function drawChrome(stage, W, H, insetTop) {
    if (!OPTS.chrome) return;
    const add = (css, label) => {
      const d = document.createElement("div");
      d.className = "chrome";
      d.style.cssText = css;
      d.textContent = label;
      stage.appendChild(d);
    };
    add(`left:0;top:0;width:${W}px;height:58px;`, "Roblox top bar");
    if (W < 1100) {
      add(`left:0;bottom:0;width:${Math.round(W * 0.35)}px;height:${Math.round(H * 0.45)}px;border-radius:0 24px 0 0;`, "thumbstick zone");
      const j = Math.round(Math.min(W, H) * 0.24);
      add(`right:${Math.round(j * 0.35)}px;bottom:${Math.round(j * 0.25)}px;width:${j}px;height:${j}px;border-radius:50%;`, "jump");
    }
    if (insetTop) add(`left:0;top:0;width:${W}px;height:${insetTop}px;background:transparent;border-style:dotted;`, "");
  }

  function renderAll() {
    const stage = document.getElementById("stage");
    stage.innerHTML = "";
    const W = window.innerWidth, H = window.innerHeight;
    const gui = MODEL;
    const gp = P(gui);
    const inset = gp.IgnoreGuiInset ? 0 : 58;
    const rootBox = { node: { className: "Root", properties: {}, children: [] }, w: W, h: H - inset, pad: { l: 0, r: 0, t: 0, b: 0 }, kids: [] };
    if (gp.Enabled !== false || OPTS.showAll) {
      rootBox.kids = kids(gui).filter((c) => GUI.has(c.className) && visible(c)).map((c) => ({ b: build(c, W, H - inset), x: 0, y: 0 }));
      rootBox.node = { className: "Root", children: gui.children || [], properties: {} };
      placeChildren(rootBox);
    }
    const layer = document.createElement("div");
    layer.className = "rbx";
    layer.style.cssText = `left:0;top:${inset}px;width:${W}px;height:${H - inset}px;z-index:1;`;
    for (const k of rootBox.kids) render(k.b, k.x, k.y, layer);
    stage.appendChild(layer);
    drawChrome(stage, W, H, inset);
    window.__rendered = true;
  }

  let timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(renderAll, 50); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(renderAll, 0));
  setTimeout(() => { if (!window.__rendered) renderAll(); }, 4000);
})();
