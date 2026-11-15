# react-native-dissolve: builder contract

Read this before touching anything. Six builders (A to F) work in parallel. Each one owns a fixed set of files and edits nothing else. Every export is already wired in `src/dissolve/index.tsx` and `src/dissolve/variants/registry.ts`, and each stub already compiles. Your job is to replace the TODO bodies while keeping the exported names and signatures.

Validate with `cd /Users/rayanselmi/works/dissolve && npx tsc --noEmit`. Ignore errors in files you do not own; keep yours at zero.

## 1. File ownership

| Group | Files (exclusive) | Exports that must stay |
|---|---|---|
| master | `index.tsx`, `types.ts`, `core.ts`, `context.ts`, `Host.tsx`, `Particles.tsx`, `presets.ts`, `variants/registry.ts`, `variants/classic.ts`, `hooks/useDissolve.ts` | everything |
| A snap + fling | `variants/snap.ts`, `variants/fling.ts` | `snap`, `fling` (AtlasVariant) |
| B stream + assemble | `variants/stream.ts`, `variants/assemble.ts`, `hooks/useAppear.tsx` | `stream`, `gather`, `rain`, `print` (AtlasVariant), `useAppear`, `DissolveIn`, `AppearOptions`, `DissolveInProps` |
| C scrub + charge | `variants/charge.ts`, `hooks/useDissolveScrub.ts`, `hooks/useDissolveHold.ts` | `charge` (AtlasVariant), `useDissolveScrub`, `ScrubOptions`, `useDissolveHold`, `HoldOptions` |
| D cascade | `variants/cascade.ts`, `hooks/useDissolveScreen.ts` | `cascadeField` (FieldFn), `useDissolveScreen`, `ScreenOptions` |
| E shatter | `variants/shatter.tsx` | `shatter` (CustomVariant) |
| F pile + morph | `variants/pile.tsx`, `variants/morph.tsx`, `hooks/useDissolveMorph.ts`, `hooks/usePile.ts` | `pile`, `morph` (CustomVariant), `useDissolveMorph`, `MorphOptions`, `usePile` |

All paths are under `src/dissolve/`. You may add private helper files only if they are prefixed with your variant name (e.g. `variants/shatter.mesh.ts`). You may not edit `app/` screens (the playground agent owns them), `package.json`, or any other group's file. Never import another builder's file: copy the small bits of math you need. You may extend the exported option types of your own hooks (add fields), but do not rename or remove exports.

If you truly need an engine change, do not make it: describe it in your final report.

## 2. Architecture

```
dissolve(opts) / builder hook
  -> runDissolve(ctx, ref, opts, extra)        hooks/useDissolve.ts
       capture(ref)  -> { image, box }          core.ts (makeImageFromView + measureInWindow)
       generic options: to -> target rect, floor -> floorY
       variant.resolve?(...)                    your async JS hook
       ctx.add(BurstInput) -> BurstHandle       index.tsx provider
         makeBurst: grain cap, pixel ratio, flat BurstParams   Host.tsx
  -> <BurstHost>                                 Host.tsx
       internal progress (withTiming 0..end, linear) unless burst.progress is given
       atlas  -> <Particles burst variant progress field />    Particles.tsx
       custom -> <variant.Renderer burst progress end />
       at the end: burst.onFinish?(), overlay removed two frames later
```

`makeBurst` also samples `burst.start = { p, a0, a1 }` (progress and aux values at add time) so renderers never read shared values during render.

The provider renders a full screen, `pointerEvents="none"` overlay above the app: first the persistent layers (`setLayer`), then one `BurstHost` per burst. Everything is in WINDOW coordinates.

## 3. Worklet dispatch (why it works on the UI thread)

There is no lookup by name on the UI thread. The variant is resolved on the JS side (`getVariant(burst.variant)` in `BurstHost`), and `Particles` captures `variant.step` in the closure of its single `useAnimatedReaction`. A worklet captured by another worklet is serialised with it, so the per-grain call is a plain direct function call. Rules for every `step`:

- First statement is `'worklet';`.
- Pure function of its arguments. Do not read any shared value inside it (a shared value read only inside a nested worklet is NOT tracked by the mapper). Animated inputs reach you as `a0` and `a1`.
- Do not allocate in it (no arrays, no objects). Write into `o`.
- Do not call non-worklet functions. Helpers from `core.ts` (`ss`, `eo`, `backOut`, `clamp01`) are worklets and are fine. Your own helpers must carry `'worklet'` too.

`timing`, `prepare`, `resolve` and `FieldFn` run on the JS thread, once, so they can do anything (sorting, Math.random, measuring).

## 4. Atlas variants (A, B, C, and F if it reuses the engine)

```ts
type AtlasVariant = {
  kind: 'atlas';
  name: VariantName;
  info: string;              // one line for the playground, no em dashes
  defaultGrain: number;
  end?: number;              // timeline end, default 1.2 (progress runs 0..end)
  natural?: 'out' | 'in' | 'both';
  resolve?: (c: ResolveCtx) => ResolveResult | Promise<ResolveResult>;
  extra?: number;            // extra floats per grain at d[k+8 ..]
  timing: (g: GrainSeed, P: BurstParams) => { delay: number; life: number };   // JS, once per grain
  spread?: number; jitter?: number; ownsOrigin?: boolean;
  prepare?: (d, stride, count, P, burst) => void;                              // JS, once
  step: (t, d, k, P, a0, a1, o) => void;                                       // UI worklet
};
```

Per grain buffer `d` (flat `number[]`), `k = i * stride`:

| slot | meaning |
|---|---|
| `d[k]`, `d[k+1]` | `lx`, `ly`: grain center in LOCAL coords of the captured view |
| `d[k+2..k+5]` | `r1..r4` random in 0..1 (r1 is used for delay jitter) |
| `d[k+6]`, `d[k+7]` | `delay`, `life` from `timing` (or overridden by a field / origin) |
| `d[k+8..]` | your `extra` slots, fill them in `prepare` |

Local time: `t = clamp((pe - delay) / life, 0, 1)` where `pe` is the progress, time reversed when needed (see direction).

Before each `step` call the engine resets `o` to the rest pose: `cx = P.x + lx`, `cy = P.y + ly`, `s = 1`, `rot = 0`, `r = g = b = 1`, `a = 1 - ss(t)`. `cx, cy` are the WINDOW center of the grain, `s` its scale, `rot` radians, `r g b a` modulate the sprite. A grain with `s <= 0` or `a <= 0` is hidden for free.

Perf contract kept by the engine: one pass per frame, grains whose `t` did not change since the last frame are skipped. Because of that skip, your step must be a pure function of `t` (plus `a0`, `a1`): no per-grain state between frames. When `a0` or `a1` changes, every grain is recomputed (charge uses this). Grain counts are capped at `MAX_GRAINS = 6000` by `capGrain` in `makeBurst`: big views get bigger grains automatically.

`BurstParams P` (flat numbers, captured once): `x y w h` (window rect), `grain pr cols rows maxR`, `dir` (0 out, 1 in), `sec` (duration in s), `hasOrigin ox oy maxD` (origin in LOCAL coords, defaults to the center), `vx vy` (pt/s), `tx ty tw th` (target rect in WINDOW coords, `tx ty` is its center), `floorY` (window, defaults to screen height), `n0..n3` free knobs (from `opts.n`, or from `resolve` via `params`).

### Origin (generic, every atlas preset)

`dissolve({ preset: 'sand', origin: 'right' })` or `origin: { x: locationX, y: locationY }`. Accepted: `'left' | 'right' | 'top' | 'bottom' | 'center' | {x, y}` (local point, the touch). When an origin is given and the variant does not set `ownsOrigin`, the engine replaces the delay with `field * spread + r1 * jitter` (edges are line fields, center and points are radial, normalised to 0..1). Variants built around the touch point (`snap`, `charge`) set `ownsOrigin: true` and read `P.ox`, `P.oy`, `P.maxD` themselves.

### Direction

`burst.direction` is `'out'` (disintegrate, grains rest at t = 0) or `'in'` (assemble, grains rest at t = 1).
- `natural: 'out'` (default): for direction `'in'` the engine plays the timeline backwards (`pe = end - p`). Any out preset becomes an entrance for free.
- `natural: 'in'` (assemble): same rule the other way. Invariant: at t = 1 the step must give the exact rest pose (`cx = P.x + lx`, `cy = P.y + ly`, `s = 1`, `rot = 0`, `a = 1`).
- `natural: 'both'` (stream, morph): never reversed, read `P.dir`.

The initial pose is computed on the JS side with the same `step`, so an entrance starts scattered on its very first frame. An out variant at t = 0 without aux uses the exact rest transform (pixel perfect first frame).

### resolve (optional, JS, async)

`resolve({ opts, box, image, grain, duration })` returns `{ params?, grain?, duration?, data?, haptics? }`. Use it to derive params from options (fling: duration from speed, stream: arrival haptics and `opts.onArrive` timers from the arrival quantiles). `haptics` replaces the default pattern. Change the grain through `grain`, never through `params.grain`. `opts.to` and `opts.floor` are already measured into `P.tx/ty/tw/th` and `P.floorY` before `resolve` runs.

### Fields (D)

`FieldFn = (g: GrainSeed, P, burst, life?, end?) => delay`, JS side. The engine passes the variant's own `life` for that grain and the timeline `end`, so a field can keep `delay <= end - life` (clean last frame). Selected with `dissolve({ preset: 'dust', field: 'cascade', rows })`; `rows` lands in `burst.rowBounds` (local Y bounds). A field wins over the origin delay; the variant keeps its own `life` and motion. A variant whose `prepare` rewrites delays (stream, pile) overrides the field.

## 5. Custom renderers (E shatter, F pile and morph)

```ts
type CustomVariant = { kind: 'custom'; name; info; defaultGrain; end?; natural?; resolve?;
  Renderer: ComponentType<{ burst: Burst; progress: SharedValue<number>; end: number }> };
```

- Render your own `<Canvas style={StyleSheet.absoluteFill} pointerEvents="none">`. It covers the window; draw at `burst.x / burst.y` (or `burst.params`).
- `progress` is raw (0..`end`, not reversed). Read `progress.value` DIRECTLY inside your `useDerivedValue` / `useAnimatedReaction` callback, never only inside a helper.
- Never read `.value` while rendering (Reanimated strict mode warns). Build the initial pose from `burst.start` (`{ p, a0, a1 }`: progress, aux0 and aux1 sampled by `makeBurst` inside `ctx.add`) and seed any "last frame" shared value with it.
- Precompute meshes, sprites, sort orders once with `useMemo`. One derived pass per frame.
- The host drives timing and calls `onFinish` then removes you. With an external progress nobody removes you except the owner.
- `burst.data` is your free payload (second image for morph). `burst.image` is the snapshot, `burst.params` the flat params.
- You may embed the engine: `<Particles burst={burst} variant={privateAtlasVariant} progress={progress} />` with a variant object private to your file (not registered).
- Persistent visuals (pile heap) go through `useDissolveContext().setLayer('pile', node)`; `setLayer('pile', null)` removes them. Layers render under the bursts and survive burst removal.

## 6. Hooks (B, C, D, F)

Use only public engine pieces:

- `useDissolveContext()` from `../context`: `{ add, remove, setLayer, reduced }`. `add(BurstInput)` returns `{ key, remove }`. Respect `reduced` (skip the effect, just show or hide).
- `runDissolve(ctx, ref, opts, extra)` from `./useDissolve`: the whole capture, resolve, add, haptics pipeline. `extra` is `{ progress?, aux0?, aux1?, data?, onFinish?, image?, box? }`; pass `image` and `box` to reuse a snapshot taken earlier (scrub and hold pre-capture on touch down). Returns `{ handle, duration }` or null.
- `capture(ref)`, `measure(ref)`, `frames(n)`, `capGrain`, `defaultHaptics` from `../core`.
- `getVariant(name)` from `../variants/registry` gives `end` and `defaultGrain`.

External progress (scrub, hold, appear if you want manual control): create a `useSharedValue(0)`, pass it as `extra.progress`, animate it yourself on the 0..`end` scale (`getVariant(preset).end ?? DEFAULT_END`). The engine never animates nor removes such a burst: call `handle.remove()` when done (after two frames if the real view must reappear first). `aux0` / `aux1` are extra shared values forwarded to `step` as `a0` / `a1` (charge level, clock).

Hiding the real view: snapshot first, add the burst, then hide the original two frames later (`frames(2)`), exactly like `useDissolve`. For entrances do the reverse: keep the real view at near zero opacity (0.01, opacity 0 can capture empty on iOS), capture, add with direction `'in'`, reveal it in `onFinish`.

Gestures: `react-native-gesture-handler` is installed and the root is wrapped in `GestureHandlerRootView`. Return a gesture object the screen wraps in `<GestureDetector>`.

## 7. Style rules

- No new dependencies, no `npm install`, Expo Go only (skia, reanimated, worklets, gesture-handler, expo-haptics).
- Calm motion on large surfaces: `Easing.bezier(0.32, 0.72, 0, 1)`; no bouncy springs. Small overshoot only on tiny elements (single grains, a badge).
- No em dashes in copy or comments. No git commit, no push.
