// SegmentedControl (registry/segmented-control.tsx), ported raw. The pill and the labels are DOM,
// the grains are drawn on a canvas over the track. Same grid, stagger, arc, timings and curves as
// the native source. Click a segment, or drag across the control and the selection follows.
import { el, clamp, bezier, CALM, isLight, mix, onTheme, loop, fitTile, availW, prop, add } from './kit.js';
const RM = matchMedia('(prefers-reduced-motion: reduce)');

/** As in segmented-control.tsx. */
const SG = { STAGGER: 110, RUN: 290, GHOST_OUT: 90, PILL_AT: 280, PILL_IN: 100, FADE_AT: 340, FADE: 80, LABELS: 360, SLIDE: 260, SHRINK: 0.55, SCATTER: 8, MAX: 180, PITCH: 0.14, OVERLAP: 1.22 };
SG.END = SG.FADE_AT + SG.FADE;
const SIZES = {
  sm: { height: 30, inset: 2, font: 13, icon: 13, gap: 5 },
  md: { height: 36, inset: 3, font: 14, icon: 15, gap: 6 },
  lg: { height: 44, inset: 4, font: 15, icon: 17, gap: 7 },
};
const FLOW = bezier(0.42, 0, 0.12, 1);
/** Room around the track for the grains that arc out of it. */
const PAD = 12;
const sgHash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const arcOf = (w) => Math.min(7, 3 + w * 0.03);

/** Grid points inside the pill capsule: x y arc seed per grain, as grainGrid() in the native source. */
function grainGrid(w, h) {
  let pitch = Math.max(4, h * SG.PITCH);
  for (;;) {
    const cols = Math.max(2, Math.round(w / pitch)), rows = Math.max(2, Math.round(h / pitch));
    const px = w / cols, py = h / rows, r = h / 2, out = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * px, y = (j + 0.5) * py;
      const dx = Math.max(0, Math.abs(x - w / 2) - (w / 2 - r)), dy = y - r;
      if (dx * dx + dy * dy > (r - Math.min(px, py) * 0.3) ** 2) continue;
      const k = out.length;
      out.push([x, y, ((y - r) / r) * 0.8 + (sgHash(k, 3) - 0.5) * 0.7, sgHash(k, 4)]);
    }
    if (out.length <= SG.MAX) return { grid: out, dot: Math.max(px, py) * SG.OVERLAP };
    pitch *= 1.15;
  }
}

const ICONS = {
  list: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 4h7.5M6 8h7.5M6 12h7.5"/><circle cx="2.8" cy="4" r=".9" fill="currentColor" stroke="none"/><circle cx="2.8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="2.8" cy="12" r=".9" fill="currentColor" stroke="none"/></svg>',
  grid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="1.3"/><rect x="9" y="2" width="5" height="5" rx="1.3"/><rect x="2" y="9" width="5" height="5" rx="1.3"/><rect x="9" y="9" width="5" height="5" rx="1.3"/></svg>',
  map: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M1.8 3.6 5.6 2l4.8 1.8L14.2 2.4v10L10.4 14l-4.8-1.8-3.8 1.6z"/><path d="M5.6 2v10.2M10.4 3.8V14"/></svg>',
};

/**
 * One control. items: [{ value, label, icon? }]. Returns { node, select(i), sweep(to, ms), index() }.
 * width: the track width in px.
 */
function segmented(sc, { items, size = 'md', width, start = 0, onChange }) {
  const s = SIZES[size], n = items.length;
  const W = width, H = s.height, seg = (W - s.inset * 2) / n, ph = H - s.inset * 2;
  const { grid, dot } = grainGrid(seg, ph);
  const N = grid.length;

  const node = el('div', `sg sg-${size}`);
  node.style.width = W + 'px';
  node.style.height = H + 'px';
  node.setAttribute('role', 'tablist');
  const mkPill = () => {
    const p = el('div', 'sg-pill');
    p.style.cssText = `width:${seg}px;height:${ph}px;top:${s.inset}px;border-radius:${ph / 2}px`;
    return p;
  };
  const ghost = mkPill(), pill = mkPill();
  const cv = el('canvas', 'sg-cv');
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round((W + PAD * 2) * dpr);
  cv.height = Math.round((H + PAD * 2) * dpr);
  cv.style.cssText = `left:${-PAD}px;top:${-PAD}px;width:${W + PAD * 2}px;height:${H + PAD * 2}px`;
  const ctx = cv.getContext('2d');
  const row = el('div', 'sg-row');
  row.style.padding = `0 ${s.inset}px`;
  const tabs = items.map((it, i) => {
    const b = el('button', 'sg-seg');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.tabIndex = i === start ? 0 : -1;
    const inner = (cls) => `<span class="sg-lbl ${cls}" style="gap:${s.gap}px;font-size:${s.font}px">${it.icon ? `<i style="width:${s.icon}px;height:${s.icon}px">${ICONS[it.icon]}</i>` : ''}<span>${it.label ?? it.value}</span></span>`;
    b.innerHTML = inner('sg-off') + inner('sg-on');
    b.setAttribute('aria-label', it.label ?? it.value);
    row.append(b);
    return { b, off: b.firstChild, on: b.lastChild };
  });
  node.append(ghost, pill, cv, row);

  let pillColor = '#fff';
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    pillColor = isLight() ? '#FFFFFF' : mix(cs.getPropertyValue('--bg').trim() || '#121212', cs.getPropertyValue('--text').trim() || '#FBFBFB', 0.3);
    ghost.style.background = pill.style.background = pillColor;
  };
  readColors();
  onTheme(sc, () => { readColors(); kick(); });

  // Same state as the frame callback of the native source.
  const D = new Float32Array(N * 4), F = new Float32Array(N * 4);
  const L = items.map((_, i) => (i === start ? 1 : 0)), LF = L.slice();
  let target = start, req = false, flying = false, startAt = 0;
  let pillX = s.inset + start * seg, pillA = 1, ghostX = 0, ghostA = 0, ghostA0 = 0, slideFrom = 0;

  const apply = () => {
    pill.style.transform = `translateX(${pillX}px)`;
    pill.style.opacity = pillA;
    ghost.style.transform = `translateX(${ghostX}px)`;
    ghost.style.opacity = ghostA;
    tabs.forEach((t, i) => { t.on.style.opacity = L[i]; t.off.style.opacity = 1 - L[i]; });
  };

  function frame(now) {
    if (!req && !flying) return;
    const reduced = RM.matches, b = target, toX = s.inset + b * seg;
    if (req) {
      req = false;
      for (let i = 0; i < n; i++) LF[i] = L[i];
      if (flying && !reduced) {
        F.set(D);
      } else {
        for (let i = 0; i < N; i++) { F[i * 4] = pillX + grid[i][0]; F[i * 4 + 1] = s.inset + grid[i][1]; F[i * 4 + 2] = 1; F[i * 4 + 3] = 1; }
      }
      ghostX = pillX;
      ghostA0 = pillA;
      slideFrom = pillX;
      startAt = now;
      flying = true;
      if (!reduced) { pillX = toX; pillA = 0; }
    }
    const since = now - startAt;
    const lk = FLOW(clamp(since / (reduced ? SG.SLIDE : SG.LABELS)));
    for (let i = 0; i < n; i++) L[i] = LF[i] + ((i === b ? 1 : 0) - LF[i]) * lk;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W + PAD * 2, H + PAD * 2);
    if (reduced) {
      pillX = slideFrom + (toX - slideFrom) * CALM(clamp(since / SG.SLIDE));
      pillA = 1;
      ghostA = 0;
      if (since >= SG.SLIDE) flying = false;
      return apply();
    }
    const dir = toX >= ghostX ? 1 : -1;
    const reach = Math.min(1, Math.abs(toX - ghostX) / seg);
    const arcAmp = arcOf(seg) * (0.55 + 0.45 * reach);
    const out = clamp((since - SG.FADE_AT) / SG.FADE);
    ctx.fillStyle = pillColor;
    for (let i = 0; i < N; i++) {
      const g = grid[i], d = i * 4;
      const u = g[0] / seg, lead = dir > 0 ? u : 1 - u;
      const delay = (1 - lead) * SG.STAGGER * 0.6 + g[3] * SG.STAGGER * 0.4;
      const run = SG.RUN * (0.85 + 0.3 * sgHash(i, 9));
      const e = FLOW(clamp((since - delay) / run)), bump = Math.sin(Math.PI * e);
      const tx = toX + g[0], ty = s.inset + g[1];
      D[d] = F[d] + (tx - F[d]) * e + (sgHash(i, 5) - 0.5) * SG.SCATTER * bump;
      D[d + 1] = F[d + 1] + (ty - F[d + 1]) * e + g[2] * arcAmp * bump;
      D[d + 2] = (F[d + 2] + (1 - F[d + 2]) * clamp(since / 60)) * (1 - out);
      D[d + 3] = (F[d + 3] + (1 - F[d + 3]) * e) * (1 - SG.SHRINK * bump);
      if (D[d + 2] <= 0.003) continue;
      ctx.globalAlpha = D[d + 2];
      ctx.beginPath();
      ctx.arc(D[d] + PAD, D[d + 1] + PAD, (dot * D[d + 3]) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ghostA = ghostA0 * (1 - clamp(since / SG.GHOST_OUT));
    pillA = clamp((since - SG.PILL_AT) / SG.PILL_IN);
    if (since >= SG.END) {
      flying = false;
      for (let i = 0; i < N; i++) D[i * 4 + 2] = 0;
      ctx.clearRect(0, 0, W + PAD * 2, H + PAD * 2);
      pillA = 1;
      ghostA = 0;
    }
    apply();
  }
  const { kick } = loop(sc, node, frame, () => req || flying);

  function select(i, user = true) {
    i = clamp(i, 0, n - 1);
    if (i === target) return;
    target = i;
    req = true;
    tabs.forEach((t, k) => { t.b.setAttribute('aria-selected', String(k === i)); t.b.tabIndex = k === i ? 0 : -1; });
    if (user) navigator.vibrate?.(4);
    onChange?.(items[i].value, i);
    kick();
  }
  tabs.forEach((t, k) => t.b.setAttribute('aria-selected', String(k === start)));

  // Pointer: a click selects on release, a horizontal drag selects under the finger as it goes.
  const at = (e) => {
    const r = node.getBoundingClientRect(), sx = r.width / W || 1;
    return Math.floor(((e.clientX - r.left) / sx - s.inset) / seg);
  };
  let ptr = null;
  node.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false };
  });
  node.addEventListener('pointermove', (e) => {
    if (!ptr || ptr.id !== e.pointerId) return;
    if (!ptr.drag) {
      const dx = Math.abs(e.clientX - ptr.x), dy = Math.abs(e.clientY - ptr.y);
      if (dy > 12 && dy > dx) { ptr = null; return; }
      if (dx < 6) return;
      ptr.drag = true;
      try { node.setPointerCapture(e.pointerId); } catch {}
      node.classList.add('on');
    }
    select(at(e));
  });
  const end = (e) => {
    if (!ptr || ptr.id !== e.pointerId) return;
    if (!ptr.drag && e.type === 'pointerup') select(at(e));
    ptr = null;
    node.classList.remove('on');
  };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
  // Keyboard: Enter or Space on a tab (click with no pointer), arrows move the selection.
  tabs.forEach((t, k) => t.b.addEventListener('click', (e) => { if (e.detail === 0) select(k); }));
  node.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    select(target + d);
    tabs[target].b.focus();
  });

  apply();

  /** Scripted drag for the autoplay: a finger sliding from segment `from` to `to` over ms. */
  const sweep = (from, to, ms) => new Promise((done) => {
    const t0 = performance.now();
    const step = (now) => {
      if (!sc.alive || ptr) return done();
      const k = clamp((now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      select(Math.floor(from + 0.5 + (to - from) * e), false);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  return { node, select, sweep, index: () => target, busy: () => !!ptr };
}

function mountSegmented(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? 360 : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'sg-demo');
  const periods = ['Day', 'Week', 'Month', 'Year'].map((v) => ({ value: v }));
  const main = segmented(sc, { items: periods, width: W, start: 1 });
  root.append(main.node);
  let small = null;
  if (!tile) {
    small = segmented(sc, { items: [{ value: 'list', label: 'List', icon: 'list' }, { value: 'grid', label: 'Grid', icon: 'grid' }, { value: 'map', label: 'Map', icon: 'map' }], size: 'sm', width: Math.min(248, W) });
    root.append(small.node);
  }
  body.append(tile ? fitTile(body, root, W, 36) : root);

  return {
    async run() {
      if (main.busy()) return;
      for (const i of [2, 3, 0]) {
        main.select(i, false);
        await sc.wait(700);
        if (!sc.alive || main.busy()) return;
      }
      await main.sweep(0, 3, 520);
      await sc.wait(700);
      if (!sc.alive || main.busy()) return;
      main.select(1, false);
      if (small) {
        await sc.wait(500);
        small.select((small.index() + 1) % 3, false);
      }
      await sc.wait(600);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'segmented-control': {
    title: 'SegmentedControl',
    note: 'Pick a segment: the pill breaks into grains that flow over and reassemble.',
    desc: 'An iOS style segmented control whose selection pill is made of grains. At rest it is a clean solid capsule with the soft iOS shadow, on a translucent track that sits on any background. Pick another segment and the pill breaks into grains, leading edge first: they flow to the new segment on a slight arc, shrinking mid flight, and reassemble into the pill there, in about 400 ms. The labels cross fade between their selected and unselected styles along the way. Drag the finger across the control and the selection follows it, the grains re-aiming from wherever they are, with a selection tick on every change. On iOS the pill and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the pill simply slides.',
    hint: 'Click a segment, or drag across the control',
    tileHint: 'Click or drag across',
    mount: mountSegmented,
    code: add('segmented-control', 'SegmentedControl', `const [period, setPeriod] = useState('Week');
<SegmentedControl segments={['Day', 'Week', 'Month', 'Year']} value={period} onChange={setPeriod} />

// Smaller, uncontrolled, a fixed width.
<SegmentedControl segments={['Inbox', 'Archive']} defaultValue="Inbox" size="sm" className="w-56 self-center" />

// Items with icons.
<SegmentedControl
  segments={[
    { value: 'list', label: 'List', icon: ({ color, size }) => <ListIcon color={color} size={size} /> },
    { value: 'grid', label: 'Grid', icon: ({ color, size }) => <GridIcon color={color} size={size} /> },
  ]}
  value={layout}
  onChange={setLayout}
/>`),
    props: [
      prop('segments', '(string | SegmentItem)[]', 'required', 'The segments: plain strings, or { value, label?, icon? } items. icon is a node or a function of { color, size, selected }.'),
      prop('value', 'string', '', 'Selected value (controlled).'),
      prop('defaultValue', 'string', 'first segment', 'Initial value when uncontrolled.'),
      prop('onChange', '(value: string, index: number) =&gt; void', '', 'Called on every selection change, also while dragging across the segments.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Height, inset and type size: 30, 36 or 44 pt.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on every change.'),
      prop('disabled', 'boolean', 'false', 'No selection, the control shows at half opacity.'),
      prop('trackColor', 'string', 'foreground at low alpha', 'Track fill.'),
      prop('indicatorColor', 'string', 'background / lifted gray', 'Pill and grain color. Default: the background token in light mode, a gray lifted off the track in dark mode.'),
      prop('className / labelClassName', 'string', '', 'Track classes (width, margins, self alignment...) and label classes. It stretches to its parent by default.'),
    ],
  },
};
