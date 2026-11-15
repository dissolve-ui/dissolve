# dissolve

An animation library for React Native. Turn any view into dust: a Skia snapshot, cut into grains,
animated by Reanimated 4 on the UI thread.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.0.1-brightgreen.svg)](CHANGELOG.md)
[![Expo SDK 57](https://img.shields.io/badge/Expo%20SDK-57-000020.svg)](https://expo.dev)

Put a ref on any component, call `dissolve()`, and it dissolves, melts, peels or rebuilds itself.
It works on any view, not a specific widget. iOS and Android, works with Expo (runs in Expo Go).

How it works: the view is snapshotted with Skia `makeImageFromView`, cut into grains drawn with one
`<Atlas>`, and animated on the UI thread (Reanimated 4, react-native-worklets). Every grain is
computed in a single reaction pass per frame, idle grains are skipped, and grain counts are capped
at 6000 per burst.

## Install

dissolve is not published on npm yet. For now, copy `src/dissolve/` into your app (this repo
imports it through the `@/dissolve` path alias, see `tsconfig.json`) and install its peers:

```sh
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

Known good versions (from `package.json`): Expo SDK 57, React Native 0.86, React 19.2,
`@shopify/react-native-skia` 2.6, `react-native-reanimated` 4.5, `react-native-worklets` 0.10,
`react-native-gesture-handler` 2.32. Expo's Babel preset already adds the worklets plugin; a bare
React Native app needs `'react-native-worklets/plugin'` in `babel.config.js`.

## Setup

Wrap the app once in `<DissolveProvider>`, above the navigator so effects survive a screen pop
(see `app/_layout.tsx`). The provider renders a full screen, `pointerEvents="none"` overlay where
grains are drawn, and skips effects when reduced motion is on.

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from '@/dissolve';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <Stack />
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}
```

## Quick start

```tsx
import { Pressable, View } from 'react-native';
import { useDissolve } from '@/dissolve';

function Row({ item, onRemove }) {
  const { ref, dissolving, dissolve } = useDissolve();
  return (
    <Pressable
      onPress={async () => {
        await dissolve({ preset: 'sand' });
        onRemove(item.id); // the space can be reclaimed
      }}
    >
      <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
        {/* row content */}
      </View>
    </Pressable>
  );
}
```

Hide the original with `opacity: dissolving ? 0 : 1` and remove it from state after the `await`.

## Variants

Common options for every atlas preset: `origin` (`'left' | 'right' | 'top' | 'bottom' | 'center' | { x, y }`),
`direction` (`'out' | 'in'`, any exit plays backwards as an entrance), `grain`, `duration`, `haptics`,
`field: 'cascade'` with `rows`, and free knobs `n`.

### Classic presets

| Preset | Usage |
|---|---|
| `dust` | `dissolve({ preset: 'dust' })` blown away to the right |
| `sand` | `dissolve({ preset: 'sand' })` grains pour down with gravity |
| `ember` | `dissolve({ preset: 'ember' })` burns from the edge, rises as sparks |
| `pixel` | `dissolve({ preset: 'pixel' })` blocky stepped collapse |
| `vortex` | `dissolve({ preset: 'vortex' })` spirals into the center |

### More variants

| Variant | Usage |
|---|---|
| `snap` | `dissolve({ preset: 'snap', origin: { x, y } })` bursts from the touch point, `n: [push]` |
| `fling` | `dissolve({ preset: 'fling', velocity: { x: e.velocityX, y: e.velocityY } })` follows the swipe |
| `stream` | `dissolve({ preset: 'stream', to: trashRef, onArrive })` flies into a target |
| `gather` | `<DissolveIn preset="gather">{card}</DissolveIn>` converges from a cloud |
| `rain` | `<DissolveIn preset="rain" delay={i * 40}>{row}</DissolveIn>` falls and settles, bottom first |
| `print` | `useAppear().appear({ preset: 'print' })` printed line by line |
| `charge` | `const { ref, pressHandlers, style } = useDissolveHold({ onCommit })` hold to heat, bursts at full charge |
| scrub | `const { ref, gesture, style } = useDissolveScrub({ preset: 'dust', onCommit })` finger driven, reversible |
| `peel` | `const { ref, gesture, style } = useDissolvePeel({ onCommit })` grab near any corner or edge and peel it off like a sticker, or `dissolve({ preset: 'peel' })` |
| `melt` | `dissolve({ preset: 'melt' })` melts down like a liquid, drips merge and pinch off (Skia gooey layer) |
| cascade | `dissolve({ preset: 'dust', field: 'cascade', rows: [0, 72, 144] })` list rows leave in a diagonal wave |
| screen | `useDissolveScreen().dissolveScreen({ preset: 'sand', then: () => router.back() })` full screen |
| `shatter` | `dissolve({ preset: 'shatter', origin: { x, y }, n: [220] })` glass shards from the impact |
| `pile` | `dissolve({ preset: 'pile', floor: 'screen' })` then `usePile().sweepPile({ preset: 'dust' })` |
| `morph` | `const { refA, refB, styleA, styleB, morph } = useDissolveMorph(); await morph()` A becomes B |

Demo screens live in `app/` (playground, stream, appear, fling, gestures, cascade, screen, shatter,
pile, morph).

## Hooks

| Hook | Purpose |
|---|---|
| `useDissolve` | Exits: `{ ref, dissolving, dissolve, reset }` |
| `DissolveIn` / `useAppear` | Entrances (`gather`, `rain`, `print`, or any exit with `direction: 'in'`) |
| `useDissolveScrub` | Any preset driven by the finger, reversible, commits past a threshold or on a fling |
| `useDissolveHold` | Hold to confirm, bursts at full charge |
| `useDissolvePeel` | Peel a view by hand from any corner or edge, sticks back if released early |
| `useDissolveScreen` | Full screen transitions |
| `useDissolveMorph` | Turn view A into view B |
| `usePile` | Sweep or clear the grains left by `pile` |

## Documentation

- Website: the `web/` folder holds the docs and the showcase (gallery, variant pages, docs, agent
  prompt), with a live Canvas 2D port of the engine. It has no build step:

  ```sh
  cd web && python3 -m http.server 8000
  ```

- Engine contract for variant authors: [docs/CONTRACT.md](docs/CONTRACT.md).
- Variant math and intent: [docs/VARIANTS.md](docs/VARIANTS.md).

## For coding agents

- Agent prompt: the website's "Agent prompt" page (`#/agent-prompt`) gives a ready to paste prompt.
- Claude skill: [web/skills/dissolve/SKILL.md](web/skills/dissolve/SKILL.md). Install it for every
  project with:

  ```sh
  mkdir -p ~/.claude/skills/react-native-dissolve
  cp web/skills/dissolve/SKILL.md ~/.claude/skills/react-native-dissolve/SKILL.md
  ```

- MCP server: [mcp/server.mjs](mcp/server.mjs), dependency free, Node over stdio. Tools:
  `list_variants`, `get_variant`, `get_setup`. Register it with:

  ```sh
  claude mcp add dissolve -- node /path/to/dissolve/mcp/server.mjs
  codex mcp add dissolve -- node /path/to/dissolve/mcp/server.mjs
  ```

  More clients in [mcp/README.md](mcp/README.md).

## Development

```sh
npm install
npm start        # then open in Expo Go
npx tsc --noEmit # type check
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Rayan Selmi
