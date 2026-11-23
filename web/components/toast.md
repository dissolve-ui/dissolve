# Toast

**Toast** is an animated toast component for React Native and React, from the dissolve library. Toasts that arrive in grains and leave as dust, with an optional Undo action.

Toasts that arrive in grains and leave as dust. A provider holds the stack at the top of the screen, three at most: over the limit the oldest one leaves as dust instead of vanishing.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add toast --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/toast.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add toast --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/toast.json
```

## Usage

Toast.tsx (React Native):

```tsx
import { ToastProvider, useToast } from '@/components/dissolve/toast';

// app/_layout.tsx, inside <DissolveProvider>
<ToastProvider top={insets.top + 8}>
  <Stack />
</ToastProvider>

// any screen
const toast = useToast();

toast.show({ title: 'Changes saved', tone: 'success' });
toast.show({
  title: 'Photo deleted',
  message: 'Lisbon, 3 years ago',
  action: { label: 'Undo', onPress: restore },
});
toast.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' });
```

Toast.tsx (React):

```tsx
import { ToastProvider, useToast } from '@/components/dissolve/toast';

// app/layout.tsx
<ToastProvider top={8}>
  {children}
</ToastProvider>

// any screen
const toast = useToast();

toast.show({ title: 'Changes saved', tone: 'success' });
toast.show({
  title: 'Photo deleted',
  message: 'Lisbon, 3 years ago',
  action: { label: 'Undo', onPress: restore },
});
toast.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' });
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `required` | First line, one line. |
| `message` | `string` |  | Second line, up to two lines. |
| `tone` | `'default' \| 'success' \| 'error'` | `'default'` | Color of the dot: gray, green or red. |
| `action` | `{ label, onPress }` |  | A single action, typically Undo. The toast leaves after it runs. |
| `duration` | `number` | `3200` | Time on screen before it leaves on its own, ms. 0 keeps it until tapped. |
| `enter` | `VariantName` | `'gather'` | Entrance. |
| `exit` | `VariantName` | `'dust'` | Exit. |
| `<ToastProvider top>` | `number` | `56` | Distance from the top of the screen. |
| `<ToastProvider max>` | `number` | `3` | Toasts on screen at once. |
| `<ToastProvider className>` | `string` | `'left-3 right-3 gap-2'` | Stack: side insets, gap. |
| `<ToastProvider cardClassName>` | `string` | `'bg-dissolve-primary rounded-[18px]'` | Every card: background, radius, padding. |

## Source

- React Native: [registry/toast.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/toast.tsx)
- React: [registry/web/toast.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/toast.tsx) and [registry/web/toast.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/toast.core.ts)

Previous: [SwipeToDelete](https://dissolve.rselmi.com/components/swipe-to-delete/) · Next: [GlossyButton](https://dissolve.rselmi.com/components/glossy-button/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/toast/
