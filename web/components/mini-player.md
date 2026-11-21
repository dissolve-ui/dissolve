# MiniPlayer

**MiniPlayer** is an animated mini player component for React Native and React, from the dissolve library. Now playing pill that opens into a full player as one object, then folds back.

A now playing bar in liquid glass that opens into the full player as one object, then folds back. Width, height, radius, artwork and the glass surface all follow one value, the artwork arcs into place, and a vertical drag drives it 1:1. In the pill the title sits centered beside the artwork and truncates before the controls. Swipe the closed pill sideways to skip.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add mini-player --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/mini-player.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add mini-player --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/mini-player.json
```

## Usage

MiniPlayer.tsx (React Native):

```tsx
import { MiniPlayer } from '@/components/dissolve/mini-player';

// Liquid glass surface: npx expo install expo-glass-effect
// Last child of a full screen container: it covers it when open.
<MiniPlayer
  title="Night Swim"
  subtitle="Low Tide"
  artwork={cover}
  progress={0.3}
  duration={214}
  playing={playing}
  onPlayPause={toggle}
  onNext={next}
  onPrev={prev}
/>
```

MiniPlayer.tsx (React):

```tsx
import { MiniPlayer } from '@/components/dissolve/mini-player';

// Last child of a positioned container (relative, full screen): it covers it when open.
<MiniPlayer
  title="Night Swim"
  subtitle="Low Tide"
  artwork="/covers/night-swim.jpg"
  progress={0.3}
  duration={214}
  playing={playing}
  onPlayPause={toggle}
  onNext={next}
  onPrev={prev}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `required` | Track title. Centered beside the artwork and truncated before the controls in the pill, it travels to centered below the artwork. |
| `subtitle` | `string` |  | Artist or album. |
| `artwork` | `ImageSource` | `required` | Cover, grows from 40 pt to the player width. |
| `progress` | `number` | `0` | Track progress, 0 to 1. |
| `duration` | `number` |  | Track length in seconds. Shows the elapsed and remaining times. |
| `playing` | `boolean` | `required` | Play or pause glyph. |
| `onPlayPause` | `() => void` | `required` | Play and pause buttons. |
| `onNext / onPrev` | `() => void` |  | Skip buttons and the sideways swipe on the pill. |
| `expanded` | `boolean` |  | Controlled open state. |
| `onExpandedChange` | `(expanded: boolean) => void` |  | Called when it opens or folds back. |
| `renderExpanded` | `(api: { close }) => ReactNode` |  | Replaces the bottom row of the open player (lyrics, AirPlay, queue). |
| `bottom` | `number` | `24` | Gap under the closed pill, and bottom padding when open. |
| `topInset` | `number` | `60` | Gap left above the open player. |
| `haptics` | `boolean` | `true` | Rigid when it locks open, light on close, a tick crossing halfway. |
| `glass` | `boolean` | `true` | Liquid glass surface (expo-glass-effect, iOS 26+). Falls back to the surface token with a hairline border. |
| `className` | `string` |  | Player surface classes (background, border) for the fallback surface. |

## Source

- React Native: [registry/mini-player.tsx](https://github.com/rs-4/dissolve/blob/main/registry/mini-player.tsx)
- React: [registry/web/mini-player.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/mini-player.tsx) and [registry/web/mini-player.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/mini-player.core.ts)

Previous: [BarChart](https://dissolve.rselmi.com/components/bar-chart/) · Next: [PullToRefresh](https://dissolve.rselmi.com/components/pull-to-refresh/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/mini-player/
