// Marquee demo. The rows are the React web component's core (registry/web/marquee.core.ts, built
// into web/lib), the same code a React app installs. This file keeps the demo: what people say about
// an app, and under it what the app does, drifting the other way, slower. The rows scroll on their
// own; the autoplay eases the top row to a stop and back, as a hover does.
import { createMarquee } from '../lib/marquee.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const QUOTES = [
  ['The calmest app on my phone.', 'Maya Ruiz'],
  ['I stopped dreading Monday planning.', 'Tom Becker'],
  ['Feels like it was always part of iOS.', 'Lena Park'],
  ['Set up in a minute, used every day since.', 'Sam Okafor'],
  ['Quiet, fast, and it never nags.', 'Inès Moreau'],
];
const FEATURES = ['Offline first', 'End to end encrypted', 'Home Screen widgets', 'Apple Watch', 'Family sharing', 'No ads, ever', 'iCloud sync', 'Dark mode'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function mountMarquee(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 340 : mode === 'stage' ? Math.round(Math.min(640, (availW(body) || 640) - 4)) : Math.round((availW(body) || 360) - 4);
  const root = el('div', 'mq-demo');
  root.style.width = W + 'px';
  const a = el('div');
  const b = el('div');
  root.append(a, b);
  body.append(tile ? fitTile(body, root, W, 140) : root);

  const fade = W >= 560 ? 96 : 40;
  const top = createMarquee(a, { speed: 36, gap: 12, fade, accessibilityLabel: 'What people say' });
  const bottom = createMarquee(b, { speed: 24, gap: 8, direction: 'right', fade, accessibilityLabel: 'Features' });
  top.content.innerHTML = QUOTES.map(([q, who]) => `<figure class="mq-quote"><p>${esc(q)}</p><span>${esc(who)}</span></figure>`).join('');
  bottom.content.innerHTML = FEATURES.map((f) => `<span class="mq-pill">${esc(f)}</span>`).join('');
  sc.onDispose(() => { top.destroy(); bottom.destroy(); });

  // A real pointer on a row stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  root.addEventListener('pointerover', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      // The rows cruise on their own: the script slows the top row to a stop, then lets it go.
      await sc.wait(1600);
      if (!sc.alive || user) return;
      top.update({ speed: 0 });
      await sc.wait(1400);
      if (!sc.alive) return;
      top.update({ speed: 36 });
      await sc.wait(1600);
    },
  };
}

export const ENTRIES = {
  marquee: {
    title: 'Marquee',
    note: 'An endless row that scrolls on its own: hover or press to stop, drag to scrub.',
    desc: 'An endless row of logos, words or cards that scrolls on its own, seamless at any width: the row is repeated as many times as the box needs and wraps without a seam, measured again when the box or the content resizes. Hover it (on the web) or press it and it eases to a stop; leave or let go and it eases back to speed. Drag it to scrub, with inertia: let go with a flick and it coasts on, then settles back to its cruise, while a vertical swipe still scrolls the page. The edges fade out: a mask on the web, so it works over any background, a gradient into fadeColor on iOS, where the motion runs on the UI thread. Copies are hidden from screen readers and, on the web, from the tab order; links work in every copy, and keyboard focus inside pauses it. Reduced motion: it does not scroll by itself, dragging still works.',
    hint: 'Hover or press a row, drag and flick it',
    tileHint: 'Drag a row',
    mount: mountMarquee,
    code: add('marquee', 'Marquee', `<Marquee speed={36} accessibilityLabel="What people say">
  {quotes.map((q) => <QuoteCard key={q.id} quote={q} />)}
</Marquee>

// The other way, slower, tighter, on a card.
<Marquee speed={24} gap={8} direction="right" fade={32} fadeColor={cardColor}>
  {features.map((f) => <Pill key={f} label={f} />)}
</Marquee>`),
    props: [
      prop('children', 'ReactNode', '', 'The items of the row, once. The copies that fill the row are made for you.'),
      prop('speed', 'number', '40', 'Cruise speed, in pt per second.'),
      prop('direction', `'left' | 'right'`, `'left'`, 'Which way the row travels.'),
      prop('pauseOnHover', 'boolean', 'true', 'Eases to a stop under the mouse (web).'),
      prop('pauseOnPress', 'boolean', 'true', 'Eases to a stop while pressed.'),
      prop('draggable', 'boolean', 'true', 'Drag to scrub, with inertia.'),
      prop('fade', 'number', '48', 'Width of the faded edges, in pt. 0 for none.'),
      prop('fadeColor', 'string', 'background token', 'The color the edges fade into on iOS: the color of the surface the row sits on. The web uses a mask.'),
      prop('gap', 'number', '12', 'Space between items, and between the end of the row and its next copy, in pt.'),
      prop('accessibilityLabel', 'string', '', 'Read by screen readers for the whole row.'),
      prop('className', 'string', '', 'Outer classes (margins, padding...).'),
    ],
    nativeOnly: ['fadeColor'],
  },
};
