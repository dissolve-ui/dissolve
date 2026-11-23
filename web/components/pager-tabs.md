# PagerTabs

**PagerTabs** is an animated pager tabs component for React Native and React, from the dissolve library. Tabs over swipeable pages: a soft pill follows the swipe, stretching between tabs, the row scrolls to keep the tab in view.

Tabs above swipeable pages. Swipe the pages (touch, a trackpad, or drag them with the mouse) and a soft pill slides behind the tabs the whole way, following the finger, stretching between two tabs of different widths; the label on it turns from muted to full ink as it arrives. No underline, no rule. Tap a tab and the pages glide to it. With more tabs than fit, the row scrolls on its own to keep the active tab in view. On the web the row is ARIA tabs: once it has focus the arrow keys, Home and End move between tabs. Give it a height: the pages fill it under the tabs and each scrolls on its own. A tick when the page changes. Reduced motion: a tap jumps straight to its page.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add pager-tabs --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/pager-tabs.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add pager-tabs --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/pager-tabs.json
```

## Usage

PagerTabs.tsx (React Native):

```tsx
import { PagerTabs, type PagerTabsHandle } from '@/components/dissolve/pager-tabs';

<PagerTabs
  tabs={['For you', 'Following', 'Design', 'Cities']}
  renderPage={(tab) => <Feed topic={tab} />}
  onIndexChange={(i) => track('tab', i)}
  className="flex-1"
/>

// A few tabs sharing the width, from code with a ref.
const pager = useRef<PagerTabsHandle>(null);
<PagerTabs ref={pager} tabs={['Day', 'Week', 'Month']} scrollable={false} renderPage={renderRange} />
pager.current?.select(2);
```

PagerTabs.tsx (React):

```tsx
import { PagerTabs, type PagerTabsHandle } from '@/components/dissolve/pager-tabs';

<PagerTabs
  tabs={['For you', 'Following', 'Design', 'Cities']}
  renderPage={(tab) => <Feed topic={tab} />}
  onIndexChange={(i) => track('tab', i)}
  style={{ height: 600 }}
/>

// A few tabs sharing the width, from code with a ref.
const pager = useRef<PagerTabsHandle>(null);
<PagerTabs ref={pager} tabs={['Day', 'Week', 'Month']} scrollable={false} renderPage={renderRange} style={{ height: 480 }} />
pager.current?.select(2);
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tabs` | `string[]` |  | The tab labels, one page each. |
| `renderPage` | `(tab: string, index: number) => ReactNode` |  | The page of each tab. Each page scrolls on its own. |
| `initialIndex` | `number` | `0` | The page shown first. |
| `onIndexChange` | `(index: number) => void` |  | Called when the pages settle on a new tab. |
| `scrollable` | `boolean` | `true` | The tab row scrolls when the tabs do not fit; false shares the width between them. |
| `haptics` | `boolean` | `true` | A tick when the page changes. |
| `ref.select` | `(index: number, animated?: boolean) => void` |  | Goes to a page from code, as a tap on its tab. |
| `className` | `string` |  | Outer classes. Give it a height (flex: 1, or a fixed height on the web). |

## Source

- React Native: [registry/pager-tabs.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/pager-tabs.tsx)
- React: [registry/web/pager-tabs.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/pager-tabs.tsx) and [registry/web/pager-tabs.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/pager-tabs.core.ts)

Previous: [MagnifyDock](https://dissolve.rselmi.com/components/magnify-dock/) · Next: [RangeSlider](https://dissolve.rselmi.com/components/range-slider/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/pager-tabs/
