# Design system for Roblox UI that doesn't look AI-made

## The anti-slop list

These are the tells of lazy or generated Roblox UI. Avoid every one.

1. **Default borders.** `BorderSizePixel` left at 1 gives every box a 1px dark outline. Always 0; use `UIStroke`.
2. **Default colors.** Studio gray `(163,162,165)`, pure white panels, pure `#000` backgrounds, or
   the default text color `(27,42,53)`. Every color comes from the theme.
3. **Legacy fonts.** `Font = SourceSans` / `Arial` / `Legacy`. Use `FontFace` from the theme.
4. **TextScaled everywhere.** Two labels next to each other end up at different sizes, and long
   strings shrink to unreadable. Use fixed `TextSize` from the type scale. Use `TextScaled` +
   `UITextSizeConstraint` only for big hero/number text that must fit a scale-sized box.
5. **Magic offsets.** Hand-placed `Position`s like `{0.0371, 0},{0.1824, 0}` (the result of
   dragging in Studio). Use `UIListLayout`/`UIGridLayout` + `UIPadding`, and anchor points.
6. **Stretchy panels.** Scale-only `Size` with no constraint becomes a thin strip on ultrawide
   and a squashed box on phones. Add `UIAspectRatioConstraint` or `UISizeConstraint`.
7. **Random radii.** 4px here, 13px there, 0.25 scale elsewhere. Use the theme's 2–4 radius steps.
   Nested corners: the inner radius equals the outer radius minus the padding (min 2).
8. **Everything is an accent.** Five saturated colors on one screen means none stands out. Use one
   accent for the primary action. Status colors (success/warning/danger) only mean status.
9. **Gradients and strokes on everything.** Gradient = depth on *one* hero element or the
   cartoon-style buttons. Text strokes belong to the cartoon style only.
10. **Emoji / letters as icons.** `"❌"`, `"$"`, `"⚙"` as icons. Use `ImageLabel` icons (white
    asset tinted with `ImageColor3`) and ask the user for asset ids. (Exception: the bold outlined
    "X" on the red close button of the cartoon style is a genre convention.)
11. **AutoButtonColor darkening.** The default hover/press tint looks cheap and fights your palette.
12. **No hierarchy.** Title, body, and buttons all at 18px. Use the type scale, with at least a ~1.4× jump
    between levels.
13. **Cramped or edge-touching text.** Text needs padding ≥ 8px from its container's edge
    (≥ 12–16 on panels).
14. **Wall of centered text.** Center short labels and titles. Left-align anything multi-line.
15. **Covering game controls.** The HUD sitting on the mobile thumbstick (bottom-left), jump
    button (bottom-right), or Roblox top bar.
16. **"Modern UI" = translucent everything.** `BackgroundTransparency` 0.5 panels over a busy 3D
    world are unreadable. Panels are opaque or ≤ 0.15 transparent; only overlays/scrims are see-through.

## Style directions

Each direction has a ready theme in `../themes/`. Copy it to `ui/theme.json`, then tune
the accent hue to the game (e.g. a fire-themed game can use orange in place of blue). Mix sparingly.

| Direction | Fits | Shape language | Fonts |
|---|---|---|---|
| `clean-dark` | RPG, FPS, strategy, anything "premium" | 10–14px radius, hairline strokes, raised surfaces instead of shadows | Builder Sans (+ Gotham numbers) |
| `chunky-cartoon` (**house style**, see `style-chunky-cartoon.md`) | Simulators, tycoons, obbies, pets, kids | Big radii, 3px dark outlines, "depth" slab under buttons, top-light gradients, outlined text | Fredoka One + Builder Sans |
| `scifi-hud` | Space, mech, cyberpunk shooters | Square/2px corners, 1px cyan lines, translucent near-black panels, mono numbers | Michroma + Titillium Web + Roboto Mono |
| `cozy-pastel` | Roleplay, café, farming, pets, dress-up | Soft big radii, no outlines, cream backgrounds, pastel accents | Fredoka One + Nunito |
| `grim-horror` | Horror, survival, mystery | Square corners, low contrast surfaces, one blood-red accent, paper notes | Oswald + Special Elite |

## Scales

- **Spacing:** use only the theme's `spacing` steps. Inside a component use small steps (4–12),
  between components medium ones (16–24), and around screen edges and between sections large ones (24–48).
- **Type:** pick ≤ 3 sizes per screen from `textSizes`. Typical: title = 4th–6th step, body = 2nd–3rd,
  caption = 1st–2nd. Phone minimum effective body size is 14px.
- **Radius:** small controls use the small radius, cards the middle one, windows the large one, pills `{"UDim": [0.5, 0]}`.
- **Touch targets:** ≥ 44px tall. Primary buttons 48–56px.

## Screen zones (landscape, which is how almost all Roblox players play)

```
┌───────────────────── Roblox top bar (58px, avoid unless IgnoreGuiInset=false) ─────────────────────┐
│ [top-left: currency/level pills]                         [top-right: menu/settings icons]         │
│                                                                                                    │
│ [left edge: vertical nav buttons            (centered modal windows)                               │
│  (Shop, Inventory, Codes)]                                                                         │
│                                                                                                    │
│ ┌ thumbstick zone ┐           [bottom-center: hotbar / health / XP]           ┌ jump button ┐     │
└─┴─────────────────┴───────────────────────────────────────────────────────────┴─────────────┴─────┘
```

- Mobile thumbstick: bottom-left ~35% width × 45% height. Jump button: bottom-right ~120×120px.
  Keep tappable things out of both. Bottom-center is safe.
- Modals: centered, `AnchorPoint [0.5,0.5]`, width ~0.6 scale capped with `UISizeConstraint`
  `MaxSize` ~[720, 520] (or an aspect constraint), plus a full-screen `Scrim` frame
  (`overlay`/`bg` color, transparency ~0.35–0.5) behind it.

## Component recipes

Names in these recipes are suggestions; colors are theme token names.

### Panel / window (clean-dark)
```
Window            Frame  surface, radius-lg, UIStroke Border line 1px, UIPadding 24
├─ Header         Frame  transparent, height 40, UIListLayout Horizontal, VerticalAlignment Center
│  ├─ Title       TextLabel  heading 28, text, AutomaticSize X, LayoutOrder 1
│  └─ CloseButton ImageButton 36×36, surfaceRaised, radius-sm, Icon child (Image "", textMuted tint)
└─ Body           Frame  transparent, Size {1,0},{1,-56}, Position {0,0},{0,56}
```

### Primary button (clean-dark)
`TextButton` accent bg, onAccent text, label font 16–20, height 48, radius-md, `AutoButtonColor:false`,
UIPadding L/R 20. Optional subtle top-light: white→`#D9D9D9` UIGradient at Rotation 90 over accent
(gradients multiply, so this darkens the bottom ~15%).

### Secondary / ghost button
Secondary: surfaceRaised bg + UIStroke Border line 1px, text color text.
Ghost: BackgroundTransparency 1, textMuted.

### Chunky cartoon button (depth slab)
UI children always draw above their parent (ZIndexBehavior Sibling), so the slab must be a
**sibling behind** the face:
```
BuyButton        Frame  transparent, Size {0,180},{0,64}
├─ Depth         Frame  primaryDepth, Size {1,0},{1,-6}, Position {0,0},{0,6}, radius 16, UIStroke outline 3, ZIndex 1
└─ Face          TextButton primary, Size {1,0},{1,-6}, radius 16, UIStroke Border outline 3, ZIndex 2
   ├─ Gradient   UIGradient white→#DADADA Rotation 90
   ├─ TextStroke UIStroke Contextual outline 2 (outlines the label text)
   └─ (text: "BUY", display font 28, text color white)
```
A UIStroke whose ApplyStrokeMode is `Border` strokes the box; one with `Contextual` on a text
object strokes the glyphs. A text button can have one of each.

### Currency pill
```
CoinsPill        Frame  surface (or panelInner), Size {0,0},{0,40}, AutomaticSize X, radius pill, UIStroke
├─ Padding       UIPadding L 6, R 16
├─ List          UIListLayout Horizontal, Padding 8, VerticalAlignment Center
├─ IconCoin      ImageLabel 28×28 (LayoutOrder 1), Image "" → needs asset
└─ Amount        TextLabel numeric 20, currency color, AutomaticSize X, Size {0,0},{1,0} (LayoutOrder 2)
```

### Progress bar (health / XP)
```
XPBar          Frame  surfaceRaised, Size {0.3,0},{0,14}, radius pill, ClipsDescendants true
├─ Fill        Frame  accent, Size {0.62,0},{1,0}, radius pill   ← the 0.62 is a placeholder value; a script drives it later
└─ (optional) Label TextLabel caption over the bar, or above it
```

### Shop item card (grid cell)
```
ItemCard        Frame surfaceRaised, radius-md, UIStroke line, UIPadding 12
├─ List         UIListLayout Vertical, Padding 8, HorizontalAlignment Center
├─ Thumb        ImageLabel Size {1,0},{1,0} + UIAspectRatioConstraint 1, surface bg, radius-sm   (LayoutOrder 1)
├─ ItemName     TextLabel body 16, text, TextTruncate AtEnd                                     (LayoutOrder 2)
└─ PriceButton  TextButton accent, height 36, numeric 16                                       (LayoutOrder 3)
```
Put the cards in a ScrollingFrame with a `UIGridLayout` (`CellSize` offset-based, e.g. 150×200;
`HorizontalAlignment: "Center"`) and `AutomaticCanvasSize: "Y"`.

### Tabs
A horizontal `UIListLayout` of TextButtons. Selected tab: accent text + a 3px-tall accent
`Underline` frame (or surfaceRaised bg). Unselected: textMuted, transparent bg.

### Notification toast
Top-center, AnchorPoint [0.5,0], Position {0.5,0},{0,16}, AutomaticSize XY, surfaceRaised, radius-md,
UIPadding 12/16, a 4px status-colored `Accent` bar on the left, body text. Starts `Visible:false`.

## Color rules

- Text on surface: contrast ≥ 4.5:1 (≥ 3:1 for text ≥ 18px bold). The linter checks this.
- The accent appears on the **primary action** and maybe one highlight. If everything is accent, nothing is.
- Translucent white lines (`UIStroke` color white, Transparency 0.85–0.92) are the clean way
  to separate dark surfaces. In the clean themes the `line` color is the opaque alternative.
- Icons are white assets tinted via `ImageColor3`, so one icon set works for every theme.
