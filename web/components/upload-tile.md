# UploadTile

**UploadTile** is an animated upload tile component for React Native and React, from the dissolve library. Attachment that assembles from grains, fills a progress ring, rejected files leave as dust.

An attachment tile for chat composers. The upload progress is the tile itself: from 0 to 1, its grains land one by one, a front running left to right, and at 1 the tile is whole. Only then the remove cross fades in. No ring, no badge. A file over maxSize, or an upload that rejects, completes, shakes three times, turns red and leaves as dust while the row closes up. Tap the tile during the upload to abort: the grains that have landed snap away from your finger. No picker dependency, you pass the files.

## Install

### React Native

Install the engine once per app and wrap the root layout in `<DissolveProvider>` (see [Installation](https://dissolve.rselmi.com/docs/installation/)), then copy the component into `components/dissolve`:

```sh
npx expo install dissolve-ui @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
```

```sh
npx dissolve-ui add upload-tile --native
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/native/upload-tile.json
```

### React

Needs React 19 and `react-dom`, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.

```sh
npx dissolve-ui add upload-tile --web
```

```sh
npx shadcn@latest add https://dissolve.rselmi.com/r/upload-tile.json
```

## Usage

UploadTile.tsx (React Native):

```tsx
import { UploadTray } from '@/components/dissolve/upload-tile';

<UploadTray
  files={files}
  upload={(file, onProgress, signal) => api.upload(file, { onProgress, signal })}
  maxSize={25 * 1024 * 1024}
  onAdd={pickFiles}
  onRemove={(file) => setFiles((all) => all.filter((f) => f.id !== file.id))}
/>
```

UploadTile.tsx (React):

```tsx
import { UploadTray } from '@/components/dissolve/upload-tile';

<UploadTray
  files={files}
  upload={(file, onProgress, signal) => api.upload(file, { onProgress, signal })}
  maxSize={25 * 1024 * 1024}
  onAdd={pickFiles}
  onRemove={(file) => setFiles((all) => all.filter((f) => f.id !== file.id))}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `file` | `{ id?, name, size, uri?, source? }` | `required` | The file. An image uri or source shows as a thumbnail, anything else as a file icon, name and size. |
| `upload` | `(file, onProgress, signal) => Promise<void>` | `required` | Your upload. Report progress 0 to 1: it drives how many grains have landed. Stop when the signal aborts (a tap on the tile aborts it), reject to show the error state. |
| `maxSize` | `number` |  | Bytes. A bigger file is rejected without starting the upload. |
| `size` | `number` | `72` | Tile side. 6 pt of room are kept around it for the cross and the grains. |
| `spacing` | `number` | `0` | Space after the tile in a row. It closes up with the tile. |
| `onDone` | `(file) => void` |  | Called once the upload resolved and the tile is whole, as the cross appears. |
| `onRemove` | `(file, reason: 'rejected' \| 'cancelled' \| 'removed') => void` |  | Called once the tile has gone and its space has closed: drop the file here. |
| `haptics` | `boolean` | `true` | Success when whole, error on reject, light impact on cancel and remove. |
| `className` | `string` |  | Outer wrapper classes (margins). |
| `tileClassName` | `string` |  | Tile classes (background, radius). |

## Source

- React Native: [registry/upload-tile.tsx](https://github.com/rs-4/dissolve/blob/main/registry/upload-tile.tsx)
- React: [registry/web/upload-tile.tsx](https://github.com/rs-4/dissolve/blob/main/registry/web/upload-tile.tsx) and [registry/web/upload-tile.core.ts](https://github.com/rs-4/dissolve/blob/main/registry/web/upload-tile.core.ts)

Previous: [SweepTransition](https://dissolve.rselmi.com/components/sweep-transition/) · Next: [TaskCheck](https://dissolve.rselmi.com/components/task-check/) · [All components](https://dissolve.rselmi.com/components/)

Source: https://dissolve.rselmi.com/components/upload-tile/
