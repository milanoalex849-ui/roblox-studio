# roblox-studio

Animated Roblox UI built as **real instances** (ScreenGui → Frame → UICorner/UIStroke/UIListLayout…),
stored as Rojo `.model.json` files. Nothing builds UI with `Instance.new`. One shared script,
`UIAnimator`, adds the motion: spinning rays, scrolling textures, chunky button presses and window pop-ins.

![Store UI preview](docs/store-preview.png)

Animation preview: [`docs/store-animation.webm`](docs/store-animation.webm) (hover, press, close, reopen).

## Try it in Studio

**Easiest:** open [`build/Place.rbxlx`](build/) in Studio and press Play. Click the purple
**Store** button on the left.

**Into your own place:** right-click **StarterGui → Insert from File…** and pick `build/StoreUI.rbxmx`,
then right-click **StarterPlayer → StarterPlayerScripts → Insert from File…** and pick
`build/UIAnimator.rbxmx`.

**With Rojo (live sync):** install [Rojo](https://rojo.space) and its Studio plugin, run
`rojo serve` here, and click **Connect** in the plugin.

## Uploading the textures (one time)

Roblox only shows uploaded images, so the textures stay invisible in Studio until you do this:

1. In Studio: **View → Asset Manager → Bulk Import**, and select every PNG in [`assets/ui/`](assets/ui/).
2. Right-click each uploaded image → **Copy Asset ID**, then paste it into [`ui/assets.json`](ui/assets.json):
   `"sunburst": "rbxassetid://1234567890"`.
3. Run `node .claude/skills/roblox-ui/scripts/assets.mjs` and `node .claude/skills/roblox-ui/scripts/build.mjs`
   (or just ask Claude: "here are my asset ids: …").

Icons (store icon, coin, item pictures) are empty `Icon…`/`Thumb` ImageLabels: upload your
own and paste the ids into their `Image`.

## Making new UI with Claude

The repo ships a Claude Code skill in [`.claude/skills/roblox-ui/`](.claude/skills/roblox-ui/SKILL.md).
Ask for any screen ("make a daily rewards window", "a spin wheel UI", "side buttons for Shop, Pets,
Codes") and Claude will build it in the house style with textures and animation, lint it, screenshot
it at phone, tablet and desktop sizes, record an animation preview, and build the `.rbxmx`/place files.

Animation is declared with attributes on instances (`Anim = "Spin"`, `Fx = "Chunky"`,
`Window = true`, `Opens = "StoreWindow"`…). See
[`references/animation.md`](.claude/skills/roblox-ui/references/animation.md) for the full list. You can also
add these attributes by hand in Studio's Properties panel.

### Tool commands

```bash
S=.claude/skills/roblox-ui/scripts
node $S/format.mjs  src/StarterGui/StoreUI.model.json            # compact formatting
node $S/lint.mjs    src/StarterGui/StoreUI.model.json            # rules + theme + animation checks
node $S/preview.mjs src/StarterGui/StoreUI.model.json --video    # HTML + PNG screenshots + .webm
node $S/assets.mjs                                               # write uploaded texture ids into the UI
node $S/build.mjs                                                # build/*.rbxmx + build/Place.rbxlx (needs rojo)
```
