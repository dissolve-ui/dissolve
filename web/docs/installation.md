# Installation

Paste one prompt into your coding agent and it sets up everything: engine, provider, NativeWind and components. Or follow the steps by hand.

## With your agent

Works with Claude Code, Codex, Cursor or any chat. It installs the engine, wraps the root layout, sets up NativeWind v5, runs `init` and adds the components you ask for. More options, like the skill and the MCP server, are on the [Agent prompt](https://dissolve.rselmi.com/docs/agent-prompt/) page.

Tell your coding agent

```
Add dissolve-ui to this React Native / Expo app. It snapshots any view with Skia and turns it into grains animated on the UI thread (Reanimated 4).

1. Install the package and its peers:
   npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
   (Known good: Expo SDK 57, Skia 2.6, Reanimated 4.5, react-native-worklets 0.10, gesture handler 2.32. Bare React Native needs 'react-native-worklets/plugin' in babel.config.js.)

2. Wrap the root layout once, above the navigator, inside GestureHandlerRootView:
   <GestureHandlerRootView style={{ flex: 1 }}>
     <DissolveProvider><Stack /></DissolveProvider>
   </GestureHandlerRootView>
   Do not add a second provider if one exists.

3. Use the hook on the view that should disappear:
   const { ref, dissolving, dissolve } = useDissolve();
   <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>...</View>
   await dissolve({ preset: 'dust' });
   then remove the item from state. Never unmount the view before the await resolves.

4. Ready-made components (swipe to delete, toasts, like button, slide to confirm, OTP input, thinking orb, mini player...) are not exported by the package. They are copied into the project with the CLI, shadcn style, and need NativeWind v5 (Tailwind v4 on react-native-css) plus tailwind-merge. Skip a) if NativeWind v5 already runs in the app.
   a) NativeWind v5 on Expo SDK 57:
      npm pkg set overrides.lightningcss=1.30.1
      npm install --legacy-peer-deps nativewind@5.0.0-preview.4 react-native-css@3.0.7 tailwindcss@^4 @tailwindcss/postcss tailwind-merge
      metro.config.js: module.exports = withNativewind(getDefaultConfig(__dirname), { inlineVariables: false, globalClassNamePolyfill: false }) (withNativewind from 'nativewind/metro')
      postcss.config.mjs: export default { plugins: { '@tailwindcss/postcss': {} } };
      nativewind-env.d.ts: /// <reference types="react-native-css/types" />
      global.css starts with: @import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/preflight.css" layer(base); @import "tailwindcss/utilities.css"; and is imported once at the top of the root layout.
   b) npx dissolve-ui init --native   (once: dissolve.json, tw.tsx primitives + --dissolve-* theme tokens in global.css, then it checks the setup and prints what is missing: fix everything it reports)
   c) npx dissolve-ui add <name>      (npx dissolve-ui list shows the names; dependencies between components are copied too)
      import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';
   Restyle with className and the part classNames (textClassName, boxClassName...), or change the --dissolve-* tokens in global.css. Light and dark follow the system.
   Finish by running npx tsc --noEmit and starting the app.

Pick the variant from the intent:
- Exits (useDissolve): delete a row or card: dust. Delete forever: sand. Unsend or burn: ember. Tap to pop: snap with origin { x: locationX, y: locationY }. Error or broken: shatter. Playful: melt. Clear all: field: 'cascade' with rows (local Y of each row) on the list container.
- Archive or move: stream with to: iconRef and onArrive to bump the icon.
- Entrances: new message or card: <DissolveIn preset="gather">. List: <DissolveIn preset="rain" delay={i * 40}>. Generated text: useAppear().appear({ preset: 'print' }).
- Gestures: swipe to dismiss: fling with the release velocity, or useDissolveScrub({ preset, onCommit }) for a reversible drag. Sticker or card dismissal by hand: useDissolvePeel({ onCommit }), both return { ref, gesture, style } for a GestureDetector around an Animated.View. Destructive confirm (delete account, wipe data): useDissolveHold({ onCommit }) instead of an alert, spread pressHandlers on a Pressable.
- Transitions: toggle state (Follow to Following): useDissolveMorph. Leave a screen: useDissolveScreen().dissolveScreen({ preset: 'sand', then: () => router.back() }).

Rules:
- One effect per user action, on user intent only, 0.9 s to 1.8 s.
- Reduced motion is handled by the provider (the effect is skipped), do not add a custom fallback.
- Keep grain counts reasonable: default grain on cards, a larger grain on big views, useDissolveScreen for full screens, one cascade burst instead of one burst per row.
- Import the engine and hooks from dissolve-ui. Import components from their copied file, never from the package.

For a React web app (Next.js, Vite) there is no engine to install: run npx dissolve-ui init --web, then npx dissolve-ui add <name> (npx dissolve-ui list shows which components run on the web). The components need React 19 and react-dom only, and take the same props as on native.
```

## React on the web

Building a Next.js or Vite app? Skip the engine and NativeWind: web components need React 19 and `react-dom`, nothing else. `init` asks the platform (React is preselected in a web project), saves it in `dissolve.json` and writes the theme tokens, as plain CSS when the project has no Tailwind.

```sh
npx dissolve-ui init --web
```

```sh
npx dissolve-ui add scratch-card
```

app/page.tsx:

```tsx
import { ScratchCard } from '@/components/dissolve/scratch-card';

export default function Page() {
  return (
    <ScratchCard onReveal={claim}>
      <span className="text-4xl font-bold">$25</span>
    </ScratchCard>
  );
}
```

Same props as on React Native. `npx dissolve-ui list` shows which components run on the web, and every component page has a React Native / React switch.

Using shadcn? `npx shadcn@latest add https://dissolve.rselmi.com/r/scratch-card.json` works too, see [CLI](https://dissolve.rselmi.com/docs/cli/).

## React Native, by hand

## Install the engine

The package holds the engine and the hooks. It is all you need for the variants.

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

| Peer | Tested | Used for |
| --- | --- | --- |
| `@shopify/react-native-skia` | 2.6 | Snapshot and Atlas drawing |
| `react-native-reanimated` | 4.5 | UI thread animation |
| `react-native-worklets` | 0.10 | Worklets runtime for Reanimated 4 |
| `react-native-gesture-handler` | 2.32 | Scrub, peel and hold gestures |
| `expo-haptics` | 57 | Haptic ticks during the effect |

Built on Expo SDK 57 and React Native 0.86, runs in Expo Go. Expo's Babel preset already adds the worklets plugin. In a bare React Native app, add `'react-native-worklets/plugin'` to `babel.config.js`.

## Add the provider

The provider draws grains in a full screen overlay that ignores touches. Put it above your navigator so an effect survives a screen pop.

app/_layout.tsx:

```tsx
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from 'dissolve-ui';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <Stack />
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}
```

## Quick start

Put the ref on the view to snapshot, hide it while it dissolves, and remove the item once the promise resolves.

Row.tsx:

```tsx
import { Pressable, View } from 'react-native';
import { useDissolve } from 'dissolve-ui';

export function Row({ item, onRemove }) {
  const { ref, dissolving, dissolve } = useDissolve();

  return (
    <Pressable onPress={async () => {
      await dissolve({ preset: 'sand' });
      onRemove(item.id); // the space can be reclaimed
    }}>
      <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
        {/* row content */}
      </View>
    </Pressable>
  );
}
```

Reduced motion is handled for you: the effect is skipped and the view hides at once.

## Components

Components are copied into your project instead of imported from the package, like shadcn. You own the file, edit it freely, and restyle it with classNames. They need NativeWind v5 (Tailwind v4 on `react-native-css`) and `tailwind-merge`.

## Set up NativeWind v5

Skip this step if your app already runs NativeWind v5.

```sh
npx expo install nativewind@5.0.0-preview.4 react-native-css@3.0.7 tailwindcss @tailwindcss/postcss tailwind-merge
```

| Package | Tested | Used for |
| --- | --- | --- |
| `nativewind` | 5.0.0-preview.4 | className on React Native views |
| `react-native-css` | 3.0.7 | The CSS runtime behind NativeWind v5 |
| `tailwindcss + @tailwindcss/postcss` | 4 | Tailwind v4 compiler |
| `tailwind-merge` | 3 | Your classes win over the defaults |
| `lightningcss (override)` | 1.30.1 | Pinned for Expo SDK 57 |

On Expo SDK 57, pin `lightningcss` with npm `overrides` (`resolutions` is Yarn only), then reinstall with `npm install --legacy-peer-deps`.

package.json:

```json
{
  "overrides": {
    "lightningcss": "1.30.1"
  }
}
```

metro.config.js:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  inlineVariables: false,         // keeps the theme tokens live, light and dark
  globalClassNamePolyfill: false, // className comes from the tw primitives
});
```

postcss.config.mjs:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

global.css:

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

/* npx dissolve-ui init appends the dissolve tokens below */
```

Import `global.css` once at the top of `app/_layout.tsx`. The full guide is on [nativewind.dev](https://www.nativewind.dev/v5).

## Init

Once per project. It asks the platform (React Native is preselected in an Expo or React Native project) and saves it in `dissolve.json`, writes `tw.tsx`, the className primitives every component shares, and appends the theme tokens to your `global.css`. It also tells you which dependency is missing.

```sh
npx dissolve-ui init
```

## Add components

Name one or more. Files land in `components/dissolve`, or `src/components/dissolve` with a `src/` layout, and the CLI prints the import line.

```sh
npx dissolve-ui add slide-to-confirm swipe-to-delete
```

```sh
npx dissolve-ui list
```

Checkout.tsx:

```tsx
import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';

<SlideToConfirm
  label="Slide to pay 42 €"
  doneLabel="Paid"
  onConfirm={pay}
  className="mx-4"
/>
```

Every option is on the [CLI](https://dissolve.rselmi.com/docs/cli/) page. Every component page shows its own `add` command and props.

## Theme

Components read `--dissolve-*` tokens: `background`, `surface`, `surface-2`, `foreground`, `muted`, `primary`, `primary-foreground`, `success`, `danger`, `danger-foreground`, `accent`, `border`, `chart-1` to `chart-3`. Change a value in `global.css` and every component follows. Dark values sit in a `prefers-color-scheme: dark` block, so dark mode follows the system.

For one instance, pass a className. Classes are merged with `tailwind-merge`, so yours replace the default of the same kind: `className="bg-amber-100"` replaces `bg-dissolve-surface`.

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

- [Pick a variant](https://dissolve.rselmi.com/)
- [Theming](https://dissolve.rselmi.com/docs/theming/)
- [Let your agent do it](https://dissolve.rselmi.com/docs/agent-prompt/)

Source: https://dissolve.rselmi.com/docs/installation/
