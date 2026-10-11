# Project notes for Claude

- All UI is authored as Rojo `.model.json` instance trees in `src/StarterGui/`, one ScreenGui per file.
  Never build UI in Luau with `Instance.new`. For any UI work, use the `roblox-ui` skill
  (`.claude/skills/roblox-ui/SKILL.md`).
- Motion comes from attributes read by `src/StarterPlayerScripts/UIAnimator.client.luau`, not from per-UI scripts.
- `ui/theme.json` holds every color, font, radius and spacing value (house style: chunky cartoon). Textures are
  in `assets/ui/`, and their uploaded ids go in `ui/assets.json` (applied by `scripts/assets.mjs`).
- After changing a UI: format, lint, preview (look at the PNGs; record `--video` for motion), then
  `build.mjs`, and commit the updated `build/` files.
