// Surfaces: CardStack and BeforeAfter demos. Both components are the React web components' cores
// (registry/web/*.core.ts, built into web/lib), the same code a React app installs. This file keeps
// the demos: sizes per mode, the cards and the painting, and the autoplay, which plays with real
// pointer events.
import { createCardStack } from '../lib/card-stack.js';
import { createBeforeAfter } from '../lib/before-after.js';
import { CALM, el, fitTile, tween, AUTO, PKG, DIR, prop } from './kit.js';

/** Calls fn once a real pointer goes down on node, and tells whether one is down right now. */
function userPointer(sc, node) {
  let down = false;
  const lift = (e) => { if (e.isTrusted) down = false; };
  node.addEventListener('pointerdown', (e) => { if (e.isTrusted) down = true; });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  sc.onDispose(() => { removeEventListener('pointerup', lift); removeEventListener('pointercancel', lift); });
  return () => down;
}

/** Where (x, y), in node layout units, is on screen, and the scale of a tile scaled down by fitTile. */
function at(node, x, y) {
  const r = node.getBoundingClientRect(), k = r.width / node.offsetWidth || 1;
  return { x: r.left + x * k, y: r.top + y * k, k };
}

/** A scripted pointer event on target at the screen point p. */
const send = (target, type, p) => target.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: p.x, clientY: p.y }));

/** A finger moving on target from p by (dx, dy) layout units over ms on the calm curve. Resolves with where it ends. */
const drag = async (sc, target, p, dx, dy, ms) => {
  let now = p;
  await tween(sc, ms, (t) => {
    const k = CALM(t);
    now = { x: p.x + dx * p.k * k, y: p.y + dy * p.k * k, k: p.k };
    send(target, 'pointermove', now);
  });
  return now;
};

/* ======================================================================================
   CardStack: Wallet style stack, tap to focus, drag down to restack.
   ====================================================================================== */

const FOCUS_MS = 560;

const CARDS = [
  { kind: 'sunset', tag: 'DEBIT', title: 'Sunset', line: '••••  4021' },
  { kind: 'violet', tag: 'CREDIT', title: 'Violet', line: '••••  7730' },
  { kind: 'lagoon', tag: 'SAVINGS', title: 'Lagoon', line: '••••  1958' },
  { kind: 'aurora', tag: 'TRAVEL', title: 'Aurora', line: '••••  0611' },
];

function cardFace(c) {
  const f = el('div', `cp-cs-face cp-cs-${c.kind}`);
  f.innerHTML = `<div class="cp-cs-strip"><span class="cp-cs-tag">${c.tag}</span><span class="cp-cs-title">${c.title}</span></div><span class="cp-cs-line">${c.line}</span>`;
  return f;
}

function mountCardStack(body, { sc, mode }) {
  const tile = mode === 'tile';
  const avail = body.clientWidth - (tile ? 32 : 0);
  const W = tile ? 260 : Math.round(Math.min(340, avail || 340));
  const peek = tile ? 44 : 60, H = Math.round(W / 1.586), n = CARDS.length;
  const total = Math.max((n - 1) * peek + H, H + 22 + Math.max(0, n - 2) * 9 + 30);

  const host = el('div', 'cp-cs');
  host.style.width = W + 'px';
  host.setAttribute('aria-label', 'Cards');
  body.append(tile ? fitTile(body, host, W, total) : host);

  let focus = null;
  const stack = createCardStack(host, {
    keys: CARDS.map((c) => c.kind),
    peek,
    cardClassName: tile ? 'cp-cs-card cp-cs-tile' : 'cp-cs-card',
    onFocus: (i) => { focus = i; },
  });
  const cards = CARDS.map((c) => {
    const node = stack.slot(c.kind);
    node.append(cardFace(c));
    return node;
  });
  sc.onDispose(() => stack.destroy());
  const user = userPointer(sc, host);

  /** A quick tap on the visible strip of card i. */
  const tap = (i) => { const p = at(cards[i], W / 2, 20); send(cards[i], 'pointerdown', p); send(cards[i], 'pointerup', p); };

  return {
    async run() {
      if (user()) return;
      if (focus !== null) { tap(focus === 0 ? 1 : 0); await sc.wait(FOCUS_MS + 120); }
      tap(1);
      await sc.wait(FOCUS_MS + 120);
      await sc.wait(1100);
      if (user() || focus !== 1) return;
      // A calm drag down on the focused card, then release: it goes back to the stack.
      const from = at(cards[1], W / 2, H / 2);
      send(cards[1], 'pointerdown', from);
      const to = await drag(sc, cards[1], from, 0, 130, 420);
      await sc.wait(120);
      send(cards[1], 'pointerup', to);
      await sc.wait(FOCUS_MS + 120);
      await sc.wait(300);
    },
  };
}

/* ======================================================================================
   BeforeAfter: drag the divider over two versions of one painting.
   ====================================================================================== */

function mountBeforeAfter(body, { sc, mode, initial = 0.42 }) {
  const tile = mode === 'tile', panel = mode === 'panel';
  const host = el('div', 'cp-ba');
  body.append(host);
  let now = initial;
  const ba = createBeforeAfter(host, {
    initial,
    height: tile ? 178 : panel ? 240 : 320,
    afterLabel: 'Vivid',
    handleClassName: 'cp-ba-knob',
    dividerClassName: 'cp-ba-line',
    onChange: (v) => { now = v; },
  });
  const src = 'assets/paintings/tuscany.jpg';
  ba.after.innerHTML = `<img src="${src}" alt="" draggable="false"><i class="cp-ba-grade"></i><i class="cp-ba-lift"></i>`;
  ba.before.innerHTML = `<img src="${src}" alt="" draggable="false">`;
  sc.onDispose(() => ba.destroy());
  const user = userPointer(sc, host);

  return {
    async run() {
      if (user()) return;
      // One calm drag of the divider: far right, far left, then back.
      let p = at(host, now * host.offsetWidth, host.offsetHeight / 2);
      send(host, 'pointerdown', p);
      for (const [to, ms] of [[0.86, 900], [0.14, 1100], [initial, 800]]) {
        p = await drag(sc, host, p, (to - now) * host.offsetWidth, 0, ms);
        now = to;
        if (to !== initial) await sc.wait(250);
        if (!sc.alive || user()) break;
      }
      send(host, 'pointerup', p);
      await sc.wait(320);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */


export const ENTRIES = {
  'card-stack': {
    title: 'CardStack',
    note: 'Wallet style cards. Tap one, drag it down to restack.',
    desc: 'A Wallet style stack. Cards overlap and show their top strip; tap one and it comes forward while the others slide down and compress under it. Drag the focused card down to put it back, swipe it sideways to go to the next one. One calm curve, no bounce, and a fixed height so nothing around it relayouts.',
    hint: 'Tap a card, drag it down to restack',
    tileHint: 'Tap a card',
    mount: mountCardStack,
    code: `// npx ${PKG} add card-stack
import { CardStack } from '${DIR}/card-stack';

<CardStack
  items={cards}
  keyExtractor={(c) => c.id}
  renderCard={(c) => <PaymentCard card={c} />}
  onFocus={setActive}
/>`,
    props: [
      prop('items', 'T[]', 'required', 'The cards, top of the stack first.'),
      prop('renderCard', '(item: T, index: number) =&gt; ReactNode', 'required', 'Renders one card face. It is clipped to the card radius.'),
      prop('cardHeight', 'number', 'width / 1.586', 'Card height. The default is the ISO payment card ratio.'),
      prop('peek', 'number', '60', 'Visible strip of each card in the stack.'),
      prop('onFocus', '(index: number | null) =&gt; void', '', 'Called with the focused index, or null when back to the stack.'),
      prop('keyExtractor', '(item: T, index: number) =&gt; string', '', 'Stable keys for the cards.'),
      prop('haptics', 'boolean', 'true', 'Light impact on focus, soft on restack, a tick when cycling.'),
      prop('className', 'string', '', 'Container: margins, padding.'),
      prop('cardClassName', 'string', `'rounded-[20px]' + shadow`, 'Card chrome: corner radius and shadow. Replaces the default, a soft shadow cast upward on the card behind.'),
    ],
  },
  'before-after': {
    title: 'BeforeAfter',
    note: 'Drag the divider to compare two versions.',
    desc: 'Compare two versions of an image. Drag the round handle, or anywhere on the frame, or tap to send the divider there. The before layer is clipped to the left of the divider without relayout, and the pills fade as the divider reaches them.',
    hint: 'Drag the divider, or tap anywhere',
    tileHint: 'Drag the divider',
    mount: mountBeforeAfter,
    code: `// npx ${PKG} add before-after
import { Image } from 'expo-image';
import { BeforeAfter } from '${DIR}/before-after';

<BeforeAfter
  height={320}
  initial={0.42}
  afterLabel="Vivid"
  renderBefore={({ width, height }) => <Image source={raw} style={{ width, height }} />}
  renderAfter={({ width, height }) => <Image source={edited} style={{ width, height }} />}
/>`,
    props: [
      prop('before / after', 'ReactNode', '', 'The two versions, left and right of the divider.'),
      prop('renderBefore / renderAfter', '(size) =&gt; ReactNode', '', 'Render props given the frame size, for images that need explicit dimensions.'),
      prop('initial', 'number', '0.5', 'Initial divider position, 0 (all after) to 1 (all before).'),
      prop('height', 'number', '320', 'Frame height.'),
      prop('beforeLabel', 'string', `'Before'`, 'Left pill.'),
      prop('afterLabel', 'string', `'After'`, 'Right pill.'),
      prop('labels', 'boolean', 'true', 'Shows the two pills.'),
      prop('onChange', '(value: number) =&gt; void', '', 'Divider position (0..1) when a drag or a tap settles.'),
      prop('haptics', 'boolean', 'true', 'A tick at the middle, a light impact at both edges.'),
      prop('className', 'string', `'rounded-[20px] bg-dissolve-surface-2'`, 'Frame: radius, placeholder background, margins.'),
      prop('handleClassName', 'string', '', 'Round handle.'),
      prop('dividerClassName', 'string', '', 'Divider line.'),
      prop('pillClassName', 'string', '', 'Before and After pills.'),
      prop('pillTextClassName', 'string', `'text-[12px] font-semibold text-white'`, 'Pill labels.'),
    ],
  },
};
