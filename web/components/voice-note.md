# VoiceNote

**VoiceNote** is an animated voice note component for React Native and React, from the dissolve library. Voice message bubble: play, scrub the waveform with ticks, unsend as dust.

A voice message bubble. Play and pause, the played part of the waveform takes the ink, drag along it to seek. Long press to unsend: the bubble blows away as dust. No audio dependency, playback is a timer you hook to your player.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add voice-note --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/voice-note.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add voice-note --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/voice-note.json
```

## Usage

VoiceNote.tsx (React Native):

```tsx
import { VoiceNote } from '@/components/dissolve/voice-note';

<VoiceNote
  mine
  duration={9}
  seed="msg-42"
  onPlay={() => player.play()}
  onPause={() => player.pause()}
  onUnsend={() => remove(id)}
/>
```

VoiceNote.tsx (React):

```tsx
import { VoiceNote } from '@/components/dissolve/voice-note';

<VoiceNote
  mine
  duration={9}
  seed="msg-42"
  onPlay={() => player.play()}
  onPause={() => player.pause()}
  onUnsend={() => remove(id)}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `duration` | `number` | `required` | Length of the note in seconds. Playback is simulated with a timer. |
| `levels` | `number[]` |  | Loudness per sample, 0 to 1. Resampled to the number of bars that fit. |
| `seed` | `number \| string` | `1` | Generates a deterministic, speech like waveform when levels is not given. |
| `mine` | `boolean` | `false` | Your own message: accent bubble with white content. Otherwise a surface bubble. |
| `width` | `number` | `248` | Bubble width. |
| `onPlay / onPause / onEnd` | `() => void` |  | Hook your audio player here. |
| `onUnsend` | `() => void` |  | Called once the bubble has dissolved: remove it from your data here. |
| `unsent` | `boolean` | `false` | Flip to true to unsend from outside (a menu, a swipe). |
| `unsendOnLongPress` | `boolean` | `true with onUnsend` | Long press the bubble (480 ms) to unsend. |
| `preset` | `VariantName` | `'dust'` | Exit used when the note is unsent. |
| `haptics` | `boolean` | `true` | Light impact on play, a tick per bar while seeking. |
| `className` | `string` |  | Bubble: background, radius, padding. |
| `buttonClassName` | `string` |  | Play and pause button. |
| `labelClassName` | `string` |  | Time label. |

## Source

- React Native: [registry/voice-note.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/voice-note.tsx)
- React: [registry/web/voice-note.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/voice-note.tsx) and [registry/web/voice-note.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/voice-note.core.ts)

Previous: [ReactionPicker](https://dissolve.rselmi.com/components/reaction-picker/) · Next: [SignaturePad](https://dissolve.rselmi.com/components/signature-pad/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/voice-note/
