# Marquee

**Marquee** is an animated marquee component for React Native and React, from the dissolve library. An endless row of logos, words or cards that scrolls on its own, seamless at any width: hover or press to stop, drag and flick to scrub.

An endless row of logos, words or cards that scrolls on its own, seamless at any width: the row is repeated as many times as the box needs and wraps without a seam, measured again when the box or the content resizes. Hover it (on the web) or press it and it eases to a stop; leave or let go and it eases back to speed. Drag it to scrub, with inertia: let go with a flick and it coasts on, then settles back to its cruise, while a vertical swipe still scrolls the page. The edges fade out: a mask on the web, so it works over any background, a gradient into fadeColor on iOS, where the motion runs on the UI thread. Copies are hidden from screen readers and, on the web, from the tab order; links work in every copy, and keyboard focus inside pauses it. Reduced motion: it does not scroll by itself, dragging still works.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add marquee --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/marquee.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add marquee --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/marquee.json
```

## Usage

Marquee.tsx (React Native):

```tsx
import { Marquee } from '@/components/dissolve/marquee';

<Marquee speed={36} accessibilityLabel="What people say">
  {quotes.map((q) => <QuoteCard key={q.id} quote={q} />)}
</Marquee>

// The other way, slower, tighter, on a card.
<Marquee speed={24} gap={8} direction="right" fade={32} fadeColor={cardColor}>
  {features.map((f) => <Pill key={f} label={f} />)}
</Marquee>
```

Marquee.tsx (React):

```tsx
import { Marquee } from '@/components/dissolve/marquee';

<Marquee speed={36} accessibilityLabel="What people say">
  {quotes.map((q) => <QuoteCard key={q.id} quote={q} />)}
</Marquee>

// The other way, slower, tighter, on a card.
<Marquee speed={24} gap={8} direction="right" fade={32} fadeColor={cardColor}>
  {features.map((f) => <Pill key={f} label={f} />)}
</Marquee>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` |  | The items of the row, once. The copies that fill the row are made for you. |
| `speed` | `number` | `40` | Cruise speed, in pt per second. |
| `direction` | `'left' \| 'right'` | `'left'` | Which way the row travels. |
| `pauseOnHover` | `boolean` | `true` | Eases to a stop under the mouse (web). |
| `pauseOnPress` | `boolean` | `true` | Eases to a stop while pressed. |
| `draggable` | `boolean` | `true` | Drag to scrub, with inertia. |
| `fade` | `number` | `48` | Width of the faded edges, in pt. 0 for none. |
| `fadeColor` (React Native only) | `string` | `background token` | The color the edges fade into on iOS: the color of the surface the row sits on. The web uses a mask. |
| `gap` | `number` | `12` | Space between items, and between the end of the row and its next copy, in pt. |
| `accessibilityLabel` | `string` |  | Read by screen readers for the whole row. |
| `className` | `string` |  | Outer classes (margins, padding...). |

## Source

- React Native: [registry/marquee.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/marquee.tsx)
- React: [registry/web/marquee.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/marquee.tsx) and [registry/web/marquee.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/marquee.core.ts)

Previous: [TypingIndicator](https://dissolve.rselmi.com/components/typing-indicator/) · Next: [TextScramble](https://dissolve.rselmi.com/components/text-scramble/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/marquee/
