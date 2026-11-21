# React web components: how to convert a component

Every component the site demos in `web/cp/*.js` becomes an installable React web component, with the
same props as the React Native version and one doc. The animation code already exists in the site
ports: we extract it and package it, we do not redesign it. The site then runs the packaged code, so
there is one implementation, and the result must look exactly like the site does today.

The two pilots are the reference: **scratch-card** (canvas, pointer, slot for content, imperative
handle, engine dust) and **glossy-button** (a styled `<button>`, springs, two slots). Read their files
before starting.

## Files

For a component `<name>` (kebab case, as in `registry/index.json`):

| File | What it is |
| --- | --- |
| `registry/web/<name>.core.ts` | The component, framework free. Owns its DOM, canvas, pointer, springs, cleanup. |
| `registry/web/<name>.tsx` | The React wrapper. Tiny: the shared hook, portals for children, the ref handle. |
| `web/cp/<file>.js` | The site demo only: sizes, demo content, gallery modes, autoplay, the doc entry. |
| `web/lib/<name>.js` | Built from the core by `scripts/build-web.mjs`. Committed, never edited. |

Shared, do not fork them: `registry/web/engine.ts` (the grain engine: `play`, `morph`, `snapshot`,
`DPR`, `VARIANTS`, `cancelAll`), `registry/web/kit.ts` (curves, springs, scope, DOM and canvas
helpers, theme tokens, `capture(node)` for a canvas replica of any DOM content the grains start from), `registry/web/react.ts` (the `useDissolveCore` hook). If you need a generic
helper that is missing, add it to `kit.ts` in a small additive edit (re-read the file first, other
converters edit it too), or keep it local to your core. Imports between registry/web files are
relative (`'./kit'`), so the CLI copies them along.

Nothing to declare anywhere: a component is available for the web as soon as
`registry/web/<name>.tsx` exists (`npx dissolve-ui list` shows it, `add` installs it).

## The core

```ts
export function createScratchCard(host: HTMLElement, initial: ScratchCardProps = {}): ScratchCardInstance
```

- **Props**: same names and defaults as `registry/<name>.tsx` (native), minus React only ones
  (`children`, `ref`, `style`, which live in the wrapper). Keep them in a `DEFAULTS` object and read
  them through `propsOf(DEFAULTS, initial)`: `props.current` is always resolved, and
  `props.update(next)` returns the set of names that changed (an `undefined` value puts the default
  back). `update()` runs on every React render, so only redo work for what changed.
- **Instance**: `update(props)`, `destroy()`, the extras of the native ref handle (`reset`, `reveal`,
  `progress`...) and a slot element for each place user content goes (`slot`, `icon`...).
- **Host**: mark it with `host.dataset.dissolve = '<name>'`. Never write `host.className`: React owns
  it. Native `className` props that target an inner part (the card, the label) are applied by the
  core to its own elements. Setting host inline sizes is fine (`width`/`height` from props).
- **Styles**: base CSS once per document with `injectStyle('dissolve-<name>', CSS)`, using
  `:where(...)` selectors so any user class wins. Exception: page resets (`button { background:
  none; padding: 0 }`, Tailwind preflight) beat `:where()`. For form controls, set the look inline
  from the props, as the glossy button does (on native, its className only reaches the outer box too).
- **Theme**: read the tokens of `registry/theme.css` as CSS variables with a fallback,
  `var(--dissolve-surface, rgb(242 242 247))` in CSS or `token(node, 'surface', fallback)` in canvas
  code. The site maps them to its palette in `web/styles.css`.
- **Text on canvas**: `fontOf(host)` once the host is in the document (a detached element has no
  computed font).
- **Motion**: `scope()` for timers, frames and engine bursts (`sc.track(play(...))`), `value(sc, ...)`
  for springs and tweens, `loop(sc, node, fn, active)` for a rAF loop that sleeps off screen.
  `reducedMotion()` read live where the native version uses `useReducedMotion`.
- **Haptics**: `vibrate(pattern)` where the native one calls expo-haptics, only when `haptics` is on.
- **Cleanup**: `destroy()` disposes the scope, removes every listener added outside its own nodes
  (window, document), removes every node it added and the host attributes and styles it set. React
  StrictMode creates, destroys and creates again: the second core must start clean.
- **No site code**: no gallery modes, no autoplay, no demo text. No DOM access at module top level
  (the wrapper is imported during server rendering).
- **Pointer events**: synthetic events (the site autoplay) have no coalesced events and cannot be
  captured. Use `e.getCoalescedEvents?.()` only when it returns something, and wrap
  `setPointerCapture` in a try.

## The wrapper

`registry/web/scratch-card.tsx`, the whole pattern:

```tsx
'use client';
import { useImperativeHandle, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { createScratchCard, type ScratchCardHandle, type ScratchCardProps as CoreProps } from './scratch-card.core';
import { useDissolveCore } from './react';

export type ScratchCardProps = CoreProps & { children?: ReactNode; style?: CSSProperties; ref?: Ref<ScratchCardHandle> };

export function ScratchCard({ children, style, ref, ...props }: ScratchCardProps) {
  const { host, instance, current } = useDissolveCore(createScratchCard, props);
  useImperativeHandle(ref, () => ({
    reset: () => current.current?.reset(),
    reveal: async () => current.current?.reveal(),
    progress: () => current.current?.progress() ?? 0,
  }), [current]);
  return <div ref={host} style={style}>{instance ? createPortal(children, instance.slot) : null}</div>;
}
```

- The host element is the right tag for the component (`<button>` for a button). It gets `style`,
  and `className` when the native className targets the outer box.
- `ref` is a prop (React 19), exactly like the native components.
- Native only props (`haptics`) stay accepted; the core maps them or ignores them.
- Render props keep their native shape: glossy-button calls `icon({ color, size })` and portals
  the result into `instance.icon`.
- The doc comment at the top: what it is and two usage examples, like the native file.

## The site port

The port keeps only the demo and drives the core through its public API. From `web/cp/scratch.js`:

```js
import { createScratchCard } from '../lib/scratch-card.js';

const host = el('div');
root.append(host);
body.append(tile ? fitTile(body, root, W, H + 8) : root); // in the document first, then create
const card = createScratchCard(host, { width: W, height: H, className: 'sc-card', contentClassName: 'sc-content', onReveal });
card.slot.innerHTML = '<span class="sc-kicker">YOU WON</span>...';
sc.onDispose(() => card.destroy());
```

- Site specific looks (per theme shadows, the site palette) stay in the port's CSS, through the
  classes passed as `className` props or the `--dissolve-*` tokens. Delete the port CSS rules the
  core now brings.
- Autoplay scripts use the public API (`reset()`, `update()`) or dispatch real `PointerEvent`s on
  the component's element, with their own `pointerId`, so a real pointer can take over. Never reach
  into private state.
- The doc entry (`ENTRIES`) does not move: its `prop(...)` list is the one doc for both platforms.
  A documented prop that cannot exist on the web goes in the entry as `nativeOnly: ['propName']`.
- The component page grows a React Native / React switch on its own once the wrapper exists (the
  build writes the list to `web/lib/available.js`). The React snippet is the native `code` with
  `Text` and `View` turned into `span` and `div`; when that is not enough, give the entry its own
  `webCode`. Props in `nativeOnly` get a React Native tag in the props table.

## Build and verify

```sh
npm run web:stamp                       # builds web/lib from registry/web, cache busts the site, writes the static pages
npx tsc -p tsconfig.web.json --noEmit   # registry/web, DOM + react-jsx
npx tsc --noEmit                        # the app and the native registry
npm test                                # includes test/web-parity.test.mjs
```

`test/web-parity.test.mjs` fails when a port imports `../lib/<name>.js` without its wrapper and
core, when a wrapper exists but the site does not run its core, when a documented prop is missing
from the Props types (wrapper and core together), when a core imports React, and when `web/lib` is
not the current build of `registry/web`.

Then check the page in a browser, light and dark, gallery tile and component page, with no console
errors. A headless check: `playwright-core` is in `~/.claude/skills/dissolve-video/node_modules`
(`chromium.launch({ channel: 'chrome' })`), the site on `http://127.0.0.1:8765`. To compare with the
site before your change, serve the committed version next to it:

```sh
mkdir -p /tmp/base && git archive HEAD web | tar -x -C /tmp/base
cd /tmp/base/web && python3 -m http.server 8766 --bind 127.0.0.1
```

and screenshot the same states on both ports (pixel identical is the goal for static states).
