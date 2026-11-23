# Skeleton

**Skeleton** is an animated skeleton component for React Native and React, from the dissolve library. Loading placeholders that break into grains and recompose into the real content, block by block.

Loading placeholders that do not just crossfade. While loading, a calm wave of light rolls across the blocks, top left to bottom right. When loading turns false, every placeholder breaks into grains and those same grains recompose the real content, block by block in reading order (about 70 ms apart, compressed so the whole handoff stays under 900 ms), with one light haptic as the first grains land. The content shows exactly where its grains land. You describe the placeholders and keep your content: wrap each piece in SkeletonBlock with its shape while loading, a line (a rounded bar centered in its line height, lines for a paragraph), a circle (an avatar) or a rect (an image, a card). Children only render once loading is false, so they can read data that is not there yet. Reduced motion: no wave, a short crossfade.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add skeleton --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/skeleton.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add skeleton --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/skeleton.json
```

## Usage

Skeleton.tsx (React Native):

```tsx
import { Skeleton, SkeletonBlock } from '@/components/dissolve/skeleton';

<Skeleton loading={!user}>
  <View className="flex-row items-center gap-4">
    <SkeletonBlock shape="circle" size={64}>
      <Image source={user?.avatar} style={{ width: 64, height: 64, borderRadius: 32 }} />
    </SkeletonBlock>
    <View className="flex-1 gap-1">
      <SkeletonBlock width={160} height={25}>
        <Text className="text-[20px] font-semibold">{user?.name}</Text>
      </SkeletonBlock>
      <SkeletonBlock width={96}>
        <Text className="text-[15px] text-dissolve-muted">{user?.handle}</Text>
      </SkeletonBlock>
    </View>
  </View>
</Skeleton>

// The dotted form, a cover and a paragraph.
<Skeleton loading={loading} stagger={80} onReveal={() => track('feed_shown')}>
  <Skeleton.Block shape="rect" height={180} radius={20}>
    <Cover post={post} />
  </Skeleton.Block>
  <Skeleton.Block lines={3} height={22} className="mt-3">
    <Text>{post?.body}</Text>
  </Skeleton.Block>
</Skeleton>
```

Skeleton.tsx (React):

```tsx
import { Skeleton, SkeletonBlock } from '@/components/dissolve/skeleton';

<Skeleton loading={!user}>
  <div className="flex items-center gap-4">
    <SkeletonBlock shape="circle" size={64}>
      <img src={user?.avatar} alt="" width={64} height={64} className="rounded-full" />
    </SkeletonBlock>
    <div className="flex flex-1 flex-col gap-1">
      <SkeletonBlock width={160} height={25}>
        <span className="text-[20px] font-semibold">{user?.name}</span>
      </SkeletonBlock>
      <SkeletonBlock width={96}>
        <span className="text-[15px] text-dissolve-muted">{user?.handle}</span>
      </SkeletonBlock>
    </div>
  </div>
</Skeleton>

// The dotted form, a cover and a paragraph.
<Skeleton loading={loading} stagger={80} onReveal={() => track('feed_shown')}>
  <Skeleton.Block shape="rect" height={180} radius={20}>
    <Cover post={post} />
  </Skeleton.Block>
  <Skeleton.Block lines={3} height={22} className="mt-3">
    <p>{post?.body}</p>
  </Skeleton.Block>
</Skeleton>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `required` | True shows the placeholders. False hands every block over to its content in grains. |
| `children` | `ReactNode` | `required` | Any layout, with SkeletonBlocks anywhere inside it. |
| `shimmer` | `boolean` | `true` | Wave of light across the blocks while loading. Off under reduced motion. |
| `color` | `'surface' \| 'surface-2' \| 'border'` | `'surface'` | Placeholder fill as a theme token. |
| `stagger` | `number` | `70` | Delay between two blocks in ms, in reading order. Compressed with many blocks so the handoff stays under about 900 ms. |
| `duration` | `number` | `600` | Duration of one block's handoff in ms. |
| `grain` | `number` | `3` | Grain size in points. |
| `haptics` | `boolean` | `true` | One light impact as the first grains land. |
| `onReveal` | `() => void` |  | Called once every block shows its content. |
| `className / style` | `string / ViewStyle` |  | Root classes and style. |
| `SkeletonBlock` | `{ shape?, width?, height?, size?, radius?, lines?, className?, style? }` |  | Wraps one piece of content. shape: 'line' (default, a bar 0.6 of height, height default 20), 'circle' (size across, default 40) or 'rect' (width by height, default 100% by 120, radius 12). lines stacks bars for a paragraph. className restyles the placeholder, style goes to the outer box. Also available as Skeleton.Block. |

## Source

- React Native: [registry/skeleton.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/skeleton.tsx)
- React: [registry/web/skeleton.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/skeleton.tsx) and [registry/web/skeleton.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/skeleton.core.ts)

Previous: [ScratchCard](https://dissolve.rselmi.com/components/scratch-card/) · Next: [SegmentedControl](https://dissolve.rselmi.com/components/segmented-control/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/skeleton/
