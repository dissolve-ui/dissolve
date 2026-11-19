// SegmentedControl demo. The control is the React web component's core
// (registry/web/segmented-control.core.ts, built into web/lib), the same code a React app installs.
// This file keeps the demo: the sizes per mode, the icons, and the autoplay, which drags across the
// control with real pointer events.
import { createSegmentedControl } from '../lib/segmented-control.js';
import { el, QUAD, isLight, onTheme, fitTile, availW, tween, AUTO, prop, add } from './kit.js';

const ICONS = {
  list: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 4h7.5M6 8h7.5M6 12h7.5"/><circle cx="2.8" cy="4" r=".9" fill="currentColor" stroke="none"/><circle cx="2.8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="2.8" cy="12" r=".9" fill="currentColor" stroke="none"/></svg>',
  grid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="1.3"/><rect x="9" y="2" width="5" height="5" rx="1.3"/><rect x="2" y="9" width="5" height="5" rx="1.3"/><rect x="9" y="9" width="5" height="5" rx="1.3"/></svg>',
  map: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M1.8 3.6 5.6 2l4.8 1.8L14.2 2.4v10L10.4 14l-4.8-1.8-3.8 1.6z"/><path d="M5.6 2v10.2M10.4 3.8V14"/></svg>',
};

/** One control, driven like a controlled React one: the value follows onChange. */
function segmented(sc, parent, { segments, value, size, width, icons }) {
  const host = el('div', 'sg');
  host.style.width = width + 'px';
  parent.append(host);
  const pill = () => (isLight() ? '#FFFFFF' : undefined);
  const c = createSegmentedControl(host, { segments, value, size, indicatorColor: pill(), onChange: (v) => { value = v; c.update({ value: v }); } });
  icons?.forEach((name, i) => { c.icon(i, false).innerHTML = c.icon(i, true).innerHTML = ICONS[name]; });
  onTheme(sc, () => c.update({ indicatorColor: pill() }));
  sc.onDispose(() => c.destroy());
  return {
    host,
    index: () => segments.findIndex((s) => (s.value ?? s) === value),
    select(i) { value = segments[i].value ?? segments[i]; c.update({ value }); },
  };
}

function mountSegmented(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? 360 : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'sg-demo');
  body.append(tile ? fitTile(body, root, W, 36) : root);
  const periods = ['Day', 'Week', 'Month', 'Year'];
  const main = segmented(sc, root, { segments: periods, value: 'Week', width: W });
  const small = tile ? null : segmented(sc, root, {
    segments: [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }, { value: 'map', label: 'Map' }],
    value: 'list', size: 'sm', width: Math.min(248, W), icons: ['list', 'grid', 'map'],
  });

  // A real pointer on the control stops the script.
  let user = false;
  const lift = (e) => { if (e.isTrusted) user = false; };
  main.host.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  sc.onDispose(() => { removeEventListener('pointerup', lift); removeEventListener('pointercancel', lift); });

  /** A pointer event over the middle of segment u (fractional), where the control sits on screen. */
  const send = (type, u) => {
    const r = main.host.getBoundingClientRect(), inset = 3, seg = (r.width - inset * 2) / periods.length;
    main.host.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: r.left + inset + seg * (u + 0.5), clientY: r.top + r.height / 2 }));
  };
  /** A finger sliding from segment `from` to `to` over ms, the selection following it. */
  const sweep = async (from, to, ms) => {
    send('pointerdown', from);
    await tween(sc, ms, (k) => {
      send('pointermove', from + (to - from) * QUAD(k));
      if (k === 1) send('pointerup', to);
    }, () => user);
  };

  return {
    async run() {
      if (user) return;
      for (const i of [2, 3, 0]) {
        main.select(i);
        await sc.wait(700);
        if (!sc.alive || user) return;
      }
      await sweep(0, 3, 520);
      await sc.wait(700);
      if (!sc.alive || user) return;
      main.select(1);
      if (small) {
        await sc.wait(500);
        small.select((small.index() + 1) % 3);
      }
      await sc.wait(600);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'segmented-control': {
    title: 'SegmentedControl',
    note: 'Pick a segment: the pill breaks into grains that flow over and reassemble.',
    desc: 'An iOS style segmented control whose selection pill is made of grains. At rest it is a clean solid capsule with the soft iOS shadow, on a translucent track that sits on any background. Pick another segment and the pill breaks into grains, leading edge first: they flow to the new segment on a slight arc, shrinking mid flight, and reassemble into the pill there, in about 400 ms. The labels cross fade between their selected and unselected styles along the way. Drag the finger across the control and the selection follows it, the grains re-aiming from wherever they are, with a selection tick on every change. On iOS the pill and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the pill simply slides.',
    hint: 'Click a segment, or drag across the control',
    tileHint: 'Click or drag across',
    mount: mountSegmented,
    code: add('segmented-control', 'SegmentedControl', `const [period, setPeriod] = useState('Week');
<SegmentedControl segments={['Day', 'Week', 'Month', 'Year']} value={period} onChange={setPeriod} />

// Smaller, uncontrolled, a fixed width.
<SegmentedControl segments={['Inbox', 'Archive']} defaultValue="Inbox" size="sm" className="w-56 self-center" />

// Items with icons.
<SegmentedControl
  segments={[
    { value: 'list', label: 'List', icon: ({ color, size }) => <ListIcon color={color} size={size} /> },
    { value: 'grid', label: 'Grid', icon: ({ color, size }) => <GridIcon color={color} size={size} /> },
  ]}
  value={layout}
  onChange={setLayout}
/>`),
    props: [
      prop('segments', '(string | SegmentItem)[]', 'required', 'The segments: plain strings, or { value, label?, icon? } items. icon is a node or a function of { color, size, selected }.'),
      prop('value', 'string', '', 'Selected value (controlled).'),
      prop('defaultValue', 'string', 'first segment', 'Initial value when uncontrolled.'),
      prop('onChange', '(value: string, index: number) =&gt; void', '', 'Called on every selection change, also while dragging across the segments.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Height, inset and type size: 30, 36 or 44 pt.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on every change.'),
      prop('disabled', 'boolean', 'false', 'No selection, the control shows at half opacity.'),
      prop('trackColor', 'string', 'foreground at low alpha', 'Track fill.'),
      prop('indicatorColor', 'string', 'background / lifted gray', 'Pill and grain color. Default: the background token in light mode, a gray lifted off the track in dark mode.'),
      prop('className / labelClassName', 'string', '', 'Track classes (width, margins, self alignment...) and label classes. It stretches to its parent by default.'),
    ],
  },
};
