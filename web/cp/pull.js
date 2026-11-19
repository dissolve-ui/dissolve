// PullToRefresh demo. The ring and the pull are the React web component's core
// (registry/web/pull-to-refresh.core.ts, built into web/lib), the same code a React app installs.
// This file keeps the demo: the activity feed, the rows each refresh brings, and the autoplay,
// which pulls with real pointer events.
import { createPullToRefresh } from '../lib/pull-to-refresh.js';
import { el, availW, fitTile, QUAD, tween, AUTO, prop, add } from './kit.js';

const FEED = [
  ['Maya Chen', '+$46.50'], ['Blue Bottle', '\u2212$6.25'], ['Jonah Reyes', '\u2212$120.00'], ['Payroll', '+$3,240.00'],
  ['Whole Foods', '\u2212$82.17'], ['Lena Park', '+$975.00'], ['Lyft', '\u2212$38.90'], ['Spotify', '\u2212$16.99'],
].map(([name, amount]) => ({ name, amount }));
const INCOMING = [['Priya Natarajan', '+$50.00'], ['Sweetgreen', '\u2212$14.75'], ['Diego Alvarez', '+$220.00'], ['Apple', '\u2212$2.99']].map(([name, amount]) => ({ name, amount }));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const T = 80;
/** The fake network: how long a refresh takes. */
const LOAD = 1400;
/** From the release to the new row built: spin, then the flight. */
const LANDED = LOAD + 1300;

function mountPull(body, { sc, mode }) {
  const tile = mode === 'tile';
  const CW = tile ? 300 : mode === 'stage' ? 340 : Math.round(Math.min(330, availW(body) || 320));
  const CH = tile ? 360 : mode === 'stage' ? 520 : 420;

  const host = el('div', 'pr');
  host.style.width = CW + 'px';
  host.style.height = CH + 'px';
  host.setAttribute('role', 'list');
  host.setAttribute('aria-label', 'Activity, pull down to refresh');
  body.append(tile ? fitTile(body, host, CW, CH) : host);

  let id = 0, incoming = 0;
  const rowOf = (t) => {
    const row = el('div', 'pr-row', `<span class="pr-name">${esc(t.name)}</span><span class="pr-amt">${t.amount}</span>`);
    row.setAttribute('role', 'listitem');
    row.dataset.pullItem = String(id++);
    return row;
  };
  const ptr = createPullToRefresh(host, {
    threshold: T,
    async onRefresh() {
      await sc.wait(LOAD);
      ptr.slot.prepend(rowOf(INCOMING[incoming++ % INCOMING.length]));
    },
  });
  FEED.forEach((t) => ptr.slot.append(rowOf(t)));
  sc.onDispose(() => ptr.destroy());

  // A real pointer on the list stops the script.
  let user = false;
  const lift = (e) => { if (e.isTrusted) user = false; };
  host.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  sc.onDispose(() => { removeEventListener('pointerup', lift); removeEventListener('pointercancel', lift); });

  /** A pointer event at a pull of y layout px, where the list sits on screen (tiles are scaled). */
  const send = (type, y) => {
    const r = host.getBoundingClientRect(), s = r.width / host.offsetWidth || 1;
    host.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 40 * s + y * s }));
  };
  /** A calm drag of the scripted finger from one pull to another. */
  const drag = (from, to, ms) => tween(sc, ms, (k) => send('pointermove', from + (to - from) * QUAD(k)), () => user);

  return {
    // A calm drag down past the line, a short hold, release, and the new row builds itself.
    async run() {
      if (user) return;
      send('pointerdown', 0);
      await drag(0, T * 0.55, 520);
      await sc.wait(160);
      await drag(T * 0.55, T * 1.7, 760);
      await sc.wait(260);
      send('pointerup', T * 1.7);
      if (!sc.alive || user) return;
      await sc.wait(LANDED);
      await sc.wait(500);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'pull-to-refresh': {
    title: 'PullToRefresh',
    note: 'Pull the feed down, release: the new row builds itself from the ring.',
    desc: 'Wraps a list. Pull it down past the top and grains drift in from scattered positions to gather into a ring, 1:1 with the pull, with a 0.5 rubber band past the threshold. At the threshold the ring closes with a rigid tick. Release past it and the ring spins while onRefresh runs, the list held under it. When the promise settles, the items already there glide to their new place while the list eases back to the top, all on the calm curve, and the ring grains fly to the new items and build them in grains. Nothing new, or onRefresh threw: the grains fall away as dust. Released early, the grains scatter back out. Wrap each item in PullItem with a stable id: the ids there when the refresh starts are remembered, any other one is new. It works for any layout, rows, a bento grid, wrapped cards of any size. On iOS it rides the native overscroll of the scroll view, so nothing fights the scroll.',
    hint: 'Drag the list down and let go, or scroll up past the top',
    tileHint: 'Pull the list down',
    mount: mountPull,
    code: add('pull-to-refresh', 'PullToRefresh, PullItem', `<PullToRefresh onRefresh={reload}>
  {items.map((item) => (
    <PullItem key={item.id} id={item.id}>
      <Row tx={item} />
    </PullItem>
  ))}
</PullToRefresh>

// Any layout: a bento grid of cards.
<PullToRefresh onRefresh={reload} contentContainerStyle={grid}>
  {cards.map((card) => (
    <PullItem key={card.id} id={card.id} style={{ width: '47%' }} className="h-36 rounded-3xl bg-dissolve-surface p-4">
      <Card card={card} />
    </PullItem>
  ))}
</PullToRefresh>

// Your own list: spread scroll on it.
<PullToRefresh onRefresh={reload} threshold={96} color="accent">
  {(scroll) => (
    <Animated.FlatList
      {...scroll}
      data={items}
      renderItem={({ item }) => <PullItem id={item.id}><Row tx={item} /></PullItem>}
    />
  )}
</PullToRefresh>`),
    props: [
      prop('children', 'ReactNode | (scroll) =&gt; ReactNode', 'required', 'List content, wrapped in an Animated.ScrollView. Or a render prop: spread scroll on your own Animated.FlatList or Animated.ScrollView.'),
      prop('onRefresh', '() =&gt; Promise&lt;void&gt;', 'required', 'Runs while the ring spins. Update your data before it resolves: the new items are built right after.'),
      prop('threshold', 'number', '80', 'Pull distance that arms the refresh, also the height held while it runs.'),
      prop('haptics', 'boolean', 'true', 'Rigid when the ring closes, Success when done, Warning if onRefresh throws.'),
      prop('color', 'PullToken', `'foreground'`, `Grain color as a theme token: 'foreground', 'muted', 'primary', 'accent', 'success', 'chart-1', 'chart-2'.`),
      prop('rebuild', 'boolean', 'true', 'Build the new PullItems from the ring grains when the refresh lands. Off, they just show. Needs DissolveProvider.'),
      prop('contentContainerStyle', 'StyleProp&lt;ViewStyle&gt;', '', 'Content container of the built in ScrollView (plain children only).'),
      prop('className', 'string', '', 'Root classes (background, radius, margins...).'),
      prop('PullItem', '{ id, className?, style? }', '', 'Wrap each item of the content. id: stable key of the item, any id not there when the refresh started is new. className and style draw the item (captured with it); size and position keys of style (width, flex, margin...) go to its outer box.'),
    ],
  },
};
