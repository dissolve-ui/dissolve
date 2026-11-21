// ElasticSlider demo. The slider is the React web component's core (registry/web/elastic-slider.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a few sliders
// in a control card, and the autoplay, which drags with real pointer events, past the end included.
import { createElasticSlider } from '../lib/elastic-slider.js';
import { el, fitTile, availW, tween, QUAD, AUTO, prop, add } from './kit.js';

const ICONS = {
  volume: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 5.1v13.8a.9.9 0 0 1-1.5.7L5.4 16H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h2.4l4.1-3.6a.9.9 0 0 1 1.5.7Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.4 5.6a9 9 0 0 1 0 12.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9Z"/></svg>',
};

function mountSlider(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 300 : mode === 'stage' ? 360 : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'es-demo');
  root.style.width = W + 'px';
  body.append(tile ? fitTile(body, root, W, 44 * 2 + 14) : root);

  const make = (opts) => {
    const host = el('div');
    root.append(host);
    let value = opts.value;
    const { glyph, ...rest } = opts;
    const s = createElasticSlider(host, { ...rest, onValueChange: (v) => { value = v; s.update({ value: v }); } });
    if (glyph) s.icon(false).innerHTML = s.icon(true).innerHTML = ICONS[glyph];
    sc.onDispose(() => s.destroy());
    return { host, set(v) { value = v; s.update({ value: v }); } };
  };
  const volume = make({ label: 'Volume', glyph: 'volume', value: 40, formatValue: (v) => `${v}%` });
  make({ label: 'Brightness', glyph: 'sun', value: 72, formatValue: (v) => `${v}%` });
  if (mode === 'stage') make({ label: 'Rating', glyph: 'star', min: 0, max: 10, value: 7, size: 'sm' });

  // A real pointer on a slider stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  /** A pointer event at x (0..1 of the track, past 1 to pull past the end) on the volume slider. */
  const send = (type, u) => {
    const r = volume.host.getBoundingClientRect();
    volume.host.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: r.left + r.width * u, clientY: r.top + r.height / 2 }));
  };
  const drag = async (from, to, ms) => {
    send('pointerdown', from);
    await tween(sc, ms, (k) => {
      send('pointermove', from + (to - from) * QUAD(k));
      if (k === 1) send('pointerup', to);
    }, () => user);
  };

  return {
    async run() {
      if (user) return;
      await drag(0.4, 0.85, 700);
      await sc.wait(350);
      if (!sc.alive || user) return;
      await drag(0.85, 1.3, 600);
      await sc.wait(700);
      if (!sc.alive || user) return;
      await drag(0.5, -0.25, 800);
      await sc.wait(700);
      if (!sc.alive || user) return;
      volume.set(40);
      await sc.wait(500);
    },
  };
}

export const ENTRIES = {
  'elastic-slider': {
    title: 'ElasticSlider',
    note: 'Pull past the end: the track stretches like a rubber band, then snaps back.',
    desc: 'A thick, rounded slider in the spirit of the iOS Control Center. The fill grows from the left, a label sits on the left and the value on the right, both inverting their color exactly where the fill passes under them. Drag anywhere to move it by the finger\'s distance, or tap to jump. Pull past either end and the whole track stretches like a rubber band toward the finger, thinning a little, then snaps back with a bounce on release. The value rolls digit by digit. A tick when it reaches the minimum or the maximum, and on every step when there are 20 steps or fewer. On iOS everything moves by transform only, so it keeps animating inside a scroll view that is being dragged.',
    hint: 'Drag a slider, then pull past its end',
    tileHint: 'Drag past the end',
    mount: mountSlider,
    code: add('elastic-slider', 'ElasticSlider', `const [volume, setVolume] = useState(40);
<ElasticSlider label="Volume" value={volume} onValueChange={setVolume} formatValue={(v) => \`\${v}%\`} />

// An icon before the label, drawn in the color it gets (it inverts over the fill).
<ElasticSlider label="Brightness" icon={({ color, size }) => <SunIcon color={color} size={size} />} defaultValue={70} />

// A small stepped one, no value shown.
<ElasticSlider min={0} max={10} step={1} defaultValue={4} size="sm" showValue={false} />`),
    props: [
      prop('value', 'number', '', 'Current value (controlled).'),
      prop('defaultValue', 'number', 'min', 'Initial value when uncontrolled.'),
      prop('onValueChange', '(value: number) =&gt; void', '', 'Called with the stepped value while sliding, every time it changes.'),
      prop('onSlidingComplete', '(value: number) =&gt; void', '', 'Called with the final value when the finger lifts.'),
      prop('min / max / step', 'number', '0 / 100 / 1', 'Range and step.'),
      prop('label', 'string', '', 'Text on the left of the track.'),
      prop('icon', 'ReactNode | ({ color, size }) =&gt; ReactNode', '', "Icon before the label. As a function it gets the color it should be drawn in, which inverts over the fill."),
      prop('showValue', 'boolean', 'true', 'Shows the value on the right of the track.'),
      prop('formatValue', '(value: number) =&gt; string', 'the number', 'Turns the value into the shown text.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Track height and type size: 32, 44 or 56 pt.'),
      prop('haptics', 'boolean', 'true', 'Ticks at the ends, and on every step when there are 20 steps or fewer.'),
      prop('disabled', 'boolean', 'false', 'No sliding, the track shows at half opacity.'),
      prop('fillColor', 'string', 'foreground token', 'Fill color.'),
      prop('trackColor', 'string', 'foreground at low alpha', 'Empty track color.'),
      prop('className', 'string', '', 'Outer classes (width, margins...). It stretches to its parent by default.'),
    ],
  },
};
