# TaskCheck

**TaskCheck** is an animated task check component for React Native and React, from the dissolve library. Checkbox that draws its check and strikes the label, then the task moves away or dissolves.

A to do row. Tap it: the box fills with a small spring, the check draws in 220 ms, the strike runs across each real line of text and the label goes muted. After a short delay the task moves to Done, or dissolves into dust from the left and the list closes up. Tap again before the delay to undo.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add task-check --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/task-check.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add task-check --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/task-check.json
```

## Usage

TaskCheck.tsx (React Native):

```tsx
import { TaskCheck } from '@/components/dissolve/task-check';

<TaskCheck
  label={task.title}
  checked={task.done}
  onCheckedChange={(done) => update(task.id, { done })}
  after="move"
  onSettled={() => moveToDone(task.id)}
/>
```

TaskCheck.tsx (React):

```tsx
import { TaskCheck } from '@/components/dissolve/task-check';

<TaskCheck
  label={task.title}
  checked={task.done}
  onCheckedChange={(done) => update(task.id, { done })}
  after="move"
  onSettled={() => moveToDone(task.id)}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | `required` | The task. The strike follows each line it wraps to. |
| `checked` | `boolean` | `required` | Checked state. |
| `onCheckedChange` | `(checked: boolean) => void` | `required` | Called on tap. |
| `after` | `'stay' \| 'move' \| 'dissolve'` | `'stay'` | Once checked: nothing, onSettled so you move it to Done, or dust from the left, the gap closes, then onSettled. |
| `settleDelay` | `number` | `900` | Pause before the task settles. A tap within it undoes. |
| `onSettled` | `() => void` |  | Called when the task settles: move it, or drop it after the dust. |
| `boxSize` | `number` | `24` | Checkbox side. |
| `disabled` | `boolean` | `false` | Turns the tap off. |
| `haptics` | `boolean` | `true` | Light impact on check. |
| `className` | `string` |  | Outer wrapper classes (margins, separators). This is the part that closes up. |
| `rowClassName` | `string` |  | Row classes (padding, gap). |
| `labelClassName` | `string` |  | Label classes (size, weight). The color is animated from the tokens. |

## Source

- React Native: [registry/task-check.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/task-check.tsx)
- React: [registry/web/task-check.tsx](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/task-check.tsx) and [registry/web/task-check.core.ts](https://github.com/dissolve-ui/dissolve/blob/main/registry/web/task-check.core.ts)

Previous: [UploadTile](https://dissolve.rselmi.com/components/upload-tile/) · Next: [QuantityStepper](https://dissolve.rselmi.com/components/quantity-stepper/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/task-check/
