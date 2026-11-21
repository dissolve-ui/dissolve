# Theming

Twelve tokens, light and dark. Change them once and every component follows, or override one instance with a className.

`init` adds the tokens to your `global.css`. Components take their colors from classes like `bg-dissolve-surface` or `text-dissolve-foreground`, so they follow your palette. On the web, components read the same `--dissolve-*` variables directly, with or without Tailwind.

## Tokens

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--dissolve-background` | `255 255 255` | `0 0 0` | Screen behind the components |
| `--dissolve-surface` | `242 242 247` | `28 28 30` | Tracks, pads, bubbles, frames |
| `--dissolve-surface-2` | `229 229 234` | `44 44 46` | Raised pills and controls |
| `--dissolve-foreground` | `28 28 30` | `242 242 247` | Text, digits, ink |
| `--dissolve-muted` | `142 142 147` | `152 152 157` | Secondary text, idle icons, placeholders |
| `--dissolve-primary` | `28 28 30` | `242 242 247` | Main buttons, knobs, toasts |
| `--dissolve-primary-foreground` | `255 255 255` | `28 28 30` | Content on primary |
| `--dissolve-success` | `52 199 89` | `48 209 88` | Done and verified states |
| `--dissolve-danger` | `255 59 48` | `255 69 58` | Destructive actions, wrong codes |
| `--dissolve-danger-foreground` | `255 255 255` | `255 255 255` | Content on danger |
| `--dissolve-accent` | `10 132 255` | `10 132 255` | Your own voice notes, highlights |
| `--dissolve-border` | `60 60 67 / 0.12` | `84 84 88 / 0.5` | Hairlines, the signing line |
| `--dissolve-chart-1` | `255 55 135` | `255 79 152` | First chart series, pink |
| `--dissolve-chart-2` | `124 92 255` | `142 114 255` | Second chart series, violet |
| `--dissolve-chart-3` | `255 196 0` | `255 210 51` | Third chart series, yellow |

Each token is also a Tailwind color: `bg-dissolve-primary`, `text-dissolve-muted`, `border-dissolve-border`. Use them in your own screens too.

## Change them

Edit the values in `global.css`. Light values live on `:root`, dark ones in the `prefers-color-scheme: dark` block below.

global.css:

```css
/* global.css, after init */
:root {
  --dissolve-primary: rgb(120 72 40);
  --dissolve-primary-foreground: rgb(255 248 240);
  --dissolve-accent: rgb(196 120 60);
}

@media (prefers-color-scheme: dark) {
  :root {
    --dissolve-primary: rgb(232 200 168);
    --dissolve-primary-foreground: rgb(40 24 12);
  }
}
```

## Dark mode

Nothing to wire: the dark block follows the system color scheme and components switch live. Keep the `:root` plus media query pattern, `light-dark()` does not resolve on native.

## Why @theme inline

The tokens are mapped to Tailwind colors with `@theme inline`. Without `inline`, a class points at a `--color-*` variable that can be resolved once at the root, and on native it keeps the light value. With it, each class reads `var(--dissolve-*)` directly and picks the value of the current color scheme.

global.css:

```css
@layer theme {
  @theme inline {
    --color-dissolve-surface: var(--dissolve-surface);
    /* ... one line per token */
  }
}
```

## Override one instance

Every component takes `className`, plus a className per part: `textClassName`, `knobClassName`, `boxClassName` and so on, listed in its props. Classes are merged with `tailwind-merge`, so yours win over the default of the same kind.

Order.tsx:

```tsx
// Defaults: track bg-dissolve-surface, number text-dissolve-foreground
<SlideToConfirm
  label="Slide to order"
  onConfirm={order}
  className="bg-amber-100"                      // replaces bg-dissolve-surface
/>

<NumberTicker
  value={total}
  textClassName="text-emerald-600 font-bold"    // replaces the color and the weight
/>
```

Some colors are animated or drawn by Skia (OTP boxes, signature ink, waveform). They read the tokens through `useToken()`, so change the token, or edit the file: it is yours.

Your own Skia drawing:

```tsx
import { useToken } from '@/components/dissolve/tw';

const ink = useToken('foreground'); // live color string, light or dark
<Path path={stroke} color={ink} />
```

- [Browse components](https://dissolve.rselmi.com/components/swipe-to-delete/)
- [CLI](https://dissolve.rselmi.com/docs/cli/)

Source: https://dissolve.rselmi.com/docs/theming/
