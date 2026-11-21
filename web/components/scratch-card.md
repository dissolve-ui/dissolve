# ScratchCard

**ScratchCard** is an animated scratch card component for React Native and React, from the dissolve library. Glossy foil scratch card that tilts in 3D under the finger, sheds grains, then dissolves past the threshold.

A lottery style card with a metal foil over any content: a reward, a promo code. The foil is one shader, a brushed silver gradient with a fine grain, a faint holographic tint, a bevel lit along the edge and a specular band. The whole card tilts in 3D under the finger, up to 9 degrees with perspective, and the light moves with it, then it springs back flat on release. Scratching erases the foil along a ragged stroke, like a coin or a nail (chipped stamps, a width that follows the speed, rough ends), and sheds it as grains that flick off and fall, with light selection ticks. A coarse grid tracks the scratched share: past the threshold, the rest of the foil dissolves from the last touch, Success haptic, onReveal. Reduced motion keeps the card flat and fades the foil instead.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add scratch-card --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/scratch-card.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add scratch-card --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/scratch-card.json
```

## Usage

ScratchCard.tsx (React Native):

```tsx
import { ScratchCard } from '@/components/dissolve/scratch-card';

<ScratchCard onReveal={claim}>
  <Text className="text-[40px] font-bold text-dissolve-foreground">$25</Text>
</ScratchCard>

// Gold foil, a bigger brush, reset from a ref.
const card = useRef<ScratchCardHandle>(null);
<ScratchCard ref={card} color="#D9B26F" label="Scratch for your code" brush={44} threshold={0.6}>
  <PromoCode code="SPRING25" />
</ScratchCard>
card.current?.reset();
```

ScratchCard.tsx (React):

```tsx
import { ScratchCard } from '@/components/dissolve/scratch-card';

<ScratchCard onReveal={claim}>
  <span className="text-[40px] font-bold text-dissolve-foreground">$25</span>
</ScratchCard>

// Gold foil, a bigger brush, reset from a ref.
const card = useRef<ScratchCardHandle>(null);
<ScratchCard ref={card} color="#D9B26F" label="Scratch for your code" brush={44} threshold={0.6}>
  <PromoCode code="SPRING25" />
</ScratchCard>
card.current?.reset();
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` |  | What the foil hides, centered on the card. |
| `width / height` | `number` | `320 / 200` | Card size in points. |
| `radius` | `number` | `24` | Corner radius. |
| `color` | `string` | `'#C3C8D0'` | Foil base color. A warm tone like #D9B26F gives gold. |
| `label` | `string` | `'Scratch to reveal'` | Text printed on the foil, erased with it. Empty hides it. |
| `brush` | `number` | `38` | Scratch stroke width in points. |
| `threshold` | `number` | `0.55` | Share of the foil to scratch before the rest dissolves. |
| `tilt` | `number` | `9` | Max tilt in degrees under the finger. 0 keeps the card flat. Off under reduced motion. |
| `haptics` | `boolean` | `true` | Selection ticks while scratching, Success on reveal. |
| `disabled` | `boolean` | `false` | No scratching, the card still shows. |
| `onReveal` | `() => void` |  | Called once the foil is gone. |
| `onScratchStart` | `() => void` |  | Called on the first stroke after mount or reset. |
| `className / contentClassName` | `string` |  | Card classes (background, border...) and the classes of the box that centers the children. |
| `ref` | `ScratchCardHandle` |  | reset() puts the foil back, reveal() dissolves it now, progress() gives the scratched share. |

## Source

- React Native: [registry/scratch-card.tsx](https://github.com/rs-4/dissolve/blob/main/registry/scratch-card.tsx)
- React: [registry/web/scratch-card.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/scratch-card.tsx) and [registry/web/scratch-card.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/scratch-card.core.ts)

Previous: [ReorderList](https://dissolve.rselmi.com/components/reorder-list/) · Next: [Skeleton](https://dissolve.rselmi.com/components/skeleton/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/scratch-card/
