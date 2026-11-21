# CLI

Copy components into your project, the shadcn way. The source is yours to read, edit and restyle.

One CLI for React Native and React on the web, run it with `npx`. Native components need NativeWind v5 in the project, web components only React 19, see [Installation](https://dissolve.rselmi.com/docs/installation/). `npx dissolve-ui` runs the same CLI.

```sh
npx dissolve-ui init
```

```sh
npx dissolve-ui add swipe-to-delete toast
```

```sh
npx dissolve-ui list
```

## Commands

| Command | Does |
| --- | --- |
| `init` | Asks the platform, React Native or React, with the one your `package.json` points to preselected, and saves it in `dissolve.json`. Appends the theme tokens to your `global.css`, and on native writes `tw.tsx` (className primitives, `cn`, `useToken`). Then lists missing dependencies. |
| `add <name...>` | Copies one or more components for the platform in `dissolve.json`, running `init` first if it is missing, and prints the import line of each file. |
| `list` | Every component, the platforms it runs on and a one line description. Alias: `ls`. |
| `help` | Usage. Also `--help` or `-h`. |

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--native, --web` | asked | Pick the platform without the question. Saved in `dissolve.json`. |
| `--yes, -y` | off | Take the detected platform. Also what happens without a terminal, in CI or scripts. |
| `--path, -p <dir>` | `components/dissolve` | Target folder, relative to the project. |
| `--overwrite, -o` | off | Replace files that exist. Without it, existing files are skipped so your edits are safe. With `init`, appends the tokens again. |
| `--cwd <dir>` | current folder | Project root, for monorepos and scripts. |

```sh
npx dissolve-ui add otp-input --path app/ui/dissolve --overwrite
```

## Platform

`init` preselects React Native when `package.json` has `react-native` or `expo`, React when it has `react-dom`, `next` or `vite` without them. The answer goes in `dissolve.json` at the project root, and every `add` reads it. Run `init --web` or `init --native` to switch.

dissolve.json:

```json
{
  "platform": "web",
  "dir": "components/dissolve"
}
```

## Where files go

By default `components/dissolve`. When `tsconfig.json` maps `@/*` to `./src/*` and a `src` folder exists, `src/components/dissolve`. Import lines use your `@/` alias when there is one, a relative path otherwise.

Terminal:

```sh
$ npx dissolve-ui add toast like-button
added   components/dissolve/toast.tsx
        import { ToastProvider, useToast } from '@/components/dissolve/toast';
added   components/dissolve/like-button.tsx
        import { LikeButton } from '@/components/dissolve/like-button';
```

## With the shadcn CLI

Already on shadcn? Every component is also a shadcn registry item. Pass its URL to `shadcn add`, no `init` or `dissolve.json` needed. The React item lives at `/r/<name>.json`, the React Native one at `/r/native/<name>.json`.

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/scratch-card.json
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/scratch-card.json
```

shadcn follows the dependencies for you: the component, its core, the shared files (engine, kit, the React hook, or `tw.tsx` on native) and the npm packages. Shared files are installed once, however many components you add. Files land in `components/dissolve`, the same place as with the dissolve CLI.

The theme tokens come as a `dissolve-theme` item: shadcn writes them in your CSS, light on `:root` and dark on `.dark`, the class shadcn projects already toggle. On React Native, you still install the engine and wrap the app in `<DissolveProvider>`, see [Installation](https://dissolve.rselmi.com/docs/installation/).

The full list is in [registry.json](https://dissolve.rselmi.com/r/registry.json) and [native/registry.json](https://dissolve.rselmi.com/r/native/registry.json).

## What init writes

On the web, `dissolve.json` and the theme tokens, as plain CSS variables when the project has no Tailwind. Each component comes with its framework free core (`<name>.core.ts`) and the shared files it imports, nothing to install.

On React Native, `tw.tsx` holds `View`, `Text`, `Pressable`, `TextInput` and `Animated` with className support, `cn()` to merge classes and `useToken()` to read a token as a color. The tokens go at the end of the first `global.css` found (root, `src/`, `app/`, `styles/`, or any CSS file importing Tailwind). With none, it writes `dissolve.css` next to the components: import it from your Tailwind entry.

Running it twice is safe: files and tokens that exist are left alone.

- [Theming](https://dissolve.rselmi.com/docs/theming/)
- [Installation](https://dissolve.rselmi.com/docs/installation/)

Source: https://dissolve.rselmi.com/docs/cli/
