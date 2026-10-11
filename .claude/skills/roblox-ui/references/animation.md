# Animation and textures

The UI files stay pure instances. Motion comes from **one** shared LocalScript,
`src/StarterPlayerScripts/UIAnimator.client.luau`, which reads **attributes** on the instances.
To animate something you add attributes in the `.model.json`. Don't write a new script per UI.
The animator only edits the script itself if a genuinely new kind of motion is needed. In that case,
add it to the script, to the attribute table in its header, to `scripts/preview-runtime.js`
(`bindAnimations`) so previews match, and to the lint `ANIMS`/`FX` sets.

Attributes go in a node's `"attributes"` object (strings, numbers and booleans only):

```json
{ "name": "Rays", "className": "ImageLabel",
  "attributes": { "Asset": "sunburst", "Anim": "Spin", "AnimSpeed": 30 },
  "properties": { ... } }
```

## Attribute reference

| Where | Attribute | Effect |
|---|---|---|
| any GuiObject | `Anim: "Spin"` | rotates forever. `AnimSpeed` = deg/sec (20) |
| | `Anim: "Float"` | bobs up/down. `AnimAmount` px (4), `AnimSpeed` Hz (0.5). **Not inside a layout** (wrap in a Frame) |
| | `Anim: "Pulse"` | breathes in scale. `AnimAmount` (0.04), `AnimSpeed` Hz (1) |
| | `Anim: "Wiggle"` | shakes every few seconds to attract attention. `AnimAmount` deg (12), `AnimPause` s (2.5) |
| tiled ImageLabel | `Anim: "Scroll"` | pattern drifts diagonally, seamless. Needs `ScaleType: "Tile"` + offset `TileSize`, and a `CanvasGroup` parent with the panel's UICorner (clips it) |
| any | `AnimDelay` | phase offset (s), so neighbours don't move in lockstep. Use it on repeated items |
| UIGradient | `Anim: "Sweep"` | slides the gradient across: a glint. `AnimPause` (2.2), `AnimDelay` |
| TextButton/ImageButton | `Fx: "Chunky"` | for the **Face** of a depth-slab button: hover grows the container, press pushes the face down `Depth` px onto the slab, release bounces back |
| | `Fx: "Pop"` | hover grows / press squashes the button itself |
| | `Opens: "<WindowName>"` | opens (or toggles) that window |
| | `Closes: "<WindowName>"` | closes it with the pop-out animation |
| window root | `Window: true` | pops in (Back easing) whenever it becomes Visible |
| | `PopTarget: "<ChildName>"` | which child pops (when the root is a full-screen frame with a scrim) |
| | `Blur: 14` | blurs the 3D world while open |
| inside a window | `Stagger: 1, 2, 3…` | pops in one after another as the window opens (cards, rewards) |
| | `FadeIn: true` | fades in/out with the window (scrims, backdrops) |

Animation budget per screen: **one** big ambient motion (spinning backdrop or rays), a few small
ones (icon wiggle, coin pulse, glints), and full interaction feedback on every button. Everything
moving at once is just as sloppy as nothing moving.

## Recipes

**Window with backdrop** (the StoreUI pattern):
```
StoreWindow   Frame full-screen, transparent, Visible:false   attrs Window, PopTarget "Panel", Blur 14
├─ Scrim      Frame outline color, BackgroundTransparency 0.45     attrs FadeIn
├─ Backdrop   ImageLabel Asset "swirl", 1.5×width square, ImageTransparency 0.9   attrs Spin 6, FadeIn
└─ Panel      the actual window (aspect + size constraint)
   ├─ Sunburst  ImageLabel Asset "sunburst", Size 1.7×, behind Body, ImageTransparency 0.55   attrs Spin 8
   ├─ Body …
   └─ CloseButton (Face attrs Fx Chunky, Closes "StoreWindow")
```
An open button anywhere in the same ScreenGui: Face attrs `Fx: "Chunky"`, `Opens: "StoreWindow"`.

**Rays behind an item:** an `ImageLabel` with `Asset: "sunburst"`, same center as the item image,
~1.5× its size, lower ZIndex, `ImageTransparency` 0.3–0.5, `Anim: "Spin"` 25–35. The item image
itself gets `Anim: "Float"` (inside a holder frame).

**Glint on a button:** a child `Glint` Frame of the Face (white, same UICorner, `Interactable: false`,
ZIndex above the face) with a `UIGradient` whose Transparency is 1 → 0.45 band at 0.5 → 1,
`Rotation` 20, `Offset [-1, 0]`, attrs `Anim: "Sweep"`.

**Scrolling panel pattern:**
```
PatternMask  CanvasGroup full size, transparent, ZIndex 1, UICorner = panel's radius
└─ Lattice   ImageLabel Asset "lattice-tile", ScaleType Tile, TileSize {0,72},{0,72},
             ImageTransparency 0.78–0.88, white   attrs Anim "Scroll", AnimSpeed 16
```
Give the panel's other children ZIndex ≥ 2 so they sit above the pattern.

## Textures

Available textures live in `assets/ui/` (white on transparent, so tint with `ImageColor3`):

| key | what | use |
|---|---|---|
| `sunburst` | straight rays fading out | behind items, rewards, titles; spin it |
| `swirl` | spiral rays | full-screen backdrop behind a window; slow spin, very transparent |
| `hex-fade` | hexagons fading from bottom to top | lower part of cards and headers (`ScaleType: "Stretch"`) |
| `lattice-tile` | diagonal crosshatch, tileable | panel bodies, scrolling |
| `squares-tile` | corner-bracket squares, tileable | alternative panel/header pattern |

Every textured ImageLabel has `"Image": ""` plus the attribute `"Asset": "<key>"`. Roblox can only show
uploaded images, so:

1. The user uploads the PNGs from `assets/ui/` (Studio → View → Asset Manager → Bulk Import, or
   create.roblox.com → Development Items → Decals/Images), and copies each asset id.
2. Put the ids in `ui/assets.json`: `{ "sunburst": "rbxassetid://123…", … }`.
3. Run `node .claude/skills/roblox-ui/scripts/assets.mjs` to write the ids into every UI file, then rebuild.

The previewer uses the local PNGs, so previews look right before upload. New textures: drop a
white-on-transparent PNG (≤ 1024px) into `assets/ui/`, then run `assets.mjs`; it adds the key to `ui/assets.json`.
