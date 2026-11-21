# SegmentedControl

**SegmentedControl** is an animated segmented control component for React Native and React, from the dissolve library. iOS segmented control whose pill breaks into grains, flows to the new segment and reassembles. Drag across to follow the finger.

An iOS style segmented control whose selection pill is made of grains. At rest it is a clean solid capsule with the soft iOS shadow, on a translucent track that sits on any background. Pick another segment and the pill breaks into grains, leading edge first: they flow to the new segment on a slight arc, shrinking mid flight, and reassemble into the pill there, in about 400 ms. The labels cross fade between their selected and unselected styles along the way. Drag the finger across the control and the selection follows it, the grains re-aiming from wherever they are, with a selection tick on every change. On iOS the pill and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the pill simply slides.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add segmented-control --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/segmented-control.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add segmented-control --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/segmented-control.json
```

## Usage

SegmentedControl.tsx (React Native):

```tsx
import { SegmentedControl } from '@/components/dissolve/segmented-control';

const [period, setPeriod] = useState('Week');
<SegmentedControl segments={['Day', 'Week', 'Month', 'Year']} value={period} onChange={setPeriod} />

// Smaller, uncontrolled, a fixed width.
<SegmentedControl segments={['Inbox', 'Archive']} defaultValue="Inbox" size="sm" className="w-56 self-center" />

// Items with icons.
<SegmentedControl
  segments={[
    { value: 'list', label: 'List', icon: ({ color, size }) => <ListIcon color={color} size={size} /> },
    { value: 'grid', label: 'Grid', icon: ({ color, size }) => <GridIcon color={color} size={size} /> },
  ]}
  value={layout}
  onChange={setLayout}
/>
```

SegmentedControl.tsx (React):

```tsx
import { SegmentedControl } from '@/components/dissolve/segmented-control';

const [period, setPeriod] = useState('Week');
<SegmentedControl segments={['Day', 'Week', 'Month', 'Year']} value={period} onChange={setPeriod} />

// Smaller, uncontrolled, a fixed width.
<SegmentedControl segments={['Inbox', 'Archive']} defaultValue="Inbox" size="sm" className="w-56 self-center" />

// Items with icons.
<SegmentedControl
  segments={[
    { value: 'list', label: 'List', icon: ({ color, size }) => <ListIcon color={color} size={size} /> },
    { value: 'grid', label: 'Grid', icon: ({ color, size }) => <GridIcon color={color} size={size} /> },
  ]}
  value={layout}
  onChange={setLayout}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `segments` | `(string \| SegmentItem)[]` | `required` | The segments: plain strings, or { value, label?, icon? } items. icon is a node or a function of { color, size, selected }. |
| `value` | `string` |  | Selected value (controlled). |
| `defaultValue` | `string` | `first segment` | Initial value when uncontrolled. |
| `onChange` | `(value: string, index: number) => void` |  | Called on every selection change, also while dragging across the segments. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Height, inset and type size: 30, 36 or 44 pt. |
| `haptics` | `boolean` | `true` | Selection tick on every change. |
| `disabled` | `boolean` | `false` | No selection, the control shows at half opacity. |
| `trackColor` | `string` | `foreground at low alpha` | Track fill. |
| `indicatorColor` | `string` | `background / lifted gray` | Pill and grain color. Default: the background token in light mode, a gray lifted off the track in dark mode. |
| `className / labelClassName` | `string` |  | Track classes (width, margins, self alignment...) and label classes. It stretches to its parent by default. |

## Source

- React Native: [registry/segmented-control.tsx](https://github.com/rs-4/dissolve/blob/main/registry/segmented-control.tsx)
- React: [registry/web/segmented-control.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/segmented-control.tsx) and [registry/web/segmented-control.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/segmented-control.core.ts)

Previous: [Skeleton](https://dissolve.rselmi.com/components/skeleton/) · Next: [Toggle](https://dissolve.rselmi.com/components/toggle/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/segmented-control/
