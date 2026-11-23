# MagnifyDock

**MagnifyDock** is an animated magnify dock component for React Native and React, from the dissolve library. The macOS dock: icons swell on springs around the pointer, the shelf widens, a launch hops the icon and lights its dot.

The macOS dock. Move the pointer along it and the icons swell around it, each on its own spring: the one under the pointer is the largest, its neighbours ease up with the distance, and the frosted shelf widens with them so nothing overlaps, anchored at the pointer so the icon under it stays under it. Icons grow from the bottom, as vectors redrawn at their size, never a scaled bitmap. The name of the icon under the pointer floats above it. Click it and it launches: it hops out of the shelf and bounces once like a ball, then a dot lights under it and stays while the app runs (running, controlled or not). On a phone, press and slide along the dock to magnify under the finger; lifting launches the icon under it. Keyboard: Tab in, the arrow keys, Home and End move (the focused icon swells), Enter or Space launches. Icons are vector specs on a 100 by 100 grid: dockIcon gives seven ready ones (finder, mail, music, photos, notes, calendar with today's date, settings), or describe your own. The shelf follows the theme. A tick on launch. Reduced motion: no magnification and no bounce; names and dots still show.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add magnify-dock --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/magnify-dock.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add magnify-dock --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/magnify-dock.json
```

## Usage

MagnifyDock.tsx (React Native):

```tsx
import { MagnifyDock, dockIcon } from '@/components/dissolve/magnify-dock';

<MagnifyDock
  items={[
    { key: 'mail', label: 'Mail', icon: dockIcon('mail') },
    { key: 'music', label: 'Music', icon: dockIcon('music') },
    { key: 'notes', label: 'Notes', icon: dockIcon('notes') },
  ]}
  onLaunch={(item) => open(item.key)}
/>

// A phone sized dock, running apps controlled.
<MagnifyDock items={apps} size={38} magnification={1.5} gap={5} running={running} onLaunch={launch} />
```

MagnifyDock.tsx (React):

```tsx
import { MagnifyDock, dockIcon } from '@/components/dissolve/magnify-dock';

<MagnifyDock
  items={[
    { key: 'mail', label: 'Mail', icon: dockIcon('mail') },
    { key: 'music', label: 'Music', icon: dockIcon('music') },
    { key: 'notes', label: 'Notes', icon: dockIcon('notes') },
  ]}
  onLaunch={(item) => open(item.key)}
/>

// A phone sized dock, running apps controlled.
<MagnifyDock items={apps} size={38} magnification={1.5} gap={5} running={running} onLaunch={launch} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `{ key, label, icon }[]` |  | The apps. icon is a vector spec: dockIcon('mail') or your own DockIconSpec (a tile paint and layers on a 100 x 100 grid). |
| `onLaunch` | `(item, index) => void` |  | Called when an icon launches (a click, a lift on touch, Enter), as it starts to bounce. |
| `running` | `string[]` |  | Keys of the running apps, a dot under each (controlled). Pair it with onLaunch. |
| `defaultRunning` | `string[]` | `[]` | Running apps at first when uncontrolled. Launching adds to it. |
| `size` | `number` | `56` | Icon size at rest, in pt. |
| `magnification` | `number` | `1.9` | Size of the icon under the pointer, as a multiple. |
| `reach` | `number` | `2.6` | How far the swell reaches, in icons. |
| `gap` | `number` | `6` | Space between icons, in pt. |
| `labels` | `boolean` | `true` | The name above the icon under the pointer. |
| `haptics` | `boolean` | `true` | A tick on launch. |
| `label` | `string` | `'Dock'` | The toolbar's accessible name (web). |
| `appearance` | `'auto' \| 'light' \| 'dark'` | `'auto'` | The shelf's look: auto reads the background token (web). |
| `className` | `string` |  | Outer classes (margins...). It takes the full width and reserves the height it needs. |

## Source

- React Native: [registry/magnify-dock.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/magnify-dock.tsx)
- React: [registry/web/magnify-dock.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/magnify-dock.tsx) and [registry/web/magnify-dock.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/magnify-dock.core.ts)

Previous: [ConfettiBurst](https://dissolve.rselmi.com/components/confetti-burst/) · Next: [PagerTabs](https://dissolve.rselmi.com/components/pager-tabs/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/magnify-dock/
