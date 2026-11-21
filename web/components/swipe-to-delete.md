# SwipeToDelete

**SwipeToDelete** is an animated swipe to delete component for React Native and React, from the dissolve library. Swipe a row left to delete it: it dissolves, then the list closes up.

A row you swipe left to delete, like Mail or WhatsApp. Past 40 percent, or with a quick flick, the row dissolves, the list closes up behind it, then onDelete runs.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add swipe-to-delete toast --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/swipe-to-delete.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add swipe-to-delete toast --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/swipe-to-delete.json
```

## Usage

SwipeToDelete.tsx (React Native):

```tsx
import { useState } from 'react';
import { SwipeToDelete } from '@/components/dissolve/swipe-to-delete';
import { useToast } from '@/components/dissolve/toast';

export function Inbox() {
  const [mails, setMails] = useState(MAILS);
  const toast = useToast();

  return mails.map((m) => (
    <SwipeToDelete
      key={m.id}
      rowClassName="rounded-[18px]"
      onDelete={() => {
        setMails((l) => l.filter((x) => x.id !== m.id));
        toast.show({
          title: 'Conversation deleted',
          message: m.from,
          action: { label: 'Undo', onPress: () => restore(m) },
        });
      }}
    >
      <MailRow mail={m} />
    </SwipeToDelete>
  ));
}
```

SwipeToDelete.tsx (React):

```tsx
import { useState } from 'react';
import { SwipeToDelete } from '@/components/dissolve/swipe-to-delete';
import { useToast } from '@/components/dissolve/toast';

export function Inbox() {
  const [mails, setMails] = useState(MAILS);
  const toast = useToast();

  return mails.map((m) => (
    <SwipeToDelete
      key={m.id}
      rowClassName="rounded-[18px]"
      onDelete={() => {
        setMails((l) => l.filter((x) => x.id !== m.id));
        toast.show({
          title: 'Conversation deleted',
          message: m.from,
          action: { label: 'Undo', onPress: () => restore(m) },
        });
      }}
    >
      <MailRow mail={m} />
    </SwipeToDelete>
  ));
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | `required` | The row. It slides with your finger over the delete action. |
| `onDelete` | `() => void` | `required` | Called once the row has dissolved and collapsed: remove the item from your data here. |
| `preset` | `VariantName` | `'dust'` | Exit used when the row goes. |
| `threshold` | `number` | `0.4` | Fraction of the row width to drag before release deletes. A flick faster than 900 pt/s deletes too. |
| `disabled` | `boolean` | `false` | Turns the pan gesture off. |
| `className` | `string` |  | Outer wrapper (margins, layout). This is the part that collapses. |
| `rowClassName` | `string` | `'overflow-hidden'` | Clipping row. Corner radius goes here (`rounded-2xl`), the action follows it. |
| `actionClassName` | `string` | `'bg-dissolve-danger'` | Delete action revealed behind the row. |

## Source

- React Native: [registry/swipe-to-delete.tsx](https://github.com/rs-4/dissolve/blob/main/registry/swipe-to-delete.tsx)
- React: [registry/web/swipe-to-delete.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/swipe-to-delete.tsx) and [registry/web/swipe-to-delete.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/swipe-to-delete.core.ts)

Next: [Toast](https://dissolve.rselmi.com/components/toast/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/swipe-to-delete/
