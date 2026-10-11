---
name: roblox-ui
description: Design and build polished, animated Roblox UI as real instances (ScreenGui/Frame/UICorner/UIStroke/UIListLayout…) authored as Rojo .model.json files, never as Luau that calls Instance.new. Motion (spinning rays, scrolling textures, chunky button presses, window pop-ins) is declared with attributes and played by one shared UIAnimator LocalScript. Use whenever the user asks for any Roblox interface or its animation: HUD, main menu, shop, inventory, settings, dialog, notification, leaderboard, loading screen, button, health/XP bar, or "make my UI look better". Includes a theme system, textures, a linter that blocks sloppy defaults, and a headless previewer that screenshots/records the UI at phone/tablet/desktop sizes.
---

# Roblox UI (instances, not scripts)

You are building UI the way a good Roblox UI designer does in Studio's Explorer and
Properties panels: a tree of real instances with deliberate properties. The output is
**data**, not code.

- **Never** write Luau that builds UI (`Instance.new("Frame")`, UI libraries, Roact/Fusion trees).
- **Never** put `Script`/`LocalScript`/`ModuleScript` inside the UI files.
- **Motion is declared, not coded.** One shared LocalScript (`src/StarterPlayerScripts/UIAnimator.client.luau`)
  animates any instance that carries attributes like `Anim: "Spin"`, `Fx: "Chunky"`, `Window: true`,
  `Opens: "StoreWindow"`. Every UI you make must be animated this way (see `references/animation.md`).
  Game logic (actually buying an item, saving data) is a separate job, only done when the user asks.
- Every UI is one `src/StarterGui/<UIName>.model.json` file whose root is a `ScreenGui`.

Read these before writing the first file:

- `references/style-chunky-cartoon.md`: **the house style for this repo** (bright simulator look:
  thick outlines, depth-slab buttons, colored headers, red X). Use it unless the user asks for
  something else. `src/StarterGui/StoreUI.model.json` is the finished example to imitate.
- `references/animation.md`: the animation attributes, the textures in `assets/ui/` and
  how they get uploaded. Static UI counts as unfinished.
- `references/model-json.md`: the exact JSON encoding for every property type you will use
  (UDim2, Color3, FontFace, ColorSequence, enums…). Wrong encodings fail the build or,
  worse, silently become defaults.
- `references/design-system.md`: the style directions, spacing/type scales, component
  recipes, and the anti-slop list. This is what separates "AI-made" UI from good UI.

## Workflow

Follow it in order. Do not skip the preview step: you can't judge a UI you haven't looked at.

### 1. Pin down the brief (briefly)

You need: the game's genre/vibe, which screen(s), and what each screen must show.
If the user gave a genre ("tycoon", "horror", "anime fighter") that's enough to choose a
style direction. Ask only when the vibe is truly unknown, and offer the style
directions from `design-system.md` as the options.

### 2. Set the theme in `ui/theme.json`

If `ui/theme.json` exists, **use it**: every screen in a game must share one theme.
If it doesn't, copy the fitting preset from `themes/` (see `design-system.md`), then
adjust the accent/hue to the game. The theme holds the only colors, fonts, corner radii,
and spacing values the UI may use; the linter enforces this.

### 3. Plan the hierarchy before writing JSON

Write a short indented outline (in your head or in chat for big screens): containers,
which ones use `UIListLayout`/`UIGridLayout`, what's scale vs. offset, what's the
primary action. Decide the **one** focal point per screen.

### 4. Author `src/StarterGui/<UIName>.model.json`

Hard rules (the linter checks most of these):

- `ScreenGui`: `ResetOnSpawn: false`, `ZIndexBehavior: "Sibling"`, and set `IgnoreGuiInset`
  on purpose (true for full-screen menus/loading, false for HUDs that should sit below the top bar).
- Every GuiObject: `BorderSizePixel: 0`. Borders come from `UIStroke`.
- Every text object uses `FontFace` from the theme (never the legacy `Font` enum).
- Every `TextButton`/`ImageButton`: `AutoButtonColor: false` (you design hover states; the
  default darken looks cheap).
- Every `UIListLayout`/`UIGridLayout`: set `SortOrder: "LayoutOrder"` and give children
  explicit `LayoutOrder` values.
- Layout with `UIListLayout`/`UIGridLayout` + `UIPadding`, not hand-placed offsets.
- Responsive sizing: panels use Scale **plus** a `UIAspectRatioConstraint` or
  `UISizeConstraint` so they don't stretch on ultrawide or crush on phones. In the cartoon style,
  everything inside a window is Scale too (see the style doc's "scale-first" section).
- `TextScaled: true` only together with a `UITextSizeConstraint` child (MaxTextSize from
  the theme's type scale). Otherwise use a fixed `TextSize` from the type scale.
- Meaningful PascalCase names (`BuyButton`, `CoinsLabel`), never `Frame`, `TextLabel`, `Frame2`.
- Icons are `ImageLabel`s named `Icon<Something>`. If you don't have a real asset id, leave
  `Image` as `""` and list the needed icons in your final message. Don't use emoji or
  letters like "X" as icons.
- Secondary screens (shop, settings, modals) start `Visible: false` on their root frame, carry
  `Window: true`, and are opened by a button with `Opens`. Every window has a close button with `Closes`.
- Every button gets an `Fx` (`Chunky` for depth-slab buttons, `Pop` for the rest).
- Panels get texture and motion: a pattern (scrolling `lattice-tile` or `hex-fade`), rays behind
  highlighted items, glints on primary buttons, `Stagger` on cards. Textured images use the
  `Asset` attribute with `Image: ""`.

For big screens it's fine to write a small throwaway generator (Python/Node in your scratchpad)
that emits the JSON with helpers for repeated pieces (cards, chunky buttons). The **output** file is what
gets committed, never the generator.

### 5. Format and lint

```bash
node .claude/skills/roblox-ui/scripts/format.mjs src/StarterGui/<UIName>.model.json   # compact, readable layout
node .claude/skills/roblox-ui/scripts/lint.mjs   src/StarterGui/<UIName>.model.json
```

`theme-colors.mjs` prints every theme color as a ready-to-paste `[r, g, b]` array.

Fix every **error**. Treat each **warning** as a real question: fix it or be able to say why
it's intentional.

### 6. Preview and look at it

```bash
node .claude/skills/roblox-ui/scripts/preview.mjs src/StarterGui/<UIName>.model.json
# show screens that start hidden:  --show ShopWindow --show SettingsWindow
# or everything:                   --show-all
# record the animations (hover, press, close, open) to .ui-preview/<UIName>.webm:  --video
```

This writes `.ui-preview/<UIName>.html` and, when Playwright is available, PNG screenshots
at phone (844×390), tablet (1180×820) and desktop (1920×1080). **Open the PNGs with the Read
tool and critique them** against the checklist below. To check motion, record `--video` and
pull a few frames out with `/opt/pw-browsers/ffmpeg-*/ffmpeg-linux -i x.webm -r 2 frame%02d.png`
(if available), or open the HTML in a browser: it plays the same animations, and the buttons respond to hover and click. Iterate until all three sizes look
intentional. The previewer is an approximation (image assets render as hatched
placeholders and fonts are close web substitutes), but layout, spacing, hierarchy, and
color are faithful.

### 7. Validate the build

Run `node .claude/skills/roblox-ui/scripts/build.mjs`. It builds every
`src/StarterGui/*.model.json` into `build/<UIName>.rbxmx` (one model per UI) and fails loudly
on bad encodings. If `rojo` isn't installed, try `cargo install rojo --locked`
(takes a few minutes); otherwise say so and stop at the lint + preview stage. Commit the
`build/*.rbxmx` files too: they let the user import the UI without installing anything.

### 8. Hand over

Tell the user, briefly:
- what was built and the style direction used,
- how to get it into Studio: **Rojo** (`rojo serve`, connect with the plugin; it syncs
  into StarterGui) **or** no tools: right-click `StarterGui` → *Insert from File…* →
  pick `build/<UIName>.rbxmx`,
- the icon/image asset ids they need to fill in, and which `assets/ui` textures still need uploading
  (`ui/assets.json` → `assets.mjs`),
- the `.webm` preview if you recorded one (send it with SendUserFile),
- that game logic (what Buy actually does) is not wired, and offer to do it.

## Self-critique checklist (run against the screenshots)

- [ ] Is there one obvious focal point / primary action? Is it the most saturated thing on screen?
- [ ] Does every element sit on the spacing scale? Do equal things have equal gaps?
- [ ] Is text readable at phone size (body ≥ 14px effective, nothing clipped or overflowing)?
- [ ] Are there ≤ 3 text sizes per screen and ≤ 2 font families?
- [ ] Does each panel keep its proportions at all three sizes (no stretched ultrawide bars)?
- [ ] Are touch targets ≥ 44px tall on phone?
- [ ] Is the HUD out of the way of Roblox's top bar, the jump button (bottom-right on mobile),
      and the thumbstick (bottom-left)?
- [ ] Would a player understand every number on screen without a label? If not, add an icon or label.
- [ ] Does it look like *this game* (theme, accent, shape language), or like a template?
- [ ] Does it move? One ambient motion, small accents, feedback on every button, a pop when windows open.
