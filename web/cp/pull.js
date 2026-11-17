// PullToRefresh (registry/pull-to-refresh.tsx), ported raw. Same ring, timings and curves as the
// native source. On desktop the pull is a mouse drag down on the list, or a wheel past its top.
import { CALM, value, el, clamp, play, snapshot, FONT, claimTouch } from './kit.js';

const PKG = 'react-native-dissolve';
const prop = (name, type, def, desc) => ({ name, type, def, desc });
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const D = (ms, floor = 0) => (RM.matches ? floor : ms);

const CSS = `
.pr { position: relative; display: flex; flex-direction: column; overflow: hidden; text-align: left; isolation: isolate; user-select: none; -webkit-user-select: none; color: var(--text); }
.pr-view { position: relative; flex: 1; overflow: hidden; touch-action: pan-y; cursor: grab; outline: none; }
.pr-view.on { cursor: grabbing; }
.pr-list { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
.pr-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; }
.pr-row + .pr-row::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 0.5px; background: var(--line); }
.pr-name, .pr-amt { font-size: 17px; line-height: 22px; letter-spacing: -0.025em; white-space: nowrap; }
.pr-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.pr-amt { flex: none; color: var(--muted); font-variant-numeric: tabular-nums; }
.pr-cv { position: absolute; left: 0; top: 0; pointer-events: none; }
.pr-fit { position: relative; flex: none; }
.pr-fit > * { position: absolute; left: 0; top: 0; }
`;
function injectStyle() {
  if (document.getElementById('pr-style')) return;
  const s = document.createElement('style');
  s.id = 'pr-style';
  s.textContent = CSS;
  document.head.append(s);
}

function availW(body) {
  const cs = getComputedStyle(body);
  return body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/** Scales a node of natural size (w, h) down to fit the tile body. */
function fitTile(body, node, w, h) {
  const cs = getComputedStyle(body);
  const aw = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const s = Math.min(1, aw / w, ah / h);
  const box = el('div', 'pr-fit');
  box.style.width = w * s + 'px';
  box.style.height = h * s + 'px';
  node.style.transform = `scale(${s})`;
  node.style.transformOrigin = '0 0';
  box.append(node);
  return box;
}

/* ======================================================================================
   PullToRefresh (pull-to-refresh.tsx)
   ====================================================================================== */

const FEED = [
  ['Maya Chen', '+$46.50'], ['Blue Bottle', '\u2212$6.25'], ['Jonah Reyes', '\u2212$120.00'], ['Payroll', '+$3,240.00'],
  ['Whole Foods', '\u2212$82.17'], ['Lena Park', '+$975.00'], ['Lyft', '\u2212$38.90'], ['Spotify', '\u2212$16.99'],
].map(([name, amount]) => ({ name, amount }));
const INCOMING = [['Priya Natarajan', '+$50.00'], ['Sweetgreen', '\u2212$14.75'], ['Diego Alvarez', '+$220.00'], ['Apple', '\u2212$2.99']].map(([name, amount]) => ({ name, amount }));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Ring geometry, as in pull-to-refresh.tsx. */
const PR = { N: 52, RADIUS: 13, DOT: 2.7, SPEED: Math.PI * 2, MIN_SPIN: 700, DUST: 820, SETTLE: 520, MOVE: 420, FLY: 240, FLY_STAGGER: 50, LAND: 90, GATHER: 820, LOAD: 1400 };
const CALM_CSS = 'cubic-bezier(0.32, 0.72, 0, 1)';
const TAU = Math.PI * 2;
const prHash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
/** Per grain: ring angle, ring radius, scatter x y, arrival delay, random. */
const SEEDS = Array.from({ length: PR.N }, (_, i) => {
  const side = prHash(i, 2) < 0.5 ? -1 : 1;
  return [(i / PR.N) * TAU, PR.RADIUS + (prHash(i, 1) - 0.5) * 3.2, side * (24 + prHash(i, 3) * 120), (prHash(i, 4) - 0.5) * 70, 0.72 * (i / PR.N) + 0.28 * prHash(i, 5), prHash(i, 6)];
});

function mountPull(body, { sc, mode }) {
  injectStyle();
  const tile = mode === 'tile';
  const CW = tile ? 300 : mode === 'stage' ? 340 : Math.round(Math.min(330, availW(body) || 320));
  const CH = tile ? 360 : mode === 'stage' ? 520 : 420;
  const T = 80, H = Math.round(T * 2.6);

  const frame = el('div', 'pr');
  frame.style.width = CW + 'px';
  frame.style.height = CH + 'px';
  const view = el('div', 'pr-view');
  view.tabIndex = 0;
  view.setAttribute('role', 'list');
  view.setAttribute('aria-label', 'Activity, pull down to refresh');
  const list = el('div', 'pr-list');
  const cv = el('canvas', 'pr-cv');
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(CW * dpr);
  cv.height = Math.round(CH * dpr);
  cv.style.width = CW + 'px';
  cv.style.height = CH + 'px';
  view.append(list, cv);
  frame.append(view);
  body.append(tile ? fitTile(body, frame, CW, CH) : frame);
  const ctx = cv.getContext('2d');

  let incoming = 0;
  /** One row per item. Rows keep their node: a refresh only adds the new one. */
  const rowOf = (t) => el('div', 'pr-row', `<span class="pr-name">${esc(t.name)}</span><span class="pr-amt">${t.amount}</span>`);
  FEED.forEach((t) => { const r = rowOf(t); r.setAttribute('role', 'listitem'); list.append(r); });

  let ink = '#fff';
  const readInk = () => { ink = getComputedStyle(frame).getPropertyValue('--text').trim() || '#fff'; };
  readInk();
  const mo = new MutationObserver(() => { readInk(); kick(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  sc.onDispose(() => mo.disconnect());

  // Pull state: raw finger travel, the rubber banded pull shown, the list scroll.
  let raw = 0, sy = 0, phase = 'idle', phaseAt = 0, closeAt = -1e9, armed = false, rot = -Math.PI / 2, dustCy = 0, flying = false;
  let busy = null;
  const P = new Float32Array(PR.N * 6);
  /** Per grain landing point on the new row: x y, in view coordinates. */
  const AIM = new Float32Array(PR.N * 2);
  const band = (d) => (d < T ? d : T + (d - T) * 0.5);
  const pull = value(sc, 0, () => { apply(); kick(); });
  const maxScroll = () => Math.max(0, list.offsetHeight - view.clientHeight);
  const apply = () => { list.style.transform = `translateY(${pull.v - sy}px)`; };
  /** Ring closes once per drag: a short pulse stands in for the rigid haptic. */
  const track = () => {
    if (phase !== 'idle' || armed || pull.v < T) return;
    armed = true;
    closeAt = performance.now();
  };
  const setPhase = (p) => {
    phase = p;
    phaseAt = performance.now();
    if (p === 'done' && !flying) {
      const cx = CW / 2;
      for (let i = 0; i < PR.N; i++) {
        const k = i * 6, dx = P[k] - cx, dy = P[k + 1] - dustCy, d = Math.hypot(dx, dy) || 1, push = 30 + SEEDS[i][5] * 90;
        P[k + 4] = (dx / d) * push + (prHash(i, 7) - 0.5) * 40;
        P[k + 5] = (dy / d) * push - 50 - prHash(i, 8) * 60;
      }
    }
    kick();
  };

  // The ring, drawn from the same pose math as the native frame callback.
  let raf = 0, last = 0;
  const kick = () => { if (!raf && sc.alive) { last = performance.now(); raf = requestAnimationFrame(paint); } };
  sc.onDispose(() => cancelAnimationFrame(raf));
  function paint(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const reduced = RM.matches;
    const vis = pull.v, since = now - phaseAt;
    const g = Math.min(1, vis / T);
    const cy = vis < T ? vis / 2 : vis - T / 2, cx = CW / 2;
    if (phase !== 'done') dustCy = cy;
    if (phase === 'idle') rot = -Math.PI / 2 + (vis / T) * 0.9;
    else if (phase === 'spin' && !reduced) rot += PR.SPEED * Math.min(1, since / 400) * dt;
    const sc_ = now - closeAt;
    const pulse = !reduced && sc_ < 300 ? 1 + 0.16 * Math.sin((Math.PI * sc_) / 300) : 1;
    const spinMix = phase === 'spin' && !reduced ? Math.min(1, since / 300) : 0;
    const fadeIn = Math.min(1, vis / 14), tSec = now / 1000;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    ctx.save();
    ctx.beginPath();
    // The gap above the list while pulling, the band above the rows for the dust, all of it in flight.
    ctx.rect(0, 0, CW, phase !== 'done' ? Math.max(0, vis) : flying ? CH : H);
    ctx.clip();
    ctx.fillStyle = ink;
    let visible = false;
    for (let i = 0; i < PR.N; i++) {
      const S = SEEDS[i], k = i * 6;
      let x, y, a, size = PR.DOT;
      if (phase === 'done') {
        if (reduced) {
          x = P[k]; y = P[k + 1]; a = P[k + 2] * (1 - Math.min(1, since / 220));
        } else if (flying) {
          // Pinch into a knot at the ring center, then hand over to the stream that builds the row.
          const delay = S[5] * PR.FLY_STAGGER, run = PR.FLY - PR.FLY_STAGGER;
          const q = clamp((since - delay) / run), e = CALM(q);
          x = P[k] + (AIM[i * 2] - P[k]) * e;
          y = P[k + 1] + (AIM[i * 2 + 1] - P[k + 1]) * e;
          const f = clamp((since - delay - run) / PR.LAND);
          a = (P[k + 2] + (0.95 - P[k + 2]) * e) * (1 - f);
          size = P[k + 3] * (1 - 0.4 * f);
        } else {
          const delay = S[5] * 110, t = Math.max(0, since - delay) / 1000;
          x = P[k] + P[k + 4] * t;
          y = P[k + 1] + P[k + 5] * t + 0.5 * 980 * t * t;
          const q = clamp((since - delay) / (PR.DUST - 110));
          a = P[k + 2] * (1 - q) * (1 - q);
          size = P[k + 3] * (1 - 0.45 * q);
        }
      } else {
        const ang = S[0] + rot;
        const rr = S[1] * pulse + (phase === 'spin' && !reduced ? Math.sin(tSec * 3.1 + i * 1.7) * 0.7 : 0);
        const rx = cx + Math.cos(ang) * rr, ry = cy + Math.sin(ang) * rr;
        if (reduced) {
          x = rx; y = ry; a = g * 0.9;
        } else {
          const gi = clamp((g - S[4] * 0.55) / 0.45), e = 1 - (1 - gi) ** 3, wob = (1 - e) * 3;
          const fx = cx + S[2] + Math.sin(tSec * 1.3 + i) * wob, fy = cy + S[3] + Math.cos(tSec * 1.1 + i * 0.7) * wob;
          x = fx + (rx - fx) * e;
          y = fy + (ry - fy) * e;
          a = (0.12 + 0.83 * e) * fadeIn;
          size = PR.DOT * (0.55 + 0.45 * e);
          if (spinMix > 0) a = a * (1 - spinMix) + (0.22 + 0.78 * (S[0] / TAU) ** 1.6) * spinMix;
        }
        P[k] = x; P[k + 1] = y; P[k + 2] = a; P[k + 3] = size;
      }
      if (a <= 0.003) continue;
      visible = true;
      ctx.globalAlpha = Math.min(1, a);
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (visible || phase !== 'idle' || vis > 0.01) raf = requestAnimationFrame(paint);
  }

  // A row as drawn, for its entrance. Layout units, scaled to the on screen size (tiles).
  function snapRow(row) {
    const r = row.getBoundingClientRect(), s = r.width / row.offsetWidth || 1;
    return snapshot(r.width, r.height, (x) => {
      x.scale(s, s);
      x.textBaseline = 'middle';
      const text = (n, align = 'left') => {
        const b = n.getBoundingClientRect(), ns = getComputedStyle(n);
        const bx = (b.left - r.left) / s, by = (b.top - r.top) / s, bw = b.width / s, bh = b.height / s;
        x.font = `${ns.fontWeight} ${ns.fontSize} ${FONT}`;
        x.fillStyle = ns.color;
        x.textAlign = align;
        let str = n.textContent;
        while (str.length > 1 && x.measureText(str).width > bw + 1) str = str.slice(0, -2) + '…';
        x.fillText(str, align === 'right' ? bx + bw : bx, by + bh / 2 + 0.5);
      };
      text(row.querySelector('.pr-name'));
      text(row.querySelector('.pr-amt'), 'right');
    });
  }

  /** Adds the new row on top. The rows already there keep their node and glide down (FLIP). */
  function insert(t, hidden) {
    const rows = [...list.children];
    const was = rows.map((n) => n.getBoundingClientRect().top);
    const row = rowOf(t);
    row.setAttribute('role', 'listitem');
    if (hidden) row.style.opacity = '0';
    list.prepend(row);
    if (!RM.matches) {
      rows.forEach((n, i) => {
        const s = n.getBoundingClientRect().width / n.offsetWidth || 1;
        const dy = (was[i] - n.getBoundingClientRect().top) / s;
        if (Math.abs(dy) < 0.5) return;
        n.style.transition = 'none';
        n.style.transform = `translateY(${dy}px)`;
      });
      void list.offsetHeight;
      rows.forEach((n) => {
        if (!n.style.transform) return;
        n.style.transition = `transform ${PR.MOVE}ms ${CALM_CSS}`;
        n.style.transform = '';
        n.addEventListener('transitionend', () => { n.style.transition = ''; }, { once: true });
      });
    }
    return row;
  }

  async function refresh() {
    setPhase('spin');
    raw = 0;
    pull.to(T, D(320, 120), CALM);
    await sc.wait(Math.max(PR.MIN_SPIN, PR.LOAD));
    if (!sc.alive) return;
    // The new row lands hidden while the rest of the list makes room for it.
    const t = INCOMING[incoming++ % INCOMING.length];
    const animate = !RM.matches;
    sy = 0;
    apply();
    const row = insert(t, animate);
    if (!animate) {
      setPhase('done');
      await pull.to(0, D(PR.SETTLE, 200), CALM);
      setPhase('idle');
      return;
    }
    // Where the row sits once the list is back at the top, in view and window coordinates.
    const vr = view.getBoundingClientRect(), s = vr.width / view.offsetWidth || 1;
    const rr = row.getBoundingClientRect();
    const lift = (pull.v - sy) * s;
    const box = { x: rr.left, y: rr.top - lift, w: rr.width, h: rr.height };
    // The ring pinches into a knot at its center, and the row streams out of that same knot.
    for (let i = 0; i < PR.N; i++) {
      const r = 1.5 + prHash(i, 11) * 3, a = prHash(i, 12) * Math.PI * 2;
      AIM[i * 2] = CW / 2 + Math.cos(a) * r;
      AIM[i * 2 + 1] = dustCy + Math.sin(a) * r;
    }
    const knot = { x: vr.left + (CW / 2) * s - 5, y: vr.top + dustCy * s - 5, width: 10, height: 10 };
    const source = snapRow(row);
    flying = true;
    setPhase('done');
    // One gesture: the list eases back while the rows reflow and the grains fly.
    const settle = pull.to(0, PR.SETTLE, CALM);
    await sc.wait(PR.FLY - PR.LAND);
    if (!sc.alive) return;
    await sc.track(play({ source, ...box, preset: 'stream', direction: 'in', target: knot, duration: PR.GATHER, grain: 2 })).done;
    if (!sc.alive) return;
    row.style.opacity = '';
    await settle;
    flying = false;
    setPhase('idle');
  }

  /** Finger up: past the line it refreshes, short of it the grains scatter back out. */
  function release() {
    view.classList.remove('on');
    armed = false;
    if (phase !== 'idle') return busy;
    if (pull.v >= T) {
      busy = refresh().finally(() => { busy = null; });
      return busy;
    }
    raw = 0;
    return pull.to(0, D(380, 200), CALM);
  }

  /** One drag step in layout px: down pulls past the top, up scrolls the list. */
  function move(d) {
    if (d > 0) {
      if (sy > 0) { const u = Math.min(sy, d); sy -= u; d -= u; }
      if (d > 0 && phase === 'idle') raw += d;
    } else {
      if (raw > 0) { const u = Math.min(raw, -d); raw -= u; d += u; }
      if (d < 0) sy = clamp(sy - d, 0, maxScroll());
    }
    if (phase === 'idle') pull.set(band(raw));
    else apply();
    track();
  }

  let ptr = null;
  view.addEventListener('pointerdown', (e) => {
    if (busy || e.button > 0) return;
    const s = view.getBoundingClientRect().width / view.offsetWidth || 1;
    ptr = { id: e.pointerId, y: e.clientY, s };
    // Grab a list still easing back: carry on from where it is, no jump.
    raw = pull.v < T ? pull.v : T + (pull.v - T) * 2;
    armed = false;
    view.classList.add('on');
    try { view.setPointerCapture(e.pointerId); } catch {}
  });
  // Touch: a swipe down is the pull, any other swipe scrolls the page.
  const claimed = claimTouch(view, (dx, dy) => dy > 0 && !!ptr);
  view.addEventListener('pointermove', (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const d = (e.clientY - ptr.y) / ptr.s;
    ptr.y = e.clientY;
    if (e.pointerType === 'touch' && !claimed()) return;
    move(d);
  });
  const up = (e) => { if (!ptr || e.pointerId !== ptr.id) return; ptr = null; release(); };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);

  // Wheel: scrolls the list; past its top it pulls, and the refresh lands once the wheel rests.
  let wheelT = 0;
  view.addEventListener('wheel', (e) => {
    if (busy || ptr) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const atTop = sy <= 0 && dy < 0, pulling = raw > 0;
    if (!atTop && !pulling && dy > 0 && sy >= maxScroll()) return; // let the page scroll on
    e.preventDefault();
    if (atTop || pulling) {
      if (!pulling) armed = false;
      raw = Math.max(0, raw - dy * 0.6);
      pull.set(band(raw));
      track();
      clearTimeout(wheelT);
      wheelT = setTimeout(() => { if (raw > 0 && !ptr) release(); }, 160);
    } else {
      sy = clamp(sy + dy, 0, maxScroll());
      apply();
    }
  }, { passive: false });
  sc.onDispose(() => clearTimeout(wheelT));
  view.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!busy && phase === 'idle') { pull.set(T); busy = refresh().finally(() => { busy = null; }); }
  });

  // Scripted pull for the autoplay: a calm drag down past the line, a short hold, release.
  const drag = (to, ms) => new Promise((done) => {
    const from = raw, t0 = performance.now();
    const step = (now) => {
      if (!sc.alive || ptr) return done();
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      move(from + (to - from) * e - raw);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  return {
    async run() {
      if (busy) return busy;
      sy = 0;
      raw = 0;
      armed = false;
      apply();
      await drag(T * 0.55, 520);
      await sc.wait(160);
      await drag(T * 1.7, 760);
      await sc.wait(260);
      if (!sc.alive || ptr) return;
      await release();
      await sc.wait(500);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

const add = (id, name, usage) => `// npx ${PKG} add ${id}
import { ${name} } from '@/components/dissolve/${id}';

${usage}`;

export const ENTRIES = {
  'pull-to-refresh': {
    title: 'PullToRefresh',
    note: 'Pull the feed down, release: the new row builds itself from the ring.',
    desc: 'Wraps a list. Pull it down past the top and grains drift in from scattered positions to gather into a ring, 1:1 with the pull, with a 0.5 rubber band past the threshold. At the threshold the ring closes with a rigid tick. Release past it and the ring spins while onRefresh runs, the list held under it. When the promise settles, the items already there glide to their new place while the list eases back to the top, all on the calm curve, and the ring grains fly to the new items and build them in grains. Nothing new, or onRefresh threw: the grains fall away as dust. Released early, the grains scatter back out. Wrap each item in PullItem with a stable id: the ids there when the refresh starts are remembered, any other one is new. It works for any layout, rows, a bento grid, wrapped cards of any size. On iOS it rides the native overscroll of the scroll view, so nothing fights the scroll.',
    hint: 'Drag the list down and let go, or scroll up past the top',
    tileHint: 'Pull the list down',
    mount: mountPull,
    glyph: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11 2.5v5M8.6 5.4 11 7.8l2.4-2.4"/><circle cx="11" cy="14.5" r="5" stroke-dasharray="0.1 2.6" stroke-width="2"/></svg>',
    code: add('pull-to-refresh', 'PullToRefresh, PullItem', `<PullToRefresh onRefresh={reload}>
  {items.map((item) => (
    <PullItem key={item.id} id={item.id}>
      <Row tx={item} />
    </PullItem>
  ))}
</PullToRefresh>

// Any layout: a bento grid of cards.
<PullToRefresh onRefresh={reload} contentContainerStyle={grid}>
  {cards.map((card) => (
    <PullItem key={card.id} id={card.id} style={{ width: '47%' }} className="h-36 rounded-3xl bg-dissolve-surface p-4">
      <Card card={card} />
    </PullItem>
  ))}
</PullToRefresh>

// Your own list: spread scroll on it.
<PullToRefresh onRefresh={reload} threshold={96} color="accent">
  {(scroll) => (
    <Animated.FlatList
      {...scroll}
      data={items}
      renderItem={({ item }) => <PullItem id={item.id}><Row tx={item} /></PullItem>}
    />
  )}
</PullToRefresh>`),
    props: [
      prop('children', 'ReactNode | (scroll) =&gt; ReactNode', 'required', 'List content, wrapped in an Animated.ScrollView. Or a render prop: spread scroll on your own Animated.FlatList or Animated.ScrollView.'),
      prop('onRefresh', '() =&gt; Promise&lt;void&gt;', 'required', 'Runs while the ring spins. Update your data before it resolves: the new items are built right after.'),
      prop('threshold', 'number', '80', 'Pull distance that arms the refresh, also the height held while it runs.'),
      prop('haptics', 'boolean', 'true', 'Rigid when the ring closes, Success when done, Warning if onRefresh throws.'),
      prop('color', 'PullToken', `'foreground'`, `Grain color as a theme token: 'foreground', 'muted', 'primary', 'accent', 'success', 'chart-1', 'chart-2'.`),
      prop('rebuild', 'boolean', 'true', 'Build the new PullItems from the ring grains when the refresh lands. Off, they just show. Needs DissolveProvider.'),
      prop('contentContainerStyle', 'StyleProp&lt;ViewStyle&gt;', '', 'Content container of the built in ScrollView (plain children only).'),
      prop('className', 'string', '', 'Root classes (background, radius, margins...).'),
      prop('PullItem', '{ id, className?, style? }', '', 'Wrap each item of the content. id: stable key of the item, any id not there when the refresh started is new. className and style draw the item (captured with it); size and position keys of style (width, flex, margin...) go to its outer box.'),
    ],
  },
};
