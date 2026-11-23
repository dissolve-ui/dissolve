# TextScramble

**TextScramble** is an animated text scramble component for React Native and React, from the dissolve library. Text that decodes into place: every letter scrambles through random glyphs, then they land one by one into the final text.

Text that decodes into place: every letter turns into random glyphs that keep changing, then the letters resolve one by one, left to right with a little randomness, into the final text. It plays when the text changes, when trigger changes, on ref.current.scramble(), and on mount with playOnMount. Letters keep the width of their final character while they scramble, so the line never shifts and wraps where the final text wraps; by default each glyph is of the same kind and about the same width as its letter, so a proportional line keeps its rhythm, and monospace sets a monospace font. Glyphs show in the muted token (glyphColor), landed letters in your text color. The text stays real text: on the web it is selectable and copyable, and screen readers read the final text once. Reduced motion: no glyphs, the new text fades in.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add text-scramble --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/text-scramble.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add text-scramble --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/text-scramble.json
```

## Usage

TextScramble.tsx (React Native):

```tsx
import { TextScramble, type TextScrambleHandle } from '@/components/dissolve/text-scramble';

<TextScramble
  text={status}
  className="text-dissolve-foreground"
  style={{ fontSize: 34, fontWeight: '600' }}
/>

// Monospace, replayed on every refresh.
<TextScramble text="GATE C14 / BOARDS 14:05" monospace trigger={refreshCount} />

// On demand.
const ref = useRef<TextScrambleHandle>(null);
<TextScramble ref={ref} text="Built to dissolve" />
ref.current?.scramble();
```

TextScramble.tsx (React):

```tsx
import { TextScramble, type TextScrambleHandle } from '@/components/dissolve/text-scramble';

<TextScramble as="h1" text={status} className="text-4xl font-semibold" />

// Monospace, replayed on every refresh.
<TextScramble text="GATE C14 / BOARDS 14:05" monospace trigger={refreshCount} />

// On demand.
const ref = useRef<TextScrambleHandle>(null);
<TextScramble ref={ref} text="Built to dissolve" />
ref.current?.scramble();
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` |  | The text it decodes into. A change plays the scramble. |
| `trigger` | `unknown` |  | Any value: each change replays the scramble on the same text. |
| `duration` | `number` | `900` | Time until the last letter lands, in ms. |
| `rate` | `number` | `45` | How often a scrambling letter changes glyph, in ms. |
| `glyphs` | `string` |  | Characters drawn while scrambling. Default: glyphs of the same kind and width as each letter; with monospace, A-Z, 0-9 and signs. |
| `monospace` | `boolean` | `false` | A monospace font (Menlo on iOS, ui-monospace on the web). |
| `playOnMount` | `boolean` | `false` | Plays once on mount. Off: the text shows as is. |
| `glyphColor` | `string` | `muted token` | Color of the glyphs. |
| `onDone` | `() => void` |  | Called when the last letter lands. |
| `ref.scramble` | `() => void` |  | Plays the scramble on the current text. |
| `as` | `ElementType` | `'span'` | The element on the web: h1, p, span... |
| `numberOfLines` (React Native only) | `number` |  | Line limit, as on a Text (React Native). |
| `style` | `TextStyle` |  | Your text style: size, weight, color... |
| `className` | `string` |  | Text classes. |

## Source

- React Native: [registry/text-scramble.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/text-scramble.tsx)
- React: [registry/web/text-scramble.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/text-scramble.tsx) and [registry/web/text-scramble.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/text-scramble.core.ts)

Previous: [Marquee](https://dissolve.rselmi.com/components/marquee/) · Next: [ConfettiBurst](https://dissolve.rselmi.com/components/confetti-burst/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/text-scramble/
