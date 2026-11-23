// ConfettiBurst demo. The burst is the React web component's core (registry/web/confetti-burst.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a weekly running
// goal one run short, a glossy button that logs today's run and throws the paper, and the autoplay,
// which logs the run and starts a new week.
import { createConfettiBurst } from '../lib/confetti-burst.js';
import { createGlossyButton } from '../lib/glossy-button.js';
import { el, fitTile, availW, prop, add, onTheme } from './kit.js';

const GOAL = 5;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function mountConfetti(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 300 : mode === 'stage' ? Math.round(Math.min(360, (availW(body) || 360) - 4)) : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'cf-demo');
  root.style.width = W + 'px';
  root.innerHTML = `<div class="cf-eyebrow">This week</div>
    <div class="cf-title" aria-live="polite"><span class="cf-digit"><span>4</span></span>&nbsp;of 5 runs</div>
    <div class="cf-dots" aria-hidden="true">${'<i></i>'.repeat(GOAL)}</div>
    <div class="cf-line">One more to reach your goal</div>
    <div class="cf-bar"><button type="button"></button></div>`;
  const digit = root.querySelector('.cf-digit');
  const dots = [...root.querySelectorAll('.cf-dots i')];
  const line = root.querySelector('.cf-line');
  const btnEl = root.querySelector('.cf-bar button');
  body.append(tile ? fitTile(body, root, W, 230) : root);

  // The paper stays inside the demo box.
  const confetti = createConfettiBurst(body, { container: body });
  sc.onDispose(() => confetti.destroy());
  const colors = () => ({ color: css('--text'), labelColor: css('--bg') });

  let runs = 4;
  /** The count rolls: the old digit leaves upward as the new one comes up from below. */
  const roll = (n) => {
    const old = digit.lastElementChild;
    const next = el('span');
    next.textContent = String(n);
    const up = n > Number(old.textContent);
    next.style.transform = `translateY(${up ? 100 : -100}%)`;
    next.style.opacity = '0';
    digit.append(next);
    void next.offsetWidth;
    next.style.transform = '';
    next.style.opacity = '1';
    old.style.transform = `translateY(${up ? -100 : 100}%)`;
    old.style.opacity = '0';
    sc.wait(440).then(() => old.remove());
  };
  const say = (text) => {
    line.dataset.fade = '';
    sc.wait(200).then(() => { line.textContent = text; delete line.dataset.fade; });
  };
  const show = () => dots.forEach((d, i) => { if (i < runs) d.dataset.on = ''; else delete d.dataset.on; });
  show();

  const press = () => {
    if (runs < GOAL) {
      runs = GOAL;
      roll(runs);
      show();
      const last = dots[GOAL - 1];
      last.dataset.pop = '';
      sc.wait(260).then(() => delete last.dataset.pop);
      say('Goal reached. See you next week.');
      confetti.fire({ from: btnEl });
      btn.update({ label: 'Start a new week' });
    } else {
      runs = 4;
      roll(runs);
      show();
      say('One more to reach your goal');
      btn.update({ label: "Log today's run" });
    }
  };
  const btn = createGlossyButton(btnEl, { label: "Log today's run", size: mode === 'stage' ? 'lg' : 'md', ...colors(), onPress: press });
  sc.onDispose(() => btn.destroy());
  onTheme(sc, () => btn.update(colors()));

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      if (runs >= GOAL) {
        press();
        await sc.wait(900);
      }
      if (!sc.alive || user) return;
      await sc.wait(500);
      if (!sc.alive || user) return;
      press();
      await sc.wait(2200);
      if (!sc.alive || user) return;
      press();
    },
  };
}

export const ENTRIES = {
  'confetti-burst': {
    title: 'ConfettiBurst',
    note: 'A short, quiet burst of paper from a button or a point, gone in under two seconds.',
    desc: 'A short, quiet celebration: a few small pieces of paper thrown up from a point, or from the top of a button, that flutter as they turn, slow down in the air and fall, fading out before they land. Real paper physics, kept small: about forty pieces, under two seconds, one shot per fire(). Pieces are rectangles, strips or dots, in the colors you pass; by default the foreground and muted tokens, so it stays monochrome and follows light and dark mode. On iOS it is simulated and drawn with Skia on the UI thread, in one canvas over the screen that never takes a touch, with a success haptic. On the web one canvas covers the viewport (or the container you pass) during a burst and is removed when the last piece is gone; it never takes a click. Reduced motion: no burst at all, fire() resolves at once.',
    hint: "Log today's run",
    tileHint: "Log today's run",
    mount: mountConfetti,
    code: add('confetti-burst', 'ConfettiBurst', `const confetti = useRef<ConfettiBurstHandle>(null);
const button = useRef<View>(null);

<View style={{ flex: 1 }}>
  <View ref={button}>
    <GlossyButton label="Place order" onPress={() => confetti.current?.fire({ from: button })} />
  </View>
  {/* Last child: the pieces fly over the whole screen. */}
  <ConfettiBurst ref={confetti} />
</View>

// Dots in your brand colors, a bigger throw.
<ConfettiBurst ref={confetti} shapes={['dot', 'rect']} colors={['#FF6B6B', '#FFD93D']} power={1.4} />`),
    webCode: `import { useRef } from 'react';
import { ConfettiBurst, type ConfettiBurstHandle } from '@/components/dissolve/confetti-burst';

const confetti = useRef<ConfettiBurstHandle>(null);
const button = useRef<HTMLButtonElement>(null);

<button ref={button} onClick={() => confetti.current?.fire({ from: button.current! })}>Place order</button>
<ConfettiBurst ref={confetti} />

// Dots in your brand colors, a bigger throw, inside a card.
<ConfettiBurst ref={confetti} shapes={['dot', 'rect']} colors={['#FF6B6B', '#FFD93D']} power={1.4} container={card} />`,
    props: [
      prop('ref.fire', '(at?: { x?, y?, from? }) =&gt; Promise&lt;void&gt;', '', 'Throws one burst: from a point (in the coordinates of the ConfettiBurst view on React Native, of the viewport on the web), from the top of a view or element (from: a ref on React Native, an element on the web), or from the center.'),
      prop('count', 'number', '40', 'Pieces per burst.'),
      prop('colors', 'string[]', '', 'Piece colors. Default: the foreground and muted tokens.'),
      prop('shapes', `('rect' | 'strip' | 'dot')[]`, `['rect', 'strip']`, 'Piece shapes, picked at random.'),
      prop('size', 'number', '8', 'Size of a piece, pt.'),
      prop('spread', 'number', '70', 'Width of the throw, degrees around straight up.'),
      prop('power', 'number', '1', "How hard the pieces are thrown, 1 is a button's worth."),
      prop('container', 'HTMLElement | null', '', 'Web only: draw over this element instead of the viewport.'),
      prop('haptics', 'boolean', 'true', 'A success haptic with each burst (a short vibration on the web, where the browser has it).'),
    ],
  },
};
