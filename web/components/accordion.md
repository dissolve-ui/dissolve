# Accordion

**Accordion** is an animated accordion component for React Native and React, from the dissolve library. Expandable sections: the height glides open, the chevron turns over and the content slides in.

Expandable sections on hairline dividers. Tap a header and its section opens on a smooth height curve while the chevron turns over, then the content fades in and slides down into place, a beat behind the height. One section open at a time (type single, the default, collapsible unless you say otherwise) or any number (type multiple), controlled or not. On the web each header is a button with aria-expanded and aria-controls, each section a region labelled by its header, and Arrow Up, Arrow Down, Home and End move between headers; on iOS the headers announce their expanded state and closed sections are hidden from VoiceOver. A selection tick on every change. Reduced motion: the section opens at once and the content simply fades.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add accordion --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/accordion.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add accordion --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/accordion.json
```

## Usage

Accordion.tsx (React Native):

```tsx
import { Accordion } from '@/components/dissolve/accordion';

<Accordion
  items={[
    { value: 'shipping', title: 'Shipping', content: 'Orders leave the studio within two days.' },
    { value: 'returns', title: 'Returns', content: <ReturnsPolicy /> },
  ]}
  defaultValue={['shipping']}
/>

// Any number open, controlled.
const [open, setOpen] = useState<string[]>([]);
<Accordion type="multiple" items={faq} value={open} onValueChange={setOpen} />
```

Accordion.tsx (React):

```tsx
import { Accordion } from '@/components/dissolve/accordion';

<Accordion
  items={[
    { value: 'shipping', title: 'Shipping', content: 'Orders leave the studio within two days.' },
    { value: 'returns', title: 'Returns', content: <ReturnsPolicy /> },
  ]}
  defaultValue={['shipping']}
/>

// Any number open, controlled.
const [open, setOpen] = useState<string[]>([]);
<Accordion type="multiple" items={faq} value={open} onValueChange={setOpen} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `{ value, title, content, disabled? }[]` |  | The sections. content is any node; a string is set in the muted body style. |
| `type` | `'single' \| 'multiple'` | `'single'` | Single: opening a section closes the other. Multiple: each opens on its own. |
| `collapsible` | `boolean` | `true` | In single mode, the open section can be closed again. |
| `value` | `string[]` |  | Open sections (controlled). In single mode, at most one. |
| `defaultValue` | `string[]` | `[]` | Initially open sections when uncontrolled. |
| `onValueChange` | `(value: string[]) => void` |  | Called with the open sections on every change. |
| `haptics` | `boolean` | `true` | Selection tick on every change. |
| `className` | `string` |  | Outer classes (margins, padding, background...). |

## Source

- React Native: [registry/accordion.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/accordion.tsx)
- React: [registry/web/accordion.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/accordion.tsx) and [registry/web/accordion.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/accordion.core.ts)

Previous: [ElasticSlider](https://dissolve.rselmi.com/components/elastic-slider/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/accordion/
