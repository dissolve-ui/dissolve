# SignaturePad

**SignaturePad** is an animated signature pad component for React Native and React, from the dissolve library. Variable width Skia signature, undo, clear into dust, PNG export.

Sign with your finger or a mouse. Ink is drawn as variable width strokes, thick when slow and thin when fast, with tapered ends, on a signing line whose placeholder fades as you start. Undo removes the last stroke, Clear turns the signature into dust and leaves the paper.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add signature-pad --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/signature-pad.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add signature-pad --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/signature-pad.json
```

## Usage

SignaturePad.tsx (React Native):

```tsx
import { useRef } from 'react';
import { SignaturePad, type SignaturePadHandle } from '@/components/dissolve/signature-pad';

export function Sign() {
  const pad = useRef<SignaturePadHandle>(null);

  return (
    <SignaturePad
      ref={pad}
      placeholder="Sign here"
      onChange={setSigned}
      onSave={({ base64 }) => upload(base64)}
    />
  );
}

// pad.current?.save(), pad.current?.clear() dissolves the ink
```

SignaturePad.tsx (React):

```tsx
import { useRef } from 'react';
import { SignaturePad, type SignaturePadHandle } from '@/components/dissolve/signature-pad';

export function Sign() {
  const pad = useRef<SignaturePadHandle>(null);

  return (
    <SignaturePad
      ref={pad}
      placeholder="Sign here"
      onChange={setSigned}
      onSave={({ base64 }) => upload(base64)}
    />
  );
}

// pad.current?.save(), pad.current?.clear() dissolves the ink
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `strokeColor` | `string` | `foreground token` | Ink color, also used for the exported PNG. |
| `strokeWidth` | `number` | `3.2` | Base nib width. Slow strokes get thicker, fast ones thinner. |
| `onChange` | `(hasSignature: boolean) => void` |  | Called when the pad goes from empty to signed and back. |
| `onSave` | `(signature: SignatureExport) => void` |  | Receives the image, a base64 PNG and its size, from save(). |
| `placeholder` | `string` | `'Sign here'` | Shown above the line, fades once you start. |
| `height` | `number` | `200` | Pad height. |
| `exportBackground` | `string` | `transparent` | Background of the exported PNG. |
| `controls` | `boolean` | `true` | Built in Undo and Clear pills. |
| `haptics` | `boolean` | `true` | Selection tick on undo, dust haptics on clear. |
| `className` | `string` | `'rounded-[20px] bg-dissolve-surface'` | Pad: background, radius, border. |
| `guideClassName` | `string` | `'bg-dissolve-border'` | Signing line. |
| `placeholderClassName` | `string` | `'text-dissolve-muted'` | Placeholder and x mark. |
| `controlClassName` | `string` | `'rounded-full bg-dissolve-surface-2'` | Undo and Clear pills. |
| `ref` | `Ref<SignaturePadHandle>` |  | `undo()`, `clear()`, `isEmpty()`, `toImage()`, `save()`. |

## Source

- React Native: [registry/signature-pad.tsx](https://github.com/rs-4/dissolve/blob/main/registry/signature-pad.tsx)
- React: [registry/web/signature-pad.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/signature-pad.tsx) and [registry/web/signature-pad.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/signature-pad.core.ts)

Previous: [VoiceNote](https://dissolve.rselmi.com/components/voice-note/) · Next: [CardStack](https://dissolve.rselmi.com/components/card-stack/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/signature-pad/
