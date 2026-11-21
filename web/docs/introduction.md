# dissolve

An animation library for React Native, with its components for React on the web too. Wrap any view and it dissolves, melts, peels or rebuilds itself. Sixteen variants, all on the UI thread.

`dissolve-ui` gives deletes, archives, arrivals and gestures a physical ending. Wrap your app once, put a ref on a view, call `dissolve()`.

## How it works

1. **Snapshot.** Skia captures the view with `makeImageFromView`, so any view works: text, images, blur, gradients.
2. **Grains.** The image is cut into a grid of grains drawn with a single `<Atlas>`, capped at 6000 per effect.
3. **UI thread.** Every grain is moved in one Reanimated 4 reaction per frame, idle grains are skipped, haptics follow the motion.

## Two parts

1. **The engine, from npm.** `npm install dissolve-ui` gives you the provider and the hooks: `useDissolve`, `DissolveIn`, `useAppear`, the gesture and transition hooks. Every variant in the sidebar runs on it.
2. **Components, copied into your app.** Swipe to delete, toasts, slide to confirm and the rest are not in the package. `npx dissolve-ui add` copies their source into `components/dissolve`, the shadcn way: the code is yours, styled with classNames and the `--dissolve-*` theme tokens.
3. **React Native or React.** `npx dissolve-ui init` asks which one and saves it in `dissolve.json`. On the web, components take the same props, need only React 19 and `react-dom`, and draw on a canvas: no engine to install. Each component page has a switch for its React Native and React snippets.
- [See the Gallery](https://dissolve.rselmi.com/)
- [Installation](https://dissolve.rselmi.com/docs/installation/)
- [CLI](https://dissolve.rselmi.com/docs/cli/)
- [Use it with your agent](https://dissolve.rselmi.com/docs/agent-prompt/)

Source: https://dissolve.rselmi.com/docs/introduction/
