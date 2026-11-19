// Controls demos: QuantityStepper, RulerPicker, BarChart, MiniPlayer. Each component is its React
// web component's core (registry/web/<name>.core.ts, built into web/lib), the same code a React app
// installs. This file keeps the demos: the cart row and its dust, the datasets and the Week / Year
// switch, the library behind the player and its track list, and the autoplay, which drives every
// component with real pointer events or its public API.
import { createQuantityStepper, STEPPER_SIZES, STEPPER_ICONS } from '../lib/quantity-stepper.js';
import { createRulerPicker } from '../lib/ruler-picker.js';
import { createBarChart } from '../lib/bar-chart.js';
import { createMiniPlayer } from '../lib/mini-player.js';
import { el, rectOf, play, IMG, cover, rr, onScreen, availW, fitTile, snapNode, QUAD, tween, AUTO, prop, add, webAdd } from './kit.js';
const fmtInt = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * A scripted pointer event at a client position, on the component's own element. It does not
 * bubble, so the autoplay conductor never takes it for the visitor's hand.
 */
function send(node, type, x, y) {
  node.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y }));
}

/* ======================================================================================
   QuantityStepper
   ====================================================================================== */

/** Stroke in px whatever the icon size, like the stepper's own icons. */
function strokeIcon(ctx, d, cx, cy, size, color, stroke) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = (stroke * 24) / size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(d));
  ctx.restore();
}

function mountStepper(body, { sc, mode }) {
  const tile = mode === 'tile';
  const size = tile ? 'sm' : 'md';
  const m = STEPPER_SIZES[size];
  const W = Math.round(Math.min(tile ? 300 : 360, availW(body) || 340));
  const row = el('div', 'cc cc-qs-row');
  row.style.width = W + 'px';
  const art = el('span', 'cc-qs-art');
  art.style.backgroundImage = 'url(assets/paintings/tuscany.jpg)';
  if (tile) { art.style.width = art.style.height = '40px'; row.style.gap = '10px'; }
  const text = el('span', 'cc-qs-text', '<span class="cc-qs-title">Tuscany print</span><span class="cc-qs-sub">A3 matte, 24 €</span>');
  const host = el('div');
  row.append(art, text, host);
  body.append(row);

  let qty = 1, busy = false;
  const stepper = createQuantityStepper(host, {
    value: qty,
    size,
    className: 'cc-qs',
    onChange: (v) => stepper.update({ value: (qty = v) }),
    onRemove: () => remove(),
  });
  sc.onDispose(() => stepper.destroy());
  const setQty = (v) => stepper.update({ value: (qty = v) });
  const [minus, plus] = host.querySelectorAll('button');

  // The row exactly as drawn, for the dust.
  const snapRow = () => snapNode(row, [
    { node: row, fill: true, radius: 18 },
    { node: art, draw: (ctx, a) => { ctx.save(); rr(ctx, a.x, a.y, a.w, a.h, 12); ctx.clip(); cover(ctx, IMG.tuscany, a.x, a.y, a.w, a.h); ctx.restore(); } },
    ...[...text.children].map((node) => ({ node })),
    { node: host.firstElementChild, fill: true, radius: 'pill' },
    { node: minus, draw: (ctx, b) => strokeIcon(ctx, STEPPER_ICONS.trash, b.x + b.w / 2, b.y + b.h / 2, m.icon, getComputedStyle(minus.querySelector('.dissolve-stepper-trash')).color, m.stroke * 0.85) },
    { node: plus, draw: (ctx, b, n) => strokeIcon(ctx, STEPPER_ICONS.plus, b.x + b.w / 2, b.y + b.h / 2, m.icon, getComputedStyle(n).color, m.stroke) },
    { node: host.querySelector('.dissolve-ticker-col'), text: String(qty), align: 'center' },
  ]);

  async function remove() {
    if (busy) return;
    busy = true;
    const src = snapRow();
    const r = rectOf(row);
    row.style.opacity = '0';
    row.inert = true;
    await sc.track(play({ source: src, ...r, preset: 'sand' })).done;
    if (!sc.alive) return;
    await sc.wait(900);
    // Back for another go: the row gathers in again.
    setQty(1);
    const back = snapRow();
    await sc.track(play({ source: back, ...rectOf(row), preset: 'gather', direction: 'in', duration: 800 })).done;
    if (!sc.alive) return;
    row.style.opacity = '';
    row.inert = false;
    busy = false;
  }

  /** A scripted tap: press, a short hold, release on the button. */
  async function tap(btn) {
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    send(btn, 'pointerdown', x, y);
    await sc.wait(130);
    send(btn, 'pointerup', x, y);
  }

  return {
    async run() {
      if (busy) return;
      if (qty > 3) { setQty(1); await sc.wait(500); }
      for (let i = 0; i < 4; i++) { await tap(plus); await sc.wait(260); }
      await sc.wait(500);
      while (qty > 1 && sc.alive) { await tap(minus); await sc.wait(220); }
      await sc.wait(700);
      await tap(minus);
      while (busy && sc.alive) await sc.wait(100);
    },
  };
}

/* ======================================================================================
   RulerPicker
   ====================================================================================== */

function mountRuler(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = Math.round(Math.min(tile ? 300 : 380, availW(body) || 340));
  const host = el('div', 'cc');
  host.style.width = W + 'px';
  body.append(host);

  let rest = null;
  const ruler = createRulerPicker(host, {
    value: 72.4,
    min: 30,
    max: 200,
    step: 0.1,
    unit: 'kg',
    format: String,
    height: tile ? 64 : 76,
    fontSize: tile ? 40 : mode === 'stage' ? 56 : 48,
    onChange: () => rest?.(),
  });
  sc.onDispose(() => ruler.destroy());
  const cv = host.querySelector('canvas');

  /** A quick sideways flick at v px/s (positive raises the value), then wait until the ruler rests. */
  async function fling(v) {
    const r = cv.getBoundingClientRect(), y = r.top + r.height / 2, x0 = r.left + r.width / 2, ms = 64;
    const settled = new Promise((res) => { rest = res; sc.wait(3500).then(res); });
    send(cv, 'pointerdown', x0, y);
    await tween(sc, ms, (k) => send(cv, k < 1 ? 'pointermove' : 'pointerup', x0 - (v / 1000) * k * ms, y));
    await settled;
    rest = null;
  }

  return {
    async run() {
      await fling(2300);
      await sc.wait(700);
      await fling(-1700);
      await sc.wait(400);
    },
  };
}

/* ======================================================================================
   BarChart
   ====================================================================================== */

const WEEK = {
  format: (v) => `${fmtInt(v)} steps`,
  data: [['Mon', 6420], ['Tue', 8912], ['Wed', 7310], ['Thu', 10240], ['Fri', 5480], ['Sat', 12650], ['Sun', 9030]].map(([label, value]) => ({ label, value })),
};
const YEAR = {
  format: (v) => `${fmtInt(v)} h`,
  stacked: true,
  data: [
    ['Jan', [42, 18, 30]], ['Feb', [38, 22, 26]], ['Mar', [51, 25, 28]], ['Apr', [47, 31, 24]], ['May', [58, 34, 22]], ['Jun', [62, 40, 20]],
    ['Jul', [55, 46, 26]], ['Aug', [40, 38, 34]], ['Sep', [60, 30, 22]], ['Oct', [66, 28, 24]], ['Nov', [57, 24, 30]], ['Dec', [44, 20, 38]],
  ].map(([label, values]) => ({ label, values })),
};
/** Enter and data change of the chart, the value axis width. */
const ENTER = 640, CHANGE = 820, AXIS = 34;

function mountChart(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = Math.round(Math.min(tile ? 300 : 420, availW(body) || 340));
  const height = tile ? 92 : mode === 'stage' ? 180 : 150, plotW = W - AXIS;

  const root = el('div', `cc cc-bc${tile ? ' cc-bc-tile' : ''}`);
  root.style.width = W + 'px';
  const seg = el('div', 'cc-seg');
  seg.setAttribute('role', 'tablist');
  const tabs = [['Week', WEEK], ['Year', YEAR]].map(([name, set]) => {
    const b = el('button', 'cc-seg-btn', name);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => change(set));
    seg.append(b);
    return { b, set };
  });
  const host = el('div');
  if (!tile) root.append(seg);
  root.append(host);
  body.append(root);

  let set = WEEK, chart = null, busy = false;
  const props = () => ({ data: set.data, stacked: !!set.stacked, formatValue: set.format, height });
  /** A fresh chart: the dots fly in. */
  const mountChartCore = () => { chart?.destroy(); chart = createBarChart(host, props()); };
  mountChartCore();
  sc.onDispose(() => chart.destroy());
  const showTabs = () => tabs.forEach((t) => { t.b.classList.toggle('on', t.set === set); t.b.setAttribute('aria-selected', String(t.set === set)); });
  showTabs();

  async function change(next) {
    if (busy || next === set) return;
    busy = true;
    set = next;
    showTabs();
    chart.update(props());
    await sc.wait(CHANGE + 300);
    busy = false;
  }

  // Scripted mouse for the autoplay: it glides across the bars with a soft vertical wave, the bar
  // under it lights up and the dots scatter around it, then it leaves.
  const plot = () => host.querySelector('.dissolve-bar-plot');
  const sweep = (x0, x1, ms) => tween(sc, ms, (t) => {
    const r = plot().getBoundingClientRect(), s = r.width / W || 1;
    send(plot(), 'pointermove', r.left + (x0 + (x1 - x0) * QUAD(t)) * s, r.top + height * (0.55 + 0.22 * Math.sin(t * Math.PI * 3)) * s);
  });
  const leave = () => send(plot(), 'pointerleave', 0, 0);

  return {
    async run() {
      if (busy) return;
      busy = true;
      mountChartCore();
      await sc.wait(ENTER + 300);
      busy = false;
      // Let the dots land before the pointer arrives.
      await sc.wait(ENTER + 900);
      await sweep(plotW * 0.04, plotW * 0.96, 2600);
      await sc.wait(250);
      await sweep(plotW * 0.96, plotW * 0.45, 1300);
      await sc.wait(600);
      leave();
      await sc.wait(700);
      await change(set === WEEK ? YEAR : WEEK);
      await sc.wait(CHANGE + 400);
      await sweep(plotW * 0.1, plotW * 0.9, 2200);
      leave();
      await sc.wait(400);
    },
  };
}

/* ======================================================================================
   MiniPlayer
   ====================================================================================== */

const TRACKS = [
  { img: 'lake', title: 'Still Water', artist: 'Mara Lind' },
  { img: 'tuscany', title: 'Golden Hours', artist: 'The Olive Rows' },
  { img: 'cypress', title: 'Night Garden', artist: 'Ines Vale' },
];
// Six covers: the last row runs under the pill, so the glass has something to blur.
const LIBRARY = [['pond', 'Low Tide'], ['temple', 'Old Light'], ['valley', 'Wide Open'], ['villa', 'Summer Rooms'], ['tuscany', 'Golden Hours'], ['cypress', 'Night Garden']];
/** Track length in seconds; open and fold back of the player. */
const LEN = 214, MORPH = 500;

function mountPlayer(body, { sc, mode }) {
  const tile = mode === 'tile';
  const CW = tile ? 300 : mode === 'stage' ? 340 : Math.round(Math.min(330, availW(body) || 320));
  const CH = tile ? 480 : mode === 'stage' ? 580 : 520;

  const frame = el('div', 'cc cc-mp');
  frame.style.width = CW + 'px';
  frame.style.height = CH + 'px';
  // What sits behind the player in the frame: a small library grid.
  const lib = el('div', 'cc-mp-lib', `<p class="cc-mp-lib-h">Library</p><div class="cc-mp-grid">${LIBRARY.map(([img, t]) => `<div><i style="background-image:url(assets/paintings/${img}.jpg)"></i><span>${t}</span></div>`).join('')}</div>`);
  const host = el('div');
  frame.append(lib, host);
  body.append(tile ? fitTile(body, frame, CW, CH) : frame);

  let idx = 0, playing = false, progress = 0.32, opened = false;
  const track = () => {
    const tr = TRACKS[idx];
    return { title: tr.title, subtitle: tr.artist, artwork: `assets/paintings/${tr.img}.jpg`, progress };
  };
  const skip = (d) => { idx = (idx + d + TRACKS.length) % TRACKS.length; progress = 0.02; player.update(track()); };
  const togglePlay = () => player.update({ playing: (playing = !playing) });
  const player = createMiniPlayer(host, {
    ...track(),
    duration: LEN,
    playing,
    topInset: 48,
    className: 'cc-mp-glass',
    onPlayPause: togglePlay,
    onNext: () => skip(1),
    onPrev: () => skip(-1),
    onExpandedChange: (v) => { opened = v; },
  });
  sc.onDispose(() => player.destroy());

  // Playback clock, 4 Hz, asleep while the player is off screen.
  const seen = onScreen(sc, body);
  (async () => {
    while (sc.alive) {
      await sc.wait(250);
      if (!seen.on) await seen.shown();
      if (playing) { progress = (progress + 0.25 / LEN) % 1; player.update({ progress }); }
    }
  })();

  return {
    async run() {
      if (opened) { player.close(); await sc.wait(MORPH); }
      await sc.wait(250);
      host.querySelector('.dissolve-player-hit').click();
      await sc.wait(MORPH);
      await sc.wait(400);
      togglePlay();
      await sc.wait(1600);
      player.close();
      await sc.wait(MORPH);
      await sc.wait(600);
      host.querySelector('.dissolve-player-pill button:last-child').click();
      await sc.wait(450);
      await sc.wait(700);
      if (playing) togglePlay();
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'quantity-stepper': {
    title: 'QuantityStepper',
    note: 'Digits roll; at one the minus becomes a trash.',
    desc: 'A minus and plus stepper with rolling digits. A tap steps once; hold a button and it repeats from 380 ms down to 60 ms over 1.5 s, the digits rolling like an odometer and always in sync. At the minimum the minus turns into a trash, armed once its morph is done so a fast double tap never removes the row; tap it and the whole row falls away as sand. At the maximum the pill shakes.',
    hint: 'Tap or hold the buttons, go down to the trash',
    tileHint: 'Tap the buttons',
    mount: mountStepper,
    code: add('quantity-stepper', 'QuantityStepper', `const { ref, dissolving, dissolve } = useDissolve();

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <QuantityStepper
    value={qty}
    onChange={setQty}
    onRemove={async () => {
      await dissolve({ preset: 'sand' });
      removeFromCart(item.id);
    }}
  />
</View>`),
    webCode: webAdd('quantity-stepper', 'QuantityStepper', `<QuantityStepper
  value={qty}
  onChange={setQty}
  onRemove={() => removeFromCart(item.id)}
/>`),
    props: [
      prop('value', 'number', 'required', 'The quantity. Digits roll whenever it changes.'),
      prop('onChange', '(value: number) =&gt; void', 'required', 'Called on every step: once per tap (on release), then at 380 ms on hold, accelerating to 60 ms.'),
      prop('min', 'number', '1', 'Lowest value. With onRemove the minus turns into a trash there.'),
      prop('max', 'number', '99', 'Highest value. Going past it shakes the pill.'),
      prop('onRemove', '() =&gt; void', '', 'When set, the minus becomes a trash at the minimum and calls this on tap (ignored for 320 ms after reaching it). Dissolve your row here.'),
      prop('size', `'sm' | 'md'`, `'md'`, 'Pill height, 30 or 36.'),
      prop('haptics', 'boolean', 'true', 'A tick per step, medium on remove, warning at max.'),
      prop('className', 'string', '', 'Pill classes (background, radius, margins...).'),
      prop('textClassName', 'string', '', 'Count classes (weight, color...).'),
    ],
  },
  'ruler-picker': {
    title: 'RulerPicker',
    note: 'Fling the ruler, it glides and snaps.',
    desc: 'A horizontal ruler you drag under a center needle: 1:1 pan, momentum, then a calm snap on the nearest step. The value rolls above it. Graduations near the needle stretch with speed, and a haptic tick lands on every step.',
    hint: 'Drag or fling the ruler, or scroll over it',
    tileHint: 'Fling the ruler',
    mount: mountRuler,
    code: add('ruler-picker', 'RulerPicker', `<RulerPicker
  value={kg}
  onChange={setKg}
  min={30}
  max={200}
  step={0.1}
  unit="kg"
/>`),
    props: [
      prop('value', 'number', 'required', 'Current value. An outside change glides the ruler to it.'),
      prop('onChange', '(value: number) =&gt; void', '', 'Called once the ruler is at rest on a new value.'),
      prop('onChanging', '(value: number) =&gt; void', '', 'Called on every step crossed while dragging or gliding.'),
      prop('min / max', 'number', 'required', 'Bounds. Past them the ruler follows with a 0.3 rubber band.'),
      prop('step', 'number', '1', 'Value between two graduations.'),
      prop('majorEvery', 'number', '10', 'A labelled major graduation every N steps.'),
      prop('unit', 'string', '', `Unit next to the value, e.g. 'kg'.`),
      prop('format', '(value: number) =&gt; string', '', 'Formats the labels and the accessibility value.'),
      prop('tickSpacing', 'number', '10', 'Distance between two graduations, pt.'),
      prop('height', 'number', '76', 'Ruler height.'),
      prop('showValue', 'boolean', 'true', 'Shows the rolling value above the ruler.'),
      prop('fontSize', 'number', '56', 'Value size.'),
      prop('haptics', 'boolean', 'true', 'A tick per step, light on majors, rigid at the bounds.'),
      prop('className', 'string', '', 'Root classes (margins, width...).'),
      prop('valueClassName', 'string', '', 'Value classes, passed to NumberTicker.'),
    ],
  },
  'bar-chart': {
    title: 'BarChart',
    note: 'Bars made of dots, scrub them and they scatter.',
    desc: 'A bar chart built from small round dots, a slightly jittered grid with a rounded top per bar. The dots fly in and assemble the bars with a short stagger. Scrub with a finger: the bar under it stays lit while the others step back, a bubble with the value slides along, and the dots near the finger scatter away, then spring back. New data sends the dots falling from the old bars and gathers them into the new ones. Stacked series use the chart tokens: pink, violet and yellow.',
    hint: 'Hover or drag across the bars, switch the period',
    tileHint: 'Scrub the bars',
    mount: mountChart,
    code: add('bar-chart', 'BarChart', `<BarChart
  data={[{ label: 'Mon', value: 8412 }, { label: 'Tue', value: 10230 }]}
  formatValue={(v) => \`\${v.toLocaleString()} steps\`}
  onSelect={(i) => setDay(i)}
/>

<BarChart stacked maxDots={1000} data={[{ label: 'Jan', values: [42, 18, 30] }]} />`),
    props: [
      prop('data', '{ label, value?, values? }[]', 'required', 'One bar per item. values are segments, bottom to top. Pass a stable array: new data replays the gather.'),
      prop('height', 'number', '180', 'Plot height. The bubble lane and labels come on top.'),
      prop('formatValue', '(value: number) =&gt; string', 'grouped', 'Text of the bubble.'),
      prop('formatAxis', '(value: number) =&gt; string', 'compact', 'Axis labels, e.g. 1.2k.'),
      prop('onSelect', '(index: number | null, datum?) =&gt; void', '', 'Bar under the finger, then null on release.'),
      prop('stacked', 'boolean', 'false', 'Draws values as stacked segments.'),
      prop('colors', 'BarToken[]', `['primary']`, `Segment colors as theme tokens. ['chart-1', 'chart-2', 'chart-3'] (pink, violet, yellow) when stacked.`),
      prop('barRadius', 'number', '6', 'Rounding of the top of each dot column.'),
      prop('maxDots', 'number', '1400', 'Dot budget for the whole chart, the grid gets coarser past it. At most 1600.'),
      prop('gap', 'number', '6', 'Space between bars, shrinks on dense charts.'),
      prop('labelEvery', 'number', '', 'One label every N bars. Default: all up to 12 bars.'),
      prop('axis', 'boolean', 'true', 'Value axis on the right.'),
      prop('haptics', 'boolean', 'true', 'A tick per bar change while scrubbing.'),
      prop('className', 'string', '', 'Root classes (margins, padding...).'),
      prop('bubbleClassName', 'string', '', 'Bubble classes (background, radius...).'),
    ],
  },
  'mini-player': {
    title: 'MiniPlayer',
    note: 'The now playing pill opens into the player.',
    desc: 'A now playing bar in liquid glass that opens into the full player as one object, then folds back. Width, height, radius, artwork and the glass surface all follow one value, the artwork arcs into place, and a vertical drag drives it 1:1. In the pill the title sits centered beside the artwork and truncates before the controls. Swipe the closed pill sideways to skip.',
    hint: 'Tap the pill, drag it up or down, swipe it sideways',
    tileHint: 'Tap the pill',
    mount: mountPlayer,
    code: add('mini-player', 'MiniPlayer', `// Liquid glass surface: npx expo install expo-glass-effect
// Last child of a full screen container: it covers it when open.
<MiniPlayer
  title="Night Swim"
  subtitle="Low Tide"
  artwork={cover}
  progress={0.3}
  duration={214}
  playing={playing}
  onPlayPause={toggle}
  onNext={next}
  onPrev={prev}
/>`),
    webCode: webAdd('mini-player', 'MiniPlayer', `// Last child of a positioned container (relative, full screen): it covers it when open.
<MiniPlayer
  title="Night Swim"
  subtitle="Low Tide"
  artwork="/covers/night-swim.jpg"
  progress={0.3}
  duration={214}
  playing={playing}
  onPlayPause={toggle}
  onNext={next}
  onPrev={prev}
/>`),
    props: [
      prop('title', 'string', 'required', 'Track title. Centered beside the artwork and truncated before the controls in the pill, it travels to centered below the artwork.'),
      prop('subtitle', 'string', '', 'Artist or album.'),
      prop('artwork', 'ImageSource', 'required', 'Cover, grows from 40 pt to the player width.'),
      prop('progress', 'number', '0', 'Track progress, 0 to 1.'),
      prop('duration', 'number', '', 'Track length in seconds. Shows the elapsed and remaining times.'),
      prop('playing', 'boolean', 'required', 'Play or pause glyph.'),
      prop('onPlayPause', '() =&gt; void', 'required', 'Play and pause buttons.'),
      prop('onNext / onPrev', '() =&gt; void', '', 'Skip buttons and the sideways swipe on the pill.'),
      prop('expanded', 'boolean', '', 'Controlled open state.'),
      prop('onExpandedChange', '(expanded: boolean) =&gt; void', '', 'Called when it opens or folds back.'),
      prop('renderExpanded', '(api: { close }) =&gt; ReactNode', '', 'Replaces the bottom row of the open player (lyrics, AirPlay, queue).'),
      prop('bottom', 'number', '24', 'Gap under the closed pill, and bottom padding when open.'),
      prop('topInset', 'number', '60', 'Gap left above the open player.'),
      prop('haptics', 'boolean', 'true', 'Rigid when it locks open, light on close, a tick crossing halfway.'),
      prop('glass', 'boolean', 'true', 'Liquid glass surface (expo-glass-effect, iOS 26+). Falls back to the surface token with a hairline border.'),
      prop('className', 'string', '', 'Player surface classes (background, border) for the fallback surface.'),
    ],
  },
};
