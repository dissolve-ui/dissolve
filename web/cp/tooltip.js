// Tooltip demo. The tooltips are the React web component's core (registry/web/tooltip.core.ts, built
// into web/lib), the same code a React app installs. This file keeps the demo: an editor toolbar, the
// four placements on the component page, and the autoplay, which shows the tooltips one by one.
import { createTooltip } from '../lib/tooltip.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const svg = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TOOLS = [
  ['Bold', svg('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>')],
  ['Italic', svg('<path d="M10 5h8M6 19h8M14 5l-4 14"/>')],
  ['Add a link', svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>')],
  ['Comment', svg('<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>')],
  ['Share with your team', svg('<path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>')],
];

function mountTooltip(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 300 : mode === 'stage' ? 360 : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'tt-demo');
  root.style.width = W + 'px';
  const bar = el('div', 'tt-bar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Formatting');
  root.append(bar);
  body.append(tile ? fitTile(body, root, W, 120) : root);

  const tips = TOOLS.map(([label, icon]) => {
    const b = el('button', 'tt-tool', icon);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    bar.append(b);
    const t = createTooltip(b, { content: label });
    sc.onDispose(() => t.destroy());
    return t;
  });

  if (mode === 'stage') {
    const sides = el('div', 'tt-sides');
    root.append(sides);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const b = el('button', 'tt-side', side[0].toUpperCase() + side.slice(1));
      b.type = 'button';
      sides.append(b);
      const t = createTooltip(b, { content: `Placed ${side}`, placement: side });
      sc.onDispose(() => t.destroy());
    }
  }

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  root.addEventListener('pointerover', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      for (const t of tips) {
        await sc.wait(450);
        if (!sc.alive || user) return;
        t.show();
        await sc.wait(900);
        t.hide();
      }
    },
  };
}

export const ENTRIES = {
  tooltip: {
    title: 'Tooltip',
    note: 'A label with an arrow that grows in, flips and slides to stay on screen.',
    desc: 'A small label with an arrow for the element it wraps. On the web, hover or focus it and after the delay the tooltip grows in from it with a soft scale and fade; moving from one tooltip to the next skips the delay. On touch, press and hold: it shows after the delay and stays a moment after the finger lifts. It sits on the side you ask for (top, bottom, left or right), flips to the other side when the edge is too close, and slides along that edge to stay on screen, the arrow still pointing at the element. On the web it lives in document.body, so no overflow clips it, and follows the element on scroll and resize; the bubble has role tooltip, the element gets aria-describedby and Escape hides it. On iOS it renders next to the view and raises itself over its siblings, and the label joins the view\'s accessibility hint. A selection tick as it shows on iOS. Reduced motion: a plain fade.',
    hint: 'Hover or focus a tool',
    tileHint: 'Hover a tool',
    mount: mountTooltip,
    code: add('tooltip', 'Tooltip', `<Tooltip content="Share">
  <IconButton icon="share" accessibilityLabel="Share" onPress={share} />
</Tooltip>

// Below, quicker, a longer label.
<Tooltip content="Archived items are kept 30 days" placement="bottom" delay={250}>
  <InfoIcon />
</Tooltip>`),
    props: [
      prop('content', 'ReactNode', '', 'The label. A string, or any node.'),
      prop('children', 'ReactElement', '', 'The element it describes. On the web, make it focusable for keyboard users.'),
      prop('placement', `'top' | 'bottom' | 'left' | 'right'`, `'top'`, 'Preferred side. It flips to the other side when the edge is too close.'),
      prop('delay', 'number', '400', 'How long to hover, focus or hold before it shows, in ms.'),
      prop('offset', 'number', '8', 'Gap between the element and the arrow tip, in pt.'),
      prop('open', 'boolean', '', 'Shown or hidden (controlled).'),
      prop('onOpenChange', '(open: boolean) =&gt; void', '', 'Called when it wants to show or hide.'),
      prop('disabled', 'boolean', 'false', 'Never shows.'),
      prop('haptics', 'boolean', 'true', 'Selection tick as it shows (iOS).'),
      prop('className', 'string', '', 'Classes of the wrapper around the element (margins...).'),
    ],
  },
};
