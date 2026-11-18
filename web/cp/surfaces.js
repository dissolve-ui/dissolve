// Surfaces: CardStack, BeforeAfter (src/dissolve/components/*), ported to the web.
// Same geometry, timings and curves as the native sources. Shown raw: one instance, no screen around it.
import { bezier, CALM, QUAD, value, el, clamp, claimTouch, fitTile, PKG, DIR, prop } from './kit.js';

const MONO = "'Geist Mono', ui-monospace, monospace";

/** Pointer velocity from the last 80 ms of samples, px/s. */
function velocity(samples) {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const a = samples[0], b = samples[samples.length - 1], dt = (b[0] - a[0]) / 1000;
  return dt > 0 ? { vx: (b[1] - a[1]) / dt, vy: (b[2] - a[2]) / dt } : { vx: 0, vy: 0 };
}
function sample(list, e) {
  const now = performance.now();
  list.push([now, e.clientX, e.clientY]);
  while (list.length > 2 && now - list[0][0] > 80) list.shift();
}

/* ======================================================================================
   CardStack (CardStack.tsx): Wallet style stack, tap to focus, drag down to restack.
   ====================================================================================== */

const FOCUS_MS = 560, CYCLE_MS = 420, MINI = 9, MINI_GAP = 22, MINI_TAIL = 30;
const EXIT = bezier(0.4, 0, 1, 1);

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
  const peek = tile ? 44 : 60, radius = tile ? 18 : 20;
  const H = Math.round(W / 1.586), n = CARDS.length, off = W + 24;
  const stackH = (n - 1) * peek + H;
  const focusH = H + MINI_GAP + Math.max(0, n - 2) * MINI + MINI_TAIL;
  const total = Math.max(stackH, focusH);

  const frame = el('div', 'cp-cs');
  frame.style.width = W + 'px';
  frame.style.height = total + 'px';
  frame.setAttribute('role', 'group');
  frame.setAttribute('aria-label', 'Cards');
  if (tile) frame.style.width = W + 'px';
  body.append(tile ? fitTile(body, frame, W, total) : frame);

  let focus = null;
  const target = (i) => {
    if (focus === null) return { y: i * peek, scale: 1, delay: i * 18 };
    if (i === focus) return { y: 0, scale: 1, delay: 0 };
    const k = i < focus ? i : i - 1;
    const m = Math.max(1, n - 2);
    const s = 0.92 + 0.04 * (k / m);
    return { y: H + MINI_GAP + k * MINI - (H * (1 - s)) / 2, scale: s, delay: 40 + k * 22 };
  };

  const cards = CARDS.map((c, i) => {
    const node = el('div', 'cp-cs-card');
    node.style.height = H + 'px';
    node.style.borderRadius = radius + 'px';
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${c.title} card`);
    const clip = el('div', 'cp-cs-clip');
    clip.style.borderRadius = radius + 'px';
    clip.append(cardFace(c));
    node.append(clip);
    frame.append(node);
    const card = { node, i };
    const render = () => {
      const away = Math.min(1, Math.abs(card.tx.v) / W);
      node.style.opacity = (card.op.v * (1 - away * 0.6)).toFixed(3);
      node.style.transform = `translate3d(${card.tx.v.toFixed(2)}px,${card.ty.v.toFixed(2)}px,0) scale(${(card.sc.v * (1 - 0.015 * card.press.v)).toFixed(4)})`;
    };
    card.ty = value(sc, i * peek, render);
    card.tx = value(sc, 0, render);
    card.sc = value(sc, 1, render);
    card.op = value(sc, 1, render);
    card.press = value(sc, 0, render);
    render();
    return card;
  });

  const sync = () => cards.forEach((c) => {
    c.node.style.zIndex = focus === c.i ? n + 10 : c.i;
    c.node.classList.toggle('focused', focus === c.i);
    c.node.setAttribute('aria-pressed', String(focus === c.i));
  });

  const move = (c) => {
    const t = target(c.i), o = { ms: FOCUS_MS };
    c.ty.to(t.y, o.ms, CALM, t.delay);
    c.sc.to(t.scale, o.ms, CALM, t.delay);
    c.tx.to(0, o.ms, CALM);
    return c.op.to(1, 200, QUAD);
  };

  function go(next) {
    focus = next;
    sync();
    cards.forEach(move);
    return sc.wait(FOCUS_MS + 120);
  }

  function cycle(dir) {
    if (focus === null) return;
    const from = focus, to = (focus + dir + n) % n;
    focus = to;
    sync();
    cards.forEach((c) => {
      const t = target(c.i);
      if (c.i === to) {
        // The next card slides in from the side it was swiped toward.
        c.ty.set(t.y); c.sc.set(t.scale); c.op.set(1);
        c.tx.set(dir * off);
        c.tx.to(0, CYCLE_MS, CALM);
      } else if (c.i === from) {
        // The card that just left settles quietly into the compressed stack.
        c.tx.set(0); c.ty.set(t.y); c.sc.set(t.scale); c.op.set(0);
        c.op.to(1, 320, CALM, 80);
      } else move(c);
    });
  }

  function onTap(i) {
    if (focus === null) go(i);
    else if (i !== focus) go(null); // tapping the compressed stack puts everything back
  }

  cards.forEach((c) => {
    const node = c.node;
    let g = null;
    // Touch: a swipe down on the focused card puts it back, any other vertical swipe scrolls the page.
    const claimed = claimTouch(node, (dx, dy) => !!g && focus === c.i && dy > 0);
    node.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      g = { x0: e.clientX, y0: e.clientY, t0: performance.now(), axis: 0, samples: [] };
      sample(g.samples, e);
      c.press.to(1, 120, QUAD);
      try { node.setPointerCapture(e.pointerId); } catch {}
    });
    node.addEventListener('pointermove', (e) => {
      if (!g) return;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      sample(g.samples, e);
      if (!g.axis) {
        if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return;
        if (focus !== c.i) { g.moved = true; c.press.to(0, 260, CALM); return; }
        g.axis = n > 1 && Math.abs(dx) > Math.abs(dy) ? 1 : 2;
        c.press.to(0, 260, CALM);
        if (g.axis === 2 && e.pointerType === 'touch' && !claimed()) { g = null; return; }
        node.classList.add('dragging');
      }
      if (g.axis === 1) { c.tx.set(dx); return; }
      // Down follows the finger, up resists.
      c.ty.set(dy > 0 ? dy * 0.9 : -Math.sqrt(-dy) * 3);
      c.sc.set(1 - Math.min(1, Math.max(0, dy) / 400) * 0.05);
    });
    const end = (e) => {
      if (!g) return;
      const st = g;
      g = null;
      node.classList.remove('dragging');
      c.press.to(0, 260, CALM);
      if (e.type !== 'pointerup' && !st.axis) return;
      const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
      const { vx, vy } = velocity(st.samples);
      if (st.axis === 1) {
        if (Math.abs(dx) > W * 0.28 || Math.abs(vx) > 700) {
          const next = dx < 0 ? 1 : -1;
          c.tx.to(-next * off, 260, EXIT).then((ok) => ok && cycle(next));
        } else c.tx.to(0, 380, CALM);
        return;
      }
      if (st.axis === 2) {
        if (dy > 90 || vy > 800) go(null);
        else { c.ty.to(0, 380, CALM); c.sc.to(1, 380, CALM); }
        return;
      }
      if (!st.moved && performance.now() - st.t0 <= 400) onTap(c.i);
    };
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(c.i); }
      else if (e.key === 'Escape' && focus !== null) go(null);
      else if (focus === c.i && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const next = e.key === 'ArrowRight' ? 1 : -1;
        c.tx.to(-next * off, 260, EXIT).then((ok) => ok && cycle(next));
      }
    });
  });
  sync();

  return {
    async run() {
      if (focus !== null) await go(null);
      await go(1);
      await sc.wait(1100);
      // A calm drag down on the focused card, then release: it goes back to the stack.
      const c = cards[1];
      c.sc.to(0.984, 420, CALM);
      await c.ty.to(130, 420, CALM);
      await sc.wait(120);
      await go(null);
      await sc.wait(300);
    },
  };
}

/* ======================================================================================
   BeforeAfter (BeforeAfter.tsx): drag the divider over two versions of one painting.
   ====================================================================================== */

const KNOB = 40;
const ARROWS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 7.5L5 12l4.5 4.5M14.5 7.5L19 12l-4.5 4.5"/></svg>';

function mountBeforeAfter(body, { sc, mode, initial = 0.42 }) {
  const tile = mode === 'tile', panel = mode === 'panel';
  const frame = el('div', 'cp-ba');
  frame.tabIndex = 0;
  frame.setAttribute('role', 'slider');
  frame.setAttribute('aria-label', 'Before and Vivid comparison');
  frame.setAttribute('aria-valuemin', '0');
  frame.setAttribute('aria-valuemax', '100');
  const height = tile ? 178 : panel ? 240 : 320;
  frame.style.height = height + 'px';
  const src = 'assets/paintings/tuscany.jpg';
  const after = el('div', 'cp-ba-layer', `<img src="${src}" alt="" draggable="false"><i class="cp-ba-grade"></i><i class="cp-ba-lift"></i>`);
  const win = el('div', 'cp-ba-clip');
  const inner = el('div', 'cp-ba-layer', `<img src="${src}" alt="" draggable="false">`);
  win.append(inner);
  const pillB = el('span', 'cp-ba-pill', 'Before');
  pillB.style.left = '14px';
  const pillA = el('span', 'cp-ba-pill', 'Vivid');
  pillA.style.right = '14px';
  const line = el('i', 'cp-ba-line');
  const knob = el('span', 'cp-ba-knob', ARROWS);
  knob.style.top = height / 2 - KNOB / 2 + 'px';
  frame.append(after, win, pillB, pillA, line, knob);
  body.append(frame);

  const W = () => frame.clientWidth;
  let w = W();
  inner.style.width = w + 'px';
  const render = () => {
    const x = pos.v * w;
    // Clip without relayout: the window slides right by x, its content slides back left by x.
    win.style.transform = `translate3d(${(x - w).toFixed(2)}px,0,0)`;
    inner.style.transform = `translate3d(${(w - x).toFixed(2)}px,0,0)`;
    line.style.transform = `translate3d(${(x - 1).toFixed(2)}px,0,0)`;
    knob.style.transform = `translate3d(${(x - KNOB / 2).toFixed(2)}px,0,0) scale(${(1 + grab.v * 0.08).toFixed(4)})`;
    // Pills sit in the top corners and fade as the divider closes in on them.
    const bw = pillB.offsetWidth || 64, aw = pillA.offsetWidth || 56;
    pillB.style.opacity = clamp((x - (14 + bw)) / 44).toFixed(3);
    pillA.style.opacity = (1 - clamp((x - (w - 14 - aw - 44)) / 44)).toFixed(3);
    frame.setAttribute('aria-valuenow', String(Math.round(pos.v * 100)));
  };
  const pos = value(sc, clamp(initial), render);
  const grab = value(sc, 0, render);
  render();
  const ro = new ResizeObserver(() => { const nw = W(); if (nw && nw !== w) { w = nw; inner.style.width = w + 'px'; render(); } });
  ro.observe(frame);
  sc.onDispose(() => ro.disconnect());

  // Pan activates past 4 px sideways and fails past 14 px vertically; a short tap jumps there.
  let g = null;
  frame.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const b = frame.getBoundingClientRect();
    g = { x0: e.clientX, y0: e.clientY, t0: performance.now(), left: b.left, start: pos.v * w, on: false, failed: false };
    grab.to(1, 180, CALM);
  });
  frame.addEventListener('pointermove', (e) => {
    if (!g || g.failed) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.on) {
      if (Math.abs(dy) > 14 && Math.abs(dx) <= 4) { g.failed = true; grab.to(0, 320, CALM); return; }
      if (Math.abs(dx) <= 4) return;
      g.on = true;
      g.start = pos.v * w;
      g.base = e.clientX;
      try { frame.setPointerCapture(e.pointerId); } catch {}
      frame.classList.add('dragging');
    }
    pos.set(clamp((g.start + e.clientX - g.base) / w));
  });
  const end = (e) => {
    if (!g) return;
    const st = g;
    g = null;
    frame.classList.remove('dragging');
    grab.to(0, 320, CALM);
    if (e.type === 'pointerup' && !st.on && !st.failed && performance.now() - st.t0 <= 400) {
      pos.to(clamp((e.clientX - st.left) / w), 560, CALM);
    }
  };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);
  frame.addEventListener('keydown', (e) => {
    const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (k) { e.preventDefault(); pos.to(clamp(pos.v + 0.1 * k), 360, CALM); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); pos.to(e.key === 'Home' ? 0 : 1, 560, CALM); }
  });

  return {
    async run() {
      grab.to(1, 180, CALM);
      await pos.to(0.86, 900, CALM);
      await sc.wait(250);
      await pos.to(0.14, 1100, CALM);
      await sc.wait(250);
      await pos.to(clamp(initial), 800, CALM);
      grab.to(0, 320, CALM);
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
