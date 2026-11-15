# Contributing to dissolve

Thanks for taking the time to contribute. Bug reports, new variants, docs fixes and demo ideas
are all welcome.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need Node 20 or later and the Expo Go app on a device or simulator.

```sh
git clone https://github.com/rs-4/dissolve.git
cd dissolve
npm install
npm start        # then open the project in Expo Go
npx tsc --noEmit # type check, must pass before you open a pull request
```

## Project layout

| Path | What lives there |
|---|---|
| `src/dissolve/` | The library: provider, engine (`core.ts`, `Host.tsx`, `Particles.tsx`), hooks and variants |
| `src/dissolve/variants/` | One file per variant, wired in `registry.ts` |
| `src/dissolve/hooks/` | `useDissolve`, `useAppear`, `useDissolveScrub`, `useDissolveHold`, `useDissolvePeel`, `useDissolveScreen`, `useDissolveMorph`, `usePile` |
| `app/` | Expo Router example app: demo screens for every variant and a playground |
| `web/` | Static docs and showcase website (no build step) |
| `mcp/` | Dependency free MCP server exposing the docs to coding agents |
| `docs/CONTRACT.md` | Engine contract for variant authors, read it before writing a variant |
| `docs/VARIANTS.md` | Variant math and intent |

## Adding a variant

1. Read `docs/CONTRACT.md`. It explains the burst pipeline, the per grain buffer and the worklet rules
   (a `step` starts with `'worklet';`, is pure, never allocates and never reads shared values).
2. Create `src/dissolve/variants/<name>.ts` (or `.tsx` for a custom renderer) exporting an
   `AtlasVariant` or a `CustomVariant`. Keep the first frame identical to the captured view, so
   `direction: 'in'` plays it back cleanly.
3. Add the name to `VariantName` in `src/dissolve/types.ts`.
4. Register it in `REGISTRY` in `src/dissolve/variants/registry.ts`.
5. Add a demo in `app/` (the playground picks it up from the registry), and document it in
   `README.md`, `docs/VARIANTS.md`, the website (`web/data.js`) and the MCP server data
   (`mcp/server.mjs`).
6. Run `npx tsc --noEmit` and try it on a real device.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(peel): add useDissolvePeel hook to peel a view by hand
fix(engine): skip idle grains after the burst ends
docs: document the cascade field
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `test`, `build`, `ci`, `chore`.
Use a scope when it helps (`engine`, `web`, `mcp`, `app`, or a variant name). Keep the subject in
the imperative mood, lowercase, without a trailing period.

## Branches and pull requests

1. Fork the repo and create a branch from `main`, for example `feat/melt-drips` or `fix/peel-anchor`.
2. Keep each pull request focused on one change.
3. Make sure `npx tsc --noEmit` passes. CI runs it on every push and pull request.
4. Fill in the pull request template. Attach a short screen recording for anything visual.
5. A maintainer reviews it, and it gets merged once approved.

## Running the website locally

The website is plain HTML, CSS and ES modules, with no build step:

```sh
cd web
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Reporting bugs and security issues

Open an issue with the bug report template. For security issues, follow [SECURITY.md](SECURITY.md)
and do not open a public issue.
