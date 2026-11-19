# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.6] - 2026-11-19

### Changed
- **The package is now `dissolve-ui`.** One package for everything: the React Native engine (`import { DissolveProvider } from 'dissolve-ui'`) and the CLI (`npx dissolve-ui add <name>`). `react-native-dissolve` is deprecated: replace it with `dissolve-ui` in package.json and in your imports. The MCP server is now `dissolve-ui-mcp`.

### Added
- React on the web: all 29 components now have a React web version in `registry/web`, with the same prop names as on React Native. Each one is a small `'use client'` wrapper (`<name>.tsx`) over a framework free core (`<name>.core.ts`) that owns the DOM, canvas, pointer handling, theme tokens and reduced motion. They need only `react` and `react-dom` 19, with no runtime dependency, and they work with the Next App Router and Vite. Native only props such as `haptics` are accepted, and map to `navigator.vibrate` where the browser has it.
- Shared web files, copied with the components that import them: `engine.ts` (the grain engine), `kit.ts` (easing, scope, DOM and canvas helpers, `capture()` of any DOM subtree), `react.ts` (the wrapper hook) and `gl.ts` (WebGL2 helper).
- `add <names> --native` or `--web` picks the platform for that run (the site shows the command for the platform you picked), and saves it in `dissolve.json`.
- `init` asks for the platform once, React Native or React web, with the detected answer preselected (`react-native` or `expo` means native; `react-dom`, `next` or `vite` without React Native means web). `--native`, `--web` and `--yes` skip the question. The choice is saved in `dissolve.json` (`{ "platform", "dir" }`), and `add` reads it, running `init` first if the file is missing. Web projects with a `src/` folder install into `src/components/dissolve`.
- `list` shows the platforms each component supports. Web availability comes from the files in `registry/web`.
- Site: every component page has a React Native / React switch (remembered across pages). It changes the usage snippet, the install notes and the copied prompt. Props stay documented once, and native only props are tagged in React mode.

### Changed (site and tooling)
- The site runs the same code as the React web components: `scripts/build-web.mjs` bundles `registry/web/*.core.ts` into `web/lib`, and the demo ports in `web/cp` keep only demo content and autoplay, which drives the components through their public API and real pointer events. The old Canvas 2D ports and `web/engine` are gone.
- Docs, README, the agent prompt, the skill and the MCP server use `npx dissolve-ui` and cover both platforms.

## [0.0.5] - 2026-11-19

### Added
- `glossy-button`: tactile pill lit from the inside (gradient stroke, inner light, drop shadow, ring), press scale and haptic, `fullWidth`.
- `segmented-control`: iOS style segmented control whose pill breaks into grains, flows to the new segment on a slight arc and reassembles there. Drag across the segments and the selection follows the finger, a selection tick per change.
- `pull-to-refresh`: grains gather into a ring 1:1 with the pull, spin while `onRefresh` runs, then stream into the new items. Wrap items in `PullItem`, it works for lists and bento layouts alike.
- `reorder-list`: long press to lift a row, the others make room, a tick per slot, auto scroll near the edges.
- `scratch-card`: glossy foil (one shader: brushed metal, grain, holographic hint, bevel, specular band) that tilts in 3D under the finger with the light following it. Scratching sheds foil grains, past `threshold` the rest of the foil dissolves.
- `skeleton`: loading placeholders (lines, circles, rects) under a calm wave of light. When loading ends, each block breaks into grains that recompose its real content, staggered in reading order. Wrap the content in `SkeletonBlock` and give it its placeholder shape.

### Changed
- Shared registry helpers `motion.ts` and `dots.ts`, installed by `add` with the components that import them.

### Fixed
- iOS: grains drawn during a scroll drag use Reanimated views (Skia and animated layout props hold still while a scroll view is tracking).

## [0.0.4] - 2026-11-16

### Added

- Components, shadcn style: `npx react-native-dissolve init` installs the `tw` primitives and theme
  tokens, `add <name>` copies a component's source (and the registry files it imports) into your
  project, `list` shows what is available. Components live in `registry/` with an `index.json`.
- NativeWind v5 theme tokens (`registry/theme.css`): `--dissolve-*` colors for light and dark,
  mapped to `bg-dissolve-*`, `text-dissolve-*` and `border-dissolve-*` utilities, and
  `useToken()` for Skia and Reanimated values.
- Automated tests with `node:test` (no new dependency): CLI against temp projects, registry
  consistency (index, files, imports, exports, colors), theme tokens, engine presets and the npm
  package contents.
- CI runs the type check, tests and a package build on every push and pull request. A Release
  workflow publishes to npm with provenance on `v*` tags. Dependabot keeps npm packages and
  GitHub Actions up to date.
- GitHub issue forms (bug, feature, component request), CODEOWNERS and `.nvmrc`.

### Changed

- The `react-native-dissolve` npm package is engine only: the engine, hooks, CLI and registry.
  The app UI components are not bundled, they are installed as source with the CLI.
- `scripts/build-package.sh` works with both BSD and GNU sed, so the package builds on Linux CI.

### Removed

- The `pile` variant and the `usePile` hook, with the `floor` option and the provider's persistent
  layers that only the heap used.

## [0.0.3] - 2026-11-15

### Fixed

- Website GitHub buttons link to the dissolve repo, the every variant grid plays one tile at a time.

## [0.0.2] - 2026-11-15

### Added

- The MCP server ships as its own dependency free package, `react-native-dissolve-mcp`.

## [0.0.1] - 2026-11-15

First public release.

### Added

- Engine: any React Native view is snapshotted with Skia `makeImageFromView`, cut into grains drawn
  with one `<Atlas>`, and animated on the UI thread with Reanimated 4 and react-native-worklets.
  One reaction pass per frame, idle grains skipped, grain counts capped at 6000 per burst.
- `DissolveProvider`: a full screen, `pointerEvents="none"` overlay that draws every effect and
  respects reduced motion.
- Variants:
  - Classic presets: `dust`, `sand`, `ember`, `pixel`, `vortex`.
  - Exits: `snap`, `fling`, `stream`, `shatter`, `pile`, `melt`.
  - Entrances: `gather`, `rain`, `print`.
  - Gestures: `charge` (hold to burst), `peel` (peel off like a sticker).
  - Transitions: `morph` (view A becomes view B).
- Common options on every atlas preset: `origin`, `direction` (any exit plays backwards as an
  entrance), `grain`, `duration`, `haptics` and free numeric knobs `n`.
- The `cascade` delay field (`field: 'cascade'` with `rows`): list rows leave in a diagonal wave.
- Hooks and components:
  - `useDissolve` for exits.
  - `DissolveIn` and `useAppear` for entrances.
  - `useDissolveScrub` for finger driven, reversible effects.
  - `useDissolveHold` for hold to confirm.
  - `useDissolvePeel` to peel a view by hand from any corner or edge.
  - `useDissolveScreen` for full screen transitions.
  - `useDissolveMorph` to turn one view into another.
  - `usePile` to sweep or clear the grains left by `pile`.
- Expo Router example app with demo screens for every variant and a playground.
- Static docs and showcase website in `web/`, with a live Canvas 2D port of the engine.
- Claude skill (`web/skills/dissolve/SKILL.md`) and an agent prompt page.
- Dependency free MCP server (`mcp/server.mjs`) exposing the docs as tools.

[Unreleased]: https://github.com/rs-4/dissolve/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/rs-4/dissolve/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/rs-4/dissolve/compare/v0.0.4...v0.0.5
[0.0.1]: https://github.com/rs-4/dissolve/releases/tag/v0.0.1
