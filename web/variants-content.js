// Reference content of the variant pages: options tables, best practices, install data.
// Source of truth: src/dissolve/types.ts (DissolveOptions), src/dissolve/variants/*, src/dissolve/hooks/*.

export const PKG = 'react-native-dissolve';

/** Peers from package.json (tested versions). */
export const PEERS = [
  ['@shopify/react-native-skia', '2.6.2', 'Snapshot (makeImageFromView) and Atlas drawing'],
  ['react-native-reanimated', '4.5.1', 'Grains animated on the UI thread'],
  ['react-native-worklets', '0.10.1', 'Worklets runtime for Reanimated 4'],
  ['react-native-gesture-handler', '~2.32.0', 'Scrub, peel and hold gestures'],
  ['expo-haptics', '~57.0.1', 'Haptic ticks that follow the effect'],
  ['expo', '~57.0.6', 'Expo SDK 57, runs in Expo Go'],
  ['react-native', '0.86.3', 'New architecture, iOS and Android'],
];

export const INSTALL = `npx expo install ${PKG} ${PEERS.slice(0, 5).map((p) => p[0]).join(' ')}`;

export const PROVIDER = `import { Stack } from 'expo-router';
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
}`;

/* ---------- options ---------- */

const ORIGIN_T = "'left' | 'right' | 'top' | 'bottom' | 'center' | { x, y }";
const row = (name, type, def, desc) => ({ name, type, def, desc });

const preset = (id) => row('preset', 'VariantName', `'dust'`, `Set it to <code>'${id}'</code>.`);
const grain = (g) => row('grain', 'number', `${g}`, 'Grain size in points. Raised automatically past about 6000 grains per burst.');
const duration = (d = 1500, note = '') => row('duration', 'number', `${d}`, `Full effect length in ms.${note ? ' ' + note : ''}`);
const origin = (def, desc) => row('origin', ORIGIN_T, def, desc);
const direction = (def = `'out'`, desc = "<code>'in'</code> plays it backwards as an entrance. Use <code>DissolveIn</code> or <code>useAppear</code> for that.") => row('direction', "'out' | 'in'", def, desc);
const haptics = (def = 'true', desc = 'Soft impact, then a few ticks while the wave sweeps the view.') => row('haptics', 'boolean', def, desc);
const field = row('field', "'cascade'", 'none', 'Replaces the native delay with a diagonal wave, for lists and full screens.');
const rows = row('rows', 'number[]', 'none', "Row boundaries in local Y used by <code>field: 'cascade'</code>: rows leave one after the other.");

const classic = (id, g, originDesc) => [
  preset(id), grain(g), duration(), origin('none', originDesc), direction(), haptics(), field, rows,
];

const appearRows = (id, extra = []) => [
  row('preset', 'VariantName', `'gather'`, `Set it to <code>'${id}'</code>. Any exit preset also works as an entrance.`),
  grain(3),
  duration(1200, 'Entrances default to 1200.'),
  origin('none', 'Where the view starts to assemble. Without it the variant uses its own order.'),
  ...extra,
  row('delay', 'number', '0', 'Wait before starting, in ms. Use <code>index * 40</code> to stagger a list.'),
  row('play', 'boolean', 'true', '<code>DissolveIn</code> only. Plays on mount; flip it from false to true to play later.'),
  row('onAppear', '() => void', 'none', '<code>DissolveIn</code> only. Called once the real view is visible.'),
  haptics('false', 'Entrances are quiet by default, lists can stagger many of them.'),
  field,
];

export const OPTIONS = {
  dust: classic('dust', 3, 'Where the wind starts. Without it grains leave left to right with a slight lift.'),
  sand: classic('sand', 2.5, 'Where the pour starts. Without it columns fall left to right.'),
  ember: classic('ember', 3, 'Where the burn starts. Without it it burns from the left, bottom first.'),
  pixel: classic('pixel', 7, 'Where the collapse starts. Without it blocks fall in random order.'),
  vortex: classic('vortex', 3, 'Where the spiral starts. Without it the edges go first and the center last.'),
  shatter: [
    preset('shatter'),
    origin(`'center'`, 'Impact point. Pass the touch point (local coords) so the cracks start under the finger.'),
    row('n', '[shards]', '[220]', 'Target shard count, clamped to 60..400. More shards read as tempered glass.'),
    row('velocity', '{ x, y }', 'none', 'Adds 30% of a swipe velocity (pt/s) to every shard launch.'),
    duration(1500, 'Shards fall with real gravity, so short durations keep them on screen.'),
    direction(`'out'`, "<code>'in'</code> plays the timeline backwards: the shards fly back and lock into the exact view."),
    haptics('true', 'One rigid impact on the break, then light ticks while shards fly.'),
  ],
  stream: [
    preset('stream'),
    row('to', 'RefObject&lt;View&gt; | Box', 'tab bar', 'Target the grains fly into: a ref (measured on the fly) or a window rect. Without it, the bottom center of the window.'),
    row('onArrive', '() => void', 'none', 'Called when most grains reach the target. Bump a badge or a counter here.'),
    grain(3.5),
    duration(),
    origin('none', 'Overrides the default order (closest grains to the target leave first).'),
    direction(`'out'`, "<code>'in'</code> pours out of the target to form the view. With <code>useAppear</code> pass <code>from: sourceRef</code>."),
    haptics('true', 'Ticks as grains leave, one soft impact on arrival.'),
    field,
  ],
  gather: appearRows('gather'),
  rain: appearRows('rain'),
  print: appearRows('print'),
  snap: [
    preset('snap'),
    origin(`'center'`, 'The burst point. Pass the touch point: <code>{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }</code>.'),
    row('n', '[push]', '[1]', 'Push strength multiplier. 0.6 is a gentle pop, 1.6 a blast.'),
    grain(3), duration(), direction(), haptics(),
  ],
  fling: [
    preset('fling'),
    row('velocity', '{ x, y }', 'none', 'Release velocity of the pan gesture in pt/s (<code>e.velocityX</code>, <code>e.velocityY</code>). Sets direction and strength.'),
    duration('auto', 'Without it, it follows the speed: clamp(1800 - speed * 0.4, 700, 1500).'),
    grain(3),
    origin('none', 'Overrides the default order (the leading edge of the swipe leaves first).'),
    direction(), haptics(), field,
  ],
  charge: [
    row('holdMs', 'number', '1200', 'Time to reach full charge. The view shakes, frays and heats on the way.'),
    row('then', 'VariantName', `'charge'`, 'Variant of the final burst. Other variants only get the burst, no heat.'),
    grain(3),
    duration(900, 'Length of the final burst.'),
    row('maxDistance', 'number', '24', 'Finger travel in pt that cancels the hold.'),
    row('haptics', 'boolean', 'true', 'Ticks speed up from every 120 ms to every 30 ms, heavy impact at full charge.'),
    row('onCommit', '() => void', 'none', 'Called once the burst is over: remove the item here.'),
    row('onCancel', '() => void', 'none', 'Called when released early, once the view has settled back.'),
    row('n', '[push]', '[1]', "With <code>dissolve({ preset: 'charge' })</code>: push multiplier of the burst."),
  ],
  pile: [
    preset('pile'),
    row('floor', "number | 'screen' | RefObject&lt;View&gt;", `'screen'`, 'Where grains land: a window Y, the bottom of the screen, or the top of a view.'),
    row('n', '[kept]', '[0.35]', 'Share of grains kept in the heap, the rest falls as dust and fades.'),
    grain(2.5),
    duration(2000, 'Pile defaults to 2000.'),
    direction(`'out'`, "<code>'in'</code> plays the pour backwards without adding to the heap."),
    row('sweepPile(opts)', 'usePile()', `{ preset: 'dust' }`, 'Dissolves the whole heap with any exit preset, then clears it.'),
    row('clearPile()', 'usePile()', 'none', 'Drops the heap instantly.'),
  ],
  morph: [
    row('refA, refB', 'RefObject&lt;View&gt;', 'none', 'The two views. Both stay mounted and laid out, stacked on top of each other.'),
    row('styleA, styleB', 'ViewStyle', 'none', 'Put them on a wrapper of each view: the hidden one sits at 0.01 opacity so it can be captured.'),
    row('reverse', 'boolean', 'false', 'Morph B back into A.'),
    row('grain', 'number', '4', 'Grain size in points, capped to 3500 grains per view (two atlases per morph).'),
    duration(1500),
    haptics(),
    row('phase', "'a' | 'morphing' | 'b'", `'a'`, 'Returned by the hook. Which view is showing.'),
  ],
  peel: [
    row('threshold', 'number', '0.4', 'useDissolvePeel: share of the view diagonal the corner must travel to commit.'),
    row('velocity', 'number', '900', 'useDissolvePeel: release speed in pt/s that commits regardless of distance.'),
    grain(3),
    duration(700, 'useDissolvePeel: fly off after a commit. With <code>dissolve()</code> it is the whole peel.'),
    row('haptics', 'boolean', 'true', 'A tick when the paper lifts, a light impact on commit.'),
    row('onCommit', '() => void', 'none', 'Called once the sticker is gone.'),
    row('onCancel', '() => void', 'none', 'Called when released early and the sticker is back in place.'),
    row('preset', 'VariantName', `'dust'`, "Auto mode: <code>dissolve({ preset: 'peel' })</code> peels from the bottom right corner."),
    direction(`'out'`, "Auto mode: <code>'in'</code> sticks the sticker back on."),
  ],
  melt: [
    preset('melt'),
    grain(3),
    duration(1500, 'Drips need time: 1500 to 2500 reads best.'),
    direction(`'out'`, "<code>'in'</code> drips up and solidifies into the view."),
    haptics(),
  ],
};

/* ---------- best practices ---------- */

const REDUCED = 'Reduced motion is handled by the provider: the effect is skipped and the promise resolves at once, so keep your state update after the <code>await</code>.';

export const PRACTICES = {
  dust: [
    ['do', 'Use it for light, reversible removals: clearing a notification, archiving a row, dismissing a toast.'],
    ['do', 'Keep grain at 2 to 4 pt on cards and rows. Below 2 pt a large view hits the 6000 grain cap and the grain is raised for you.'],
    ['do', "Hide the original with <code>opacity: dissolving ? 0 : 1</code> and remove it from state after the <code>await</code>."],
    ['dont', 'Do not chain several dust exits on screen at once, a cascade on one snapshot reads better and costs one burst.'],
    ['do', REDUCED],
  ],
  sand: [
    ['do', 'Fits deletes with weight: photos, files, anything that should fall rather than blow away.'],
    ['do', 'Keep 2 to 3 pt grain on photos so the image still reads as it pours.'],
    ['dont', 'Avoid it near the bottom edge of the screen, the pour needs room below the view.'],
    ['do', 'Use 1200 to 1800 ms. Shorter feels like a glitch, longer blocks the next action.'],
    ['do', REDUCED],
  ],
  ember: [
    ['do', 'Use it for permanent removals with a bit of drama: burn after reading, discard a draft, revoke a key.'],
    ['do', 'Sparks are tinted by the dominant color of the view, colorful views glow best.'],
    ['dont', 'Do not use it for routine actions like marking as read, it reads as destructive.'],
    ['do', 'Keep haptics on: the sweep ticks match the burn front.'],
    ['do', REDUCED],
  ],
  pixel: [
    ['do', 'Made for games, retro skins and playful UIs: level cleared, enemy down, coin collected.'],
    ['do', 'Use a larger grain (6 to 10 pt). The stepped motion needs visible blocks.'],
    ['dont', 'Avoid it on photos in a calm interface, it reads as a rendering bug there.'],
    ['do', 'Short durations (800 to 1200 ms) suit the stepped timing.'],
    ['do', REDUCED],
  ],
  vortex: [
    ['do', 'Use it for clear all and close actions: the view collapses toward a single point.'],
    ['do', 'Set an origin to collapse toward a button or a badge rather than the center.'],
    ['dont', 'Avoid very wide views, the spiral flattens on long thin shapes.'],
    ['do', '3 pt grain and 1500 ms is the sweet spot on cards.'],
    ['do', REDUCED],
  ],
  shatter: [
    ['do', 'Use it for hard failures and irreversible breaks: wrong passcode, declined payment, broken link.'],
    ['do', 'Pass the touch point as origin, cracks starting under the finger sell the impact.'],
    ['do', 'Keep 120 to 260 shards on cards. 400 is for full width media.'],
    ['dont', 'Do not use it for frequent actions, the flash and the gravity get tiring.'],
    ['do', REDUCED],
  ],
  stream: [
    ['do', 'Use it to show where something went: a file into a folder, an item into the cart, a mail into the archive.'],
    ['do', 'Pass a ref as <code>to</code> and bump a badge in <code>onArrive</code>, the arrival is the payoff.'],
    ['dont', 'Avoid targets hidden under other views, grains fly in a straight overlay above everything.'],
    ['do', "Pair it with <code>direction: 'in'</code> and <code>from</code> to restore an item from the same place."],
    ['do', REDUCED],
  ],
  gather: [
    ['do', 'Use it for arrivals that deserve attention: a new message, a match, an unlocked reward.'],
    ['do', 'Wrap the new view in <code>&lt;DissolveIn preset="gather"&gt;</code>, it plays on mount and reveals the real view at the end.'],
    ['dont', 'Do not gather every row of a long list, stagger at most the first five with <code>delay</code>.'],
    ['do', 'Entrances are quiet by default, turn haptics on only for important arrivals.'],
    ['do', 'With reduced motion the view simply appears.'],
  ],
  rain: [
    ['do', 'Use it for content that loads in: refreshed feeds, search results, a grid of products.'],
    ['do', 'Stagger rows with <code>delay={index * 40}</code> for a falling wave.'],
    ['dont', 'Avoid it for views at the very top of the screen, grains fall from above the view.'],
    ['do', '1000 to 1400 ms keeps the settle bounce crisp.'],
    ['do', 'With reduced motion the view simply appears.'],
  ],
  print: [
    ['do', 'Made for documents that are produced: receipts, tickets, invoices, generated reports.'],
    ['do', 'Tall views read best, the head prints line by line from the top.'],
    ['dont', 'Avoid it on short pills or chips, there are too few lines to see the print.'],
    ['do', 'Fresh ink starts with a cool tint and settles to the real colors, so it works on light and dark themes.'],
    ['do', 'With reduced motion the view simply appears.'],
  ],
  snap: [
    ['do', 'Use it for tap to dismiss: tags, chips, toasts and cards the user taps directly.'],
    ['do', 'Always pass the touch point as origin, otherwise it bursts from the center.'],
    ['do', 'Tune the push with <code>n: [push]</code>: 0.6 for small chips, 1.6 for hero cards.'],
    ['dont', 'Do not trigger it from a separate button, the burst point would make no sense.'],
    ['do', REDUCED],
  ],
  fling: [
    ['do', 'Use it at the end of a swipe gesture: dismiss a card, triage a mail, reject a match.'],
    ['do', 'Pass the release velocity of the pan gesture, slow swipes drift, fast ones tear apart.'],
    ['do', 'Leave duration out so it follows the speed (700 to 1500 ms).'],
    ['dont', 'Do not fling below about 300 pt/s, spring the card back instead.'],
    ['do', REDUCED],
  ],
  charge: [
    ['do', 'Use it to confirm destructive actions without a dialog: delete an account, wipe a project.'],
    ['do', 'Show the charge (the <code>charge</code> shared value) as a ring or a label so users know to keep holding.'],
    ['do', 'Keep holdMs between 800 and 1600. Shorter triggers by accident, longer feels broken.'],
    ['dont', 'Do not use it for frequent actions, a hold on every delete gets tedious.'],
    ['do', 'With reduced motion the hold still works, only the burst is skipped.'],
  ],
  pile: [
    ['do', 'Use it where removed items should stay visible for a while: done tasks, inbox zero, a trash you empty later.'],
    ['do', 'Sweep the heap with <code>usePile().sweepPile()</code> at a natural moment (leaving the screen, empty trash).'],
    ['do', 'Keep 20 to 40 percent of the grains in the heap, more fills the floor too fast.'],
    ['dont', 'Do not leave the heap forever, call <code>clearPile()</code> on unmount.'],
    ['do', REDUCED],
  ],
  morph: [
    ['do', 'Use it for state changes of the same element: Follow to Following, Download to Open, Add to In cart.'],
    ['do', 'Keep both views the same size and stacked, the grains pair by brightness.'],
    ['dont', 'Avoid morphing two very different layouts, it reads as noise rather than a change.'],
    ['do', 'Grain 3 to 4 pt on buttons, the grain cap is halved because two atlases are drawn.'],
    ['do', REDUCED],
  ],
  peel: [
    ['do', 'Made for stickers, badges and coupons: anything that should feel like paper.'],
    ['do', 'Prefer <code>useDissolvePeel</code>: the fold follows the finger from any corner or edge.'],
    ['do', 'Keep the default threshold (0.4) so a short pull springs back.'],
    ['dont', 'Avoid it on views with a transparent background, the back of the sticker is a plain paper color.'],
    ['do', REDUCED],
  ],
  melt: [
    ['do', 'Use it for playful or seasonal removals: weather alerts, ice, wax, expiring offers.'],
    ['do', 'Give it room below the view and 1500 to 2500 ms, drips merge and pinch off as they fall.'],
    ['dont', 'Avoid it on small chips, the gooey layer needs some height to form drips.'],
    ['do', 'Colorful, flat views melt best, fine text blurs into the liquid.'],
    ['do', REDUCED],
  ],
};
