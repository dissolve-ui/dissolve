# dissolve

Expo SDK 57 app (expo-router, runs in Expo Go) hosting `react-native-dissolve` in `src/dissolve/`.
A view is snapshotted with Skia `makeImageFromView`, cut into grains drawn with one `<Atlas>`, and
animated on the UI thread (Reanimated 4, react-native-worklets). Every grain is computed in a single
reaction pass per frame, idle grains are skipped, and grain counts are capped at 6000.

```sh
npm start        # then open in Expo Go
npx tsc --noEmit # type check
```

Wrap the app once in `<DissolveProvider>` (see `app/_layout.tsx`), then:

```tsx
const { ref, dissolving, dissolve } = useDissolve();
<View ref={ref} style={{ opacity: dissolving ? 0 : 1 }} />
await dissolve({ preset: 'sand' });
```

Engine contract for variant authors: `docs/CONTRACT.md`. Variant math and intent: `docs/VARIANTS.md`.

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

### New variants

| Variant | Usage |
|---|---|
| `snap` | `dissolve({ preset: 'snap', origin: { x, y } })` bursts from the touch point, `n: [push]` |
| `fling` | `dissolve({ preset: 'fling', velocity: { x: e.velocityX, y: e.velocityY } })` follows the swipe |
| `stream` | `dissolve({ preset: 'stream', to: trashRef, onArrive })` flies into a target |
| `gather` | `<DissolveIn preset="gather">{card}</DissolveIn>` converges from a cloud |
| `rain` | `<DissolveIn preset="rain" delay={i * 40}>{row}</DissolveIn>` falls and settles, bottom first |
| `print` | `useAppear().appear({ preset: 'print' })` printed line by line |
| `charge` | `const { ref, gesture, style } = useDissolveHold({ onCommit })` hold to heat, bursts at full charge |
| scrub | `const { ref, gesture, style } = useDissolveScrub({ preset: 'dust', onCommit })` finger driven, reversible |
| cascade | `dissolve({ preset: 'dust', field: 'cascade', rows: [0, 72, 144] })` list rows leave in a diagonal wave |
| screen | `useDissolveScreen().dissolveScreen({ preset: 'sand', then: () => router.back() })` full screen |
| `shatter` | `dissolve({ preset: 'shatter', origin: { x, y }, n: [220] })` glass shards from the impact |
| `pile` | `dissolve({ preset: 'pile', floor: 'screen' })` then `usePile().sweepPile({ preset: 'dust' })` |
| `morph` | `const { refA, refB, styleA, styleB, morph } = useDissolveMorph(); await morph()` A becomes B |

Demo screens live in `app/` (playground, stream, appear, fling, gestures, cascade, screen, shatter, pile, morph).
