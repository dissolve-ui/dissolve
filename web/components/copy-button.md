# CopyButton

**CopyButton** is an animated copy button component for React Native and React, from the dissolve library. Icon button that copies text: the copy icon breaks into grains that reform as a check, a Copied tooltip rises.

An icon button that copies text. Press it and the text goes to the clipboard with a success haptic on iOS. The copy icon breaks into a few grains that flow over on a slight arc, shrinking mid flight, and reform as a check with a tiny pop, while a Copied tooltip rises above the button and screen readers announce it. After 1.5 s it settles back to the copy icon; pressing again while the check shows only restarts the countdown. The grains are the one dissolve moment: effects="none" swaps the icons with a plain crossfade. Reduced motion: a crossfade, no pop. React Native copies with expo-clipboard; the web uses the Clipboard API, with the selection fallback on insecure pages.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add copy-button --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/copy-button.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add copy-button --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/copy-button.json
```

## Usage

CopyButton.tsx (React Native):

```tsx
import { CopyButton } from '@/components/dissolve/copy-button';

<CopyButton text="npx dissolve-ui add copy-button" />

// The text at press time, smaller, a plain crossfade.
<CopyButton text={() => editor.getValue()} size="sm" effects="none" onCopy={(t) => track('copied', t.length)} />
```

CopyButton.tsx (React):

```tsx
import { CopyButton } from '@/components/dissolve/copy-button';

<CopyButton text="npx dissolve-ui add copy-button" />

// The text at press time, smaller, a plain crossfade.
<CopyButton text={() => editor.getValue()} size="sm" effects="none" onCopy={(t) => track('copied', t.length)} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string \| () => string` |  | The text to copy, or a function that returns it at press time. |
| `onCopy` | `(text: string) => void` |  | Called with the copied text. |
| `timeout` | `number` | `1500` | How long the check and the tooltip stay, in ms. |
| `copiedLabel` | `string` | `'Copied'` | Tooltip text, also announced to screen readers. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button and icon size: 32, 36 or 44 pt. |
| `effects` | `'accent' \| 'none'` | `'accent'` | Accent: the copy icon breaks into grains that reform as the check. None: a plain crossfade. |
| `haptics` | `boolean` | `true` | Success haptic on copy. |
| `disabled` | `boolean` | `false` | No copy, the button shows at 40% opacity. |
| `accessibilityLabel` | `string` | `'Copy'` | Read by screen readers. |
| `className` | `string` |  | Outer classes (margins, background...). The size comes from the size prop. |

## Source

- React Native: [registry/copy-button.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/copy-button.tsx)
- React: [registry/web/copy-button.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/copy-button.tsx) and [registry/web/copy-button.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/copy-button.core.ts)

Previous: [Accordion](https://dissolve.rselmi.com/components/accordion/) · Next: [AvatarStack](https://dissolve.rselmi.com/components/avatar-stack/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/copy-button/
