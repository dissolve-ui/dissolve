# PullToRefresh

**PullToRefresh** is an animated pull to refresh component for React Native and React, from the dissolve library. Pull a list down: grains gather into a loader, release and the content rebuilds itself.

Wraps a list. Pull it down past the top and grains drift in from scattered positions to gather into a ring, 1:1 with the pull, with a 0.5 rubber band past the threshold. At the threshold the ring closes with a rigid tick. Release past it and the ring spins while onRefresh runs, the list held under it. When the promise settles, the items already there glide to their new place while the list eases back to the top, all on the calm curve, and the ring grains fly to the new items and build them in grains. Nothing new, or onRefresh threw: the grains fall away as dust. Released early, the grains scatter back out. Wrap each item in PullItem with a stable id: the ids there when the refresh starts are remembered, any other one is new. It works for any layout, rows, a bento grid, wrapped cards of any size. On iOS it rides the native overscroll of the scroll view, so nothing fights the scroll.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add pull-to-refresh --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/pull-to-refresh.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add pull-to-refresh --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/pull-to-refresh.json
```

## Usage

PullToRefresh.tsx (React Native):

```tsx
import { PullToRefresh, PullItem } from '@/components/dissolve/pull-to-refresh';

<PullToRefresh onRefresh={reload}>
  {items.map((item) => (
    <PullItem key={item.id} id={item.id}>
      <Row tx={item} />
    </PullItem>
  ))}
</PullToRefresh>

// Any layout: a bento grid of cards.
<PullToRefresh onRefresh={reload} contentContainerStyle={grid}>
  {cards.map((card) => (
    <PullItem key={card.id} id={card.id} style={{ width: '47%' }} className="h-36 rounded-3xl bg-dissolve-surface p-4">
      <Card card={card} />
    </PullItem>
  ))}
</PullToRefresh>

// Your own list: spread scroll on it.
<PullToRefresh onRefresh={reload} threshold={96} color="accent">
  {(scroll) => (
    <Animated.FlatList
      {...scroll}
      data={items}
      renderItem={({ item }) => <PullItem id={item.id}><Row tx={item} /></PullItem>}
    />
  )}
</PullToRefresh>
```

PullToRefresh.tsx (React):

```tsx
import { PullToRefresh, PullItem } from '@/components/dissolve/pull-to-refresh';

<PullToRefresh onRefresh={reload}>
  {items.map((item) => (
    <PullItem key={item.id} id={item.id}>
      <Row tx={item} />
    </PullItem>
  ))}
</PullToRefresh>

// Any layout: a bento grid of cards.
<PullToRefresh onRefresh={reload} contentContainerStyle={grid}>
  {cards.map((card) => (
    <PullItem key={card.id} id={card.id} style={{ width: '47%' }} className="h-36 rounded-3xl bg-dissolve-surface p-4">
      <Card card={card} />
    </PullItem>
  ))}
</PullToRefresh>

// Your own list: spread scroll on it.
<PullToRefresh onRefresh={reload} threshold={96} color="accent">
  {(scroll) => (
    <Animated.FlatList
      {...scroll}
      data={items}
      renderItem={({ item }) => <PullItem id={item.id}><Row tx={item} /></PullItem>}
    />
  )}
</PullToRefresh>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode \| (scroll) => ReactNode` | `required` | List content, wrapped in an Animated.ScrollView. Or a render prop: spread scroll on your own Animated.FlatList or Animated.ScrollView. |
| `onRefresh` | `() => Promise<void>` | `required` | Runs while the ring spins. Update your data before it resolves: the new items are built right after. |
| `threshold` | `number` | `80` | Pull distance that arms the refresh, also the height held while it runs. |
| `haptics` | `boolean` | `true` | Rigid when the ring closes, Success when done, Warning if onRefresh throws. |
| `color` | `PullToken` | `'foreground'` | Grain color as a theme token: 'foreground', 'muted', 'primary', 'accent', 'success', 'chart-1', 'chart-2'. |
| `rebuild` | `boolean` | `true` | Build the new PullItems from the ring grains when the refresh lands. Off, they just show. Needs DissolveProvider. |
| `contentContainerStyle` | `StyleProp<ViewStyle>` |  | Content container of the built in ScrollView (plain children only). |
| `className` | `string` |  | Root classes (background, radius, margins...). |
| `PullItem` | `{ id, className?, style? }` |  | Wrap each item of the content. id: stable key of the item, any id not there when the refresh started is new. className and style draw the item (captured with it); size and position keys of style (width, flex, margin...) go to its outer box. |

## Source

- React Native: [registry/pull-to-refresh.tsx](https://github.com/rs-4/dissolve/blob/main/registry/pull-to-refresh.tsx)
- React: [registry/web/pull-to-refresh.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/pull-to-refresh.tsx) and [registry/web/pull-to-refresh.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/pull-to-refresh.core.ts)

Previous: [MiniPlayer](https://dissolve.rselmi.com/components/mini-player/) · Next: [ReorderList](https://dissolve.rselmi.com/components/reorder-list/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/pull-to-refresh/
