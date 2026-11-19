/**
 * BarChart for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (bar-chart.tsx) wraps it; it also runs on its own:
 *
 *   const chart = createBarChart(el, { data: [{ label: 'Mon', value: 8412 }, { label: 'Tue', value: 10230 }] });
 *   chart.update({ data: nextWeek });
 *
 * A bar chart made of small dots. Each bar is a slightly jittered grid of round dots with a
 * rounded top, stacked segments use the chart tokens (pink, violet, yellow). On mount the dots fly
 * in from below and assemble the bars with a short stagger. Hover or drag across the chart: the
 * bar under the pointer stays lit while the others step back, a bubble with the value slides
 * along, and the dots near the pointer scatter away, then spring back. New data sends the dots of
 * the old bars falling and gathers them into the new ones. One canvas, one frame loop that sleeps
 * once the dots have settled.
 */
import { CALM, clamp, el, fontOf, hash, injectStyle, onThemeChange, propsOf, reducedMotion, rgbOf, scope, token, value, vibrate } from './kit';

export type BarToken = 'primary' | 'foreground' | 'foreground-2' | 'foreground-3' | 'chart-1' | 'chart-2' | 'chart-3' | 'accent' | 'success' | 'muted' | 'danger';

export type BarDatum = {
  label: string;
  /** One value per bar. */
  value?: number;
  /** Segments, bottom to top (with stacked). */
  values?: number[];
};

export type BarChartProps = {
  data: BarDatum[];
  /** Plot height. The bubble lane and labels come on top. Default 180. */
  height?: number;
  /** Text of the bubble. Default: grouped digits. */
  formatValue?: (value: number) => string;
  /** Axis labels. Default: compact (1.2k). */
  formatAxis?: (value: number) => string;
  /** Bar under the pointer, then null on release. */
  onSelect?: (index: number | null, datum?: BarDatum) => void;
  /** Draws values as stacked segments. Default false. */
  stacked?: boolean;
  /** Segment colors as theme tokens. Default ['primary'], or ['chart-1', 'chart-2', 'chart-3'] when stacked. */
  colors?: BarToken[];
  /** Rounding of the top of each dot column. Default 6. */
  barRadius?: number;
  /** Space between bars, shrinks on dense charts. Default 6. */
  gap?: number;
  /** Dot budget for the whole chart, the grid gets coarser past it. Default 1400, at most 1600. */
  maxDots?: number;
  /** One label every N bars. Default: all up to 12 bars. */
  labelEvery?: number;
  /** Value axis on the right. Default true. */
  axis?: boolean;
  /** A short vibration per bar change while scrubbing, where the browser has it. Default true. */
  haptics?: boolean;
  /** Bubble classes (background, radius...). */
  bubbleClassName?: string;
};

export type BarChartInstance = {
  update: (props: Partial<BarChartProps>) => void;
  destroy: () => void;
};

const compact = (v: number) => {
  const a = Math.abs(v), trim = (n: number) => String(Math.round(n * 10) / 10);
  return a >= 1e6 ? `${trim(v / 1e6)}M` : a >= 1e3 ? `${trim(v / 1e3)}k` : trim(v);
};
const grouped = (v: number) => Math.round(v).toLocaleString();

const DEFAULTS = {
  height: 180, formatValue: grouped, formatAxis: compact, stacked: false, barRadius: 6, gap: 6, maxDots: 1400, axis: true, haptics: true,
};

/** Enter, data change and reduced motion durations. */
const ENTER = 640, CHANGE = 820, REDUCED = 150;
/** Value axis width, headroom above the tallest bar, how much the other bars dim while scrubbing. */
const AXIS = 34, HEAD = 8, DIM = 0.65;
/** Dot grid: smallest pitch, dot share of the pitch, largest dot, buffer capacity. */
const MIN_PITCH = 4.4, DOT_FILL = 0.7, MAX_DOT = 5, CAPACITY = 1600;
/** Pointer repulsion: radius, push, and the spring that brings the dots back. */
const FLEE = 44, PUSH = 20, K = 260, DAMP = 24;
const TICK_GAP = 25;
const SPRING = { stiffness: 260, damping: 22, eps: 0.002 };

/** Light theme fallbacks of the tokens a series may use (theme.css). */
const FALLBACK: Record<string, string> = {
  primary: 'rgb(28 28 30)', foreground: 'rgb(28 28 30)', accent: 'rgb(10 132 255)', success: 'rgb(52 199 89)', muted: 'rgb(142 142 147)',
  danger: 'rgb(255 59 48)', 'chart-1': 'rgb(255 55 135)', 'chart-2': 'rgb(124 92 255)', 'chart-3': 'rgb(255 196 0)', surface: 'rgb(242 242 247)',
  border: 'rgb(60 60 67 / 0.12)',
};

const CSS = `
:where([data-dissolve="bar-chart"]) { display: flex; flex-direction: column; }
:where(.dissolve-bar-lane) { position: relative; height: 46px; pointer-events: none; }
:where(.dissolve-bar-bubble) {
  position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center;
  padding: 5px 10px; border-radius: 12px; white-space: nowrap; opacity: 0; will-change: transform, opacity; transform-origin: 50% 100%;
  background: var(--dissolve-primary, rgb(28 28 30)); color: var(--dissolve-primary-foreground, rgb(255 255 255));
}
:where(.dissolve-bar-bubble) b { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.25; }
:where(.dissolve-bar-bubble) span { font-size: 11px; font-weight: 500; opacity: .7; line-height: 1.25; }
:where(.dissolve-bar-plot) { position: relative; touch-action: pan-y; user-select: none; -webkit-user-select: none; outline: none; cursor: crosshair; }
:where(.dissolve-bar-plot:focus-visible) { box-shadow: 0 0 0 2px color-mix(in srgb, var(--dissolve-accent, rgb(10 132 255)) 12%, transparent); border-radius: 6px; }
:where(.dissolve-bar-plot) canvas { display: block; }
:where(.dissolve-bar-labels) { display: flex; margin-top: 8px; }
:where(.dissolve-bar-label) {
  flex: 1; min-width: 0; text-align: center; font-size: 11px; font-weight: 500; color: var(--dissolve-muted, rgb(142 142 147));
  font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden;
}
`;

type Shown = { vals: number[][]; top: number; ticks: number[]; tickText: string[] };

const segmentsOf = (d: BarDatum, stacked: boolean) => {
  const raw = (d.values ?? [d.value ?? 0]).map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  return stacked ? raw : [raw.reduce((a, b) => a + b, 0)];
};
const totalOf = (d: BarDatum) => segmentsOf(d, false)[0];

/** Bars, round gridlines and their labels. */
function build(data: BarDatum[], stacked: boolean, formatAxis: (v: number) => string): Shown {
  const vals = data.map((d) => segmentsOf(d, stacked));
  const max = Math.max(0, ...vals.map((s) => s.reduce((a, b) => a + b, 0)));
  if (!max) return { vals, top: 1, ticks: [0], tickText: [formatAxis(0)] };
  const raw = max / 3, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { vals, top, ticks, tickText: ticks.map(formatAxis) };
}

/** The dots of every bar: x, y, segment, bar, delay per dot. */
function layoutDots(s: Shown, plotW: number, height: number, gap: number, barRadius: number, budget: number, enter: boolean) {
  const n = s.vals.length, to: number[] = [];
  if (!n || plotW <= 0) return { to, count: 0, dot: 3 };
  const base = height - 1, scale = (height - 1 - HEAD) / s.top, slot = plotW / n;
  const bw = Math.max(1.5, slot - Math.min(gap, slot * 0.4));
  const sums = s.vals.map((sg) => sg.reduce((a, b) => a + b, 0));
  const area = sums.reduce((a, v) => a + v * scale * bw, 0);
  let pitch = Math.max(MIN_PITCH, Math.sqrt(area / budget));
  for (let tries = 0; tries < 12; tries++) {
    to.length = 0;
    const cols = Math.max(bw >= 5.5 ? 2 : 1, Math.round(bw / pitch)), cp = bw / cols;
    const dot = Math.min(MAX_DOT, Math.max(1.8, Math.min(cp, pitch) * DOT_FILL));
    const r = Math.min(barRadius, bw / 2);
    let maxRows = 1;
    for (let i = 0; i < n; i++) maxRows = Math.max(maxRows, Math.round((sums[i] * scale) / pitch));
    for (let i = 0; i < n; i++) {
      const h = sums[i] * scale;
      if (h < 1) continue;
      const rows = Math.max(1, Math.round(h / pitch)), rp = h / rows;
      const x0 = i * slot + (slot - bw) / 2, yt = base - h, rt = Math.min(r, h / 2), seg = s.vals[i];
      for (let k = 0; k < rows; k++) {
        const y = base - rp * (k + 0.5), v = ((k + 0.5) / rows) * sums[i];
        let acc = 0, sg = 0;
        for (let q = 0; q < seg.length; q++) { acc += seg[q]; sg = q; if (v <= acc) break; }
        for (let c = 0; c < cols; c++) {
          const x = x0 + cp * (c + 0.5);
          // Rounded top: skip the dots outside the corner arcs.
          if (y - yt < rt) {
            const ccx = x < x0 + rt ? x0 + rt : x > x0 + bw - rt ? x0 + bw - rt : x;
            if (Math.hypot(x - ccx, y - (yt + rt)) + dot / 2 > rt + 0.25) continue;
          }
          const j = to.length / 5;
          const delay = enter ? (i / n) * 300 + (k / maxRows) * 220 + hash(j, 3) * 80 : (i / n) * 260 + hash(j, 3) * 140;
          to.push(x + (hash(j, 1) - 0.5) * cp * 0.22, y + (hash(j, 2) - 0.5) * rp * 0.22, sg, i, delay);
        }
      }
    }
    if (to.length / 5 <= budget) return { to, count: to.length / 5, dot };
    pitch *= 1.06;
  }
  to.length = Math.min(to.length, budget * 5);
  return { to, count: to.length / 5, dot: Math.max(1.8, pitch * DOT_FILL) };
}

/** The chart, filling the width of el: bubble lane, plot and labels. */
export function createBarChart(host: HTMLElement, initial: BarChartProps): BarChartInstance {
  injectStyle('dissolve-bar-chart', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();

  host.dataset.dissolve = 'bar-chart';
  const lane = el('div', 'dissolve-bar-lane');
  const bubble = el('div');
  const bubbleValue = el('b'), bubbleLabel = el('span');
  bubble.append(bubbleValue, bubbleLabel);
  lane.append(bubble);
  const plot = el('div', 'dissolve-bar-plot');
  plot.tabIndex = 0;
  plot.setAttribute('role', 'img');
  const cv = el('canvas');
  plot.append(cv);
  const labelsEl = el('div', 'dissolve-bar-labels');
  host.append(lane, plot, labelsEl);
  const ctx = cv.getContext('2d')!;

  let W = 0, H = 0, plotW = 0, dpr = 1;
  let rgb = { pal: [] as number[][], muted: '', border: '' };
  function readColors() {
    const o = p();
    const tok = (name: string) => token(host, name, FALLBACK[name]);
    const surface = rgbOf(tok('surface'));
    const color = (t: BarToken) => {
      if (t !== 'foreground-2' && t !== 'foreground-3') return rgbOf(tok(t)).slice(0, 3);
      // Lighter steps of the ink, mixed toward the surface the chart sits on: calm, monochrome stacks.
      const f = rgbOf(tok('foreground')), k = t === 'foreground-2' ? 0.5 : 0.74;
      return f.slice(0, 3).map((c, i) => Math.round(c + (surface[i] - c) * k));
    };
    const tokens = o.colors ?? (o.stacked ? ['chart-1', 'chart-2', 'chart-3'] : ['primary']);
    rgb = { pal: tokens.map(color), muted: tok('muted'), border: tok('border') };
  }

  // Per dot state: pose and frozen pose (x, y, alpha, diameter, r, g, b), control point, repulsion.
  const P = new Float32Array(CAPACITY * 7), F = new Float32Array(CAPACITY * 7), Q = new Float32Array(CAPACITY * 2), O = new Float32Array(CAPACITY * 4);
  const RND = new Float32Array(CAPACITY * 6);
  for (let j = 0; j < RND.length; j++) RND[j] = hash(Math.floor(j / 6), 10 + (j % 6));
  let pl = { enter: true, count: 0, to: [] as number[], dot: 3 }, live = 0, t0 = 0, tEnd = 0, planned = 0, planKey = '';
  let ptr: { x: number; y: number } | null = null;

  let shown = build(p().data, p().stacked, p().formatAxis), prevShown = shown, active = -1, raf = 0, last = performance.now();
  const draw = () => { if (!raf && sc.alive) raf = requestAnimationFrame(paint); };
  sc.onDispose(() => cancelAnimationFrame(raf));
  const scrub = value(sc, 0, draw), pos = value(sc, 0, draw), gridMix = value(sc, 1, draw);
  const bx = value(sc, 0, () => placeBubble());
  let bubbleW = 0, lastTick = 0;

  /** New layout: freeze the dots where they are and plan their path to the new bars. */
  function plan() {
    const o = p();
    const budget = Math.max(50, Math.min(CAPACITY, Math.round(o.maxDots)));
    const key = `${JSON.stringify(o.data)}|${o.stacked}|${plotW}|${H}|${o.gap}|${o.barRadius}|${budget}`;
    if (!plotW || key === planKey) return;
    planKey = key;
    const enter = planned++ === 0;
    const lay = layoutDots(shown, plotW, H, o.gap, o.barRadius, budget, enter);
    const pc = rgb.pal, base = H - 1, was = live, red = reducedMotion();
    pl = { enter, count: lay.count, to: lay.to, dot: lay.dot };
    F.set(P);
    for (let i = 0; i < Math.max(lay.count, was); i++) {
      const p7 = i * 7, q = i * 6, t = i * 5;
      if (i < lay.count) {
        const tx = lay.to[t], ty = lay.to[t + 1], col = pc[lay.to[t + 2] % pc.length];
        if (enter || i >= was) {
          // Born under the bar, scattered, transparent and small.
          F[p7] = tx + (RND[q + 1] - 0.5) * 44; F[p7 + 1] = base - RND[q + 2] * 26; F[p7 + 2] = 0; F[p7 + 3] = lay.dot * 0.3;
          F[p7 + 4] = col[0]; F[p7 + 5] = col[1]; F[p7 + 6] = col[2];
          Q[i * 2] = (F[p7] + tx) / 2 + (RND[q + 4] - 0.5) * 24; Q[i * 2 + 1] = (F[p7 + 1] + ty) / 2;
        } else {
          // Falls toward the floor on the way to its new bar.
          Q[i * 2] = (F[p7] + tx) / 2 + (RND[q + 1] - 0.5) * 64;
          Q[i * 2 + 1] = Math.min(base - 2, Math.max(F[p7 + 1], ty) + 30 + RND[q + 2] * 60);
        }
      } else {
        // Leaves: falls to the floor and fades.
        Q[i * 2] = F[p7] + (RND[q + 1] - 0.5) * 50; Q[i * 2 + 1] = Math.min(base - 2, F[p7 + 1] + 40);
      }
      if (red) { Q[i * 2] = F[p7]; Q[i * 2 + 1] = F[p7 + 1]; }
    }
    live = Math.max(lay.count, was);
    t0 = performance.now();
    tEnd = t0 + (red ? REDUCED : enter ? ENTER : CHANGE) + 600;
    draw();
  }

  function placeBubble() {
    const x = clamp(bx.v - bubbleW / 2, 0, Math.max(0, W - bubbleW));
    const s = scrub.v;
    bubble.style.opacity = s.toFixed(3);
    bubble.style.transform = `translate3d(${x.toFixed(2)}px,${((1 - s) * 4).toFixed(2)}px,0) scale(${(0.92 + 0.08 * s).toFixed(4)})`;
  }

  function labels() {
    const { data, labelEvery } = p();
    labelsEl.textContent = '';
    const every = labelEvery ?? (data.length <= 12 ? 1 : Math.ceil(data.length / 6));
    data.forEach((d, i) => { const l = el('span', 'dissolve-bar-label'); l.textContent = i % every === 0 ? d.label : ''; labelsEl.append(l); });
    summary();
  }
  const summary = () => plot.setAttribute('aria-label', p().data.map((d) => `${d.label} ${p().formatValue(totalOf(d))}`).join(', '));

  function size() {
    W = host.clientWidth;
    H = p().height;
    plotW = Math.max(0, W - (p().axis ? AXIS : 0));
    dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    labelsEl.style.width = plotW + 'px';
  }

  function paint(now: number) {
    raf = 0;
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    const red = reducedMotion(), base = H - 1, hair = 1 / dpr, axis = p().axis;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Gridlines and axis, the old ones fading out under the new ones.
    ctx.font = `500 10px ${fontOf(host)}`;
    ctx.textAlign = 'left';
    const grid = (g: Shown, alpha: number) => {
      if (alpha <= 0.01) return;
      const scale = (H - 1 - HEAD) / g.top;
      ctx.globalAlpha = alpha;
      for (let k = 0; k < g.ticks.length; k++) {
        const y = Math.round((base - g.ticks[k] * scale) * dpr) / dpr;
        if (k) { ctx.fillStyle = rgb.border; ctx.fillRect(0, y, plotW, hair); }
        if (!axis) continue;
        ctx.fillStyle = rgb.muted;
        ctx.fillText(g.tickText[k], plotW + 6, k ? Math.min(base, Math.max(9, y + 3.5)) : base);
      }
    };
    grid(prevShown, 1 - gridMix.v);
    grid(shown, gridMix.v);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgb.border;
    ctx.fillRect(0, base, plotW, 1);

    // The guide above the active bar.
    const scv = scrub.v, ps = pos.v, n = shown.vals.length;
    if (scv > 0.01 && n) {
      const scale = (H - 1 - HEAD) / shown.top, slot = plotW / n;
      const i0 = clamp(Math.floor(ps), 0, n - 1), i1 = Math.min(n - 1, i0 + 1), f = clamp(ps - i0);
      const sum = (i: number) => shown.vals[i].reduce((a, b) => a + b, 0);
      const h = (sum(i0) * (1 - f) + sum(i1) * f) * scale, cx = ps * slot + slot / 2;
      ctx.globalAlpha = scv * 0.5;
      ctx.fillStyle = rgb.muted;
      ctx.fillRect(Math.round(cx * dpr) / dpr - 0.5, 0, 1, Math.max(0, base - h - 6));
    }

    // Dots.
    const pc = rgb.pal, dur = red ? REDUCED : pl.enter ? ENTER : CHANGE, since = now - t0, dot = pl.dot;
    const fon = !!ptr && !red;
    let moving = 0;
    for (let i = 0; i < live; i++) {
      const p7 = i * 7, t = i * 5, q = i * 6, z = RND[q], inPlan = i < pl.count;
      let tx, ty, ta = 0, ts = dot * 0.3, tr = F[p7 + 4], tg = F[p7 + 5], tb = F[p7 + 6], bar = -9, delay = RND[q + 5] * 140;
      if (inPlan) {
        tx = pl.to[t]; ty = pl.to[t + 1];
        const col = pc[pl.to[t + 2] % pc.length];
        tr = col[0]; tg = col[1]; tb = col[2];
        bar = pl.to[t + 3];
        delay = red ? 0 : pl.to[t + 4];
        ta = 0.8 + 0.2 * z;
        ts = dot * (0.86 + 0.28 * z);
      } else { tx = Q[i * 2]; ty = base - 2; }
      const k = clamp((since - delay) / dur), e = k === 1 ? 1 : CALM(k), u = 1 - e;
      const x = u * u * F[p7] + 2 * u * e * Q[i * 2] + e * e * tx;
      const y = u * u * F[p7 + 1] + 2 * u * e * Q[i * 2 + 1] + e * e * ty;
      let a = F[p7 + 2] + (ta - F[p7 + 2]) * e;
      if (!pl.enter && e > 0 && e < 1) a *= 1 - 0.35 * Math.sin(Math.PI * e);
      const s = F[p7 + 3] + (ts - F[p7 + 3]) * e;
      const r = F[p7 + 4] + (tr - F[p7 + 4]) * e, g = F[p7 + 5] + (tg - F[p7 + 5]) * e, b = F[p7 + 6] + (tb - F[p7 + 6]) * e;
      P[p7] = x; P[p7 + 1] = y; P[p7 + 2] = a; P[p7 + 3] = s; P[p7 + 4] = r; P[p7 + 5] = g; P[p7 + 6] = b;

      // Pointer repulsion with a little random spread, a spring brings the dot back.
      const o = i * 4;
      let gx = 0, gy = 0;
      if (fon) {
        const dx = x - ptr!.x, dy = y - ptr!.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < FLEE) {
          const push = (1 - d / FLEE) * PUSH * (0.6 + 0.8 * RND[q + 3]);
          const ang = (d > 0.01 ? Math.atan2(dy, dx) : RND[q + 4] * 6.283) + (RND[q + 4] - 0.5) * 0.9;
          gx = Math.cos(ang) * push; gy = Math.sin(ang) * push;
        }
      }
      O[o + 2] += (K * (gx - O[o]) - DAMP * O[o + 2]) * dt;
      O[o + 3] += (K * (gy - O[o + 1]) - DAMP * O[o + 3]) * dt;
      O[o] += O[o + 2] * dt;
      O[o + 1] += O[o + 3] * dt;
      if (Math.abs(O[o]) + Math.abs(O[o + 1]) + Math.abs(O[o + 2]) + Math.abs(O[o + 3]) > 0.05) moving = 1;
      else if (!fon) O.fill(0, o, o + 4);

      // The bars away from the pointer step back.
      const near = bar < 0 ? 1 : Math.max(0, 1 - Math.abs(bar - ps));
      const alpha = clamp(a * (1 - scv * DIM * (1 - near)));
      if (alpha < 0.004 || s < 0.1) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.beginPath();
      ctx.arc(x + O[o], y + O[o + 1], s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (now > tEnd && live > pl.count) live = pl.count;

    // Labels far from the pointer step back while scrubbing.
    [...labelsEl.children].forEach((l, i) => { (l as HTMLElement).style.opacity = (1 - scv * 0.5 * (1 - Math.max(0, 1 - Math.abs(i - ps)))).toFixed(3); });
    placeBubble();
    if (fon || moving || now < tEnd) draw();
  }

  /** New data or layout: the grid crossfades, the dots fall and gather. */
  function refresh() {
    const o = p();
    releaseScrub();
    prevShown = shown;
    shown = build(o.data, o.stacked, o.formatAxis);
    labels();
    gridMix.set(0);
    gridMix.to(1, reducedMotion() ? REDUCED : 420, CALM);
    plan();
  }

  function select(i: number) {
    const n = shown.vals.length;
    if (!n || !plotW) return;
    i = clamp(i, 0, n - 1);
    if (i === active) return;
    const jump = active < 0 && scrub.v < 0.05;
    active = i;
    const slot = plotW / n, cx = i * slot + slot / 2;
    const d = p().data[i];
    bubbleValue.textContent = p().formatValue(totalOf(d));
    bubbleLabel.textContent = d.label;
    bubbleW = bubble.offsetWidth;
    if (jump || reducedMotion()) { pos.set(i); bx.set(cx); }
    else { pos.spring(i, SPRING); bx.spring(cx, { ...SPRING, eps: 0.05 }); }
    scrub.to(1, reducedMotion() ? REDUCED : 160, CALM);
    p().onSelect?.(i, d);
    if (p().haptics && performance.now() - lastTick >= TICK_GAP) { lastTick = performance.now(); vibrate(4); }
  }
  function releaseScrub() {
    ptr = null;
    draw();
    if (active < 0) return;
    active = -1;
    scrub.to(0, reducedMotion() ? REDUCED : 250, CALM);
    p().onSelect?.(null);
  }
  const local = (e: PointerEvent) => { const b = cv.getBoundingClientRect(), s = b.width / W || 1; return { x: (e.clientX - b.left) / s, y: (e.clientY - b.top) / s }; };
  const touch = (e: PointerEvent) => { ptr = local(e); draw(); select(Math.floor(ptr.x / (plotW / shown.vals.length))); };

  // Mouse scrubs on hover. Touch: a sideways pan right away, or a 120 ms press and hold.
  let g: { x0: number; y0: number; e: PointerEvent; on: boolean; id: number } | null = null;
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return touch(e);
    const st = { x0: e.clientX, y0: e.clientY, e, on: false, id: e.pointerId };
    g = st;
    sc.wait(120).then(() => {
      if (g !== st || st.on) return;
      st.on = true;
      try { plot.setPointerCapture(st.id); } catch { /* synthetic pointers cannot be captured */ }
      touch(st.e);
    });
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return touch(e);
    if (!g) return;
    if (!g.on) {
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (Math.abs(dy) > 10 && Math.abs(dx) < 6) { g = null; return; }
      if (Math.abs(dx) < 6) return;
      g.on = true;
      try { plot.setPointerCapture(e.pointerId); } catch { /* synthetic pointers cannot be captured */ }
    }
    touch(e);
  };
  const onEnd = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.type !== 'pointerleave') return;
    g = null;
    releaseScrub();
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (k) { e.preventDefault(); select(active < 0 ? 0 : active + k); }
    else if (e.key === 'Escape') releaseScrub();
  };
  plot.addEventListener('pointerdown', onDown);
  plot.addEventListener('pointermove', onMove);
  plot.addEventListener('pointerup', onEnd);
  plot.addEventListener('pointercancel', onEnd);
  plot.addEventListener('pointerleave', onEnd);
  plot.addEventListener('keydown', onKey);
  plot.addEventListener('blur', releaseScrub);

  onThemeChange(sc, () => { readColors(); draw(); });
  const ro = new ResizeObserver(() => {
    if (host.clientWidth === W) return;
    size();
    plan();
    draw();
  });
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());

  const applyBubbleClass = () => { bubble.className = 'dissolve-bar-bubble' + (p().bubbleClassName ? ' ' + p().bubbleClassName : ''); };
  applyBubbleClass();
  readColors();
  size();
  labels();
  plan();

  let dataKey = JSON.stringify(p().data);
  return {
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      const has = (...keys: (keyof BarChartProps)[]) => keys.some((k) => changed.has(k));
      if (changed.has('bubbleClassName')) applyBubbleClass();
      if (has('colors', 'stacked')) readColors();
      if (has('height', 'axis')) size();
      // A new array with the same content is the same data: only new values replay the gather.
      const key = changed.has('data') ? JSON.stringify(p().data) : dataKey;
      if (key !== dataKey || changed.has('stacked')) {
        dataKey = key;
        refresh();
      } else {
        if (changed.has('formatAxis')) shown.tickText = shown.ticks.map(p().formatAxis);
        if (changed.has('labelEvery')) labels();
        else if (changed.has('formatValue')) summary();
      }
      if (has('height', 'axis', 'gap', 'barRadius', 'maxDots')) plan();
      draw();
    },
    destroy() {
      sc.dispose();
      g = null;
      lane.remove();
      plot.remove();
      labelsEl.remove();
      delete host.dataset.dissolve;
    },
  };
}
