// ScratchCard demo. The card is the React web component's core (registry/web/scratch-card.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: the size per
// mode, the reward under the foil, Again, and the autoplay, which scratches with real pointer events.
import { createScratchCard } from '../lib/scratch-card.js';
import { el, fitTile, availW, AUTO, prop, add } from './kit.js';

const BRUSH = 38;

function mountScratch(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 300 : mode === 'stage' ? 340 : Math.round(Math.min(320, (availW(body) || 320) - 8));
  const H = Math.round(W * 0.62);

  const root = el('div', 'sc');
  const host = el('div');
  root.append(host);
  const again = el('button', 'sc-again', 'Again');
  again.type = 'button';
  if (!tile) root.append(again);
  body.append(tile ? fitTile(body, root, W, H + 8) : root);

  let revealed = false;
  const card = createScratchCard(host, {
    width: W,
    height: H,
    brush: BRUSH,
    className: 'sc-card',
    contentClassName: 'sc-content',
    onReveal: () => { revealed = true; },
  });
  card.slot.innerHTML = '<span class="sc-kicker">YOU WON</span><span class="sc-amount">$25</span><span class="sc-code">CODE SPRING25</span>';
  sc.onDispose(() => card.destroy());
  const reset = () => { revealed = false; card.reset(); };
  again.addEventListener('click', reset);

  // A real pointer on the card stops the script.
  let user = false;
  const lift = (e) => { if (e.isTrusted) user = false; };
  host.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  sc.onDispose(() => { removeEventListener('pointerup', lift); removeEventListener('pointercancel', lift); });

  /** A pointer event at (x, y) in card units, where the card sits on screen (tiles are scaled). */
  const send = (type, x, y) => {
    const r = host.getBoundingClientRect(), s = r.width / host.offsetWidth || 1;
    host.querySelector('.sc-card')?.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: r.left + x * s, clientY: r.top + y * s }));
  };

  /** A quick zigzag with a little wobble, like a thumb. Stops on reveal or when a real pointer comes. */
  const stroke = (pts, speed) => new Promise((res) => {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
    const t0 = performance.now();
    const step = (now) => {
      if (!sc.alive || user) return res();
      let dist = Math.min(total, ((now - t0) / 1000) * speed), i = 0;
      while (i < segs.length - 1 && dist > segs[i]) { dist -= segs[i]; i++; }
      const k = segs[i] ? Math.min(1, dist / segs[i]) : 1;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
      send('pointermove', x + Math.sin(now / 60) * 1.5, y + Math.cos(now / 75) * 1.5);
      if (revealed || ((now - t0) / 1000) * speed >= total) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  return {
    async run() {
      if (user) return;
      if (revealed || card.progress() > 0) { reset(); await sc.wait(500); }
      const m = BRUSH * 0.55, ys = [], pts = [];
      for (let y = m; y <= H - m + 1; y += BRUSH * 0.82) ys.push(y);
      ys.forEach((y, i) => { const l = m * 0.8, r = W - m * 0.8; pts.push(i % 2 ? [r, y] : [l, y], i % 2 ? [l, y + BRUSH * 0.41] : [r, y + BRUSH * 0.41]); });
      send('pointerdown', ...pts[0]);
      await stroke(pts, 820);
      send('pointerup', ...pts.at(-1));
      if (revealed) await sc.wait(1100);
      await sc.wait(1400);
      if (sc.alive && !user) reset();
      await sc.wait(400);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'scratch-card': {
    title: 'ScratchCard',
    note: 'Scratch the glossy foil, past half the rest turns to dust.',
    desc: 'A lottery style card with a metal foil over any content: a reward, a promo code. The foil is one shader, a brushed silver gradient with a fine grain, a faint holographic tint, a bevel lit along the edge and a specular band. The whole card tilts in 3D under the finger, up to 9 degrees with perspective, and the light moves with it, then it springs back flat on release. Scratching erases the foil along a ragged stroke, like a coin or a nail (chipped stamps, a width that follows the speed, rough ends), and sheds it as grains that flick off and fall, with light selection ticks. A coarse grid tracks the scratched share: past the threshold, the rest of the foil dissolves from the last touch, Success haptic, onReveal. Reduced motion keeps the card flat and fades the foil instead.',
    hint: 'Scratch the foil with the mouse or a finger',
    tileHint: 'Scratch the foil',
    mount: mountScratch,
    code: add('scratch-card', 'ScratchCard', `<ScratchCard onReveal={claim}>
  <Text className="text-[40px] font-bold text-dissolve-foreground">$25</Text>
</ScratchCard>

// Gold foil, a bigger brush, reset from a ref.
const card = useRef<ScratchCardHandle>(null);
<ScratchCard ref={card} color="#D9B26F" label="Scratch for your code" brush={44} threshold={0.6}>
  <PromoCode code="SPRING25" />
</ScratchCard>
card.current?.reset();`),
    props: [
      prop('children', 'ReactNode', '', 'What the foil hides, centered on the card.'),
      prop('width / height', 'number', '320 / 200', 'Card size in points.'),
      prop('radius', 'number', '24', 'Corner radius.'),
      prop('color', 'string', `'#C3C8D0'`, 'Foil base color. A warm tone like #D9B26F gives gold.'),
      prop('label', 'string', `'Scratch to reveal'`, 'Text printed on the foil, erased with it. Empty hides it.'),
      prop('brush', 'number', '38', 'Scratch stroke width in points.'),
      prop('threshold', 'number', '0.55', 'Share of the foil to scratch before the rest dissolves.'),
      prop('tilt', 'number', '9', 'Max tilt in degrees under the finger. 0 keeps the card flat. Off under reduced motion.'),
      prop('haptics', 'boolean', 'true', 'Selection ticks while scratching, Success on reveal.'),
      prop('disabled', 'boolean', 'false', 'No scratching, the card still shows.'),
      prop('onReveal', '() =&gt; void', '', 'Called once the foil is gone.'),
      prop('onScratchStart', '() =&gt; void', '', 'Called on the first stroke after mount or reset.'),
      prop('className / contentClassName', 'string', '', 'Card classes (background, border...) and the classes of the box that centers the children.'),
      prop('ref', 'ScratchCardHandle', '', 'reset() puts the foil back, reveal() dissolves it now, progress() gives the scratched share.'),
    ],
  },
};
