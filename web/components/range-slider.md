# RangeSlider

**RangeSlider** is an animated range slider component for React Native and React, from the dissolve library. Two handle range slider: the track fills between the handles, the values roll in bubbles while you drag, optional steps with ticks.

A dual handle range slider. Drag either handle, or press the track and the nearest handle jumps there. The handles never cross (minDistance keeps a gap), the track fills between them, and while you drag both values roll in bubbles above the handles (NumberTicker, from dissolve); bubbles that would touch slide apart. With a step, the handles snap from step to step on a quick spring, tick dots show under the track (up to 40) and each step gives a selection tick, with a firmer one at the ends. Keyboard on each handle: arrows by a step, Page Up and Page Down by a tenth, Home and End to the ends. Controlled or not; onSlidingComplete fires once the handle is let go. Reduced motion: no springs, the bubbles only fade.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add range-slider --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/range-slider.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add range-slider --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/range-slider.json
```

## Usage

RangeSlider.tsx (React Native):

```tsx
import { RangeSlider } from '@/components/dissolve/range-slider';

const [price, setPrice] = useState<RangeValue>([120, 640]);

<RangeSlider min={0} max={1000} step={10} value={price} onValueChange={setPrice} prefix="$" />

// Stepped, no ticks, the handles at least 1 km apart.
<RangeSlider min={0} max={10} step={1} defaultValue={[2, 7]} suffix=" km" minDistance={1} ticks={false} />
```

RangeSlider.tsx (React):

```tsx
import { RangeSlider } from '@/components/dissolve/range-slider';

const [price, setPrice] = useState<RangeValue>([120, 640]);

<RangeSlider min={0} max={1000} step={10} value={price} onValueChange={setPrice} prefix="$" />

// Stepped, no ticks, the handles at least 1 km apart.
<RangeSlider min={0} max={10} step={1} defaultValue={[2, 7]} suffix=" km" minDistance={1} ticks={false} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `[number, number]` |  | The range, controlled: [low, high]. |
| `defaultValue` | `[number, number]` | `[min, max]` | The range when uncontrolled. |
| `onValueChange` | `(value: [number, number]) => void` |  | Called with the stepped range while dragging, every time it changes. |
| `onSlidingComplete` | `(value: [number, number]) => void` |  | Called with the final range when the handle is let go, or after a key moved it. |
| `min` | `number` | `0` | Lower bound. |
| `max` | `number` | `100` | Upper bound. |
| `step` | `number` | `1` | Step the values snap to. |
| `minDistance` | `number` | `0` | Smallest gap between the two values. At 0 they can meet, never cross. |
| `ticks` | `boolean` |  | Tick dots under the track, one per step. Default: on when step is given and there are 40 steps or fewer. |
| `bubbles` | `'drag' \| 'always' \| 'none'` | `'drag'` | The value bubbles above the handles: while dragging, always, or never. |
| `decimals` | `number` | `0` | Digits after the decimal point in the bubbles. |
| `locale` | `string` |  | Locale for the bubble number separators. |
| `prefix` | `string` |  | Text before the number in the bubbles ($). |
| `suffix` | `string` |  | Text after the number in the bubbles ( km). |
| `haptics` | `boolean` | `true` | A selection tick on every step (when ticks show) and a firmer one at the ends. |
| `disabled` | `boolean` | `false` | Dims the slider and ignores input. |
| `accessibilityLabels` | `[string, string]` | `['Minimum', 'Maximum']` | Read by screen readers on the two handles. |
| `className` | `string` |  | Outer classes (margins, width...). The height is the slider's own. |

## Source

- React Native: [registry/range-slider.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/range-slider.tsx)
- React: [registry/web/range-slider.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/range-slider.tsx) and [registry/web/range-slider.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/range-slider.core.ts)

Previous: [PagerTabs](https://dissolve.rselmi.com/components/pager-tabs/) · Next: [PasswordStrength](https://dissolve.rselmi.com/components/password-strength/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/range-slider/
