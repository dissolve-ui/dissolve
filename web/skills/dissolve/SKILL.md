---
name: react-native-dissolve
description: Add particle disintegration and assembly effects to React Native and Expo apps with react-native-dissolve (Skia snapshot + Reanimated 4 grains on the UI thread). Use when the user wants a view, list row, card, message, sticker or whole screen to dissolve, turn into dust or sand, burn, shatter, melt, peel off, fly into an icon, appear from particles, or be destroyed by a hold or swipe gesture, or when the code imports react-native-dissolve, DissolveProvider, useDissolve, DissolveIn, useAppear, useDissolveScrub, useDissolveHold, useDissolvePeel, useDissolveScreen or useDissolveMorph.
---

# react-native-dissolve

Snapshots any view with Skia (`makeImageFromView`), cuts it into grains drawn with one `<Atlas>`, and animates every grain on the UI thread (Reanimated 4, react-native-worklets). Capped at 6000 grains per burst. Runs in Expo Go.

## Setup (once per app)

1. Install the package and its peers:

```sh
npx expo install react-native-dissolve @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

Known good: Expo SDK 57, React Native 0.86, Skia 2.6, Reanimated 4.5, worklets 0.10, gesture handler 2.32. Expo's Babel preset adds the worklets plugin; a bare React Native app needs `'react-native-worklets/plugin'` in `babel.config.js`.

2. Wrap the root layout once, above the navigator, so grains survive a screen pop:

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from 'react-native-dissolve';

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

Before adding the provider, check it is not already there. Never add a second one.

## Ready-made components

Components are NOT exported by the package. They are copied into the app with the CLI, shadcn style, and the user owns the files. Never write `import { SlideToConfirm } from 'react-native-dissolve'`.

They need NativeWind v5 (Tailwind v4 on react-native-css) and tailwind-merge. On Expo SDK 57:

```sh
npm pkg set overrides.lightningcss=1.30.1
npm install --legacy-peer-deps nativewind@5.0.0-preview.4 react-native-css@3.0.7 tailwindcss@^4 @tailwindcss/postcss tailwind-merge
```

Then `metro.config.js` wraps the config with `withNativewind(getDefaultConfig(__dirname), { inlineVariables: false, globalClassNamePolyfill: false })` (from `nativewind/metro`), `postcss.config.mjs` uses `@tailwindcss/postcss`, `nativewind-env.d.ts` references `react-native-css/types`, and `global.css` imports `tailwindcss/theme.css`, `preflight.css` and `utilities.css` and is imported once in the root layout.

```sh
npx react-native-dissolve init                 # once: tw.tsx primitives + --dissolve-* tokens in global.css, checks the setup
npx react-native-dissolve add slide-to-confirm # one or more names; components they build on are copied too
npx react-native-dissolve list                 # every name
```

```tsx
import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';
```

Restyle with `className` and the part classNames (`textClassName`, `boxClassName`...): classes go through tailwind-merge, so later classes win. Theme tokens (`--dissolve-background`, `surface`, `surface-2`, `foreground`, `muted`, `primary`, `primary-foreground`, `success`, `danger`, `danger-foreground`, `accent`, `border`, `chart-1` to `chart-3`, `chart-1`, `chart-2`, `chart-3`) live in `global.css` with a dark block; keep them in `@theme inline` so dark mode resolves. `toast` needs `<ToastProvider>` inside `<DissolveProvider>`.

| Component | Use it for |
|---|---|
| `swipe-to-delete` | Swipe a row left to delete it: it dissolves, then the list closes up. |
| `toast` | Toasts that arrive in grains and leave as dust, with an optional Undo action. |
| `like-button` | Heart that pops with sparks on like and snaps into grains on unlike. |
| `morph-button` | Dynamic Island style pill that folds into a loader, then opens as the done state. |
| `split-button` | Splits in two like a drop of liquid metal, Cancel and Confirm halves. |
| `slide-to-confirm` | Slide to pay or confirm, shimmer label, loader, done state. |
| `gooey-menu` | Floating button whose actions pour out as gooey drops. |
| `otp-input` | One time code boxes, verify sweep, success tint, shake and dust on reject. |
| `number-ticker` | Rolling digit columns for prices and counters, locale aware. |
| `reaction-picker` | iMessage style reactions: long press, dock magnifier, emoji flies to a badge. |
| `voice-note` | Voice message bubble: play, scrub the waveform with ticks, unsend as dust. |
| `card-stack` | Wallet style card stack: tap to focus, drag down to put back, swipe to cycle. |
| `signature-pad` | Variable width Skia signature, undo, clear into dust, PNG export. |
| `before-after` | Before / after image comparison with a draggable divider and haptic ticks. |
| `thinking-orb` | A sphere of dots that shows what an AI agent is doing: thinking, searching, listening, done. |
| `image-reveal` | Image generation loader: a thinking mosaic that resolves coarse to fine, then settles in grains. |
| `sweep-transition` | A crisp light band sweeps across a view and leaves the new state behind it. |
| `upload-tile` | Attachment that assembles from grains, fills a progress ring, rejected files leave as dust. |
| `task-check` | Checkbox that draws its check and strikes the label, then the task moves away or dissolves. |
| `quantity-stepper` | Minus and plus with rolling digits and an accelerating long press; at 1 it turns into a trash. |
| `ruler-picker` | Horizontal ruler with momentum, rolling value and a haptic tick per graduation. |
| `bar-chart` | Bar chart you scrub with a finger, sliding bubble, bars regrow on period change. |
| `search-morph` | The magnifier becomes the search field; clearing turns the query into dust. |
| `mini-player` | Now playing pill that opens into a full player as one object, then folds back. |

## Core pattern

```tsx
import { useDissolve } from 'react-native-dissolve';

function Row({ item, onRemove }) {
  const { ref, dissolving, dissolve } = useDissolve();
  return (
    <Pressable onPress={async () => { await dissolve({ preset: 'dust' }); onRemove(item.id); }}>
      <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
        {/* content */}
      </View>
    </Pressable>
  );
}
```

Rules:
- Put `ref` on the exact view to snapshot, with `collapsable={false}`. Its background, padding and radius are what the grains look like.
- Hide the original with `opacity: dissolving ? 0 : 1`. Do not unmount it before `await dissolve(...)` resolves.
- `dissolve()` resolves when the space can be reclaimed: update state (remove the item) after the await.
- `reset()` makes the view visible again (e.g. for undo).

## Common options (every atlas preset)

| Option | Type | Notes |
|---|---|---|
| `preset` | `VariantName` | default `'dust'` |
| `origin` | `'left' \| 'right' \| 'top' \| 'bottom' \| 'center' \| { x, y }` | point in local coords (`nativeEvent.locationX / locationY`) |
| `direction` | `'out' \| 'in'` | any exit played backwards is an entrance |
| `grain` | number (pt) | default about 3, raised automatically to stay under 6000 grains |
| `duration` | ms | 900 to 1800 feels right |
| `haptics` | boolean | soft impact plus ticks |
| `field`, `rows` | `'cascade'`, `number[]` | rows leave in a diagonal wave (local Y of each row) |
| `n` | `[n0?, n1?, n2?, n3?]` | free knobs (snap push, shatter shard count) |
| `velocity` | `{ x, y }` pt/s | fling |
| `to` | ref or `{ x, y, width, height }` | stream target |
| `onArrive` | `() => void` | stream, grains reached the target |

## Picking a variant

| Situation | Use |
|---|---|
| Delete a row or card | `dissolve({ preset: 'dust' })` |
| Delete forever, heavy | `sand` |
| Unsend, burn, destroy a secret | `ember` |
| Digital or retro removal | `pixel` |
| Minimize, collapse to a point | `vortex` |
| Tap to pop | `snap` with `origin` = touch point |
| Error, broken, rejected | `shatter` with `origin`, `n: [220]` |
| Playful, liquid exit | `melt` |
| Archive, move to folder, add to cart | `stream` with `to: iconRef` and `onArrive` |
| Swipe to dismiss | `fling` with the release `velocity` |
| Reversible drag to erase | `useDissolveScrub` |
| Sticker or card dismissal by hand | `useDissolvePeel` |
| Destructive confirm (delete account, wipe) | `useDissolveHold` (charge), instead of an alert |
| Clear all | `field: 'cascade'` on the list container |
| New message or card arrives | `<DissolveIn preset="gather">` |
| List entrance | `<DissolveIn preset="rain" delay={i * 40}>` |
| Generated text, receipt | `useAppear().appear({ preset: 'print' })` |
| Toggle state (Follow to Following) | `useDissolveMorph` |
| Leave a screen | `useDissolveScreen` |

## Hooks

### Entrances: `DissolveIn` / `useAppear`

```tsx
<DissolveIn preset="gather" style={styles.card} onAppear={() => {}}>
  <Card />
</DissolveIn>
```

Props: every `DissolveOptions` field plus `delay` (ms), `play` (default true, flip false to true to play later), `onAppear`, `style` (snapshotted), `from` (source ref for `stream` entrances).

```tsx
const a = useAppear();
useEffect(() => { a.appear({ preset: 'print' }); }, []);
<View style={a.wrapStyle}>
  <View ref={a.ref} collapsable={false} style={styles.card}>{text}</View>
</View>
```

Returns `{ ref, visible, appear, reset, wrapStyle }`.

### Stream into a target

```tsx
const trash = useRef<View>(null);
await dissolve({ preset: 'stream', to: trash, duration: 1300, onArrive: () => bumpBadge() });
```

### Scrub (finger driven, reversible)

```tsx
const { ref, gesture, style } = useDissolveScrub({ preset: 'dust', axis: 'x', onCommit: remove });
<GestureDetector gesture={gesture}>
  <Animated.View ref={ref} style={[styles.card, style]} />
</GestureDetector>
```

Options: `preset`, `axis`, `threshold`, `velocity`, `grain`, `duration`, `haptics`, `onCommit`, `onCancel`. Returns `{ ref, gesture, progress, style, reset }`.

### Peel (sticker, by hand)

```tsx
const { ref, gesture, style, reset } = useDissolvePeel({ onCommit: remove });
<GestureDetector gesture={gesture}>
  <Animated.View ref={ref} style={[styles.sticker, style]} />
</GestureDetector>
```

Options: `threshold` (fraction of the diagonal, default 0.4), `velocity` (pt/s, default 900), `grain`, `duration` (default 700), `haptics`, `onCommit`, `onCancel`. Returns `{ ref, gesture, style, progress, reset }`. Below the threshold the corner springs back.

### Hold to destroy (charge)

```tsx
const { ref, pressHandlers, style, charge } = useDissolveHold({ holdMs: 1200, onCommit: remove });
<Pressable {...pressHandlers}>
  <Animated.View ref={ref} style={[styles.card, style]} />
</Pressable>
```

Options: `holdMs`, `then` (final variant, default `'charge'`), `grain`, `duration`, `haptics`, `maxDistance`, `onCommit`, `onCancel`. Also returns `gesture` for a `GestureDetector`, `progress` and `reset`.

### Morph

```tsx
const { refA, refB, styleA, styleB, morph } = useDissolveMorph();
<View style={[abs, styleA]}><View ref={refA} collapsable={false}>{follow}</View></View>
<View style={[abs, styleB]}><View ref={refB} collapsable={false}>{following}</View></View>
await morph();                  // A becomes B
await morph({ reverse: true }); // and back
```

Both views stay mounted and stacked. Styles go on a wrapper of the ref'd view.

### Full screen

```tsx
const { ref, dissolveScreen } = useDissolveScreen();
<View ref={ref} collapsable={false} style={{ flex: 1 }}>{screen}</View>
dissolveScreen({ preset: 'sand', then: () => router.back() });
```

Give that screen `animation: 'none'` (or `'fade'`) in its Stack options. Options add `then`, `onFinish`, `maxGrains` (default 5000).

## Best practices

- One effect per user action, triggered by user intent. Never on scroll or on a timer.
- Reduced motion is handled by the provider: the effect is skipped and the view hides at once. Do not add a custom fallback, and do not rely on the animation finishing for app logic beyond the returned promise and callbacks.
- Keep grain counts reasonable: default grain on cards and rows, a larger `grain` on big views, `useDissolveScreen` for full screens, one `cascade` burst on the container instead of one burst per row. Stagger entrances only for visible rows.
- Keep durations between 0.9 s and 1.8 s. Exits feel best slightly faster than entrances.
- Gestures (`useDissolveScrub`, `useDissolvePeel`, `useDissolveHold` gesture) need `GestureHandlerRootView` at the root and an `Animated.View` target.
- Use the exports above only. Do not reach into internals or write custom variants unless asked.
