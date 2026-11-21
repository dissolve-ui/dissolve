# BarChart

**BarChart** is an animated bar chart component for React Native and React, from the dissolve library. Bar chart you scrub with a finger, sliding bubble, bars regrow on period change.

A bar chart built from small round dots, a slightly jittered grid with a rounded top per bar. The dots fly in and assemble the bars with a short stagger. Scrub with a finger: the bar under it stays lit while the others step back, a bubble with the value slides along, and the dots near the finger scatter away, then spring back. New data sends the dots falling from the old bars and gathers them into the new ones. Stacked series use the chart tokens: pink, violet and yellow.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add bar-chart --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/bar-chart.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add bar-chart --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/bar-chart.json
```

## Usage

BarChart.tsx (React Native):

```tsx
import { BarChart } from '@/components/dissolve/bar-chart';

<BarChart
  data={[{ label: 'Mon', value: 8412 }, { label: 'Tue', value: 10230 }]}
  formatValue={(v) => `${v.toLocaleString()} steps`}
  onSelect={(i) => setDay(i)}
/>

<BarChart stacked maxDots={1000} data={[{ label: 'Jan', values: [42, 18, 30] }]} />
```

BarChart.tsx (React):

```tsx
import { BarChart } from '@/components/dissolve/bar-chart';

<BarChart
  data={[{ label: 'Mon', value: 8412 }, { label: 'Tue', value: 10230 }]}
  formatValue={(v) => `${v.toLocaleString()} steps`}
  onSelect={(i) => setDay(i)}
/>

<BarChart stacked maxDots={1000} data={[{ label: 'Jan', values: [42, 18, 30] }]} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `{ label, value?, values? }[]` | `required` | One bar per item. values are segments, bottom to top. Pass a stable array: new data replays the gather. |
| `height` | `number` | `180` | Plot height. The bubble lane and labels come on top. |
| `formatValue` | `(value: number) => string` | `grouped` | Text of the bubble. |
| `formatAxis` | `(value: number) => string` | `compact` | Axis labels, e.g. 1.2k. |
| `onSelect` | `(index: number \| null, datum?) => void` |  | Bar under the finger, then null on release. |
| `stacked` | `boolean` | `false` | Draws values as stacked segments. |
| `colors` | `BarToken[]` | `['primary']` | Segment colors as theme tokens. ['chart-1', 'chart-2', 'chart-3'] (pink, violet, yellow) when stacked. |
| `barRadius` | `number` | `6` | Rounding of the top of each dot column. |
| `maxDots` | `number` | `1400` | Dot budget for the whole chart, the grid gets coarser past it. At most 1600. |
| `gap` | `number` | `6` | Space between bars, shrinks on dense charts. |
| `labelEvery` | `number` |  | One label every N bars. Default: all up to 12 bars. |
| `axis` | `boolean` | `true` | Value axis on the right. |
| `haptics` | `boolean` | `true` | A tick per bar change while scrubbing. |
| `className` | `string` |  | Root classes (margins, padding...). |
| `bubbleClassName` | `string` |  | Bubble classes (background, radius...). |

## Source

- React Native: [registry/bar-chart.tsx](https://github.com/rs-4/dissolve/blob/main/registry/bar-chart.tsx)
- React: [registry/web/bar-chart.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/bar-chart.tsx) and [registry/web/bar-chart.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/bar-chart.core.ts)

Previous: [RulerPicker](https://dissolve.rselmi.com/components/ruler-picker/) · Next: [MiniPlayer](https://dissolve.rselmi.com/components/mini-player/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/bar-chart/
