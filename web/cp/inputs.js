// Inputs: SlideToConfirm, OTPInput, NumberTicker (src/dissolve/components/*), ported raw.
// Same timings, curves and thresholds as the native sources. Only the component, centered.
import { CALM, QUAD, IN_OUT_CUBIC, value, el, clamp, mix, rectOf, play, snapshot, FONT, isLight } from './kit.js';

const PKG = 'react-native-dissolve';
const DIR = '@/components/dissolve';
const prop = (name, type, def, desc) => ({ name, type, def, desc });
const SOFT_CSS = 'cubic-bezier(0.45, 0, 0.2, 1)';

/* ======================================================================================
   SlideToConfirm (SlideToConfirm.tsx)
   ====================================================================================== */

const CHEVRON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const CHECK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';

function mountSlide(body, { sc, mode }) {
  const label = 'Slide to pay 42 €', doneLabel = 'Paid';
  const H = 60, pad = 5, knob = H - pad * 2, threshold = 0.88, resetAfter = 1600;
  const light = isLight();
  // Native defaults in light. On the dark site the dark knob and fill are inverted so they read.
  const C = light
    ? { track: '#F2F2F7', fill: '#1C1C1E', knob: '#1C1C1E', ink: '#FFFFFF', text: '#8E8E93', shine: '#FFFFFF' }
    : { track: '#26282C', fill: '#F2F4F7', knob: '#F2F4F7', ink: '#12151A', text: '#8E8E93', shine: '#FFFFFF' };
  const done = '#34C759';

  const track = el('div', 'cp-slide');
  track.style.cssText = `height:${H}px;border-radius:${H / 2}px;background:${C.track}`;
  track.tabIndex = 0;
  track.setAttribute('role', 'button');
  track.setAttribute('aria-label', label);
  const fill = el('div', 'cp-slide-fill');
  fill.style.borderRadius = H / 2 + 'px';
  const text = el('span', 'cp-slide-label');
  text.textContent = label;
  const doneText = el('span', 'cp-slide-label cp-slide-done');
  doneText.textContent = doneLabel;
  const k = el('div', 'cp-slide-knob');
  k.style.cssText = `left:${pad}px;top:${pad}px;width:${knob}px;height:${knob}px;color:${C.ink}`;
  const chev = el('span', 'cp-slide-ic', CHEVRON);
  const spin = el('span', 'cp-slide-ic', '<i class="cp-slide-spinner"></i>');
  spin.firstChild.style.borderColor = C.ink;
  spin.firstChild.style.borderTopColor = 'transparent';
  const check = el('span', 'cp-slide-ic', CHECK);
  k.append(chev, spin, check);
  track.append(fill, text, doneText, k);
  body.append(track);

  const W = () => track.clientWidth;
  const max = () => Math.max(1, W() - knob - pad * 2);
  let phase = 'idle', angle = 0, sweep = 0, textW = 0;

  const render = () => {
    const p = x.v / max(), t = tone.v;
    fill.style.width = (x.v + knob + pad * 2).toFixed(2) + 'px';
    fill.style.background = mix(C.fill, done, t);
    fill.style.opacity = (phase === 'idle' ? Math.min(1, 0.15 + p) : 1).toFixed(3);
    k.style.transform = `translate3d(${x.v.toFixed(2)}px,0,0)`;
    k.style.background = mix(C.knob, '#FFFFFF', t);
    text.style.opacity = ((1 - Math.min(1, p * 1.6)) * (1 - t)).toFixed(3);
    doneText.style.opacity = t.toFixed(3);
    chev.style.opacity = phase === 'idle' ? '1' : '0';
    spin.style.opacity = phase === 'loading' ? '1' : '0';
    spin.style.transform = `rotate(${angle.toFixed(1)}deg)`;
    check.style.opacity = t.toFixed(3);
  };
  const x = value(sc, 0, render);
  const tone = value(sc, 0, render);
  render();

  // Shimmer: an 80 px light band sweeps across the label, linear, every 2.2 s.
  text.style.backgroundImage = `linear-gradient(90deg, ${C.text}, ${C.shine}, ${C.text})`;
  text.style.backgroundColor = C.text;
  let last = performance.now();
  const loop = (now) => {
    if (!sc.alive) return;
    const dt = now - last;
    last = now;
    sweep = (sweep + dt / 2200) % 1;
    if (!textW) textW = text.offsetWidth;
    text.style.backgroundPosition = `${(-80 + (textW + 160) * sweep).toFixed(1)}px 0`;
    if (phase === 'loading') { angle = (angle + (dt / 900) * 360) % 360; render(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const setPhase = (next) => {
    phase = next;
    track.setAttribute('aria-busy', String(next === 'loading'));
    tone.to(next === 'done' ? 1 : 0, 320, QUAD);
    if (next === 'idle') x.to(0, 420, CALM);
    render();
  };

  async function confirm() {
    setPhase('loading');
    await sc.wait(1400); // onConfirm: a 1.4 s payment
    setPhase('done');
    track.setAttribute('aria-label', doneLabel);
    await sc.wait(resetAfter);
    setPhase('idle');
    track.setAttribute('aria-label', label);
    await sc.wait(440);
  }

  let g = null, busy = null;
  track.addEventListener('pointerdown', (e) => {
    if (phase !== 'idle' || busy || e.button > 0) return;
    g = { last: e.clientX, samples: [[performance.now(), e.clientX]] };
    try { track.setPointerCapture(e.pointerId); } catch {}
    track.classList.add('dragging');
  });
  track.addEventListener('pointermove', (e) => {
    if (!g) return;
    x.set(clamp(x.v + e.clientX - g.last, 0, max()));
    g.last = e.clientX;
    const now = performance.now();
    g.samples.push([now, e.clientX]);
    while (g.samples.length > 2 && now - g.samples[0][0] > 80) g.samples.shift();
  });
  const end = () => {
    if (!g) return;
    const s = g.samples;
    g = null;
    track.classList.remove('dragging');
    const [t0, x0] = s[0], [t1, x1] = s[s.length - 1];
    const vx = t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
    if (x.v > max() * threshold || (vx > 1200 && x.v > max() * 0.5)) {
      busy = x.to(max(), 160, CALM).then((ok) => (ok ? confirm() : null)).finally(() => (busy = null));
    } else x.to(0, 380, CALM);
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);

  // Scripted slide: a calm drag to the end, the same lock, load and confirm.
  async function run() {
    if (phase !== 'idle' || busy || g) return busy;
    busy = (async () => {
      await x.to(max() * 0.94, 820, IN_OUT_CUBIC);
      await sc.wait(60);
      if (await x.to(max(), 160, CALM)) await confirm();
    })().finally(() => (busy = null));
    return busy;
  }
  track.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); run(); }
  });
  return { run };
}

/* ======================================================================================
   OTPInput (OTPInput.tsx)
   ====================================================================================== */

const CORRECT = '123456';

function mountOTP(body, { sc, mode }) {
  const length = 6, gap = 8, H = mode === 'tile' ? 50 : 56, fontSize = mode === 'tile' ? 23 : 26, radius = 14;
  const light = isLight();
  const C = light
    ? { color: '#1C1C1E', box: '#F5F5F5', border: '#E5E5EA', active: '#1C1C1E', glow: '#E6E6EA', success: '#34C759', successFill: '#EAF9EE', error: '#FF3B30', errorFill: '#FFEFEE' }
    : { color: '#F2F4F7', box: '#1E2024', border: '#33363C', active: '#F2F4F7', glow: '#2C2F35', success: '#34C759', successFill: '#15301D', error: '#FF453A', errorFill: '#3A1C1B' };

  const wrap = el('div', 'cp-otp');
  const row = el('div', 'cp-otp-row');
  row.style.gap = gap + 'px';
  const digitsLayer = el('div', 'cp-otp-row cp-otp-digits');
  digitsLayer.style.gap = gap + 'px';
  const input = el('input', 'cp-otp-input');
  Object.assign(input, { type: 'text', inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: length, spellcheck: false });
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('aria-label', `${length} digit code`);
  const reset = el('button', 'cp-reset cp-otp-reset');
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.style.visibility = 'hidden';
  const shaker = el('div', 'cp-otp-shake');
  shaker.append(row, digitsLayer, input);
  wrap.append(shaker);
  body.append(wrap);
  if (mode !== 'tile') body.append(reset);

  let code = '', phase = 'idle', focused = false, run = 0;

  // Per slot: active (0..1), tone (-1 error, 0, 1 success), pop (lift), plus the digit's landing.
  const slots = Array.from({ length }, (_, i) => {
    const box = el('div', 'cp-otp-box');
    box.style.cssText = `height:${H}px;border-radius:${radius}px`;
    const cell = el('div', 'cp-otp-cell');
    cell.style.height = H + 'px';
    const glyph = el('span', 'cp-otp-glyph');
    glyph.style.fontSize = fontSize + 'px';
    cell.append(glyph);
    row.append(box);
    digitsLayer.append(cell);
    const s = { box, cell, glyph, caret: null };
    const draw = () => {
      const x = sweep.v * (length + 2) - 1 - i;
      const glow = sweep.v === 0 ? 0 : Math.max(0, 1 - Math.abs(x) / 1.4);
      const base = rgbHex(mix(C.border, C.active, s.a.v));
      const t = s.tone.v;
      const border = t < 0 ? mix(base, C.error, -t) : mix(base, C.success, t);
      const fillBase = rgbHex(mix(C.box, C.glow, glow));
      const fill = t < 0 ? mix(fillBase, C.errorFill, -t) : mix(fillBase, C.successFill, t);
      const bw = 1 + 0.5 * Math.max(s.a.v, Math.abs(t));
      box.style.background = fill;
      box.style.boxShadow = `inset 0 0 0 ${bw.toFixed(2)}px ${border}`;
      const sc2 = 1 + s.pop.v * 0.05;
      box.style.transform = cell.style.transform = sc2 === 1 ? '' : `scale(${sc2.toFixed(4)})`;
      const gc = t < 0 ? mix(C.color, C.error, -t) : mix(C.color, C.success, t);
      glyph.style.color = gc;
      const p = s.land.v;
      glyph.style.opacity = p.toFixed(3);
      glyph.style.transform = `translateY(${((1 - p) * 5).toFixed(2)}px) scale(${(0.72 + 0.28 * p).toFixed(4)})`;
    };
    s.draw = draw;
    s.a = value(sc, 0, draw);
    s.tone = value(sc, 0, draw);
    s.pop = value(sc, 0, draw);
    s.land = value(sc, 0, draw);
    return s;
  });
  const sweep = value(sc, 0, () => slots.forEach((s) => s.draw()));
  slots.forEach((s) => s.draw());

  function syncActive() {
    const active = Math.min(code.length, length - 1);
    slots.forEach((s, i) => {
      const on = phase === 'idle' && i === active && code.length < length;
      if (s.on !== on) { s.on = on; s.a.to(on ? 1 : 0, 180, CALM); }
      // One caret, recreated on every keystroke so its blink restarts fully lit, like UIKit.
      s.caret?.remove();
      s.caret = null;
      if (on && focused) {
        s.caret = el('i', 'cp-otp-caret');
        s.caret.style.cssText = `height:${Math.round(fontSize * 1.05)}px;background:${C.active}`;
        s.box.append(s.caret);
      }
    });
    input.setAttribute('aria-description', code.length ? `${code.length} of ${length} digits entered` : '');
  }

  function setCode(next) {
    const prev = code;
    code = next;
    input.value = next;
    slots.forEach((s, i) => {
      const ch = next[i] ?? '';
      if (ch === (prev[i] ?? '')) return;
      s.glyph.textContent = ch;
      if (ch) { s.land.set(0); s.land.to(1, 220, CALM); } else s.land.set(0);
    });
    syncActive();
  }

  function setPhase(next) {
    phase = next;
    slots.forEach((s, i) => {
      if (next === 'success') {
        s.tone.to(1, 260, CALM, i * 40);
        s.pop.to(1, 130, CALM, i * 40).then((ok) => ok && s.pop.to(0, 260, CALM));
      } else if (next === 'error') s.tone.to(-1, 200, CALM);
      else s.tone.to(0, 260, CALM);
    });
    reset.style.visibility = next === 'success' ? '' : 'hidden';
    reset.tabIndex = next === 'success' ? 0 : -1;
    syncActive();
  }

  // The sweep loops left to right (1.1 s, ease in out) while the code is being checked.
  let sweeping = false;
  async function sweepLoop() {
    sweeping = true;
    while (sweeping && sc.alive) {
      sweep.set(0);
      await sweep.to(1, 1100, QUAD);
    }
  }

  // Three damped swings on a sine curve.
  const shake = value(sc, 0, () => { shaker.style.transform = shake.v ? `translate3d(${shake.v.toFixed(2)}px,0,0)` : ''; });
  const SIN = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  async function doShake() {
    for (const [to, d] of [[-11, 55], [9, 85], [-6, 80], [4, 75], [-2, 70], [0, 65]]) await shake.to(to, d, SIN);
  }

  // The digit layer exactly as drawn: glyphs centered in their cells, in their current color.
  function digitsSnapshot() {
    const r = digitsLayer.getBoundingClientRect();
    const src = snapshot(r.width, r.height, (ctx) => {
      ctx.font = `600 ${fontSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      slots.forEach((s) => {
        if (!s.glyph.textContent) return;
        const b = s.glyph.getBoundingClientRect(), c = s.cell.getBoundingClientRect();
        ctx.fillStyle = s.glyph.style.color;
        ctx.fillText(s.glyph.textContent, c.left - r.left + c.width / 2, b.top - r.top + b.height / 2 + 1);
      });
    });
    return { src, r };
  }

  async function verify(full) {
    const id = ++run;
    const refocus = focused;
    setPhase('pending');
    sweepLoop();
    await sc.wait(900); // the demo's verify(): 900 ms round trip
    sweeping = false;
    sweep.to(0, 160, QUAD);
    if (id !== run || !sc.alive) return;
    if (full === CORRECT) {
      setPhase('success');
      if (focused) sc.wait(280).then(() => input.blur());
      return;
    }
    setPhase('error');
    doShake();
    await sc.wait(520);
    if (id !== run || !sc.alive) return;
    const { src, r } = digitsSnapshot();
    digitsLayer.style.opacity = '0';
    await sc.track(play({ source: src, x: r.left, y: r.top, w: r.width, h: r.height, preset: 'dust', duration: 900, grain: 2, origin: 'left' })).done;
    if (id !== run || !sc.alive) return;
    setCode('');
    digitsLayer.style.opacity = '';
    setPhase('idle');
    if (refocus) input.focus({ preventScroll: true });
  }

  function accept(text) {
    if (phase !== 'idle') { input.value = code; return; } // Ignore keys while verifying.
    const next = text.replace(/\D/g, '').slice(0, length);
    if (next !== input.value) input.value = next;
    if (next === code) return;
    setCode(next);
    if (next.length === length) verify(next);
  }
  input.addEventListener('input', () => accept(input.value));
  input.addEventListener('focus', () => { focused = true; input.setSelectionRange(input.value.length, input.value.length); syncActive(); });
  input.addEventListener('blur', () => { focused = false; syncActive(); });
  // Keep the caret at the end, so typing always appends and Backspace removes the last digit.
  input.addEventListener('select', () => { if (input.selectionStart !== input.value.length) input.setSelectionRange(input.value.length, input.value.length); });

  function clear() {
    run++;
    sweeping = false;
    setCode('');
    setPhase('idle');
  }
  reset.addEventListener('click', () => { clear(); input.focus({ preventScroll: true }); });
  syncActive();

  return {
    // Scripted: a wrong code shakes and turns to dust, then the right one goes green.
    async run() {
      clear();
      for (const ch of '123465') { accept(code + ch); await sc.wait(80); }
      while (phase !== 'idle' && sc.alive) await sc.wait(100);
      await sc.wait(250);
      for (const ch of CORRECT) { accept(code + ch); await sc.wait(80); }
      await sc.wait(1000 + 900);
      if (mode === 'tile') clear();
    },
  };
}

/** rgb(r,g,b) from mix() back to #rrggbb, so it can be mixed again. */
function rgbHex(c) {
  if (c[0] === '#') return c;
  const m = c.match(/\d+/g);
  return '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');
}

/* ======================================================================================
   NumberTicker (NumberTicker.tsx)
   ====================================================================================== */

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const MINUS = '−';
const SLACK = 6;

function separatorsFor(locale) {
  try {
    const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true }).format(12345.6);
    const marks = s.replace(/[0-9]/g, '');
    if (marks.length >= 2) return { group: marks[0], decimal: marks[marks.length - 1] };
    if (marks.length === 1) return { group: '', decimal: marks[0] };
  } catch {}
  return { group: ',', decimal: '.' };
}

/** Cells keyed by their place, not their index, so the units column stays the units column. */
function toCells(v, decimals, group, decimal) {
  const safe = Number.isFinite(v) ? v : 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [int, frac = ''] = fixed.split('.');
  const cells = [];
  if (safe < 0 && Number(fixed) !== 0) cells.push({ key: 'sign', char: MINUS, kind: 'sym', order: -1e6 });
  for (let i = 0; i < int.length; i++) {
    const place = int.length - 1 - i;
    if (group && place < int.length - 1 && (place + 1) % 3 === 0) cells.push({ key: `g${place + 1}`, char: group, kind: 'sym', order: -(place + 1) * 2 + 1 });
    cells.push({ key: `i${place}`, char: int[i], kind: 'digit', order: -place * 2 });
  }
  if (decimals > 0) {
    cells.push({ key: 'dec', char: decimal, kind: 'sym', order: 1 });
    for (let i = 0; i < frac.length; i++) cells.push({ key: `f${i}`, char: frac[i], kind: 'digit', order: 2 + i });
  }
  return cells.sort((a, b) => a.order - b.order);
}

/** A new random amount: mostly small moves, sometimes a jump that adds or drops a digit. */
function randomAmount(from) {
  const jump = Math.random() < 0.3;
  let v = jump ? (from >= 10000 ? 200 + Math.random() * 1800 : 10000 + Math.random() * 9000) : from * (0.75 + Math.random() * 0.5);
  v = Math.round(Math.max(1, v) * 100) / 100;
  return v === from ? v + 1 : v;
}

function mountTicker(body, { sc, mode }) {
  const fontSize = mode === 'stage' ? 44 : 38, decimals = 2, duration = 700, stagger = 28;
  const { group, decimal } = separatorsFor('fr-FR');
  const suffix = ' €';
  const lh = Math.round(fontSize * 1.22);
  const wrap = el('div', 'cp-ticker');
  wrap.style.cssText = `font-size:${fontSize}px;line-height:${lh}px;height:${lh}px;letter-spacing:${(-fontSize * 0.027).toFixed(2)}px`;
  wrap.setAttribute('role', 'text');
  const btn = el('button', 'cp-reset cp-ticker-btn');
  btn.type = 'button';
  btn.textContent = 'New value';
  body.append(wrap);
  body.append(btn);

  // Glyph widths, measured with the real text style.
  const width = {};
  const probe = el('span', 'cp-ticker-probe');
  wrap.append(probe);
  for (const g of [...DIGITS, group, decimal, MINUS].filter(Boolean)) { probe.textContent = g; width[g] = probe.getBoundingClientRect().width; }
  probe.remove();
  const digitW = Math.max(...DIGITS.map((d) => width[d]));

  const affix = el('span', 'cp-ticker-affix');
  affix.textContent = suffix;
  const cols = new Map(); // key -> { node, roll, item, y, w, o }
  wrap.append(affix);

  function makeCol(c, fresh) {
    const node = el('span', 'cp-ticker-col');
    node.style.height = lh + 'px';
    const roll = el('span', 'cp-ticker-roll');
    const glyphs = c.kind === 'digit' ? DIGITS : [c.char];
    const cw = c.kind === 'digit' ? digitW : width[c.char] ?? 0;
    glyphs.forEach((d) => {
      const g = el('span', 'cp-ticker-cell');
      g.textContent = d;
      g.style.cssText = `width:${cw + SLACK}px;margin-left:${-SLACK / 2}px;height:${lh}px`;
      roll.append(g);
    });
    node.append(roll);
    const col = { node, roll, c, cw };
    const draw = () => {
      roll.style.transform = `translate3d(0,${col.y.v.toFixed(2)}px,0)`;
      node.style.width = col.w.v.toFixed(2) + 'px';
      node.style.opacity = col.o.v.toFixed(3);
    };
    const digit = c.kind === 'digit' ? +c.char : 0;
    col.y = value(sc, fresh ? 0 : -digit * lh, draw);
    col.w = value(sc, fresh ? 0 : cw, draw);
    col.o = value(sc, fresh ? 0 : 1, draw);
    draw();
    return col;
  }

  let current = 1240.5;
  function render(v, first) {
    const cells = toCells(v, decimals, group, decimal);
    const keys = new Set(cells.map((c) => c.key));
    // Leaving columns stay in the order until they have folded out.
    const items = [...cells.map((c) => ({ ...c, present: true }))];
    for (const [key, col] of cols) if (!keys.has(key)) items.push({ ...col.c, present: false });
    items.sort((a, b) => a.order - b.order);
    const delays = {};
    let rank = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      delays[items[i].key] = Math.min(rank, 8) * stagger;
      if (items[i].kind === 'digit') rank++;
    }
    for (const it of items) {
      let col = cols.get(it.key);
      if (!col) { col = makeCol(it, !first); cols.set(it.key, col); }
      if (it.present) col.c = it;
      wrap.insertBefore(col.node, affix);
      const delay = delays[it.key];
      const shown = it.present && it.kind === 'digit' ? +it.char : 0;
      col.y.to(-shown * lh, duration, CALM, delay);
      col.w.to(it.present ? col.cw : 0, duration, CALM, it.present ? 0 : delay);
      col.o.to(it.present ? 1 : 0, duration * 0.6, CALM, it.present ? delay : 0);
      if (!it.present && !col.leaving) {
        col.leaving = true;
        sc.wait(duration + 400).then(() => { if (cols.get(it.key) === col && col.leaving) { col.node.remove(); cols.delete(it.key); } });
      } else if (it.present) col.leaving = false;
    }
    const digits = cells.map((c) => c.char).join('');
    wrap.setAttribute('aria-label', digits + suffix);
  }
  render(current, true);

  const next = () => { current = randomAmount(current); render(current); };
  btn.addEventListener('click', next);
  return {
    async run() { next(); await sc.wait(duration + 8 * stagger + 900); },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'slide-to-confirm': {
    title: 'SlideToConfirm',
    note: 'Slide the knob to the end to pay.',
    desc: 'Slide to pay or confirm, like Apple Pay or power off. A light shimmer runs across the label, the track fills behind the knob, and past the threshold it locks, loads, then confirms.',
    hint: 'Drag the knob to the end',
    tileHint: 'Slide to pay',
    mount: mountSlide,
    glyph: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="6.5" width="19" height="9" rx="4.5"/><circle cx="15.5" cy="11" r="2.6"/><path d="M5.5 11h5" opacity=".55"/></svg>',
    code: `// npx ${PKG} add slide-to-confirm
import { SlideToConfirm } from '${DIR}/slide-to-confirm';

<SlideToConfirm
  label="Slide to pay 42 €"
  doneLabel="Paid"
  onConfirm={() => pay(order)} // the knob shows a loader until the promise settles
/>`,
    props: [
      prop('label', 'string', 'required', 'Label on the track, with a shimmer running across it.'),
      prop('onConfirm', '() => Promise | void', 'required', 'Runs once the knob reaches the end. The knob shows a loader until the promise settles; a rejection goes back to idle.'),
      prop('doneLabel', 'string', `'Done'`, 'Label once confirmed.'),
      prop('height', 'number', '60', 'Track height. The knob is 10 points smaller.'),
      prop('threshold', 'number', '0.88', 'Fraction of the track to reach before release confirms. A flick past halfway confirms too.'),
      prop('resetAfter', 'number', '1600', 'Time on the done state before the slider resets, ms. 0 stays done.'),
      prop('haptics', 'boolean', 'true', 'Medium impact on lock, success when done.'),
      prop('className', 'string', `'rounded-full bg-dissolve-surface'`, 'Track: background, radius, margins. Fill, label and done state read the primary, muted and success tokens.'),
      prop('knobClassName', 'string', `'rounded-full shadow-md'`, 'Knob: shadow, extra layout. Its color is animated from the primary token.'),
    ],
  },
  'otp-input': {
    title: 'OTPInput',
    note: 'A wrong code shakes, then turns to dust.',
    desc: 'One time code input. A hidden field (SMS autofill, paste) drives the boxes, the active box blinks a calm caret and each digit lands crisply. A full code is checked: the boxes turn green, or the row shakes and the digits blow away as dust before the input clears and asks again.',
    hint: 'Type a code. 123456 is the right one',
    tileHint: 'Type a code',
    mount: mountOTP,
    glyph: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="6" width="5" height="10" rx="1.8"/><rect x="8.5" y="6" width="5" height="10" rx="1.8"/><rect x="15.5" y="6" width="5" height="10" rx="1.8" opacity=".55"/><path d="M4 11h0M11 11h0" stroke-width="2.4"/></svg>',
    code: `// npx ${PKG} add otp-input
import { OTPInput } from '${DIR}/otp-input';

<OTPInput
  autoFocus
  onComplete={async (code) => (await api.verify(code)).ok}
/>`,
    props: [
      prop('length', 'number', '6', 'Number of digits.'),
      prop('value', 'string', '', 'Controlled value. Leave undefined to let the input own its state.'),
      prop('onChange', '(code: string) => void', '', 'Called on every change.'),
      prop('onComplete', '(code: string) => boolean | void | Promise', '', 'Runs once every box is filled. True shows the success state, false rejects: the row shakes, the digits turn to dust and the input clears. Nothing leaves the code in place.'),
      prop('autoFocus', 'boolean', 'false', 'Focus on mount.'),
      prop('height', 'number', '56', 'Box height. Box width follows the available space unless boxWidth is set.'),
      prop('boxWidth', 'number', '', 'Fixed box width.'),
      prop('gap', 'number', '8', 'Space between boxes.'),
      prop('fontSize', 'number', '26', 'Digit size.'),
      prop('radius', 'number', '14', 'Box corner radius.'),
      prop('blurOnSuccess', 'boolean', 'true', 'Close the keyboard once the code is accepted.'),
      prop('haptics', 'boolean', 'true', 'Success and error notifications.'),
      prop('className', 'string', '', 'Root: margins, width.'),
      prop('boxClassName', 'string', '', 'Every box: shadow, extra layout. Box colors are animated from the surface, border, foreground, success and danger tokens.'),
      prop('digitClassName', 'string', `'font-semibold'`, 'Digits: weight, family. Their color is animated from the tokens.'),
    ],
  },
  'number-ticker': {
    title: 'NumberTicker',
    note: 'Every digit rolls to its new value.',
    desc: 'Animated number for prices, balances and counters. Every digit is a clipped 0 to 9 column that rolls to its new value on a calm iOS curve, right to left with a slight stagger. Added digits open in, removed ones fold out, so the layout never jumps.',
    hint: 'Change the value',
    tileHint: 'Digits roll',
    mount: mountTicker,
    glyph: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="7" height="15" rx="2"/><rect x="12" y="3.5" width="7" height="15" rx="2"/><path d="M6.5 8.5v5M14.2 9l1.3-.8v5.3" opacity=".55"/></svg>',
    code: `// npx ${PKG} add number-ticker
import { NumberTicker } from '${DIR}/number-ticker';

<NumberTicker
  value={balance}
  decimals={2}
  locale="fr-FR"
  suffix={'\\u00A0€'}
  fontSize={44}
/>`,
    props: [
      prop('value', 'number', 'required', 'The number to show. Digits roll whenever it changes.'),
      prop('decimals', 'number', '0', 'Digits after the decimal separator.'),
      prop('locale', 'string', '', `Picks the separators, e.g. 'fr-FR' gives "1 240,50", 'en-US' "1,240.50".`),
      prop('separator', 'string', '', `Overrides the locale thousands separator. '' turns grouping off.`),
      prop('decimalSeparator', 'string', '', 'Overrides the locale decimal separator.'),
      prop('prefix', 'string', '', `Static text before the number, e.g. '$'.`),
      prop('suffix', 'string', '', 'Static text after the number, e.g. a no break space and €.'),
      prop('fontSize', 'number', '34', 'Text size.'),
      prop('duration', 'number', '700', 'Roll duration, ms.'),
      prop('stagger', 'number', '28', 'Delay between two columns, right to left, ms.'),
      prop('tabular', 'boolean', 'true', 'Tabular figures, so digits never change width.'),
      prop('className', 'string', `'flex-row items-center self-start'`, 'Root: margins, alignment.'),
      prop('textClassName', 'string', `'font-semibold text-dissolve-foreground'`, 'Number: color, weight, family.'),
      prop('affixClassName', 'string', '', 'Prefix and suffix, added on top of the number classes.'),
    ],
  },
};
