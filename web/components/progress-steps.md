# ProgressSteps

**ProgressSteps** is an animated progress steps component for React Native and React, from the dissolve library. Numbered steps on a line, or story style bars: the progress streams on to the next step in grains.

Steps for onboarding, checkout or any multi step form, in two looks. variant="numbers" draws small numbered discs on a hairline: done steps are filled with a check, the current one has a thin ring around it, the next ones are soft and muted. Move forward and the current disc sheds a copy of itself in grains: the cloud flattens onto the line and streams along it, filling the line behind its front, then gathers back into a disc on the new step, in about 450 ms and a little longer when it skips steps. Move back and the disc breaks up and streams home the other way, emptying the line. variant="bars" is story style: one thin segment per step and no numbers. The fill runs on into the next segment, its head gathering out of grains that drift in and settle, and recedes shedding them as dust when you go back. A selection tick on every change. On iOS the discs, fills and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the fills slide and the discs cross fade.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add progress-steps --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/progress-steps.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add progress-steps --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/progress-steps.json
```

## Usage

ProgressSteps.tsx (React Native):

```tsx
import { ProgressSteps } from '@/components/dissolve/progress-steps';

const [step, setStep] = useState(0);
<ProgressSteps steps={['Account', 'Profile', 'Payment', 'Done']} current={step} />

// Numbers only, smaller, done steps can be pressed to go back.
<ProgressSteps steps={5} current={step} size="sm" onStepPress={(i) => i < step && setStep(i)} />

// Story bars, no numbers.
<ProgressSteps variant="bars" steps={4} current={story} />
```

ProgressSteps.tsx (React):

```tsx
import { ProgressSteps } from '@/components/dissolve/progress-steps';

const [step, setStep] = useState(0);
<ProgressSteps steps={['Account', 'Profile', 'Payment', 'Done']} current={step} />

// Numbers only, smaller, done steps can be pressed to go back.
<ProgressSteps steps={5} current={step} size="sm" onStepPress={(i) => i < step && setStep(i)} />

// Story bars, no numbers.
<ProgressSteps variant="bars" steps={4} current={story} />
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `'numbers' \| 'bars'` | `'numbers'` | Numbered discs on a line, or story style segments with no numbers. |
| `steps` | `string[] \| number` | `required` | The steps: their labels, or how many there are (no labels then). Two or more. |
| `current` | `number` | `required` | The current step, from 0. steps.length marks them all done. |
| `onStepPress` | `(index: number) => void` |  | Called with the index of a pressed step. Steps are not pressable without it. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Disc, line and type size (18, 22 or 28 pt discs), or bar thickness (3, 4 or 6 pt). |
| `haptics` | `boolean` | `true` | Selection tick on every change of current. |
| `activeColor` | `string` | `primary token` | Fill of the done and current discs, the line and the grains. |
| `trackColor` | `string` | `foreground at low alpha` | The next steps' discs, the empty line and the empty bars. |
| `className / labelClassName` | `string` |  | Outer classes (width, margins...) and label classes. It stretches to its parent by default. |

## Source

- React Native: [registry/progress-steps.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/progress-steps.tsx)
- React: [registry/web/progress-steps.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/progress-steps.tsx) and [registry/web/progress-steps.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/progress-steps.core.ts)

Previous: [Toggle](https://dissolve.rselmi.com/components/toggle/) · Next: [ElasticSlider](https://dissolve.rselmi.com/components/elastic-slider/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/progress-steps/
