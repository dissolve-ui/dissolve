# ReorderList

**ReorderList** is an animated reorder list component for React Native and React, from the dissolve library. Long press a row to lift it, drag to reorder, the others make room, it settles with a tick.

A list you reorder by drag, like Reminders or Things. Long press a row (250 ms) or grab its handle: it lifts with a medium tick, grows a shadow and leans a little with the sideways speed of the finger, which it follows 1:1. The other rows slide out of the way on the calm curve, a selection tick lands on every new slot, and the list scrolls by itself near its edges. On release the row settles critically damped, then onReorder runs. A faint trail of grains stays at the slot it left, a small puff marks the one it lands in. With onDelete, drag a row far to the side to turn it to dust. Rows can have different heights, everything runs on the UI thread.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add reorder-list --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/reorder-list.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add reorder-list --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/reorder-list.json
```

## Usage

ReorderList.tsx (React Native):

```tsx
import { ReorderList, ReorderHandle } from '@/components/dissolve/reorder-list';

<ReorderList
  data={tasks}
  keyExtractor={(t) => t.id}
  onReorder={(next) => setTasks(next)}
  onDelete={(t) => remove(t.id)}
  gap={8}
  itemClassName="rounded-[18px] bg-dissolve-surface"
  renderItem={({ item, index }) => (
    <TaskRow task={item} rank={index + 1}>
      <ReorderHandle />
    </TaskRow>
  )}
/>
```

ReorderList.tsx (React):

```tsx
import { ReorderList, ReorderHandle } from '@/components/dissolve/reorder-list';

<ReorderList
  data={tasks}
  keyExtractor={(t) => t.id}
  onReorder={(next) => setTasks(next)}
  onDelete={(t) => remove(t.id)}
  gap={8}
  itemClassName="rounded-[18px] bg-dissolve-surface"
  renderItem={({ item, index }) => (
    <TaskRow task={item} rank={index + 1}>
      <ReorderHandle />
    </TaskRow>
  )}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | `required` | The rows, in order. |
| `keyExtractor` | `(item: T, index: number) => string` | `required` | A stable key per row. Rows are positioned by key. |
| `renderItem` | `({ item, index, dragging }) => ReactNode` | `required` | A row. dragging is true while it is lifted (one render on lift, one on drop). |
| `onReorder` | `(data: T[], from: number, to: number) => void` | `required` | Called once the dropped row has settled, with the reordered copy of data. |
| `onDelete` | `(item: T, index: number) => void` |  | Enables the delete: drag a row past 42 percent of the width to the side and release, it turns to dust and the list closes up. |
| `preset` | `VariantName` | `'dust'` | Exit used by onDelete. |
| `longPressDelay` | `number` | `250` | Hold before a row lifts, ms. Moving earlier scrolls the list instead. |
| `handle` | `boolean` | `false` | Drag only from a `<ReorderHandle>` inside the row, which lifts at once. |
| `gap` | `number` | `0` | Space between rows. Use it instead of vertical margins. |
| `haptics` | `boolean` | `true` | Medium on lift, a selection tick per slot, light on drop. |
| `grains` | `boolean` | `true` | Trail and puff of grains. Off with reduced motion, as is the lean. |
| `header / footer` | `ReactNode` |  | Scroll above and below the rows. |
| `className` | `string` | `'flex-1'` | Root classes. Give the list a height: it scrolls by itself. |
| `contentContainerStyle` | `StyleProp<ViewStyle>` |  | Scroll content padding. |
| `itemClassName` | `string` | `'bg-dissolve-background'` | Row surface classes (background, radius). The lift shadow follows it. |

## Source

- React Native: [registry/reorder-list.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/reorder-list.tsx)
- React: [registry/web/reorder-list.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/reorder-list.tsx) and [registry/web/reorder-list.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/reorder-list.core.ts)

Previous: [PullToRefresh](https://dissolve.rselmi.com/components/pull-to-refresh/) · Next: [ScratchCard](https://dissolve.rselmi.com/components/scratch-card/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/reorder-list/
