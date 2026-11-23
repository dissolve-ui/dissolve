# Agent prompt

The fastest way to set up dissolve. Paste this prompt into your coding agent: it installs the engine, sets up NativeWind and adds the components you want.

Tell your coding agent

```
Add dissolve-ui to this React Native / Expo app. It snapshots any view with Skia and turns it into grains animated on the UI thread (Reanimated 4).

1. Install the package and its peers:
   npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
   (Known good: Expo SDK 57, Skia 2.6, Reanimated 4.5, react-native-worklets 0.10, gesture handler 2.32. Bare React Native needs 'react-native-worklets/plugin' in babel.config.js.)

2. Wrap the root layout once, above the navigator, inside GestureHandlerRootView:
   <GestureHandlerRootView style={{ flex: 1 }}>
     <DissolveProvider><Stack /></DissolveProvider>
   </GestureHandlerRootView>
   Do not add a second provider if one exists.

3. Use the hook on the view that should disappear:
   const { ref, dissolving, dissolve } = useDissolve();
   <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>...</View>
   await dissolve({ preset: 'dust' });
   then remove the item from state. Never unmount the view before the await resolves.

4. Ready-made components (swipe to delete, toasts, like button, slide to confirm, OTP input, thinking orb, mini player...) are not exported by the package. They are copied into the project with the CLI, shadcn style, and need NativeWind v5 (Tailwind v4 on react-native-css) plus tailwind-merge. Skip a) if NativeWind v5 already runs in the app.
   a) NativeWind v5 on Expo SDK 57:
      npm pkg set overrides.lightningcss=1.30.1
      npm install --legacy-peer-deps nativewind@5.0.0-preview.4 react-native-css@3.0.7 tailwindcss@^4 @tailwindcss/postcss tailwind-merge
      metro.config.js: module.exports = withNativewind(getDefaultConfig(__dirname), { inlineVariables: false, globalClassNamePolyfill: false }) (withNativewind from 'nativewind/metro')
      postcss.config.mjs: export default { plugins: { '@tailwindcss/postcss': {} } };
      nativewind-env.d.ts: /// <reference types="react-native-css/types" />
      global.css starts with: @import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/preflight.css" layer(base); @import "tailwindcss/utilities.css"; and is imported once at the top of the root layout.
   b) npx dissolve-ui init --native   (once: dissolve.json, tw.tsx primitives + --dissolve-* theme tokens in global.css, then it checks the setup and prints what is missing: fix everything it reports)
   c) npx dissolve-ui add <name>      (npx dissolve-ui list shows the names; dependencies between components are copied too)
      import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';
   Restyle with className and the part classNames (textClassName, boxClassName...), or change the --dissolve-* tokens in global.css. Light and dark follow the system.
   Finish by running npx tsc --noEmit and starting the app.

Pick the variant from the intent:
- Exits (useDissolve): delete a row or card: dust. Delete forever: sand. Unsend or burn: ember. Tap to pop: snap with origin { x: locationX, y: locationY }. Error or broken: shatter. Playful: melt. Clear all: field: 'cascade' with rows (local Y of each row) on the list container.
- Archive or move: stream with to: iconRef and onArrive to bump the icon.
- Entrances: new message or card: <DissolveIn preset="gather">. List: <DissolveIn preset="rain" delay={i * 40}>. Generated text: useAppear().appear({ preset: 'print' }).
- Gestures: swipe to dismiss: fling with the release velocity, or useDissolveScrub({ preset, onCommit }) for a reversible drag. Sticker or card dismissal by hand: useDissolvePeel({ onCommit }), both return { ref, gesture, style } for a GestureDetector around an Animated.View. Destructive confirm (delete account, wipe data): useDissolveHold({ onCommit }) instead of an alert, spread pressHandlers on a Pressable.
- Transitions: toggle state (Follow to Following): useDissolveMorph. Leave a screen: useDissolveScreen().dissolveScreen({ preset: 'sand', then: () => router.back() }).

Rules:
- One effect per user action, on user intent only, 0.9 s to 1.8 s.
- Reduced motion is handled by the provider (the effect is skipped), do not add a custom fallback.
- Keep grain counts reasonable: default grain on cards, a larger grain on big views, useDissolveScreen for full screens, one cascade burst instead of one burst per row.
- Import the engine and hooks from dissolve-ui. Import components from their copied file, never from the package.

For a React web app (Next.js, Vite) there is no engine to install: run npx dissolve-ui init --web, then npx dissolve-ui add <name> (npx dissolve-ui list shows which components run on the web). The components need React 19 and react-dom only, and take the same props as on native.
```

## Keep it in your agent

Install the skill or the MCP server once, and your agent knows dissolve in every project.

Claude Code

Install the plugin, skill and MCP server in one go

```sh
/plugin marketplace add dissolve-ui/dissolve
```

```sh
/plugin install dissolve@dissolve
```

Or install the skill

```sh
mkdir -p ~/.claude/skills/dissolve-ui && curl -fsSL https://dissolve.rselmi.com/skills/dissolve/SKILL.md -o ~/.claude/skills/dissolve-ui/SKILL.md
```

Add the MCP server

```sh
claude mcp add dissolve -- npx -y dissolve-ui-mcp
```

Codex

Add the instructions to AGENTS.md

```sh
curl -fsSL https://dissolve.rselmi.com/skills/dissolve/SKILL.md >> AGENTS.md
```

Add the MCP server

```sh
codex mcp add dissolve -- npx -y dissolve-ui-mcp
```

## Details

## Claude Code plugin

The dissolve repository is a Claude Code plugin marketplace with one plugin, `dissolve`. It bundles a skill that knows when to reach for dissolve, picks the component and installs it with `npx dissolve-ui add`, and the MCP server below for the particle effects. Run these two commands inside Claude Code:

```sh
/plugin marketplace add dissolve-ui/dissolve
```

```sh
/plugin install dissolve@dissolve
```

On Claude Code 2.1.275 or later, `/plugin install dissolve --marketplace dissolve-ui/dissolve` does both. Then ask for a component, for example "add an animated segmented control to the settings screen". The plugin is in `plugins/dissolve` on [GitHub](https://github.com/dissolve-ui/dissolve).

## Claude skill

An Agent Skill is a `SKILL.md` file Claude loads on its own whenever you ask for a dissolve effect. It holds the setup, the API of every hook, a variant picking table and the best practices.

SKILL.md

dissolve-ui

- [View](https://dissolve.rselmi.com/skills/dissolve/SKILL.md)
- [Download](https://dissolve.rselmi.com/skills/dissolve/SKILL.md)

For all your projects

```sh
mkdir -p ~/.claude/skills/dissolve-ui && curl -fsSL https://dissolve.rselmi.com/skills/dissolve/SKILL.md -o ~/.claude/skills/dissolve-ui/SKILL.md
```

For this project only, shared with your team

```sh
mkdir -p .claude/skills/dissolve-ui && curl -fsSL https://dissolve.rselmi.com/skills/dissolve/SKILL.md -o .claude/skills/dissolve-ui/SKILL.md
```

Restart Claude Code, then ask for an effect, for example "dissolve the row when I delete a task". With other agents, paste the file into `AGENTS.md` or a Cursor rule.

## MCP server

A tiny MCP server with no dependencies, published on npm as `dissolve-ui-mcp`. Your agent runs it with `npx` over stdio, so it stays up to date, and it answers with the same data as the docs. The source is in `mcp/server.mjs` on [GitHub](https://github.com/dissolve-ui/dissolve).

| Tool | Returns |
| --- | --- |
| `list_variants` | Every variant with its kind (exit, entrance, gesture, transition), hook and use case. |
| `get_variant` | Usage snippet, options and best practices for one variant. |
| `get_setup` | Install command, provider snippet, first effect, the component CLI and picking rules. |

Claude Code

```sh
claude mcp add dissolve -- npx -y dissolve-ui-mcp
```

Claude Desktop · claude_desktop_config.json:

```json
{
  "mcpServers": {
    "dissolve": {
      "command": "npx",
      "args": ["-y", "dissolve-ui-mcp"]
    }
  }
}
```

Cursor · .cursor/mcp.json:

```json
{
  "mcpServers": {
    "dissolve": {
      "command": "npx",
      "args": ["-y", "dissolve-ui-mcp"]
    }
  }
}
```

Codex · ~/.codex/config.toml:

```toml
[mcp_servers.dissolve]
command = "npx"
args = ["-y", "dissolve-ui-mcp"]
```

Then ask: "use the dissolve MCP to add a delete effect to the inbox rows".

Source: https://dissolve.rselmi.com/docs/agent-prompt/
