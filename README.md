# dissolve

An animation library for React Native. Turn any view into dust: a Skia snapshot, cut into grains,
animated by Reanimated 4 on the UI thread. Its ready-made components also run on the web, as React
components with the same props.

[![npm](https://img.shields.io/npm/v/dissolve-ui.svg)](https://www.npmjs.com/package/dissolve-ui)
[![CI](https://github.com/dissolve-ui/dissolve/actions/workflows/ci.yml/badge.svg)](https://github.com/dissolve-ui/dissolve/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/dissolve-ui.svg)](https://www.npmjs.com/package/dissolve-ui)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Expo SDK 57](https://img.shields.io/badge/Expo%20SDK-57-000020.svg)](https://expo.dev)

Put a ref on any component, call `dissolve()`, and it dissolves, melts, peels or rebuilds itself.
It works on any view, not a specific widget. iOS and Android, works with Expo (runs in Expo Go).

How it works: the view is snapshotted with Skia `makeImageFromView`, cut into grains drawn with one
`<Atlas>`, and animated on the UI thread (Reanimated 4, react-native-worklets). Every grain is
computed in a single reaction pass per frame, idle grains are skipped, and grain counts are capped
at 6000 per burst.

## Install

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

The demo app in this repo imports the source directly through the `@/dissolve` path alias.

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
| `morph` | `const { refA, refB, styleA, styleB, morph } = useDissolveMorph(); await morph()` A becomes B |

The example app in `app/` has one screen per effect (`app/effect/[name].tsx`), one per component
(`app/demo/[name].tsx`) and a playground with every option.

## Components

Ready-made components ship the shadcn way: the CLI copies their source into your project, you own it
and restyle it with classNames. They read the dissolve theme tokens, so light and dark follow the
system automatically. One CLI for React Native and React on the web:

```sh
npx dissolve-ui init                  # asks the platform, saves it in dissolve.json, theme tokens
npx dissolve-ui add swipe-to-delete   # one or more components, for that platform
npx dissolve-ui list                  # everything available, and where it runs
```

Already on shadcn? Every component is also a shadcn registry item, installed with its own CLI:

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/scratch-card.json         # React
npx shadcn@latest add https://dissolve.rselmi.com/r/native/scratch-card.json  # React Native
```

`init` preselects the platform from your `package.json` (`--native`, `--web` or `--yes` skip the
question). Components land in `components/dissolve/`
(or `src/components/dissolve/` with a `src/` layout):

```tsx
import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';

<SlideToConfirm label="Slide to pay 42 €" doneLabel="Paid" onConfirm={pay} className="mx-4 bg-zinc-100" />
```

On React Native they need NativeWind v5 (Tailwind v4, react-native-css) and `tailwind-merge`, like
shadcn: later classes win, so `className="bg-blue-500"` replaces the default background.

On the web they need React 19 and `react-dom`, nothing else: no engine, no Tailwind required. Each
one is a `'use client'` React wrapper around a framework free core that draws on a canvas, with the
same props as the native version (Next.js, Vite, any React 19 app):

```tsx
import { ScratchCard } from '@/components/dissolve/scratch-card';

<ScratchCard onReveal={claim}>
  <span className="text-4xl font-bold">$25</span>
</ScratchCard>
```

| Component | |
|---|---|
| `swipe-to-delete` | Swipe a row left, it dissolves and the list closes up. |
| `toast` | Toasts that arrive in grains and leave as dust, with Undo. |
| `like-button` | Heart pop with sparks, snaps into grains on unlike. |
| `morph-button` | Dynamic Island style pill: loader, then done. |
| `split-button` | Splits in the middle like liquid metal into Cancel and Confirm. |
| `slide-to-confirm` | Slide to pay, shimmer label, loader, done. |
| `gooey-menu` | Actions pour out of a round button as drops. |
| `otp-input` | One time code boxes, shake and dust on a wrong code. |
| `number-ticker` | Rolling digits for prices and counters. |
| `reaction-picker` | iMessage style reactions on long press. |
| `voice-note` | Voice message bubble, scrub the waveform, unsend as dust. |
| `card-stack` | Wallet style card stack. |
| `signature-pad` | Sign with a finger, clear into dust, PNG export. |
| `before-after` | Before / after image comparison. |

Theme tokens (`--dissolve-background`, `surface`, `surface-2`, `foreground`, `muted`, `primary`,
`primary-foreground`, `success`, `danger`, `danger-foreground`, `accent`, `border`, `chart-1` to `chart-3`) live in your
`global.css` after `init`: change them once and every component follows.

### dissolve pro

Full screen blocks (paywall, onboarding, sign in...) and pro components install with the same
command, and show up in `list` marked `pro`:

```sh
npx dissolve-ui add paywall
```

The first time, the CLI prints a link and a code and opens your browser to connect your account,
then carries on. Without a subscription it prints the checkout link instead. Free components never
need an account and work offline.

```sh
npx dissolve-ui login    # or let add do it
npx dissolve-ui whoami
npx dissolve-ui logout
```

The token is saved in `~/.config/dissolve/auth.json`. In CI, set `DISSOLVE_TOKEN` instead.

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

## Documentation

- Website: the `web/` folder holds the docs and the showcase (gallery, variant pages, docs, agent
  prompt), with a live Canvas 2D port of the engine. Component pages run the React web cores, built
  into `web/lib/` by `npm run web:stamp` and committed, so the server needs no build step:

  ```sh
  cd web && python3 -m http.server 8000
  ```

- React web components: how a component becomes one, in [docs/WEB.md](docs/WEB.md).

- Engine contract for variant authors: the documented types in `src/dissolve/types.ts` (`AtlasVariant`, `StepFn`, `CustomVariant`).
- Variant math and intent: [docs/VARIANTS.md](docs/VARIANTS.md).

## Use with Claude Code

This repository is a Claude Code plugin marketplace with one plugin, `dissolve`: a skill that picks
and installs components with `npx dissolve-ui add`, plus the dissolve MCP server for the effects.
In Claude Code:

```
/plugin marketplace add dissolve-ui/dissolve
/plugin install dissolve@dissolve
```

On Claude Code 2.1.275 or later, one line does both:
`/plugin install dissolve --marketplace dissolve-ui/dissolve`. Then ask for a component, for example
"add an animated segmented control to the settings screen". The plugin lives in
[plugins/dissolve](https://github.com/dissolve-ui/dissolve/tree/main/plugins/dissolve).

## For coding agents

- Agent prompt: the website's [Agent prompt](https://dissolve.rselmi.com/docs/agent-prompt/) page gives a ready to paste prompt.
- Claude skill: [web/skills/dissolve/SKILL.md](web/skills/dissolve/SKILL.md). Install it for every
  project with:

  ```sh
  mkdir -p ~/.claude/skills/dissolve-ui
  cp web/skills/dissolve/SKILL.md ~/.claude/skills/dissolve-ui/SKILL.md
  ```

- MCP server: [mcp/server.mjs](mcp/server.mjs), dependency free, Node over stdio. Tools:
  `list_variants`, `get_variant`, `get_setup`. Register it with:

  ```sh
  claude mcp add dissolve -- npx -y dissolve-ui-mcp
  codex mcp add dissolve -- npx -y dissolve-ui-mcp
  ```

  More clients in [mcp/README.md](mcp/README.md).

## Development

```sh
npm install
npm start          # then open in Expo Go
npm run typecheck  # tsc for the app and registry/web
npm test           # CLI, registry, theme, engine and package tests (node:test)
```

The tests live in `test/` and run in CI on every push and pull request. See
[CONTRIBUTING.md](CONTRIBUTING.md#tests) for the individual suites.

## Contributing

Contributions are welcome, new components included: the
[component workflow](CONTRIBUTING.md#adding-a-component) covers the registry file, the
`index.json` entry, the demo, the web port and the tests. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Rayan Selmi
