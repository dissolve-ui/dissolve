# LikeButton

**LikeButton** is an animated like button component for React Native and React, from the dissolve library. Heart that pops with sparks on like and snaps into grains on unlike.

Like: the heart pops and ten sparks burst around it. Unlike: the filled heart snaps away into grains from its center and the outline is back.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add like-button --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/like-button.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add like-button --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/like-button.json
```

## Usage

LikeButton.tsx (React Native):

```tsx
import { useState } from 'react';
import { LikeButton } from '@/components/dissolve/like-button';

export function PostActions() {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(128);

  return (
    <LikeButton
      liked={liked}
      count={likes}
      onChange={(v) => {
        setLiked(v);
        setLikes((n) => n + (v ? 1 : -1));
      }}
    />
  );
}
```

LikeButton.tsx (React):

```tsx
import { useState } from 'react';
import { LikeButton } from '@/components/dissolve/like-button';

export function PostActions() {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(128);

  return (
    <LikeButton
      liked={liked}
      count={likes}
      onChange={(v) => {
        setLiked(v);
        setLikes((n) => n + (v ? 1 : -1));
      }}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `liked` | `boolean` | `required` | Controlled state. |
| `onChange` | `(liked: boolean) => void` | `required` | Called with true right away on like, with false once the heart has snapped away. |
| `size` | `number` | `26` | Heart size in points. |
| `color` | `string` | `'#FF2D55'` | Filled heart and counter when liked. |
| `idleColor` | `string` | `muted token` | Outline and counter when not liked. |
| `count` | `number` |  | Optional counter shown next to the heart. |
| `haptics` | `boolean` | `true` | Light impact on like, the snap ticks on unlike. |
| `className` | `string` | `'flex-row items-center gap-1.5'` | Row: gap, padding, margins. |
| `countClassName` | `string` | `'text-[15px] font-semibold'` | Counter text: size, weight. |

## Source

- React Native: [registry/like-button.tsx](https://github.com/rs-4/dissolve/blob/main/registry/like-button.tsx)
- React: [registry/web/like-button.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/like-button.tsx) and [registry/web/like-button.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/like-button.core.ts)

Previous: [GlossyButton](https://dissolve.rselmi.com/components/glossy-button/) · Next: [MorphButton](https://dissolve.rselmi.com/components/morph-button/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/like-button/
