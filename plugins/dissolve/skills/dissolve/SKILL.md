---
name: dissolve
description: Add animated UI components to React Native (Expo) and React web apps with dissolve. Use when the user wants an animated or tactile component (swipe to delete, toast, like button, slide to confirm, OTP input, number ticker, segmented control, toggle, slider, accordion, tooltip, skeleton, bar chart, pull to refresh...), a view that dissolves into dust or gathers from particles, or when the project already has dissolve.json, components/dissolve/ or imports from dissolve-ui.
---

# dissolve

dissolve is a library of animated components you own, shadcn style: the CLI copies each component's source into the app, and the user edits it freely. Every component runs on React Native (Expo, Reanimated 4, Skia) and on React for the web (framework free canvas and DOM cores), with the same props on both. Site: https://dissolve.rselmi.com.

## When to reach for it

- The user asks for a polished, animated version of a common control in a React Native or React app: a button with feedback, a toggle, a segmented control, a price that rolls, a toast, a list row that swipes away.
- The user wants a view to disintegrate (delete, unsend, dismiss) or to appear from grains. On React Native that is the engine in the `dissolve-ui` package (hooks such as `useDissolve`), documented by the dissolve MCP server.
- The project already uses dissolve: there is a `dissolve.json`, a `components/dissolve/` folder, or imports from `dissolve-ui`.

Do not use it for apps that are neither React Native nor React, or when the user wants a plain unanimated control.

## Pick a component

Run `npx dissolve-ui list` in the project for the current list and the platforms of each one. As of this plugin version:

| Name | Export | Use it for |
|---|---|---|
| `swipe-to-delete` | `SwipeToDelete` | Swipe a row left to delete it: it dissolves, then the list closes up. |
| `toast` | `ToastProvider, useToast` | Toasts that arrive in grains and leave as dust, with an optional Undo action. |
| `like-button` | `LikeButton` | Heart that pops with sparks on like and snaps into grains on unlike. |
| `morph-button` | `MorphButton` | Dynamic Island style pill that folds into a loader, then opens as the done state. |
| `split-button` | `SplitButton` | Splits in two like a drop of liquid metal, Cancel and Confirm halves. |
| `slide-to-confirm` | `SlideToConfirm` | Slide to pay or confirm, shimmer label, loader, done state. |
| `gooey-menu` | `GooeyMenu` | Floating button whose actions pour out as gooey drops. |
| `otp-input` | `OTPInput` | One time code boxes, verify sweep, success tint, shake and dust on reject. |
| `number-ticker` | `NumberTicker` | Rolling digit columns for prices and counters, locale aware. |
| `reaction-picker` | `ReactionPicker` | iMessage style reactions: long press, dock magnifier, emoji flies to a badge. |
| `voice-note` | `VoiceNote` | Voice message bubble: play, scrub the waveform with ticks, unsend as dust. |
| `card-stack` | `CardStack` | Wallet style card stack: tap to focus, drag down to put back, swipe to cycle. |
| `signature-pad` | `SignaturePad` | Variable width signature, undo, clear into dust, PNG export. |
| `before-after` | `BeforeAfter` | Before / after image comparison with a draggable divider and haptic ticks. |
| `thinking-orb` | `ThinkingOrb` | A sphere of dots that shows what an AI agent is doing: thinking, searching, listening, done. |
| `image-reveal` | `ImageReveal` | Image generation loader: a mosaic that resolves coarse to fine, then settles in grains. |
| `sweep-transition` | `SweepTransition` | A liquid band sweeps across a view and leaves the new state behind it. |
| `upload-tile` | `UploadTile, UploadTray` | Attachment that assembles from grains, fills a progress ring, rejected files leave as dust. |
| `task-check` | `TaskCheck` | Checkbox that draws its check and strikes the label, then the task moves away or dissolves. |
| `quantity-stepper` | `QuantityStepper` | Minus and plus with rolling digits and an accelerating long press; at 1 it turns into a trash. |
| `ruler-picker` | `RulerPicker` | Horizontal ruler with momentum, rolling value and a haptic tick per graduation. |
| `bar-chart` | `BarChart` | Bar chart you scrub with a finger, sliding bubble, bars regrow on period change. |
| `mini-player` | `MiniPlayer` | Now playing pill that opens into a full player as one object, then folds back. |
| `pull-to-refresh` | `PullToRefresh` | Pull a list down: grains gather into a loader, release and the content rebuilds itself. |
| `reorder-list` | `ReorderList` | Long press a row to lift it, drag to reorder, the others make room. |
| `glossy-button` | `GlossyButton` | Tactile pill lit from the inside, presses down on a crisp spring. |
| `scratch-card` | `ScratchCard` | Foil scratch card that tilts under the finger, sheds grains, then dissolves past the threshold. |
| `skeleton` | `Skeleton, SkeletonBlock` | Loading placeholders that break into grains and recompose into the real content. |
| `segmented-control` | `SegmentedControl` | iOS segmented control whose pill breaks into grains and reassembles on the new segment. |
| `toggle` | `Toggle` | iOS switch whose thumb breaks into grains and reassembles at the other end. |
| `progress-steps` | `ProgressSteps` | Numbered steps on a line, or story style bars, the progress streams on in grains. |
| `elastic-slider` | `ElasticSlider` | Thick rounded slider; pulled past an end, the track stretches like a rubber band. |
| `accordion` | `Accordion` | Expandable sections: the height glides open, the chevron turns, the content slides in. |
| `copy-button` | `CopyButton` | Copy icon that breaks into grains and reforms as a check, with a Copied tooltip. |
| `avatar-stack` | `AvatarStack` | Overlapping avatars with a +N chip that spread apart with names on hover or hold. |
| `tooltip` | `Tooltip` | A label with an arrow on hover, focus or long press, flips and slides to stay on screen. |
| `typing-indicator` | `TypingIndicator` | Chat typing indicator: avatars pop into a stack beside three waving dots. |
| `marquee` | `Marquee` | Endless scrolling row of logos, words or cards; hover to stop, drag to scrub. |
| `text-scramble` | `TextScramble` | Text that decodes into place through random glyphs, without shifting layout. |
| `confetti-burst` | `ConfettiBurst` | A short, quiet burst of paper from a button, fired from a ref. |
| `magnify-dock` | `MagnifyDock` | The macOS dock: icons swell around the pointer, launch bounce and running dots. |
| `pager-tabs` | `PagerTabs` | Tabs over swipeable pages with a soft pill that follows the swipe. |
| `range-slider` | `RangeSlider` | Two handle range slider with rolling value bubbles and optional steps. |
| `password-strength` | `PasswordStrength` | Password field with a dotted strength meter and live rules. |

Pick the one closest to the user's intent, and say which you picked and why in one line. Each component's page, with its props and an example, is at `https://dissolve.rselmi.com/components/<name>/`, and as markdown at `https://dissolve.rselmi.com/components/<name>.md`. Read it before you wire props you are unsure of.

## Install

1. Once per project, set up the platform. It writes `dissolve.json`, adds the theme tokens to the global css, and on React Native copies the `tw.tsx` primitives and checks the NativeWind setup:

```sh
npx dissolve-ui init --native   # React Native / Expo
npx dissolve-ui init --web      # React on the web (Next.js, Vite...)
```

Skip it when `dissolve.json` already exists. On React Native, `init` prints what is missing (NativeWind v5, `react-native-css`, `tailwind-merge`, metro and postcss config): fix what it prints, then run it again.

React Native apps need Expo SDK 57 or 58. Install the packages the CLI prints with `npx expo install` (never pinned versions), so Expo picks the versions of the app's SDK. Skia is `@shopify/react-native-skia` on both SDKs, the name the components import.

2. Add components, one or more names. Shared files and the components they build on are copied too:

```sh
npx dissolve-ui add segmented-control number-ticker
```

Options: `--path <dir>` (default `components/dissolve`, or `src/components/dissolve` with a `src/` layout), `--overwrite` to replace files, `--native` / `--web` to override the platform in `dissolve.json`.

3. Import from the copied file, never from the package:

```tsx
import { SegmentedControl } from '@/components/dissolve/segmented-control';
```

`import { SegmentedControl } from 'dissolve-ui'` is wrong: the package only exports the React Native engine.

## Conventions

- Same props on web and native. Code written for one platform works on the other; native only props such as `haptics` are accepted on the web (they map to `navigator.vibrate`).
- Colors come from the theme tokens, `--dissolve-background`, `surface`, `surface-2`, `foreground`, `muted`, `primary`, `primary-foreground`, `success`, `danger`, `danger-foreground`, `accent`, `border` and `chart-1` to `chart-3`, written by `init` into the global css with a dark block. Change a token to restyle every component, and use the matching Tailwind classes (`bg-dissolve-surface`, `text-dissolve-muted`) in the app's own screens. Do not hardcode colors in the components.
- Restyle one instance with `className` and the part classNames (`textClassName`, `labelClassName`...). Classes go through tailwind-merge, so yours win.
- The files are the user's. Edit timings, sizes or markup in the copied source when asked, rather than wrapping the component.
- Controlled or not: components with a value take `value` with `onChange`, or `defaultValue` alone.
- React Native needs `GestureHandlerRootView` at the root, and `DissolveProvider` from `dissolve-ui` for the components that play grain effects (and for `toast`, with `<ToastProvider>` inside it). Check the root layout before adding either, and never add a second one.
- On the web, each component is a `'use client'` wrapper (`<name>.tsx`) around a framework free core (`<name>.core.ts`). It needs only `react` and `react-dom`; Tailwind is optional.
- Reduced motion is handled by the components. Do not add your own fallback.

## Particle effects on any view (React Native)

To make any view dissolve, burn, melt, peel or gather (not a ready-made component), use the engine in `dissolve-ui` through the dissolve MCP server that this plugin adds:

- `get_setup`: the install command with its peer dependencies, the `DissolveProvider` root layout and a first `useDissolve` example.
- `list_variants`: every variant (dust, sand, ember, stream, gather, peel, morph...) with its hook and use case. Pass `kind` (`exit`, `entrance`, `gesture`, `transition`) to filter.
- `get_variant`: the usage snippet, options and best practices of one variant.

Call `list_variants` to pick, then `get_variant` for the code. One effect per user action, never on scroll or on a timer.

The MCP server needs a free dissolve account. If a tool answers with a sign-in link instead, relay it to the user as is and call the tool again once they signed in. The CLI works without an account.
