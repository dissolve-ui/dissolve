# ConfettiBurst

**ConfettiBurst** is an animated confetti burst component for React Native and React, from the dissolve library. A short, quiet burst of paper from a button or a point: the pieces flutter, turn and fall, gone in under two seconds.

A short, quiet celebration: a few small pieces of paper thrown up from a point, or from the top of a button, that flutter as they turn, slow down in the air and fall, fading out before they land. Real paper physics, kept small: about forty pieces, under two seconds, one shot per fire(). Pieces are rectangles, strips or dots, in the colors you pass; by default the foreground and muted tokens, so it stays monochrome and follows light and dark mode. On iOS it is simulated and drawn with Skia on the UI thread, in one canvas over the screen that never takes a touch, with a success haptic. On the web one canvas covers the viewport (or the container you pass) during a burst and is removed when the last piece is gone; it never takes a click. Reduced motion: no burst at all, fire() resolves at once.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add confetti-burst --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/confetti-burst.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add confetti-burst --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/confetti-burst.json
```

## Usage

ConfettiBurst.tsx (React Native):

```tsx
import { ConfettiBurst } from '@/components/dissolve/confetti-burst';

const confetti = useRef<ConfettiBurstHandle>(null);
const button = useRef<View>(null);

<View style={{ flex: 1 }}>
  <View ref={button}>
    <GlossyButton label="Place order" onPress={() => confetti.current?.fire({ from: button })} />
  </View>
  {/* Last child: the pieces fly over the whole screen. */}
  <ConfettiBurst ref={confetti} />
</View>

// Dots in your brand colors, a bigger throw.
<ConfettiBurst ref={confetti} shapes={['dot', 'rect']} colors={['#FF6B6B', '#FFD93D']} power={1.4} />
```

ConfettiBurst.tsx (React):

```tsx
import { useRef } from 'react';
import { ConfettiBurst, type ConfettiBurstHandle } from '@/components/dissolve/confetti-burst';

const confetti = useRef<ConfettiBurstHandle>(null);
const button = useRef<HTMLButtonElement>(null);

<button ref={button} onClick={() => confetti.current?.fire({ from: button.current! })}>Place order</button>
<ConfettiBurst ref={confetti} />

// Dots in your brand colors, a bigger throw, inside a card.
<ConfettiBurst ref={confetti} shapes={['dot', 'rect']} colors={['#FF6B6B', '#FFD93D']} power={1.4} container={card} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `ref.fire` | `(at?: { x?, y?, from? }) => Promise<void>` |  | Throws one burst: from a point (in the coordinates of the ConfettiBurst view on React Native, of the viewport on the web), from the top of a view or element (from: a ref on React Native, an element on the web), or from the center. |
| `count` | `number` | `40` | Pieces per burst. |
| `colors` | `string[]` |  | Piece colors. Default: the foreground and muted tokens. |
| `shapes` | `('rect' \| 'strip' \| 'dot')[]` | `['rect', 'strip']` | Piece shapes, picked at random. |
| `size` | `number` | `8` | Size of a piece, pt. |
| `spread` | `number` | `70` | Width of the throw, degrees around straight up. |
| `power` | `number` | `1` | How hard the pieces are thrown, 1 is a button's worth. |
| `container` | `HTMLElement \| null` |  | Web only: draw over this element instead of the viewport. |
| `haptics` | `boolean` | `true` | A success haptic with each burst (a short vibration on the web, where the browser has it). |

## Source

- React Native: [registry/confetti-burst.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/confetti-burst.tsx)
- React: [registry/web/confetti-burst.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/confetti-burst.tsx) and [registry/web/confetti-burst.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/confetti-burst.core.ts)

Previous: [TextScramble](https://dissolve.rselmi.com/components/text-scramble/) · Next: [MagnifyDock](https://dissolve.rselmi.com/components/magnify-dock/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/confetti-burst/
