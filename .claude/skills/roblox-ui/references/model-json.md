# Rojo `.model.json` encoding for UI

These are the encodings Rojo 7.x accepts for GUI properties, verified against `rojo build`
(7.7.1). If you get an encoding wrong, the build fails with `data did not match any variant of
untagged enum UnresolvedValue`, so build often.

## File shape

```json
{
  "className": "ScreenGui",
  "properties": { "ResetOnSpawn": false, "ZIndexBehavior": "Sibling", "IgnoreGuiInset": true },
  "children": [
    {
      "name": "MainPanel",
      "className": "Frame",
      "properties": { "BorderSizePixel": 0 },
      "children": [ { "name": "Corner", "className": "UICorner", "properties": { "CornerRadius": { "UDim": [0, 16] } } } ]
    }
  ]
}
```

- The root's name comes from the file name: `src/StarterGui/MainMenu.model.json` → `MainMenu`.
  The root object has no `"name"`; every child needs one.
- Leave out any property you'd leave at Roblox's default, *except* the ones the
  skill makes mandatory (`BorderSizePixel`, `AutoButtonColor`, `SortOrder`, …).
- Property names are exact Roblox names. A typo fails the build with `Unknown property`.

## Value encodings

| Roblox type | JSON | Example |
|---|---|---|
| bool / number / string | plain | `"Visible": false`, `"TextSize": 18`, `"Text": "Play"` |
| **Enum** | the item name as a string | `"TextXAlignment": "Left"`, `"FillDirection": "Horizontal"` |
| **Color3** | `[r, g, b]` floats **0–1** (not 0–255) | `"BackgroundColor3": [0.067, 0.094, 0.153]` |
| Vector2 | `[x, y]` | `"AnchorPoint": [0.5, 0.5]`, `"MinSize": [240, 48]` |
| **UDim2** | must be wrapped: `{"UDim2": [[xScale, xOffset], [yScale, yOffset]]}` | `"Size": {"UDim2": [[0.3, 0], [0, 56]]}` |
| **UDim** | must be wrapped: `{"UDim": [scale, offset]}` | `"CornerRadius": {"UDim": [0, 12]}`, `"PaddingLeft": {"UDim": [0, 16]}` |
| **FontFace** | object, no wrapper | `"FontFace": {"family": "rbxasset://fonts/families/Montserrat.json", "weight": "Bold", "style": "Normal"}` |
| ColorSequence | `{"ColorSequence": {"keypoints": [{"time": 0, "color": [r,g,b]}, …]}}` | see UIGradient below |
| NumberSequence | `{"NumberSequence": {"keypoints": [{"time": 0, "value": 0, "envelope": 0}, …]}}` | see UIGradient below |
| Rect | `{"Rect": [[minX, minY], [maxX, maxY]]}` | `"SliceCenter": {"Rect": [[12, 12], [52, 52]]}` |
| Content (Image) | string | `"Image": "rbxassetid://1234567890"` or `""` |

A bare `[[0.5, 0], [0, 40]]` for a UDim2, or a bare `[0, 12]` for a UDim, does **not** work.
These are the most common mistakes.

Font weights: `Thin, ExtraLight, Light, Regular, Medium, SemiBold, Bold, ExtraBold, Heavy`.
Style: `Normal` or `Italic`.

### Hex → Color3

Divide each channel by 255 and round to 3 decimals: `#1E2633` → `[0.118, 0.149, 0.2]`.
`node .claude/skills/roblox-ui/scripts/theme-colors.mjs` prints every theme color already converted.

## Frequently used classes and properties

### ScreenGui (root)
`ResetOnSpawn: false`, `ZIndexBehavior: "Sibling"`, `IgnoreGuiInset: true|false`,
`DisplayOrder` (higher draws on top of other ScreenGuis, e.g. 10 for modals),
`ScreenInsets: "CoreUISafeInsets"` (default, avoids top bar and notch) | `"DeviceSafeInsets"` | `"None"`.

### GuiObject (Frame, TextLabel, TextButton, ImageLabel, ImageButton, ScrollingFrame, CanvasGroup, TextBox)
`Size`, `Position` (UDim2), `AnchorPoint` (Vector2), `BackgroundColor3`, `BackgroundTransparency`,
`BorderSizePixel: 0`, `Visible`, `ZIndex`, `LayoutOrder`, `Rotation`, `ClipsDescendants`,
`AutomaticSize: "None"|"X"|"Y"|"XY"`, `Interactable`.

### Text (TextLabel, TextButton, TextBox)
`Text`, `FontFace`, `TextSize`, `TextColor3`, `TextTransparency`, `TextXAlignment: "Left"|"Center"|"Right"`,
`TextYAlignment: "Top"|"Center"|"Bottom"`, `TextWrapped`, `TextScaled`, `TextTruncate: "AtEnd"`,
`RichText` (`<b>`, `<i>`, `<font color="#FFD34D">`, `<br/>`), `LineHeight`.
TextBox only: `PlaceholderText`, `PlaceholderColor3`, `ClearTextOnFocus`.
Buttons: `AutoButtonColor: false`.

### Images (ImageLabel, ImageButton)
`Image`, `ImageColor3` (tints white icons, so make icons white and tint them here), `ImageTransparency`,
`ScaleType: "Stretch"|"Fit"|"Crop"|"Slice"|"Tile"`, `SliceCenter` (Rect), `SliceScale`.

### ScrollingFrame
`CanvasSize: {"UDim2": [[0,0],[0,0]]}` + `AutomaticCanvasSize: "Y"`, `ScrollingDirection: "Y"`,
`ScrollBarThickness`, `ScrollBarImageColor3`, `ScrollBarImageTransparency`.

### CanvasGroup
Like Frame, plus `GroupTransparency` (fades a whole subtree). Use sparingly; it costs memory.

## UI modifiers (children of the object they modify)

```json
{ "name": "Corner",  "className": "UICorner",  "properties": { "CornerRadius": { "UDim": [0, 12] } } }
{ "name": "Pill",    "className": "UICorner",  "properties": { "CornerRadius": { "UDim": [0.5, 0] } } }

{ "name": "Stroke",  "className": "UIStroke",  "properties": {
    "ApplyStrokeMode": "Border", "Color": [1, 1, 1], "Transparency": 0.88, "Thickness": 1 } }
// On a TextLabel, ApplyStrokeMode "Contextual" (default) outlines the TEXT instead of the box.

{ "name": "Padding", "className": "UIPadding", "properties": {
    "PaddingTop": { "UDim": [0, 16] }, "PaddingBottom": { "UDim": [0, 16] },
    "PaddingLeft": { "UDim": [0, 20] }, "PaddingRight": { "UDim": [0, 20] } } }

{ "name": "List", "className": "UIListLayout", "properties": {
    "FillDirection": "Vertical", "SortOrder": "LayoutOrder", "Padding": { "UDim": [0, 12] },
    "HorizontalAlignment": "Center", "VerticalAlignment": "Top" } }
// Flex (newer): "HorizontalFlex"/"VerticalFlex": "Fill"|"SpaceBetween"|"SpaceAround"|"SpaceEvenly",
// "Wraps": true, "ItemLineAlignment": "Center". Per-child: a UIFlexItem with "FlexMode": "Fill"|"Grow"|"Shrink".

{ "name": "Grid", "className": "UIGridLayout", "properties": {
    "CellSize": { "UDim2": [[0, 120], [0, 150]] }, "CellPadding": { "UDim2": [[0, 12], [0, 12]] },
    "SortOrder": "LayoutOrder", "HorizontalAlignment": "Center", "FillDirectionMaxCells": 4 } }

{ "name": "Aspect", "className": "UIAspectRatioConstraint", "properties": {
    "AspectRatio": 1.6, "AspectType": "FitWithinMaxSize", "DominantAxis": "Width" } }

{ "name": "SizeLimit", "className": "UISizeConstraint", "properties": { "MinSize": [280, 0], "MaxSize": [720, 10000] } }

{ "name": "TextLimit", "className": "UITextSizeConstraint", "properties": { "MinTextSize": 12, "MaxTextSize": 28 } }

{ "name": "Gradient", "className": "UIGradient", "properties": {
    "Rotation": 90,
    "Color": { "ColorSequence": { "keypoints": [
      { "time": 0, "color": [1, 1, 1] }, { "time": 1, "color": [0.82, 0.82, 0.86] } ] } },
    "Transparency": { "NumberSequence": { "keypoints": [
      { "time": 0, "value": 0, "envelope": 0 }, { "time": 1, "value": 0, "envelope": 0 } ] } } } }
// UIGradient MULTIPLIES the parent's colors (background, text, image). For an exact gradient,
// set the parent's BackgroundColor3 to white [1,1,1]. Rotation 0 = left→right, 90 = top→bottom.

{ "name": "Scale", "className": "UIScale", "properties": { "Scale": 1 } }
```

## Coordinates cheat sheet

- `Position` is where the **AnchorPoint** of the object lands inside the parent.
  Centered: `AnchorPoint [0.5,0.5]` + `Position {"UDim2": [[0.5,0],[0.5,0]]}`.
  Bottom-right with a 24px margin: `AnchorPoint [1,1]` + `Position {"UDim2": [[1,-24],[1,-24]]}`.
- Size `{"UDim2": [[1,0],[0,48]]}` = full parent width, 48px tall.
- Inside a `UIListLayout`/`UIGridLayout`, children's `Position` is ignored.
- `UIPadding` shrinks the area children are laid out in (it affects scale sizes too).
