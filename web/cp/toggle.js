// Toggle demo. The switch is the React web component's core (registry/web/toggle.core.ts, built
// into web/lib), the same code a React app installs. This file keeps the demo: a settings group,
// the sizes on the component page, and the autoplay, which flips the switches one by one.
import { createToggle } from '../lib/toggle.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const ROWS = [['Wi-Fi', true], ['Bluetooth', false], ['Airplane mode', false]];

function mountToggle(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 300 : mode === 'stage' ? 340 : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'tg-demo');
  root.style.width = W + 'px';
  const group = el('div', 'tg-group');
  root.append(group);
  body.append(tile ? fitTile(body, root, W, 3 * 52) : root);

  const switches = ROWS.map(([label, on]) => {
    const row = el('div', 'tg-row');
    const host = el('button');
    host.type = 'button';
    row.append(el('span', 'tg-label', label), host);
    group.append(row);
    let value = on;
    const t = createToggle(host, { value, accessibilityLabel: label, onValueChange: (v) => { value = v; t.update({ value: v }); } });
    sc.onDispose(() => t.destroy());
    return { host, flip() { value = !value; t.update({ value }); } };
  });

  if (mode === 'stage') {
    const sizes = el('div', 'tg-sizes');
    root.append(sizes);
    for (const [size, on] of [['sm', true], ['md', false], ['lg', true]]) {
      const host = el('button');
      host.type = 'button';
      sizes.append(host);
      const t = createToggle(host, { size, defaultValue: on, accessibilityLabel: `Size ${size}` });
      sc.onDispose(() => t.destroy());
    }
  }

  // A real pointer on a switch stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      for (const i of [1, 2, 0, 2, 1, 0]) {
        if (!sc.alive || user) return;
        switches[i].flip();
        await sc.wait(650);
      }
    },
  };
}

export const ENTRIES = {
  toggle: {
    title: 'Toggle',
    note: 'Flip a switch: the thumb breaks into grains that flow across and reassemble.',
    desc: 'An iOS style switch whose thumb is made of grains. At rest it is the familiar white thumb on a capsule track. Flip it and the thumb breaks into grains, leading edge first: they flow to the other end of the track on a slight arc, shrinking mid flight, and reassemble into the thumb there in about 380 ms, while the track fills with the on color behind them. Tap it, or swipe the thumb toward the other side, with a selection tick on every flip. On iOS the thumb, the track layers and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the thumb simply slides.',
    hint: 'Click a switch, or swipe its thumb',
    tileHint: 'Click a switch',
    mount: mountToggle,
    code: add('toggle', 'Toggle', `const [wifi, setWifi] = useState(true);
<Toggle value={wifi} onValueChange={setWifi} accessibilityLabel="Wi-Fi" />

// Uncontrolled, smaller, another on color.
<Toggle defaultValue size="sm" onColor="#0A84FF" />`),
    props: [
      prop('value', 'boolean', '', 'On or off (controlled).'),
      prop('defaultValue', 'boolean', 'false', 'Initial state when uncontrolled.'),
      prop('onValueChange', '(value: boolean) =&gt; void', '', 'Called with the new state on every flip.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Track size: 42 x 26, 51 x 31 (the iOS switch) or 60 x 36 pt.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on every flip.'),
      prop('disabled', 'boolean', 'false', 'No flip, the switch shows at half opacity.'),
      prop('onColor', 'string', 'success token', 'Track fill when on.'),
      prop('offColor', 'string', 'foreground at low alpha', 'Track fill when off.'),
      prop('thumbColor', 'string', 'white', 'Thumb and grain color.'),
      prop('accessibilityLabel', 'string', '', 'Read by screen readers.'),
      prop('className', 'string', '', 'Outer classes (margins, self alignment...). The size comes from the size prop.'),
    ],
  },
};
