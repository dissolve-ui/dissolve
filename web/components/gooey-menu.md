# GooeyMenu

**GooeyMenu** is an animated gooey menu component for React Native and React, from the dissolve library. Floating button whose actions pour out as gooey drops.

A floating button whose actions pour out of it as drops along an arc and melt back in when it closes. Place it absolutely: it reserves room for the arc above and to the left of the button.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add gooey-menu --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/gooey-menu.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add gooey-menu --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/gooey-menu.json
```

## Usage

GooeyMenu.tsx (React Native):

```tsx
import { GooeyMenu } from '@/components/dissolve/gooey-menu';

<GooeyMenu
  className="absolute bottom-2 right-2"
  items={[
    { icon: <Icon name="camera" />, label: 'Camera', onPress: openCamera },
    { icon: <Icon name="photo" />, label: 'Photo', onPress: openLibrary },
    { icon: <Icon name="mic" />, label: 'Voice', onPress: record },
  ]}
/>
```

GooeyMenu.tsx (React):

```tsx
import { GooeyMenu } from '@/components/dissolve/gooey-menu';

<GooeyMenu
  className="absolute bottom-2 right-2"
  items={[
    { icon: <Icon name="camera" />, label: 'Camera', onPress: openCamera },
    { icon: <Icon name="photo" />, label: 'Photo', onPress: openLibrary },
    { icon: <Icon name="mic" />, label: 'Voice', onPress: record },
  ]}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `GooeyMenuItem[]` | `required` | `{ icon, onPress, label? }`. The menu closes after an action runs. |
| `size` | `number` | `56` | Diameter of the main button. Actions are 82 percent of it. |
| `distance` | `number` | `92` | Distance from the main button to the actions. |
| `startAngle` | `number` | `-90` | Arc start in degrees, 0 = right, -90 = up. |
| `endAngle` | `number` | `-180` | Arc end in degrees, -180 = left. |
| `haptics` | `boolean` | `true` | Light impact on toggle. |
| `className` | `string` |  | Root: position it here. Button and drops read the primary token. |
| `iconClassName` | `string` | `'bg-dissolve-primary-foreground'` | The two bars of the plus, their color. |

## Source

- React Native: [registry/gooey-menu.tsx](https://github.com/rs-4/dissolve/blob/main/registry/gooey-menu.tsx)
- React: [registry/web/gooey-menu.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/gooey-menu.tsx) and [registry/web/gooey-menu.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/gooey-menu.core.ts)

Previous: [SplitButton](https://dissolve.rselmi.com/components/split-button/) · Next: [SlideToConfirm](https://dissolve.rselmi.com/components/slide-to-confirm/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/gooey-menu/
