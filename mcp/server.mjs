#!/usr/bin/env node
/**
 * dissolve MCP server: a tiny, dependency free Model Context Protocol server.
 *
 * Transport: stdio, JSON-RPC 2.0, one JSON message per line.
 * Methods: initialize, notifications/initialized, ping, tools/list, tools/call.
 * Tools: list_variants, get_variant, get_setup.
 *
 * Register it in Claude Code:
 *   claude mcp add dissolve -- node /absolute/path/to/mcp/server.mjs
 *
 * The data below is derived from README.md and src/dissolve (types.ts, hooks/, variants/).
 */
import { createInterface } from 'node:readline';

const PKG = 'react-native-dissolve';
const VERSION = '0.1.0';
const PROTOCOL = '2025-06-18';

/* ---------- Data ---------- */

const PEERS = [
  '@shopify/react-native-skia',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
  'expo-haptics',
];

const SETUP = `# react-native-dissolve setup

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
    name: 'pile', kind: 'exit', hook: 'useDissolve + usePile',
    use: 'Pours down and piles up on the floor, the heap stays until swept (todo done, trash).',
    info: 'Pours down and piles up on the floor. The heap stays until you sweep it.',
    snippet: `await dissolve({ preset: 'pile', floor: 'screen' });\n\nconst { sweepPile, clearPile } = usePile();\nawait sweepPile({ preset: 'dust' });`,
    options: ['floor: number | \'screen\' | RefObject<View>', ...COMMON],
    tips: ['Always offer a way to sweep the heap.'],
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
Best practices:
- One effect per user action, 0.9 s to 1.8 s. Exits on user intent only, never on scroll.
- Reduced motion is handled by the provider, do not add a custom fallback.
- Keep grain counts reasonable: default grain (about 3 pt) on cards, raise grain on large views, useDissolveScreen for full screens.
- Hide the original with opacity: dissolving ? 0 : 1 (never unmount before the await).`;

/* ---------- Tools ---------- */

const TOOLS = [
  {
    name: 'list_variants',
    description: 'List every react-native-dissolve variant with its kind (exit, entrance, gesture, transition), the hook to use, and a one line use case. Call this first to pick an effect.',
    inputSchema: {
      type: 'object',
      properties: { kind: { type: 'string', enum: ['exit', 'entrance', 'gesture', 'transition'], description: 'Optional filter.' } },
    },
  },
  {
    name: 'get_variant',
    description: 'Get the usage snippet, options and best practices for one react-native-dissolve variant (e.g. dust, stream, gather, charge, peel, melt, morph, cascade, screen).',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', enum: VARIANTS.map((v) => v.name), description: 'Variant name.' } },
      required: ['name'],
    },
  },
  {
    name: 'get_setup',
    description: 'Get the install command (package and peer dependencies), the DissolveProvider root layout snippet, a minimal useDissolve example and the variant picking rules.',
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

function callTool(name, args) {
  if (name === 'list_variants') return listVariants(args);
  if (name === 'get_variant') return getVariant(args);
  if (name === 'get_setup') return getSetup();
  throw new RpcError(-32602, `Unknown tool: ${name}`);
}

/* ---------- JSON-RPC over stdio ---------- */

class RpcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

function handle(req) {
  const { method, params = {} } = req;
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'dissolve', version: VERSION },
        instructions: 'Docs for react-native-dissolve (turn any React Native view into dust). Call get_setup to install it, list_variants to pick an effect, get_variant for the code.',
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call':
      try {
        return { content: [{ type: 'text', text: callTool(params.name, params.arguments ?? {}) }] };
      } catch (e) {
        if (e instanceof ToolError) return { content: [{ type: 'text', text: e.message }], isError: true };
        throw e;
      }
    default:
      throw new RpcError(-32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
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
    send({ id: req.id, result: handle(req) });
  } catch (e) {
    send({ id: req.id, error: { code: e.code ?? -32603, message: e.message } });
  }
});
rl.on('close', () => process.exit(0));
