# AvatarStack

**AvatarStack** is an animated avatar stack component for React Native and React, from the dissolve library. Overlapping avatars with a +N chip: hover or hold to spread them with names, adding or removing one animates the stack.

Overlapping avatars with a +N chip for the rest, each ringed in the background color so the overlap reads cleanly; a person without an image shows their initials. Hover the stack and it spreads apart on a spring, with a tooltip that slides from avatar to avatar naming the one under the pointer, which lifts a little. On touch, press and hold then slide your finger across, or tap: the tap names the avatar under the finger and the stack closes up again on its own. With the keyboard, focus spreads it and the arrow keys move the name. Add or remove a person and the stack makes room or closes the gap, the newcomer popping in from a smaller size, the leaver shrinking away, the chip counting the rest. A selection tick as the name changes. Reduced motion: no springs, plain fades.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add avatar-stack --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/avatar-stack.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add avatar-stack --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/avatar-stack.json
```

## Usage

AvatarStack.tsx (React Native):

```tsx
import { AvatarStack } from '@/components/dissolve/avatar-stack';

<AvatarStack
  avatars={[
    { id: 'ava', name: 'Ava Chen', src: 'https://example.com/ava.jpg' },
    { id: 'ben', name: 'Ben Ortiz' },
    { id: 'chloe', name: 'Chloe Martin', src: chloe },
  ]}
/>

// Three faces then the chip, smaller and tighter.
<AvatarStack avatars={team} max={3} size="sm" overlap={0.4} />
```

AvatarStack.tsx (React):

```tsx
import { AvatarStack } from '@/components/dissolve/avatar-stack';

<AvatarStack
  avatars={[
    { id: 'ava', name: 'Ava Chen', src: 'https://example.com/ava.jpg' },
    { id: 'ben', name: 'Ben Ortiz' },
    { id: 'chloe', name: 'Chloe Martin', src: chloe },
  ]}
/>

// Three faces then the chip, smaller and tighter.
<AvatarStack avatars={team} max={3} size="sm" overlap={0.4} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `avatars` | `{ id, name, src? }[]` |  | The people. src is an image URL (or a require() on React Native); without it the initials show. |
| `max` | `number` | `4` | Avatars shown before the +N chip. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Avatar diameter: 28, 36 or 44 pt. |
| `overlap` | `number` | `0.3` | How much each avatar slides under the previous one, as a share of its size. |
| `spreadGap` | `number` | `6` | Space between avatars once spread, in pt. |
| `haptics` | `boolean` | `true` | Selection tick as the named avatar changes. |
| `className` | `string` |  | Outer classes (margins...). |

## Source

- React Native: [registry/avatar-stack.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/avatar-stack.tsx)
- React: [registry/web/avatar-stack.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/avatar-stack.tsx) and [registry/web/avatar-stack.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/avatar-stack.core.ts)

Previous: [CopyButton](https://dissolve.rselmi.com/components/copy-button/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/avatar-stack/
