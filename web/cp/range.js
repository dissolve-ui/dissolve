// RangeSlider demo. The sliders are the React web component's core (registry/web/range-slider.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a price range
// and a stepped distance, each under its value in large type, and the autoplay, which moves the
// handles with the keyboard so the bubbles roll.
import { createRangeSlider } from '../lib/range-slider.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const GROUPS = [
  {
    label: 'Price per night',
    text: (v) => `$${v[0]} – $${v[1]}`,
    props: { min: 0, max: 1000, step: 10, defaultValue: [120, 640], prefix: '$', accessibilityLabels: ['Minimum price', 'Maximum price'] },
    // Autoplay: [handle, key, presses].
    script: [[0, 'ArrowRight', 14], [1, 'ArrowLeft', 22], [1, 'ArrowRight', 22], [0, 'ArrowLeft', 14]],
  },
  {
    label: 'Distance from the center',
    text: (v) => `${v[0]} – ${v[1]} <small>km</small>`,
    props: { min: 0, max: 10, step: 1, defaultValue: [2, 7], suffix: ' km', minDistance: 1, ticks: false, accessibilityLabels: ['Minimum distance', 'Maximum distance'] },
    script: [[1, 'ArrowLeft', 3], [0, 'ArrowRight', 2], [0, 'ArrowLeft', 2], [1, 'ArrowRight', 3]],
  },
];

function mountRange(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? Math.round(Math.min(400, (availW(body) || 400) - 4)) : Math.round(Math.min(360, (availW(body) || 360) - 4));
  const root = el('div', 'rg-demo');
  if (mode === 'stage') root.classList.add('rg-stage');
  root.style.width = W + 'px';
  const groups = tile ? GROUPS.slice(0, 1) : GROUPS;
  body.append(tile ? fitTile(body, root, W, 130) : root);

  const sliders = groups.map((g) => {
    const box = el('div', 'rg-group', `<div class="rg-label">${g.label}</div><div class="rg-val"></div>`);
    const val = box.querySelector('.rg-val');
    const show = (v) => { val.innerHTML = g.text(v); };
    show(g.props.defaultValue);
    const host = el('div');
    box.append(host);
    root.append(box);
    // Created once attached, so the bubble tickers measure real glyphs.
    const s = createRangeSlider(host, { ...g.props, haptics: false, onValueChange: show });
    sc.onDispose(() => s.destroy());
    return { s, host, script: g.script };
  });

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  const press = (handle, key) => handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  return {
    async run() {
      for (const { host, script } of sliders) {
        const handles = host.querySelectorAll('.dissolve-rs-handle');
        for (const [which, key, n] of script) {
          await sc.wait(350);
          for (let i = 0; i < n; i++) {
            if (!sc.alive || user) return;
            press(handles[which], key);
            await sc.wait(n > 6 ? 45 : 220);
          }
        }
        await sc.wait(600);
      }
    },
  };
}

export const ENTRIES = {
  'range-slider': {
    title: 'RangeSlider',
    note: 'Two handles for a range: the track fills between them, the values roll in bubbles.',
    desc: 'A dual handle range slider. Drag either handle, or press the track and the nearest handle jumps there. The handles never cross (minDistance keeps a gap), the track fills between them, and while you drag both values roll in bubbles above the handles (NumberTicker, from dissolve); bubbles that would touch slide apart. With a step, the handles snap from step to step on a quick spring, tick dots show under the track (up to 40) and each step gives a selection tick, with a firmer one at the ends. Keyboard on each handle: arrows by a step, Page Up and Page Down by a tenth, Home and End to the ends. Controlled or not; onSlidingComplete fires once the handle is let go. Reduced motion: no springs, the bubbles only fade.',
    hint: 'Drag a handle, or use the arrow keys',
    tileHint: 'Drag a handle',
    mount: mountRange,
    code: add('range-slider', 'RangeSlider', `const [price, setPrice] = useState<RangeValue>([120, 640]);

<RangeSlider min={0} max={1000} step={10} value={price} onValueChange={setPrice} prefix="$" />

// Stepped, no ticks, the handles at least 1 km apart.
<RangeSlider min={0} max={10} step={1} defaultValue={[2, 7]} suffix=" km" minDistance={1} ticks={false} />`),
    props: [
      prop('value', '[number, number]', '', 'The range, controlled: [low, high].'),
      prop('defaultValue', '[number, number]', '[min, max]', 'The range when uncontrolled.'),
      prop('onValueChange', '(value: [number, number]) =&gt; void', '', 'Called with the stepped range while dragging, every time it changes.'),
      prop('onSlidingComplete', '(value: [number, number]) =&gt; void', '', 'Called with the final range when the handle is let go, or after a key moved it.'),
      prop('min', 'number', '0', 'Lower bound.'),
      prop('max', 'number', '100', 'Upper bound.'),
      prop('step', 'number', '1', 'Step the values snap to.'),
      prop('minDistance', 'number', '0', 'Smallest gap between the two values. At 0 they can meet, never cross.'),
      prop('ticks', 'boolean', '', 'Tick dots under the track, one per step. Default: on when step is given and there are 40 steps or fewer.'),
      prop('bubbles', `'drag' | 'always' | 'none'`, `'drag'`, 'The value bubbles above the handles: while dragging, always, or never.'),
      prop('decimals', 'number', '0', 'Digits after the decimal point in the bubbles.'),
      prop('locale', 'string', '', 'Locale for the bubble number separators.'),
      prop('prefix', 'string', '', 'Text before the number in the bubbles ($).'),
      prop('suffix', 'string', '', 'Text after the number in the bubbles ( km).'),
      prop('haptics', 'boolean', 'true', 'A selection tick on every step (when ticks show) and a firmer one at the ends.'),
      prop('disabled', 'boolean', 'false', 'Dims the slider and ignores input.'),
      prop('accessibilityLabels', '[string, string]', `['Minimum', 'Maximum']`, 'Read by screen readers on the two handles.'),
      prop('className', 'string', '', 'Outer classes (margins, width...). The height is the slider\'s own.'),
    ],
  },
};
