# Chunky Cartoon: the simulator look (this repo's house style)

This is the style of the popular simulator, tycoon and spin-wheel games, and the style the
repo owner's reference screenshots use: store windows, spin wheels, side button stacks and
item shops. Theme: `themes/chunky-cartoon.json` (already copied to `ui/theme.json`).
Full working example: `src/StarterGui/StoreUI.model.json`.

## What makes it look right

1. **Thick dark outlines on everything.** Panels get a 4px `outline` `UIStroke` (Border). Cards and
   buttons get 2–3px. Every piece of text gets a `UIStroke` with Contextual mode (2px small, 3px titles)
   in the same `outline` color. Leaving an outline off one element is what makes it look unfinished.
2. **Bright, saturated, flat-ish fills with a top-light gradient.** Each filled shape has a
   `UIGradient` (Rotation 90) from white → ~0.94 → ~0.75–0.82 gray. Because gradients multiply,
   this keeps the theme color on top and shades the bottom. Never use rainbow gradients.
3. **Depth slabs under buttons.** Each button is a container `Frame` holding a darker `Depth` frame
   offset 4–6px down (ZIndex 1) and the `Face` TextButton (ZIndex 2). This is what makes the buttons look chunky and pressable.
4. **A colored header bar** on every window: darker (`panelDark`) or red (`headerRed`), with a white outlined
   title on the left and a thick `outline` line under it. The header has its own top UICorner plus a
   `SquareBottom` frame of the same color covering its lower half, so only the top corners are round.
5. **Red X close button** (`danger` + `dangerDepth` slab) hanging over the top-right corner:
   `AnchorPoint [0.5,0.5]`, `Position {1,-10},{0,10}`, `ZIndex 3`. In this style a bold outlined "X"
   in the display font is correct; it doesn't need an icon.
6. **Item cards in rarity/category colors** (`pink`, `secondary`, `orange`, `purple`, `primary`), each with:
   outlined name at top-left, coin icon + gold price, a perk line at the bottom-left, the item image
   on the right, and a green **Buy** button bottom-right.
7. **Green = buy/confirm, purple = premium/Robux, red = close/cancel, gray `neutral` = inactive tab.**
   Keep these meanings consistent across every screen.
8. **Prices**: coin/gem/Robux icon, then the number in `currency` gold with an outline. Use a thousands separator: `633,637`.
9. **One font: Fredoka One** for everything that matters. Builder Sans ExtraBold only for tiny fine print.

## Responsive strategy for windows: scale-first

Cartoon windows must look identical on a 844×390 phone and a 1920×1080 monitor, so:

- The window root is a transparent `Frame`, centered, with `Size {0.9,0},{0.8,0}` +
  `UIAspectRatioConstraint` (e.g. 1.3) + `UISizeConstraint MaxSize` (e.g. [640, 492]).
- **Everything inside uses Scale** for size and position (`{0.485,0},{0.47,0}`, …). Only padding,
  strokes and depth offsets are pixels.
- **All text uses `TextScaled: true` + `UITextSizeConstraint`** (MaxTextSize = the size you want on
  desktop, MinTextSize 10). The label's *box* decides its size, which keeps the hierarchy consistent
  at every resolution. Use box heights to set the hierarchy: title ≈ 0.6–0.7 of the header height,
  card names ≈ 0.24 of the card height, small lines ≈ 0.16.
- Square things (icons, item images, close button) get a `UIAspectRatioConstraint` of 1.
  For icons sized from their row's height: `AspectType: "ScaleWithParentSize"`, `DominantAxis: "Height"`.

HUD pieces (side button stacks, currency pills, top timers) work the same way: a scale-sized
container anchored to a screen edge, with an aspect constraint, and scale + TextScaled inside.

## Side button stack (reference screenshot 3)

```
SideButtons    Frame transparent, AnchorPoint [0,0.5], Position {0,12},{0.5,0}, Size {0.16,0},{0.5,0}, UIAspectRatioConstraint 0.75
└─ Grid        UIGridLayout CellSize {0.31,0},{0.23,0}, CellPadding {0.03,0},{0.03,0}, SortOrder LayoutOrder
   ├─ ShopButton   ImageButton (colored rounded square, outline stroke 3, depth slab optional) + IconShop + Label
   └─ ...
```
Each button is a colored rounded square with a big white icon and a small outlined label underneath
or overlapping the bottom edge. Timers ("15:00") sit on top as an outlined TextLabel.

## Spin wheel / big title text (reference screenshot 2)

Big titles like "Free Spin: 14m 09s" sit directly on the game world, with no panel behind them: `currency` or white
text, 3–4px outline stroke, TextScaled in a wide box at top-center. The wheel itself is an image
asset; build the buttons around it (Spin = green, Buy = purple with a Robux icon, Close = neutral).

## Optional textures

Many reference UIs have a subtle diagonal stripe or checker pattern inside panels. That needs an
image: an `ImageLabel` named `Pattern` filling the panel, `ScaleType: "Tile"`, `TileSize` ~{0,64},{0,64},
`ImageTransparency` 0.85–0.92, tinted white, with ZIndex at the panel's level and the content above it. Ask the user for a
tileable stripe asset id; leave `Image: ""` until then.
