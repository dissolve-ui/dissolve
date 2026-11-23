# PasswordStrength

**PasswordStrength** is an animated password strength component for React Native and React, from the dissolve library. Password field with Show and Hide, a strength meter of dots that fill as it gets stronger and the rules ticking live.

A password field with Show and Hide, a quiet strength meter and the rules ticking live. The meter is four short segments of dots, not a bar: they fill from the left, dot by dot, as the password gets stronger, and the word beside them (Weak, Fair, Good, Strong) rolls to the next one. Each rule's circle turns into a check as soon as it is met. The score weighs length and variety; common passwords and long runs of one character score as weak whatever they contain. onChange hands you the password and its strength on every keystroke, with passed true once every rule is met and the score reaches minScore, so a Save button can wake up. Bring your own rules, or keep the default four (12 characters, upper and lower case, a number, a symbol). A selection tick when the strength changes. Reduced motion: dots and words change in place.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add password-strength --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/password-strength.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add password-strength --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/password-strength.json
```

## Usage

PasswordStrength.tsx (React Native):

```tsx
import { PasswordStrength } from '@/components/dissolve/password-strength';

const [ok, setOk] = useState(false);

<PasswordStrength onChange={(password, strength) => setOk(strength.passed)} />
<GlossyButton disabled={!ok} onPress={save}>Save password</GlossyButton>

// Your own rules, a lower bar.
<PasswordStrength
  rules={[{ label: 'At least 8 characters', test: (p) => p.length >= 8 }]}
  minScore={2}
/>
```

PasswordStrength.tsx (React):

```tsx
import { PasswordStrength } from '@/components/dissolve/password-strength';

const [ok, setOk] = useState(false);

<PasswordStrength onChange={(password, strength) => setOk(strength.passed)} />
<GlossyButton disabled={!ok} onPress={save}>Save password</GlossyButton>

// Your own rules, a lower bar.
<PasswordStrength
  rules={[{ label: 'At least 8 characters', test: (p) => p.length >= 8 }]}
  minScore={2}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` |  | The password, controlled. |
| `defaultValue` | `string` | `''` | The password when uncontrolled. |
| `onChange` | `(password: string, strength: Strength) => void` |  | Called on every keystroke. strength is { score: 0 to 4, label, rules: { label, met }[], passed }. |
| `onSubmit` | `(password: string, strength: Strength) => void` |  | Return in the field. |
| `rules` | `{ label, test(password) }[]` | `DEFAULT_RULES` | The checklist. Default: 12 characters, upper and lower case, a number, a symbol. |
| `minScore` | `number` | `3` | The score passed needs: 1 Weak, 2 Fair, 3 Good, 4 Strong. |
| `placeholder` | `string` | `'Password'` | Placeholder of the field. |
| `haptics` | `boolean` | `true` | A selection tick when the strength changes. |
| `disabled` | `boolean` | `false` | Dims the field and ignores input. |
| `surfaceClassName` (React Native only) | `string` | `'bg-dissolve-surface'` | Classes of the field surface. |
| `className` | `string` |  | Outer classes (margins, width...). |

## Source

- React Native: [registry/password-strength.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/password-strength.tsx)
- React: [registry/web/password-strength.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/password-strength.tsx) and [registry/web/password-strength.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/password-strength.core.ts)

Previous: [RangeSlider](https://dissolve.rselmi.com/components/range-slider/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/password-strength/
