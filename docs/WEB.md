# React web components: how to convert a component

Every component can ship as an installable React web component, with the same props as the React
Native version and one doc. The website (https://dissolve.rselmi.com, whose source is no longer in
this repository) runs these same cores, so there is one implementation.

The two pilots are the reference: **scratch-card** (canvas, pointer, slot for content, imperative
handle, engine dust) and **glossy-button** (a styled `<button>`, springs, two slots). Read their files
before starting.

## Files

For a component `<name>` (kebab case, as in `registry/index.json`):

| File | What it is |
| --- | --- |
| `registry/web/<name>.core.ts` | The component, framework free. Owns its DOM, canvas, pointer, springs, cleanup. |
| `registry/web/<name>.tsx` | The React wrapper. Tiny: the shared hook, portals for children, the ref handle. |

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
  code.
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
- **Pointer events**: synthetic events (a demo autoplay) have no coalesced events and cannot be
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

## Build and verify

```sh
npx tsc -p tsconfig.web.json --noEmit   # registry/web, DOM + react-jsx
npx tsc --noEmit                        # the app and the native registry
npm test                                # includes test/web-components.test.mjs
```

`test/web-components.test.mjs` fails when a wrapper has no `registry/index.json` entry, does not
follow the wrapper pattern (the shared hook, its core, the named exports), or when a core imports
React or anything outside `registry/web`.

Then check it in a browser, light and dark, in a small React app
(`node packages/dissolve-ui/bin/dissolve.mjs add <name> --web --cwd ../my-app` after
`npm run build:package`), with no console errors.
