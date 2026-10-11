# Project notes for Claude

- All UI is authored as Rojo `.model.json` instance trees in `src/StarterGui/`, one ScreenGui per file.
  Never build UI in Luau with `Instance.new`. For any UI work, use the `roblox-ui` skill
  (`.claude/skills/roblox-ui/SKILL.md`).
- `ui/theme.json` is the single source of colors, fonts, radii and spacing (house style: chunky cartoon).
- After changing a UI, run lint, preview (and look at the PNGs), and `build.mjs`, then commit the updated `build/*.rbxmx`.
