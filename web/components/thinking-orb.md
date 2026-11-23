# ThinkingOrb

**ThinkingOrb** is an animated thinking orb component for React Native and React, from the dissolve library. A sphere of dots that shows what an AI agent is doing: thinking, searching, listening, done.

An agent status indicator made of 180 dots. Idle, it breathes as a sphere; thinking, the dots split into three tilted rings; searching, the sphere flattens into a disc swept by a radar arc; listening, it pulses with the voice level; done, the dots fly into a checkmark; error, they fall and reform. Every state change moves each dot from where it is to its new place on the calm curve, staggered, never instant. With interactive on, dots flee the finger and spring back.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add thinking-orb --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/thinking-orb.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add thinking-orb --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/thinking-orb.json
```

## Usage

ThinkingOrb.tsx (React Native):

```tsx
import { ThinkingOrb } from '@/components/dissolve/thinking-orb';

<ThinkingOrb
  state={agent.status} // 'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error'
  size={96}
  level={micLevel}
  interactive
/>
```

ThinkingOrb.tsx (React):

```tsx
import { ThinkingOrb } from '@/components/dissolve/thinking-orb';

<ThinkingOrb
  state={agent.status} // 'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error'
  size={96}
  level={micLevel} // a number, or an object whose value is read every frame
  interactive
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `state` | `'idle' \| 'thinking' \| 'searching' \| 'listening' \| 'done' \| 'error'` | `'idle'` | What the agent is doing. Each change moves every dot to its new place in 600 ms, staggered. |
| `size` | `number` | `64` | Diameter of the orb. |
| `dots` | `number` | `180` | Number of dots. |
| `dotSize` | `number` | `2.5` | Dot diameter in points. |
| `level` | `SharedValue<number>` |  | Voice level 0 to 1 that drives the listening pulse. |
| `interactive` | `boolean` | `false` | Dots flee the finger within 40 pt and spring back. |
| `haptics` | `boolean` | `true` | Light impact on done, warning on error. |
| `className` | `string` |  | Classes of the container. Dots use the foreground token, done the success token, error the danger token. |

## Source

- React Native: [registry/thinking-orb.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/thinking-orb.tsx)
- React: [registry/web/thinking-orb.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/thinking-orb.tsx) and [registry/web/thinking-orb.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/thinking-orb.core.ts)

Previous: [BeforeAfter](https://dissolve.rselmi.com/components/before-after/) · Next: [ImageReveal](https://dissolve.rselmi.com/components/image-reveal/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/thinking-orb/
