# Contributing to dissolve

Thanks for taking the time to contribute. Bug reports, new variants, docs fixes and demo ideas
are all welcome.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need Node 22 (see `.nvmrc`, `nvm use` picks it up) and the Expo Go app on a device or simulator.

```sh
git clone https://github.com/dissolve-ui/dissolve.git
cd dissolve
npm install        # .npmrc sets legacy-peer-deps for the NativeWind v5 preview
npm start          # then open the project in Expo Go
npm run check      # type check + tests, must pass before you open a pull request
```

## Project layout

| Path | What lives there |
|---|---|
| `src/dissolve/` | The library: provider, engine (`core.ts`, `Host.tsx`, `Particles.tsx`), hooks and variants |
| `src/dissolve/variants/` | One file per variant, wired in `registry.ts` |
| `src/dissolve/hooks/` | `useDissolve`, `useAppear`, `useDissolveScrub`, `useDissolveHold`, `useDissolvePeel`, `useDissolveScreen`, `useDissolveMorph` |
| `registry/` | Copy paste components installed by the CLI: one file each, `index.json`, `tw.tsx` primitives, `theme.css` tokens |
| `registry/web/` | The React web versions: a framework free core and a React wrapper per component, plus the shared engine, kit and hook (see [docs/WEB.md](docs/WEB.md)) |
| `packages/dissolve-ui/` | The npm package: the React Native engine and hooks (`lib/`), the `init/add/list` CLI (`bin/`) and a copy of the registry, native and web |
| `src/demos/` | One demo screen per component (`<Name>.demo.tsx`), listed in `src/demos/index.ts` |
| `app/` | Expo Router example app: demo screens for every variant and a playground |
| `web/` | Static docs and showcase website (no build step on the server), with the component demos in `web/cp/` (`web/components.js` assembles them) running the web cores built into `web/lib/` |
| `test/` | `node:test` suites: CLI, registry, theme, engine logic, package contents |
| `mcp/` | Dependency free MCP server exposing the docs to coding agents |
| `docs/VARIANTS.md` | Variant math and intent |

## Adding a variant

1. Read the engine types in `src/dissolve/types.ts` (`AtlasVariant`, `StepFn`, `CustomVariant`): they
   document the burst pipeline, the per grain buffer and the worklet rules (a `step` starts with
   `'worklet';`, is pure, never allocates and never reads shared values). Import shared helpers
   (`ss`, `eo`, `palette`...) from `core.ts` instead of copying them.
2. Create `src/dissolve/variants/<name>.ts` (or `.tsx` for a custom renderer) exporting an
   `AtlasVariant` or a `CustomVariant`. Keep the first frame identical to the captured view, so
   `direction: 'in'` plays it back cleanly.
3. Add the name to `VariantName` in `src/dissolve/types.ts`.
4. Register it in `REGISTRY` in `src/dissolve/variants/registry.ts`.
5. Add a demo in `app/` (the playground picks it up from the registry), and document it in
   `README.md`, `docs/VARIANTS.md`, the website (`web/data.js`) and the MCP server data
   (`mcp/server.mjs`).
6. Run `npm run check` and try it on a real device.

## Adding a component

Components are shadcn style: the CLI copies the source into the user's project, so they read like
app code. They are styled with NativeWind v5 classes and the `dissolve-*` theme tokens.

1. **Registry file.** Create `registry/<name>.tsx` (kebab case). Import primitives from `./tw`
   (`View`, `Text`, `Pressable`, `Animated`, `cn`, `useToken`), never from your app. Allowed
   packages: `react`, `react-native`, `dissolve-ui`, `@shopify/react-native-skia`,
   `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`,
   `expo-haptics`, `expo-symbols`, `expo-image`, `expo-glass-effect`, `expo-blur`, plus other registry files as `./<file>` (the CLI
   copies those along). Colors come from tokens: `bg-dissolve-surface`, `text-dissolve-muted`, or
   `useToken('accent')` for Skia and Reanimated values. No hex colors in class names.
2. **Index entry.** Add it to `registry/index.json`:
   `{ "name": "<name>", "file": "<name>.tsx", "export": "MyComponent", "description": "One line." }`.
   `export` lists the names the CLI prints in the import hint, comma separated.
3. **Demo.** Add `src/demos/<Name>.demo.tsx` importing from `@registry/<name>`, and list it in
   `src/demos/index.ts`.
4. **Web port.** Add an entry to the right `ENTRIES` map in `web/cp/*.js`, then run `npm run web:stamp`:
   title, description, a `mount` function drawing it on the page and the usage `code`. To ship it
   as a React web component too, follow [docs/WEB.md](docs/WEB.md): its page then shows a React
   Native / React switch on its own.
5. **Tests.** `npm test` checks the new file automatically: index entry and file match, declared
   exports exist, imports stay in the allowlist, tokens exist in `theme.css`, no em dash. Add a
   test in `test/` if the component brings new logic that can run in Node.
6. Try it end to end in a fresh Expo app:
   `node packages/dissolve-ui/bin/dissolve.mjs add <name> --cwd ../my-app` after
   `npm run build:package` (the CLI reads the registry copy inside the package).

New theme tokens go in `registry/theme.css` with a light value, a dark value and a
`--color-dissolve-*` mapping in `@theme inline` (the theme test enforces all three).

## Tests

```sh
npm run typecheck     # tsc --noEmit on the app, engine and registry
npm test              # every suite in test/ (node:test, no extra dependency)
npm run test:cli      # CLI only: init, add, list against temp projects
npm run test:registry # registry and theme consistency
npm run test:package  # builds the package in a temp copy and checks npm pack contents
npm run build:package # builds packages/dissolve-ui for real
```

CI runs the type check, the tests and the package build on every push and pull request.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(peel): add useDissolvePeel hook to peel a view by hand
fix(engine): skip idle grains after the burst ends
docs: document the cascade field
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `test`, `build`, `ci`, `chore`.
Use a scope when it helps (`engine`, `cli`, `registry`, `web`, `mcp`, `app`, a variant or a component
name). Keep the subject in
the imperative mood, lowercase, without a trailing period.

## Branches and pull requests

1. Fork the repo and create a branch from `main`, for example `feat/melt-drips` or `fix/peel-anchor`.
2. Keep each pull request focused on one change.
3. Make sure `npm run check` passes. CI runs the same checks on every push and pull request.
4. Fill in the pull request template. Attach a short screen recording for anything visual.
5. A maintainer reviews it, and it gets merged once approved.

## Running the website locally

The website is plain HTML, CSS and ES modules, with no build step:

```sh
cd web
python3 -m http.server 8000
```

Then open http://localhost:8000.

Every page has its own URL (`/components/<name>/`, `/effects/<name>/`, `/docs/<page>/`). `npm run web:stamp`
ends with `scripts/build-seo.mjs`, which writes a static `index.html` per URL from the site data (title,
description, JSON-LD and the page content for crawlers, then the app takes over), a markdown copy of
each page, `llms.txt`, `llms-full.txt`, `sitemap.xml` and `robots.txt`. They are committed, and
`test/seo.test.mjs` fails when they are stale. Links inside the site use these paths (`pathOf(id)` in
`web/routes.js`), and asset URLs start with `/`, since pages live in sub folders. Old `#/<id>` links
still open the right page.

## Reporting bugs and security issues

Open an issue with the bug report form (or the component request form for a new component). For security issues, follow [SECURITY.md](SECURITY.md)
and do not open a public issue.

## Releases

Maintainers bump `packages/dissolve-ui/package.json`, move the `[Unreleased]` notes in
`CHANGELOG.md` under the new version, then push a `v<version>` tag. The Release workflow runs the
checks, builds the package and publishes it to npm with provenance. It needs an `NPM_TOKEN`
repository secret (an npm automation token), added once in the repository settings.
