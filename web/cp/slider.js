// ElasticSlider demo. The slider is the React web component's core (registry/web/elastic-slider.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a few sliders
// in a control card, and the autoplay, which drags with real pointer events, past the end included.
import { createElasticSlider } from '../lib/elastic-slider.js';
import { el, fitTile, availW, tween, QUAD, AUTO, prop, add } from './kit.js';

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
    const s = createElasticSlider(host, { ...opts, onValueChange: (v) => { value = v; s.update({ value: v }); } });
    sc.onDispose(() => s.destroy());
    return { host, set(v) { value = v; s.update({ value: v }); } };
  };
  const volume = make({ label: 'Volume', value: 40, formatValue: (v) => `${v}%` });
  make({ label: 'Brightness', value: 72, formatValue: (v) => `${v}%` });
  if (mode === 'stage') make({ label: 'Rating', min: 0, max: 10, value: 7, size: 'sm' });

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

// A small stepped one, no value shown.
<ElasticSlider min={0} max={10} step={1} defaultValue={4} size="sm" showValue={false} />`),
    props: [
      prop('value', 'number', '', 'Current value (controlled).'),
      prop('defaultValue', 'number', 'min', 'Initial value when uncontrolled.'),
      prop('onValueChange', '(value: number) =&gt; void', '', 'Called with the stepped value while sliding, every time it changes.'),
      prop('onSlidingComplete', '(value: number) =&gt; void', '', 'Called with the final value when the finger lifts.'),
      prop('min / max / step', 'number', '0 / 100 / 1', 'Range and step.'),
      prop('label', 'string', '', 'Text on the left of the track.'),
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
