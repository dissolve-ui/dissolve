#!/usr/bin/env node
/**
 * dissolve MCP server: a tiny, dependency free Model Context Protocol server.
 *
 * Transport: stdio, JSON-RPC 2.0, one JSON message per line.
 * Methods: initialize, notifications/initialized, ping, tools/list, tools/call.
 * Tools: list_variants, get_variant, get_setup, list_components, add_component, dissolve_login,
 * dissolve_login_status.
 *
 * The tools need a free dissolve account (the CLI and the source stay open): tools/list always
 * answers, and every tools/call except dissolve_login and dissolve_login_status first checks the
 * token with GET /api/me. Without one the call answers with a login link (device flow) instead.
 *
 * Register it in Claude Code:
 *   claude mcp add dissolve -- npx -y dissolve-ui-mcp
 *
 * The data below is derived from README.md and src/dissolve (types.ts, hooks/, variants/).
 * list_components and add_component run the dissolve-ui CLI, the one install path for free and pro
 * items. The dissolve pro login (device flow, token in ~/.config/dissolve/auth.json) comes from
 * pro.mjs, the client the CLI ships.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { hostname } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

// Published: pro.mjs sits next to this file (copied at pack time). In the repo: the CLI's copy.
const pro = await import('./pro.mjs').catch((e) => {
  if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  return import('../packages/dissolve-ui/bin/pro.mjs');
});

const PKG = 'dissolve-ui';
// Keep in step with packages/dissolve-ui-mcp/package.json.
const VERSION = '0.2.0';
const PROTOCOL = '2025-06-18';

/* ---------- Data ---------- */

const PEERS = [
  '@shopify/react-native-skia',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
  'expo-haptics',
];

const SETUP = `# dissolve-ui setup

Snapshots any view with Skia (makeImageFromView), cuts it into grains drawn with one <Atlas>,
and animates every grain on the UI thread (Reanimated 4, react-native-worklets).
Grain counts are capped at 6000 per burst.

## 1. Install

\`\`\`sh
npx expo install ${PKG} ${PEERS.join(' ')}
\`\`\`

Tested with Expo SDK 57, React Native 0.86, @shopify/react-native-skia 2.6, react-native-reanimated 4.5,
react-native-worklets 0.10, react-native-gesture-handler 2.32. It runs in Expo Go.
Expo's Babel preset already adds the worklets plugin. In a bare React Native app add
'react-native-worklets/plugin' to babel.config.js.

## 2. Wrap the app once

The provider renders a full screen, pointerEvents="none" overlay where grains are drawn.
Put it above your navigator so effects survive a screen pop.

\`\`\`tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DissolveProvider } from '${PKG}';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <Stack />
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}
\`\`\`

## 3. First effect

\`\`\`tsx
import { Pressable, View } from 'react-native';
import { useDissolve } from '${PKG}';

function Row({ item, onRemove }) {
  const { ref, dissolving, dissolve } = useDissolve();
  return (
    <Pressable onPress={async () => { await dissolve({ preset: 'dust' }); onRemove(item.id); }}>
      <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
        {/* row content */}
      </View>
    </Pressable>
  );
}
\`\`\`

dissolve() resolves when the space can be reclaimed: remove the item from state after the await.
Reduced motion is handled by the provider: the effect is skipped and the view is hidden right away.

## Ready-made components (CLI, shadcn style)

Components (swipe-to-delete, toast, like-button, morph-button, split-button, slide-to-confirm,
gooey-menu, otp-input, number-ticker, reaction-picker, voice-note, card-stack, signature-pad,
before-after, more with \`list\`) are NOT exported by the package. The CLI, dissolve-ui, copies their
source into the project, where the user owns it, for React Native or React on the web:

\`\`\`sh
npx dissolve-ui init --native        # once: dissolve.json, components/dissolve/tw.tsx + --dissolve-* tokens in global.css
npx dissolve-ui add slide-to-confirm # one or more names, for the platform in dissolve.json
npx dissolve-ui list                 # every component and the platforms it runs on
\`\`\`

init asks the platform (preselected from package.json) and saves it in dissolve.json; --native, --web
or --yes skip the question.
Options: --path <dir> (default components/dissolve, or src/components/dissolve with a src/ layout
mapped to @/*), --overwrite (replace existing files), --cwd <dir> (project root).

\`\`\`tsx
import { SlideToConfirm } from '@/components/dissolve/slide-to-confirm';

<SlideToConfirm label="Slide to pay 42 €" onConfirm={pay} className="mx-4" />
\`\`\`

They need NativeWind v5 (Tailwind v4 on react-native-css) and tailwind-merge. Known good on Expo SDK 57:
nativewind 5.0.0-preview.4, react-native-css 3.0.7, npm overrides { "lightningcss": "1.30.1" },
metro withNativewind, postcss @tailwindcss/postcss, global.css importing Tailwind.
Style them with className and the part classNames (knobClassName, textClassName, boxClassName...):
classes are merged with tailwind-merge, so later classes win. Colors that are animated or drawn by Skia read the tokens.
Theme tokens (--dissolve-background, surface, surface-2, foreground, muted, primary,
primary-foreground, success, danger, danger-foreground, accent, border) live in global.css,
light on :root and dark in @media (prefers-color-scheme: dark). Change them there to retheme every
component. They are mapped with @theme inline so each class resolves the token of the current color scheme.
Toasts (and swipe-to-delete with Undo) need <ToastProvider> from '@/components/dissolve/toast' inside <DissolveProvider>.

React on the web (Next.js, Vite, React 19): npx dissolve-ui init --web, then npx dissolve-ui add <name>
for the components list marks web. Same props as native, only react and react-dom needed (no engine,
Tailwind optional): a 'use client' wrapper around a framework free canvas core. The hooks and
variants above are React Native only.

## Common options (every atlas preset)

- preset: VariantName
- origin: 'left' | 'right' | 'top' | 'bottom' | 'center' | { x, y } (local coords, e.g. nativeEvent.locationX / locationY)
- direction: 'out' | 'in' (any exit plays backwards as an entrance)
- grain: grain size in points (default about 3, capped to about 6000 grains)
- duration: full effect duration in ms
- haptics: boolean
- field: 'cascade' with rows: number[] (local Y of each row)
- n: [number?, number?, number?, number?] free numeric knobs
`;

const COMMON = ['preset', 'origin', 'direction', 'grain', 'duration', 'haptics', 'field + rows', 'n'];

const basic = (preset) => `const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  {children}
</View>

await dissolve({ preset: '${preset}' });
onRemove(); // the space can be reclaimed`;

/** kind: exit, entrance, gesture, transition. */
const VARIANTS = [
  {
    name: 'dust', kind: 'exit', hook: 'useDissolve',
    use: 'Default delete: a list row or card blown away to the right.',
    info: 'Blown away to the right, like a breath of wind.',
    snippet: basic('dust'), options: COMMON,
    tips: ['The safe default for removing an item.', 'Pass origin to start the wave from another edge.', 'Combine with field: \'cascade\' to clear a whole list in a diagonal wave.'],
  },
  {
    name: 'sand', kind: 'exit', hook: 'useDissolve',
    use: 'Heavier, final removal: grains pour down with gravity.',
    info: 'Grains pour down with gravity.',
    snippet: basic('sand'), options: COMMON,
    tips: ['Reads as permanent, good for "delete forever".', 'Default grain 2.5, raise it for large views.'],
  },
  {
    name: 'ember', kind: 'exit', hook: 'useDissolve',
    use: 'Burn it: unsend a message, destroy a secret.',
    info: 'Burns from the edge and rises as sparks.',
    snippet: `onLongPress={async () => {\n  await dissolve({ preset: 'ember', duration: 1300 });\n  onRemove();\n}}`, options: COMMON,
    tips: ['Strong effect, keep it for rare, meaningful actions.'],
  },
  {
    name: 'pixel', kind: 'exit', hook: 'useDissolve',
    use: 'Digital, retro or system feel: blocky stepped collapse.',
    info: 'Blocky, stepped collapse. Very digital.',
    snippet: basic('pixel'), options: COMMON,
    tips: ['Default grain is 7 points, so it is cheap even on large views.'],
  },
  {
    name: 'vortex', kind: 'exit', hook: 'useDissolve',
    use: 'Collapse into a point: minimize, send to a hidden place.',
    info: 'Spirals into the center and vanishes.',
    snippet: basic('vortex'), options: COMMON,
    tips: ['Pair with origin to spiral into a specific point.'],
  },
  {
    name: 'snap', kind: 'exit', hook: 'useDissolve',
    use: 'Tap to pop: bursts outward from the touch point.',
    info: 'Bursts outward from the point you touched.',
    snippet: `<Pressable onPress={(e) => dissolve({\n  preset: 'snap',\n  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },\n})}>`,
    options: [...COMMON, 'n: [push]'],
    tips: ['Always pass the touch point as origin, in local coordinates.', 'n[0] scales the outward push.'],
  },
  {
    name: 'fling', kind: 'gesture', hook: 'useDissolve',
    use: 'Swipe to dismiss: grains follow the swipe direction and speed.',
    info: 'Carried away in the direction and speed of the swipe.',
    snippet: `const pan = Gesture.Pan().onEnd((e) => {\n  scheduleOnRN(dismiss, e.velocityX, e.velocityY);\n});\n\nconst dismiss = (vx, vy) => dissolve({ preset: 'fling', velocity: { x: vx, y: vy } });`,
    options: [...COMMON, 'velocity: { x, y } in pt/s'],
    tips: ['Feed the real release velocity, the duration adapts to it.', 'Call dissolve on the JS thread (scheduleOnRN or runOnJS).'],
  },
  {
    name: 'stream', kind: 'exit', hook: 'useDissolve / DissolveIn',
    use: 'Archive or move: grains fly into a target view (trash, folder, tab icon).',
    info: 'Grains fly into a target, or pour out of a source to form the view.',
    snippet: `const trash = useRef<View>(null);\n\nawait dissolve({ preset: 'stream', to: trash, duration: 1300, onArrive: () => bump() });\n\n// entrance: grains pour out of a source\n<DissolveIn preset="stream" from={sourceRef}>{card}</DissolveIn>`,
    options: [...COMMON, 'to: RefObject<View> | { x, y, width, height }', 'onArrive: () => void'],
    tips: ['Give the target a visible reaction in onArrive (badge count, bounce).', 'The target ref must be mounted and laid out.'],
  },
  {
    name: 'gather', kind: 'entrance', hook: 'DissolveIn / useAppear',
    use: 'New content arrives: a cloud of grains converges into the view (new message, new card).',
    info: 'A cloud of grains converges into the view.',
    snippet: `<DissolveIn preset="gather" style={styles.card}>\n  <Card />\n</DissolveIn>`,
    options: ['preset', 'delay (ms)', 'duration', 'grain', 'play (default true)', 'onAppear', 'style (snapshotted)', 'from (stream)'],
    tips: ['Put background, padding and radius in DissolveIn style so they are part of the snapshot.', 'Use play={false} then true to trigger later.'],
  },
  {
    name: 'rain', kind: 'entrance', hook: 'DissolveIn',
    use: 'List entrance: rows fall and settle, bottom first. Stagger with delay.',
    info: 'Grains fall from above and settle into place, bottom first.',
    snippet: `{rows.map((row, i) => (\n  <DissolveIn key={row.id} preset="rain" delay={i * 40} style={styles.row}>\n    <Row row={row} />\n  </DissolveIn>\n))}`,
    options: ['preset', 'delay (ms)', 'duration', 'grain', 'play', 'onAppear', 'style'],
    tips: ['Stagger with delay={i * 40}, only for the rows visible on screen.'],
  },
  {
    name: 'print', kind: 'entrance', hook: 'useAppear / DissolveIn',
    use: 'Generated or received text: printed line by line from the top (AI answer, receipt).',
    info: 'Printed line by line from the top, fresh ink glows cyan.',
    snippet: `const a = useAppear();\nuseEffect(() => { a.appear({ preset: 'print', duration: 1100 }); }, []);\n\n<View style={a.wrapStyle}>\n  <View ref={a.ref} collapsable={false} style={styles.card}>{text}</View>\n</View>`,
    options: ['preset', 'delay (ms)', 'duration', 'grain'],
    tips: ['appear() resolves once the real view is visible.', 'Keep wrapStyle on a wrapper and the ref on the inner view.'],
  },
  {
    name: 'charge', kind: 'gesture', hook: 'useDissolveHold',
    use: 'Destructive confirm: hold to heat it up, it bursts at full charge. Release early to cancel.',
    info: 'Hold to heat it up, release at full charge and it blows apart.',
    snippet: `const { ref, pressHandlers, style, charge } = useDissolveHold({ holdMs: 1200, onCommit: remove });\n\n<Pressable {...pressHandlers}>\n  <Animated.View ref={ref} style={[styles.card, style]} />\n</Pressable>`,
    options: ['holdMs (default 1200)', 'then: VariantName (default charge)', 'grain', 'duration (default 900)', 'haptics', 'maxDistance (default 24)', 'onCommit', 'onCancel'],
    tips: ['Use it instead of a confirmation alert for delete account, wipe data.', 'Also returns gesture (for GestureDetector), progress and reset.', 'Show a hint like "Hold to delete" next to it.'],
  },
  {
    name: 'scrub', kind: 'gesture', hook: 'useDissolveScrub',
    use: 'Finger driven and reversible: drag to erase, drag back to restore.',
    info: 'Any preset driven by the finger, commits past a threshold or on a fast fling.',
    snippet: `const { ref, gesture, style } = useDissolveScrub({ preset: 'dust', axis: 'x', onCommit: remove });\n\n<GestureDetector gesture={gesture}>\n  <Animated.View ref={ref} style={[styles.card, style]} />\n</GestureDetector>`,
    options: ['preset (default dust)', 'axis: x | y', 'threshold', 'velocity', 'grain', 'duration', 'haptics', 'onCommit', 'onCancel'],
    tips: ['Requires GestureHandlerRootView at the root.', 'Haptics follow the content density.'],
  },
  {
    name: 'peel', kind: 'gesture', hook: 'useDissolvePeel',
    use: 'Sticker or card dismissal by hand: grab near a corner or edge and peel it off.',
    info: 'Peels off like a sticker, from any corner or edge. Drive it by hand with useDissolvePeel.',
    snippet: `const { ref, gesture, style, reset } = useDissolvePeel({ onCommit: remove });\n\n<GestureDetector gesture={gesture}>\n  <Animated.View ref={ref} style={[styles.sticker, style]} />\n</GestureDetector>`,
    options: ['threshold (fraction of the diagonal, default 0.4)', 'velocity (pt/s, default 900)', 'grain', 'duration (fly off, default 700)', 'haptics', 'onCommit', 'onCancel'],
    tips: ['Released below the threshold, the corner springs back home.', 'Also usable as a plain exit: dissolve({ preset: \'peel\' }).'],
  },
  {
    name: 'melt', kind: 'exit', hook: 'useDissolve',
    use: 'Playful or liquid exit: the view melts down in drips that merge and pinch off.',
    info: 'Melts down like a liquid, in drips that merge and pinch off.',
    snippet: basic('melt'), options: COMMON,
    tips: ['Best on colorful, solid views (stickers, tiles, artwork).'],
  },
  {
    name: 'shatter', kind: 'exit', hook: 'useDissolve',
    use: 'Breaks like glass from the impact point: error, broken, rejected.',
    info: 'Breaks like glass into spinning triangular shards.',
    snippet: `onPress={(e) => dissolve({\n  preset: 'shatter',\n  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },\n  n: [220],\n})}`,
    options: ['preset', 'origin', 'duration', 'haptics', 'n: [shards]'],
    tips: ['n[0] is the shard count, 150 to 250 reads well.'],
  },
  {
    name: 'morph', kind: 'transition', hook: 'useDissolveMorph',
    use: 'State change: one view rearranges its grains into another (Follow becomes Following).',
    info: 'One view rearranges its grains into another, sorted by brightness.',
    snippet: `const { refA, refB, styleA, styleB, morph } = useDissolveMorph();\n\n<View style={[abs, styleA]}><View ref={refA} collapsable={false}>{follow}</View></View>\n<View style={[abs, styleB]}><View ref={refB} collapsable={false}>{following}</View></View>\n\nawait morph();                  // A becomes B\nawait morph({ reverse: true }); // and back`,
    options: ['reverse', 'grain', 'duration', 'haptics', 'origin'],
    tips: ['Both views must be mounted and laid out, stacked on top of each other.', 'Put styleA / styleB on a wrapper of the ref\'d view.', 'Capped at 3500 grains (two atlases).'],
  },
  {
    name: 'cascade', kind: 'exit', hook: 'useDissolve (field)',
    use: 'Clear a whole list: rows leave in a diagonal wave (Clear all).',
    info: 'Delay field: list rows leave in a diagonal wave, works with any atlas preset.',
    snippet: `const ys: number[] = [];\n\n<View ref={ref} collapsable={false}>\n  {rows.map((r, i) => <Row key={r.id} onLayout={(e) => (ys[i] = e.nativeEvent.layout.y)} />)}\n</View>\n\nawait dissolve({ preset: 'dust', field: 'cascade', rows: ys, duration: 1800 });`,
    options: ['field: \'cascade\'', 'rows: number[] (local Y of each row)', ...COMMON],
    tips: ['Capture the list container once instead of one burst per row.'],
  },
  {
    name: 'screen', kind: 'transition', hook: 'useDissolveScreen',
    use: 'Full screen exit before navigating away (close, log out, delete account done).',
    info: 'The whole screen dissolves, then navigation runs under the grains.',
    snippet: `const { ref, dissolveScreen } = useDissolveScreen();\n\n<View ref={ref} collapsable={false} style={{ flex: 1 }}>{screen}</View>\n\ndissolveScreen({ preset: 'sand', then: () => router.back() });`,
    options: ['then: () => void', 'onFinish', 'maxGrains (default 5000)', ...COMMON],
    tips: ['Give the screen animation: \'none\' or \'fade\' in its Stack options.', 'The provider must sit above the Stack.'],
  },
];

const INDEX = Object.fromEntries(VARIANTS.map((v) => [v.name, v]));

const RULES = `Picking a variant:
- Delete a row or card: dust (default), sand for "delete forever".
- Archive, move to a folder, add to cart: stream with to: iconRef.
- Unsend or burn: ember. Tap to pop: snap with the touch origin. Broken or rejected: shatter.
- Swipe to dismiss: fling with the release velocity, or useDissolveScrub for a reversible drag.
- Sticker or card dismissal by hand: useDissolvePeel.
- Destructive confirm (delete account, wipe): useDissolveHold, the charge variant.
- New message or card: DissolveIn preset="gather". List entrance: rain with delay={i * 40}. Generated text: print.
- Clear all: field: 'cascade' on the list container. Toggle state: useDissolveMorph. Leave a screen: useDissolveScreen.
- A ready-made UI fits (swipe to delete, toast, slide to confirm, OTP...): npx dissolve-ui add <name>, import it from its copied file, never from the package.
Best practices:
- One effect per user action, 0.9 s to 1.8 s. Exits on user intent only, never on scroll.
- Reduced motion is handled by the provider, do not add a custom fallback.
- Keep grain counts reasonable: default grain (about 3 pt) on cards, raise grain on large views, useDissolveScreen for full screens.
- Hide the original with opacity: dissolving ? 0 : 1 (never unmount before the await).`;

/* ---------- Tools ---------- */

const TOOLS = [
  {
    name: 'list_variants',
    description: 'List every dissolve-ui variant with its kind (exit, entrance, gesture, transition), the hook to use, and a one line use case. Call this first to pick an effect.',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['exit', 'entrance', 'gesture', 'transition'], description: 'Optional filter.' } },
    },
  },
  {
    name: 'get_variant',
    description: 'Get the usage snippet, options and best practices for one dissolve-ui variant (e.g. dust, stream, gather, charge, peel, melt, morph, cascade, screen).',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', enum: VARIANTS.map((v) => v.name), description: 'Variant name.' } },
      required: ['name'],
    },
  },
  {
    name: 'list_components',
    description: 'List the dissolve components and blocks you can install (React Native and React web), with their platforms. Install one with add_component.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_component',
    description: 'Install a dissolve component or block into the project (copies its source, like npx dissolve-ui add). If the user needs to connect or subscribe, relay the returned message as is.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Item name from list_components, e.g. slide-to-confirm or paywall. Several names: space separated.' },
        cwd: { type: 'string', description: 'Absolute path of the app root (folder with package.json). Defaults to the server working directory.' },
        platform: { type: 'string', enum: ['native', 'web'], description: 'Optional: React Native or React web. Defaults to dissolve.json, else detected.' },
        overwrite: { type: 'boolean', description: 'Replace files that already exist.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'dissolve_login',
    description: 'Connect the user\'s free dissolve account (the other dissolve tools need one). Returns a link and a code to relay to the user.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'dissolve_login_status',
    description: 'Check whether the dissolve account is connected and has dissolve pro. Call it after the user opened the sign-in link.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_setup',
    description: 'Get the install command (package and peer dependencies), the DissolveProvider root layout snippet, a minimal useDissolve example, the component CLI (npx dissolve-ui init, add, list for React Native or React on the web, NativeWind v5 and theme tokens) and the variant picking rules.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function listVariants({ kind } = {}) {
  const rows = VARIANTS.filter((v) => !kind || v.kind === kind);
  return rows.map((v) => `- ${v.name} (${v.kind}, ${v.hook}): ${v.use}`).join('\n') + `\n\n${RULES}`;
}

function getVariant({ name } = {}) {
  const v = INDEX[String(name ?? '').toLowerCase()];
  if (!v) throw new ToolError(`Unknown variant "${name}". Known: ${VARIANTS.map((x) => x.name).join(', ')}.`);
  return `# ${v.name}

${v.info}
Kind: ${v.kind}. Hook: ${v.hook}.
Use it for: ${v.use}

## Usage

\`\`\`tsx
import { ${v.hook.split(/[ /(+]/)[0]} } from '${PKG}';

${v.snippet}
\`\`\`

## Options

${v.options.map((o) => `- ${o}`).join('\n')}

## Best practices

${v.tips.map((t) => `- ${t}`).join('\n')}
- Requires <DissolveProvider> at the root (see get_setup).`;
}

const getSetup = () => `${SETUP}\n${RULES}\n`;

class ToolError extends Error {}

/* ---------- Components (free and pro) through the CLI ---------- */

/** DISSOLVE_CLI (a path to dissolve.mjs), the built repo package in a checkout, else npx. */
function cliCommand() {
  if (process.env.DISSOLVE_CLI) return [process.execPath, [process.env.DISSOLVE_CLI]];
  const pkg = fileURLToPath(new URL('../packages/dissolve-ui/', import.meta.url));
  if (existsSync(join(pkg, 'registry', 'index.json'))) return [process.execPath, [join(pkg, 'bin', 'dissolve.mjs')]];
  return ['npx', ['-y', `${PKG}@latest`]];
}

const ANSI = /\x1b\[[0-9;]*m/g;

/** Runs the CLI, resolves { code, out } with colors stripped. */
function runCli(args, cwd) {
  const [cmd, base] = cliCommand();
  return new Promise((resolve) => {
    const child = spawn(cmd, [...base, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && cmd === 'npx' });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => resolve({ code: -1, out: `Could not run ${cmd}: ${e.message}` }));
    child.on('close', (code) => resolve({ code, out: out.replace(ANSI, '').trim() }));
  });
}

/** Polls the login in the background, so the token is saved as soon as the user confirms. */
let watching = null;
function watchLogin(pending) {
  if (watching) return;
  watching = pro.waitForLogin(pending).catch(() => null).finally(() => (watching = null));
}

const loginMessage = (p) => `Open ${p.verify_url} to connect your dissolve account (code ${p.user_code}), then ask me again.`;

/** The login in progress, or a new one (opened in the browser), polled in the background. */
async function ensureLogin() {
  let pending = pro.pendingLogin();
  if (!pending) {
    pending = await pro.startLogin(`dissolve MCP on ${hostname()}`);
    pro.openBrowser(pending.verify_url);
  }
  watchLogin(pending);
  return pending;
}

/** The login in progress (or a new one), as the message to relay. */
const loginPrompt = async () => loginMessage(await ensureLogin());

/** A login in progress that the user may have confirmed since: one poll. */
async function settlePendingLogin() {
  const pending = !pro.readToken() && pro.pendingLogin();
  if (pending) await pro.pollLogin(pending).catch(() => null);
}

async function listComponents() {
  const { code, out } = await runCli(['list'], process.cwd());
  if (code !== 0) throw new ToolError(`Could not list the components:\n${out}`);
  return `${out}\n\nInstall with add_component({ name }). "pro" items need dissolve pro (a one-time purchase); add_component handles the login and the checkout link.`;
}

async function addComponent({ name, cwd, platform, overwrite } = {}) {
  const names = String(name ?? '').split(/[\s,]+/).filter(Boolean);
  if (!names.length) throw new ToolError('Pass the item name, e.g. { "name": "slide-to-confirm" }. See list_components.');
  const root = cwd || process.cwd();
  if (!isAbsolute(root) || !existsSync(join(root, 'package.json'))) {
    throw new ToolError(`No package.json in ${root}. Pass cwd: the absolute path of the app root.`);
  }
  await settlePendingLogin();
  const args = ['add', ...names, '--cwd', root, '--yes', '--no-login'];
  if (platform === 'native' || platform === 'web') args.push(`--${platform}`);
  if (overwrite) args.push('--overwrite');
  const { code, out } = await runCli(args, root);
  if (code === 0) return { code, text: out };
  // 3: the item is pro and no account is connected (or the token was revoked).
  if (code === 3) return { code, text: await loginPrompt() };
  // 4: connected, no dissolve pro purchase. Files of the other names may have been written.
  if (code === 4) {
    const links = [...out.matchAll(/^(\S+) is part of dissolve pro\.\s*\n\s*Subscribe: (\S+)/gm)];
    const lines = links.map((m) => `${m[1]} is part of dissolve pro: subscribe at ${m[2]}, then ask me again.`);
    const rest = out.split(/\n\S+ is part of dissolve pro\./)[0].trim();
    return { code, text: [...lines, rest && /\b(added|replaced|skipped)\b/.test(rest) ? `\nInstalled meanwhile:\n${rest}` : ''].filter(Boolean).join('\n') };
  }
  throw new ToolError(out || `dissolve-ui exited with code ${code}.`);
}

async function describeAccount(token) {
  const who = await pro.me(token);
  if (!who) return null;
  saveAccount(token, who);
  return `Connected as ${who.user.email}. dissolve pro: ${who.pro ? `active${who.plan ? ` (${who.plan})` : ''}` : 'not active'}.`;
}

async function login() {
  const auth = pro.readToken();
  if (auth) {
    const who = await describeAccount(auth.token);
    if (who) return who;
    if (auth.source === 'env') throw new ToolError('DISSOLVE_TOKEN is set but was not accepted. Unset it or set a valid token.');
    pro.clearToken();
  }
  return loginPrompt();
}

async function loginStatus() {
  const pending = !pro.readToken() && pro.pendingLogin();
  if (pending) {
    const r = await pro.pollLogin(pending);
    if (r === 'pending') return `Waiting for the user: ${loginMessage(pending)}`;
    if (r === 'expired') return 'The login code expired. Call dissolve_login for a new one.';
  }
  const auth = pro.readToken();
  if (!auth) return 'Not connected. The dissolve tools need a free account: call dissolve_login.';
  return (await describeAccount(auth.token)) ?? 'The saved token is not valid anymore. Call dissolve_login.';
}

/* ---------- Free account gate ---------- */

const DAY = 24 * 60 * 60 * 1000;
/** A successful GET /api/me is trusted this long before asking again. */
const CHECK_EVERY = DAY;
/** API unreachable: a last success younger than this still lets the call run. */
const OFFLINE_GRACE = 7 * DAY;
/** The tools that work without an account (they are how you get one). */
const UNGATED = new Set(['dissolve_login', 'dissolve_login_status']);

/** The last successful check, next to auth.json: { token: <sha256 prefix>, checked_at, pro }. */
const accountFile = () => join(pro.configDir(), 'mcp-account.json');
const tokenId = (token) => createHash('sha256').update(token).digest('hex').slice(0, 16);

/** The last check of this token, or null (none, or made for another token). */
function readAccount(token) {
  try {
    const a = JSON.parse(readFileSync(accountFile(), 'utf8'));
    return a?.token === tokenId(token) && Number.isFinite(a.checked_at) ? a : null;
  } catch {
    return null;
  }
}

function saveAccount(token, who) {
  try {
    pro.writePrivate(accountFile(), { token: tokenId(token), checked_at: Date.now(), pro: !!who?.pro });
  } catch {
    // A read only HOME only means checking again next time.
  }
}

const clearAccount = () => rmSync(accountFile(), { force: true });

const SITE = () => pro.apiUrl().replace(/^https?:\/\//, '');
const accountMessage = (p) =>
  `dissolve needs a free account to work in your agent (it takes 10 seconds). Open ${p.verify_url} and sign in with Google or GitHub, then ask me again. You can also run \`npx dissolve-ui login\` in a terminal.`;
const offlineMessage = () =>
  `dissolve needs a free account to work in your agent, and ${SITE()} could not be reached right now. Check the connection and ask me again, or run \`npx dissolve-ui login\` in a terminal.`;

/** Starts (or reuses) the device login and returns the sign-in message; the token is saved in the background. */
async function accountPrompt() {
  try {
    return accountMessage(await ensureLogin());
  } catch {
    // Offline, or the API could not start a login.
    return offlineMessage();
  }
}

/**
 * Before a gated call: { ok: true, token, pro } when it may run, else { ok: false, text } with
 * the message to answer instead. Never throws for network reasons.
 */
async function checkAccount() {
  await settlePendingLogin();
  const auth = pro.readToken();
  if (!auth) return { ok: false, text: await accountPrompt() };
  const last = readAccount(auth.token);
  const age = last ? Date.now() - last.checked_at : Infinity;
  if (age < CHECK_EVERY) return { ok: true, token: auth.token, pro: !!last.pro };

  let res = null;
  try {
    res = await pro.request('/api/me', { token: auth.token, timeout: 5000 });
  } catch (e) {
    if (!(e instanceof pro.OfflineError)) throw e;
  }
  if (res?.status === 200 && res.body?.user) {
    saveAccount(auth.token, res.body);
    return { ok: true, token: auth.token, pro: !!res.body.pro };
  }
  // 401, or 200 { user: null }: the token is not valid (revoked, or never was).
  if (res && (res.status === 401 || res.status === 200)) {
    clearAccount();
    if (auth.source === 'env') {
      return { ok: false, text: 'DISSOLVE_TOKEN is set but dissolve did not accept it. Unset it (the dissolve tools then give you a sign-in link), or set a valid token.' };
    }
    pro.clearToken();
    return { ok: false, text: await accountPrompt() };
  }
  // Unreachable or a server error: a recent success is enough.
  if (age < OFFLINE_GRACE) return { ok: true, token: auth.token, pro: !!last.pro };
  // A new login cannot replace DISSOLVE_TOKEN: only the connection can fix this one.
  if (auth.source === 'env') return { ok: false, text: offlineMessage() };
  return { ok: false, text: await accountPrompt() };
}

/* ---------- Usage events ---------- */

const telemetryOff = () =>
  ['0', 'false', 'off'].includes(String(process.env.DISSOLVE_TELEMETRY ?? '').toLowerCase()) ||
  ['1', 'true'].includes(String(process.env.DO_NOT_TRACK ?? '').toLowerCase());

const itemNames = (name) => String(name ?? '').split(/[\s,]+/).filter(pro.isItemName);

/**
 * Fire and forget: POST /api/mcp/event per call (per item for add_component). 2 s timeout,
 * failures ignored, never awaited by the tool. Off with DISSOLVE_TELEMETRY=0 or DO_NOT_TRACK=1.
 */
function track(token, tool, args) {
  if (telemetryOff()) return;
  const items = tool === 'add_component' ? itemNames(args?.name).slice(0, 10) : tool === 'get_variant' ? itemNames(args?.name).slice(0, 1) : [];
  for (const item of items.length ? items : [undefined]) {
    const body = { tool, ...(item ? { item } : {}), client: 'mcp', version: VERSION };
    const p = pro.request('/api/mcp/event', { token, method: 'POST', body, timeout: 2000 }).catch(() => null);
    // Lets a closing stdin wait for it (2 s at most) instead of cutting it off.
    inflight.add(p);
    p.finally(() => inflight.delete(p));
  }
}

/* ---------- Pro pairing hint ---------- */

/** Free component -> the pro screen it naturally pairs with. */
const PAIRS = {
  toggle: ['settings-group', 'a ready-made settings screen'],
  'segmented-control': ['settings-group', 'a ready-made settings screen'],
  'slide-to-confirm': ['paywall-01', 'a ready-made paywall screen'],
  'glossy-button': ['paywall-01', 'a ready-made paywall screen'],
  'otp-input': ['sign-in', 'a ready-made sign in screen'],
  'password-strength': ['sign-in', 'a ready-made sign in screen'],
  'quantity-stepper': ['cart-01', 'a ready-made cart screen'],
  'typing-indicator': ['message-composer', 'a ready-made chat composer'],
  'voice-note': ['message-composer', 'a ready-made chat composer'],
  'progress-steps': ['onboarding', 'a ready-made onboarding flow'],
};

/** One short line for a free user who just installed a component with a pro pair, else ''. */
function pairingHint(names, account) {
  if (account.pro) return '';
  const hit = names.find((n) => PAIRS[n] && !names.includes(PAIRS[n][0]));
  if (!hit) return '';
  const [item, what] = PAIRS[hit];
  return `\n\nPairs well with ${item}, ${what} in dissolve pro: ${pro.apiUrl()}/pro`;
}

/* ---------- Dispatch ---------- */

async function runTool(name, args, account) {
  if (name === 'list_variants') return listVariants(args);
  if (name === 'get_variant') return getVariant(args);
  if (name === 'get_setup') return getSetup();
  if (name === 'list_components') return listComponents();
  if (name === 'add_component') {
    const { code, text } = await addComponent(args);
    return code === 0 ? text + pairingHint(itemNames(args?.name).map((n) => n.toLowerCase()), account) : text;
  }
  if (name === 'dissolve_login') return login();
  if (name === 'dissolve_login_status') return loginStatus();
  throw new RpcError(-32602, `Unknown tool: ${name}`);
}

async function callTool(name, args) {
  if (!TOOLS.some((t) => t.name === name)) throw new RpcError(-32602, `Unknown tool: ${name}`);
  try {
    if (UNGATED.has(name)) return await runTool(name, args, null);
    const account = await checkAccount();
    if (!account.ok) return account.text;
    const text = await runTool(name, args, account);
    track(account.token, name, args);
    return text;
  } catch (e) {
    if (e instanceof pro.OfflineError) throw new ToolError(`${e.message} Check the connection and try again.`);
    throw e;
  }
}

/* ---------- JSON-RPC over stdio ---------- */

class RpcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

async function handle(req) {
  const { method, params = {} } = req;
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'dissolve', version: VERSION },
        instructions: 'dissolve-ui: animated components and blocks for React Native and React. list_components shows what can be installed, add_component installs it (free or pro, relay its message if the user must connect or subscribe). get_setup, list_variants and get_variant document the dissolve engine. The tools need a free dissolve account: when a tool answers with a sign-in link, relay it to the user as is and call the tool again once they signed in.',
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call':
      try {
        return { content: [{ type: 'text', text: await callTool(params.name, params.arguments ?? {}) }] };
      } catch (e) {
        if (e instanceof ToolError) return { content: [{ type: 'text', text: e.message }], isError: true };
        throw e;
      }
    default:
      throw new RpcError(-32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
/** Calls in flight: stdin closing waits for them before exiting. */
const inflight = new Set();
rl.on('line', (line) => {
  const p = onLine(line).finally(() => inflight.delete(p));
  inflight.add(p);
});
rl.on('close', () => Promise.allSettled([...inflight]).then(() => process.exit(0)));

async function onLine(line) {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    send({ id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  const isNotification = req.id === undefined || req.id === null;
  // notifications/initialized and any other notification: nothing to answer.
  if (isNotification) return;
  try {
    send({ id: req.id, result: await handle(req) });
  } catch (e) {
    send({ id: req.id, error: { code: e.code ?? -32603, message: e.message } });
  }
}
