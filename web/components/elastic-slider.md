# ElasticSlider

**ElasticSlider** is an animated elastic slider component for React Native and React, from the dissolve library. Thick rounded slider whose texts invert over the fill; pulled past an end, the track stretches like a rubber band and snaps back.

A thick, rounded slider in the spirit of the iOS Control Center. The fill grows from the left, a label sits on the left and the value on the right, both inverting their color exactly where the fill passes under them. Drag anywhere to move it by the finger's distance, or tap to jump. Pull past either end and the whole track stretches like a rubber band toward the finger, thinning a little, then snaps back with a bounce on release. The value rolls digit by digit. A tick when it reaches the minimum or the maximum, and on every step when there are 20 steps or fewer. On iOS everything moves by transform only, so it keeps animating inside a scroll view that is being dragged.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add elastic-slider --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/elastic-slider.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add elastic-slider --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/elastic-slider.json
```

## Usage

ElasticSlider.tsx (React Native):

```tsx
import { ElasticSlider } from '@/components/dissolve/elastic-slider';

const [volume, setVolume] = useState(40);
<ElasticSlider label="Volume" value={volume} onValueChange={setVolume} formatValue={(v) => `${v}%`} />

// An icon before the label, drawn in the color it gets (it inverts over the fill).
<ElasticSlider label="Brightness" icon={({ color, size }) => <SunIcon color={color} size={size} />} defaultValue={70} />

// A small stepped one, no value shown.
<ElasticSlider min={0} max={10} step={1} defaultValue={4} size="sm" showValue={false} />
```

ElasticSlider.tsx (React):

```tsx
import { ElasticSlider } from '@/components/dissolve/elastic-slider';

const [volume, setVolume] = useState(40);
<ElasticSlider label="Volume" value={volume} onValueChange={setVolume} formatValue={(v) => `${v}%`} />

// An icon before the label, drawn in the color it gets (it inverts over the fill).
<ElasticSlider label="Brightness" icon={({ color, size }) => <SunIcon color={color} size={size} />} defaultValue={70} />

// A small stepped one, no value shown.
<ElasticSlider min={0} max={10} step={1} defaultValue={4} size="sm" showValue={false} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `number` |  | Current value (controlled). |
| `defaultValue` | `number` | `min` | Initial value when uncontrolled. |
| `onValueChange` | `(value: number) => void` |  | Called with the stepped value while sliding, every time it changes. |
| `onSlidingComplete` | `(value: number) => void` |  | Called with the final value when the finger lifts. |
| `min / max / step` | `number` | `0 / 100 / 1` | Range and step. |
| `label` | `string` |  | Text on the left of the track. |
| `icon` | `ReactNode \| ({ color, size }) => ReactNode` |  | Icon before the label. As a function it gets the color it should be drawn in, which inverts over the fill. |
| `showValue` | `boolean` | `true` | Shows the value on the right of the track. |
| `formatValue` | `(value: number) => string` | `the number` | Turns the value into the shown text. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Track height and type size: 32, 44 or 56 pt. |
| `haptics` | `boolean` | `true` | Ticks at the ends, and on every step when there are 20 steps or fewer. |
| `disabled` | `boolean` | `false` | No sliding, the track shows at half opacity. |
| `fillColor` | `string` | `foreground token` | Fill color. |
| `trackColor` | `string` | `foreground at low alpha` | Empty track color. |
| `className` | `string` |  | Outer classes (width, margins...). It stretches to its parent by default. |

## Source

- React Native: [registry/elastic-slider.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/elastic-slider.tsx)
- React: [registry/web/elastic-slider.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/elastic-slider.tsx) and [registry/web/elastic-slider.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/elastic-slider.core.ts)

Previous: [ProgressSteps](https://dissolve.rselmi.com/components/progress-steps/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/elastic-slider/
