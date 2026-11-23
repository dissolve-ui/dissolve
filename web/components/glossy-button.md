# GlossyButton

**GlossyButton** is an animated glossy button component for React Native and React, from the dissolve library. Tactile pill lit from the inside: gradient stroke, inner light and ring, presses down on a crisp spring.

A pill button with a slightly 3D look, built from one recipe: a 1 pt inside stroke as a white gradient lit from the top, a soft black drop shadow, a white inner shadow and a thin outer ring in the fill color. Pressed, it scales to 0.97 on a crisp spring while the inner light dims, with a light haptic. Every layer is a prop, tune them here and copy the JSX.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add glossy-button --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/glossy-button.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add glossy-button --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/glossy-button.json
```

## Usage

GlossyButton.tsx (React Native):

```tsx
import { GlossyButton } from '@/components/dissolve/glossy-button';

<GlossyButton onPress={start}>Get started</GlossyButton>

<GlossyButton
  icon={({ color, size }) => <SymbolView name="plus" tintColor={color} size={size} />}
  onPress={create}
>
  New project
</GlossyButton>

<GlossyButton color="#E5484D" radius={14} size="lg" onPress={remove}>
  Delete
</GlossyButton>
```

GlossyButton.tsx (React):

```tsx
import { GlossyButton } from '@/components/dissolve/glossy-button';

<GlossyButton onPress={start}>Get started</GlossyButton>

<GlossyButton
  icon={({ color, size }) => <Icon name="plus" color={color} size={size} />}
  onPress={create}
>
  New project
</GlossyButton>

<GlossyButton color="#E5484D" radius={14} size="lg" onPress={remove}>
  Delete
</GlossyButton>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children / label` | `ReactNode / string` |  | The label. A string is styled with labelColor, any other node renders as is. |
| `icon` | `ReactNode \| ({ color, size }) => ReactNode` |  | Leading icon. The function form gets the label color and the icon size. |
| `onPress` | `() => void` |  | Called on release. |
| `color` | `string` | `'#296FF0'` | Fill, also the color of the outer ring. |
| `labelColor` | `string` | `'#FFFFFF'` | Label and icon color. |
| `radius` | `number` | `999` | Corner radius, capped at half the height (a pill). |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Height 36, 44 or 52, with matching padding and type. |
| `fullWidth` | `boolean` | `false` | Stretches to the full width of the parent. |
| `strokeOpacity` | `number` | `0.4` | Top opacity of the 1 pt white gradient stroke, fading to 0 at the bottom. |
| `innerOpacity / innerBlur / innerSpread` | `number` | `0.24 / 6 / 2` | White inner shadow. Dims while pressed. |
| `shadowOpacity / shadowY / shadowBlur` | `number` | `0.2 / 3 / 6` | Black drop shadow. |
| `ringSpread` | `number` | `1` | Outer ring in the fill color, no blur. 0 removes it. |
| `disabled` | `boolean` | `false` | Half opacity, no press, no haptic. |
| `haptics` | `boolean` | `true` | Light impact on press in. |
| `className` | `string` |  | Outer classes (margins, alignment, width...). |
| `labelClassName` | `string` |  | Label classes (weight, tracking...). |

## Source

- React Native: [registry/glossy-button.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/glossy-button.tsx)
- React: [registry/web/glossy-button.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/glossy-button.tsx) and [registry/web/glossy-button.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/glossy-button.core.ts)

Previous: [Toast](https://dissolve.rselmi.com/components/toast/) · Next: [LikeButton](https://dissolve.rselmi.com/components/like-button/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/glossy-button/
