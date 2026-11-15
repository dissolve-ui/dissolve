// Variant playground: a live stage driven by a control panel, mirroring app/playground.tsx.
// The code blocks under it always show the exact snippet for the current settings.
import { play, snapshot, Heap, morph } from './engine/atlas.js';
import { drawCard, binSvg, attachFling, holdController, attachHold, peelController, attachPeel, attachScrub } from './demo.js';
import { PKG } from './variants-content.js';

/* ---------- variant facts (src/dissolve/variants/registry.ts) ---------- */

const GRAIN = { dust: 3, sand: 2.5, ember: 3, pixel: 7, vortex: 3, shatter: 3, stream: 3.5, gather: 3, rain: 3, print: 3, snap: 3, fling: 3, charge: 3, pile: 2.5, morph: 4, peel: 3, melt: 3 };
const ATLAS = ['dust', 'sand', 'ember', 'pixel', 'vortex', 'snap', 'fling', 'stream', 'gather', 'rain', 'print', 'charge', 'peel'];
const ENTRANCES = ['gather', 'rain', 'print'];
const CLASSIC = ['dust', 'sand', 'ember', 'pixel', 'vortex'];
const ORIGINS = ['auto', 'touch', 'left', 'right', 'top', 'bottom', 'center'];
const FLINGS = [
  { label: 'slow right', v: { x: 600, y: 0 } },
  { label: 'fast right', v: { x: 2600, y: -200 } },
  { label: 'up left', v: { x: -900, y: -1400 } },
];
/** Variant knob: n[0] for snap, shatter and pile, hook options for charge and peel. */
const KNOB = {
  snap: { key: 'n', title: 'Push', min: 0.4, max: 2, step: 0.1, def: 1, fmt: (v) => `${v}x` },
  shatter: { key: 'n', title: 'Shards', min: 60, max: 400, step: 10, def: 220, fmt: (v) => `${v}` },
  pile: { key: 'n', title: 'Kept in the heap', min: 0.1, max: 0.8, step: 0.05, def: 0.35, fmt: (v) => `${Math.round(v * 100)}%` },
  charge: { key: 'holdMs', title: 'Hold time', min: 400, max: 3000, step: 100, def: 1200, fmt: (v) => `${v} ms` },
  peel: { key: 'threshold', title: 'Threshold', min: 0.2, max: 0.8, step: 0.05, def: 0.4, fmt: (v) => `${Math.round(v * 100)}%`, when: (s) => s.mode === 'hand' },
};
const MODES = {
  peel: { title: 'Trigger', opts: [['hand', 'by hand'], ['auto', 'dissolve()']], def: 'hand' },
  ...Object.fromEntries(CLASSIC.map((id) => [id, { title: 'Trigger', opts: [['tap', 'tap'], ['scrub', 'scrub']], def: 'tap' }])),
};

const naturalOf = (id) => (ENTRANCES.includes(id) ? 'in' : 'out');
const r2 = (v) => Math.round(v * 100) / 100;

function durationDef(id, s) {
  if (ENTRANCES.includes(id)) return 1200;
  if (id === 'pile') return 2000;
  if (id === 'charge') return 900;
  if (id === 'morph') return 1100;
  if (id === 'peel') return s.mode === 'hand' ? 700 : 1900;
  return 1500;
}

/** Which controls a variant shows for the current state. */
function caps(id, s) {
  const hook = id === 'charge' || id === 'morph' || (id === 'peel' && s.mode === 'hand') || s.mode === 'scrub';
  return {
    origin: (ATLAS.includes(id) || id === 'shatter') && !hook && id !== 'peel',
    direction: !hook,
    field: ATLAS.includes(id) && !hook && id !== 'peel',
    grain: id !== 'shatter',
    fling: id === 'fling',
    knob: KNOB[id] && (!KNOB[id].when || KNOB[id].when(s)) ? KNOB[id] : null,
    mode: MODES[id] ?? null,
    reverse: id !== 'charge',
  };
}

function defaults(id) {
  const s = {
    mode: MODES[id]?.def ?? null,
    origin: id === 'snap' || id === 'shatter' ? 'touch' : 'auto',
    direction: naturalOf(id),
    field: false,
    grain: GRAIN[id],
    fling: 1,
    knob: KNOB[id]?.def ?? null,
    haptics: !ENTRANCES.includes(id),
  };
  s.duration = durationDef(id, s);
  return s;
}

/* ---------- snippets ---------- */

const ORIGIN_TOUCH = '{ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }';

/** Exact native snippet for the current settings (port of snippet() in app/playground.tsx). */
export function nativeSnippet(id, s) {
  const c = caps(id, s);
  const hapticsDef = s.direction === 'in' ? false : true;
  if (id === 'charge') {
    const o = [`  holdMs: ${s.knob},`, `  grain: ${s.grain},`, `  duration: ${s.duration},`];
    if (!s.haptics) o.push('  haptics: false,');
    o.push('  onCommit: () => remove(item.id),');
    return `import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { useDissolveHold } from '${PKG}';

const { ref, pressHandlers, style, charge } = useDissolveHold({
${o.join('\n')}
});

<Pressable {...pressHandlers}>
  <Animated.View ref={ref} style={[styles.card, style]} />
</Pressable>`;
  }
  if (id === 'peel' && s.mode === 'hand') {
    const o = [`  threshold: ${s.knob},`, `  grain: ${s.grain},`, `  duration: ${s.duration},`];
    if (!s.haptics) o.push('  haptics: false,');
    o.push('  onCommit: () => remove(sticker.id),');
    return `import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useDissolvePeel } from '${PKG}';

const { ref, gesture, style } = useDissolvePeel({
${o.join('\n')}
});

<GestureDetector gesture={gesture}>
  <Animated.View ref={ref} style={[styles.sticker, style]} />
</GestureDetector>`;
  }
  if (s.mode === 'scrub') {
    const o = [`  preset: '${id}',`, `  grain: ${s.grain},`, `  duration: ${s.duration},`];
    if (!s.haptics) o.push('  haptics: false,');
    o.push('  onCommit: () => remove(item.id),');
    return `import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useDissolveScrub } from '${PKG}';

const { ref, gesture, style } = useDissolveScrub({
${o.join('\n')}
});

<GestureDetector gesture={gesture}>
  <Animated.View ref={ref} style={[styles.card, style]} />
</GestureDetector>`;
  }
  if (id === 'morph') {
    const o = [`grain: ${s.grain}`, `duration: ${s.duration}`];
    if (!s.haptics) o.push('haptics: false');
    return `import { useDissolveMorph } from '${PKG}';

const { refA, refB, styleA, styleB, morph } = useDissolveMorph();

<View>
  <View style={styleA}><View ref={refA} collapsable={false}>{follow}</View></View>
  <View style={[StyleSheet.absoluteFill, styleB]}><View ref={refB} collapsable={false}>{following}</View></View>
</View>

await morph({ ${o.join(', ')} });                // A becomes B
await morph({ ${o.join(', ')}, reverse: true }); // and back`;
  }

  // Generic options, in the order of the mobile playground.
  const entries = [['preset', `'${id}'`]];
  if (c.grain) entries.push(['grain', `${s.grain}`]);
  entries.push(['duration', `${s.duration}`]);
  const touch = c.origin && s.origin === 'touch';
  if (touch) entries.push(['origin', ORIGIN_TOUCH]);
  else if (c.origin && s.origin !== 'auto') entries.push(['origin', `'${s.origin}'`]);
  if (id === 'fling') entries.push(['velocity', `{ x: ${FLINGS[s.fling].v.x}, y: ${FLINGS[s.fling].v.y} }`]);
  if (id === 'stream') entries.push(s.direction === 'in' ? ['from', 'sourceRef'] : ['to', 'binRef']);
  if (id === 'stream' && s.direction === 'out') entries.push(['onArrive', '() => bumpBadge()']);
  if (id === 'pile') entries.push(['floor', "'screen'"]);
  if (s.field) entries.push(['field', "'cascade'"]);
  if (c.knob) entries.push(['n', `[${s.knob}]`]);
  if (s.haptics !== hapticsDef) entries.push(['haptics', `${s.haptics}`]);

  if (s.direction === 'in' && !touch) {
    // Entrances: the component plays on mount.
    const attr = ([k, v]) => (v.startsWith("'") ? `${k}="${v.slice(1, -1)}"` : `${k}={${v}}`);
    const props = entries.map(attr);
    return `import { DissolveIn } from '${PKG}';

<DissolveIn
  ${props.join('\n  ')}
>
  <Card />
</DissolveIn>`;
  }
  const lines = entries.map(([k, v]) => `  ${k}: ${v},`);
  if (s.direction === 'in') {
    return `import { useAppear } from '${PKG}';

const { ref, appear, wrapStyle } = useAppear();

await appear({
${lines.join('\n')}
});`;
  }
  if (s.direction !== naturalOf(id)) lines.push(`  direction: '${s.direction}',`);
  const pile = id === 'pile';
  return `import { ${pile ? 'useDissolve, usePile' : 'useDissolve'} } from '${PKG}';

const { ref, dissolving, dissolve } = useDissolve();${pile ? '\nconst { sweepPile } = usePile();' : ''}

<View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
  <Card />
</View>

await dissolve({
${lines.join('\n')}
});${pile ? "\n\n// later, e.g. when leaving the screen\nawait sweepPile({ preset: 'dust', origin: 'left' });" : ''}`;
}

/** Same settings on the Canvas 2D port (web/engine/atlas.js). */
export function webSnippet(id, s) {
  const c = caps(id, s);
  if (id === 'morph') {
    return `import { morph } from './engine/atlas.js';

// a, b: { source: canvas, x, y, w, h } in viewport px
await morph(a, b, { grain: ${s.grain}, duration: ${s.duration} }).done;
await morph(a, b, { grain: ${s.grain}, duration: ${s.duration}, reverse: true }).done;`;
  }
  const o = [`preset: '${id}'`];
  if (c.grain) o.push(`grain: ${s.grain}`);
  o.push(`duration: ${s.duration}`);
  if (c.origin && s.origin === 'touch') o.push('origin: { x: e.clientX - x, y: e.clientY - y }');
  else if (c.origin && s.origin !== 'auto') o.push(`origin: '${s.origin}'`);
  if (c.direction && s.direction !== naturalOf(id)) o.push(`direction: '${s.direction}'`);
  if (id === 'fling') o.push(`velocity: { x: ${FLINGS[s.fling].v.x}, y: ${FLINGS[s.fling].v.y} }`);
  if (id === 'stream') o.push('target: { x, y, width, height } // the bin rect');
  if (id === 'pile') o.push('heap: new Heap(floorEl)');
  if (s.field) o.push("field: 'cascade'");
  if (c.knob && KNOB[id].key === 'n') o.push(`n: [${s.knob}]`);
  if (id === 'charge') o.push('hold: true');
  if (id === 'peel' && s.mode === 'hand') o.push('n: [1, ax, ay], hold: true');
  if (s.mode === 'scrub') o.push("origin: 'left', hold: true");
  const extra = id === 'charge'
    ? `\n// every frame while pressed: h.aux.a0 = charge (0..1), h.aux.a1 = ms held\n// at full charge (${s.knob} ms): h.release()`
    : id === 'peel' && s.mode === 'hand'
      ? '\n// pointermove: h.aux.a0, h.aux.a1 = the grabbed corner, local px\n// commit: h.release()'
      : s.mode === 'scrub'
        ? '\n// pointermove: h.set(progress), commit: h.release(), rewind: h.cancel()'
        : '';
  const hold = id === 'charge' || (id === 'peel' && s.mode === 'hand') || s.mode === 'scrub';
  return `import { play${id === 'pile' ? ', Heap' : ''} } from './engine/atlas.js';

// source: a canvas snapshot of the view, x, y, w, h: its viewport rect
const h = play({
  source, x, y, w, h,
  ${o.join(',\n  ')},
});${extra}${hold ? '' : '\nawait h.done;'}`;
}

/* ---------- HTML ---------- */

const chip = (k, v, label, on) => `<button class="chip${on ? ' on' : ''}" data-k="${k}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
const group = (title, inner) => `<div class="ctl" role="group" aria-label="${title}"><p class="ctl-label">${title}</p><div class="chips">${inner}</div></div>`;

function range(k, label, { min, max, step }, val, text) {
  const p = ((val - min) / (max - min)) * 100;
  return `<div class="ctl"><label class="slider" style="--p:${p}%">
    <span>${label}</span><output class="slider-val">${text}</output>
    <input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${label}" aria-valuetext="${text}">
  </label></div>`;
}

function panelHTML(id, s) {
  const c = caps(id, s);
  const parts = [];
  if (c.mode) parts.push(group(c.mode.title, c.mode.opts.map(([v, l]) => chip('mode', v, l, s.mode === v)).join('')));
  if (c.direction) parts.push(group('Direction', ['out', 'in'].map((d) => chip('direction', d, d, s.direction === d)).join('')));
  if (c.origin) parts.push(group('Origin', ORIGINS.map((o) => chip('origin', o, o, s.origin === o)).join('')));
  if (c.fling) parts.push(group('Velocity', FLINGS.map((f, i) => chip('fling', i, f.label, s.fling === i)).join('')));
  if (c.field) parts.push(group('Delay field', chip('field', 0, 'native', !s.field) + chip('field', 1, 'cascade', s.field)));
  if (c.knob) parts.push(range('knob', c.knob.title, c.knob, s.knob, c.knob.fmt(s.knob)));
  if (c.grain) parts.push(range('grain', 'Grain', { min: 2, max: 10, step: 0.5 }, s.grain, `${s.grain} px`));
  parts.push(range('duration', 'Duration', { min: 400, max: 4000, step: 100 }, s.duration, `${s.duration} ms`));
  parts.push(`<div class="ctl ctl-row"><span id="pg-hap">Haptics</span><button class="switch${s.haptics ? ' on' : ''}" role="switch" aria-checked="${s.haptics}" aria-labelledby="pg-hap" data-k="haptics"></button></div>`);
  return parts.join('');
}

function hintFor(id, s) {
  if (id === 'charge') return 'Press and hold the card, or press Play';
  if (id === 'peel' && s.mode === 'hand') return 'Grab any edge or corner and pull, or press Play';
  if (s.mode === 'scrub') return 'Drag the card sideways, release past half to commit';
  if (id === 'fling') return 'Swipe the card, or press Play to use the velocity preset';
  if (id === 'morph') return 'Tap the card or press Play';
  if (id === 'pile') return 'Each play adds to the heap. Sweep blows it away';
  if (caps(id, s).origin && s.origin === 'touch') return 'Tap the card where it should break';
  return 'Tap the card or press Play';
}

/** Playground section (stage, panel, code). helpers: { codeBlock } from app.js. */
export function playgroundHTML(id, { codeBlock, title }) {
  const s = defaults(id);
  return `
    <h2 class="section-title" id="playground">Playground</h2>
    <div class="pg" data-pg="${id}">
      <div class="pg-stage">
        <p class="pg-hint" aria-live="polite">${hintFor(id, s)}</p>
        <div class="pg-scene"></div>
        <div class="pg-actions">
          <button class="chip on" data-act="play">Play</button>
          <button class="chip" data-act="reverse">Reverse</button>
          <button class="chip" data-act="reset">Reset</button>
          ${id === 'pile' ? '<button class="chip" data-act="sweep">Sweep</button>' : ''}
        </div>
      </div>
      <aside class="panel" aria-label="Playground controls">${panelHTML(id, s)}</aside>
    </div>
    <div class="code-swap" data-code="rn">${codeBlock(nativeSnippet(id, s), { title: `${title} · React Native` })}</div>
    <div class="code-swap" data-code="web" hidden>${codeBlock(webSnippet(id, s), { title: 'Canvas 2D port · Web', lang: 'js' })}</div>`;
}

/* ---------- mount ---------- */

/** Wires the playground in root. Returns a dispose function. */
export function mountPlayground(root, id, { highlight }) {
  const pg = root.querySelector('[data-pg]');
  if (!pg) return () => {};
  const stage = pg.querySelector('.pg-stage');
  const scene = pg.querySelector('.pg-scene');
  const panel = pg.querySelector('.panel');
  const hint = pg.querySelector('.pg-hint');
  const codes = [...root.querySelectorAll('[data-code] code')];
  let s = defaults(id);
  let alive = true, busy = false, timer = 0;
  const handles = new Set();
  const track = (h) => { handles.add(h); h.done.then(() => handles.delete(h)); return h; };

  /* scene */
  const W = Math.max(220, Math.min(320, scene.clientWidth - 32)), H = 84;
  const mk = (key) => {
    const c = snapshot(W, H, (ctx) => drawCard(ctx, W, H, key));
    c.style.width = W + 'px'; c.style.height = H + 'px';
    c.className = 'demo-card';
    return c;
  };
  const card = mk(id);
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Play ${id}`);
  let cardB = null, bin = null, heap = null, onB = false;
  const nodes = [card];
  if (id === 'morph') {
    cardB = mk('morphB');
    cardB.classList.add('demo-card-b');
    cardB.style.opacity = '0';
    const pair = document.createElement('div');
    pair.className = 'demo-pair';
    pair.append(card, cardB);
    nodes[0] = pair;
  }
  if (id === 'stream') {
    bin = document.createElement('span');
    bin.className = 'demo-bin pg-bin';
    bin.innerHTML = binSvg;
    nodes.push(bin);
  }
  scene.replaceChildren(...nodes);
  if (id === 'pile') heap = new Heap(stage, 150);

  const rect = (el) => { const r = el.getBoundingClientRect(); return { source: el, x: r.left, y: r.top, w: r.width, h: r.height }; };
  const hide = (el) => { el.style.transition = 'none'; el.style.opacity = '0'; };
  const show = (el, fade = true) => { el.style.transition = fade ? '' : 'none'; el.style.opacity = '1'; el.style.transform = ''; };
  const wait = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });
  const buzz = () => { if (s.haptics) navigator.vibrate?.(12); };
  const bump = () => {
    if (!bin) return;
    const n = bin.querySelector('.bin-count');
    n.textContent = +n.textContent + 1; n.hidden = false;
    bin.classList.add('bump'); setTimeout(() => bin.classList.remove('bump'), 400);
  };

  function engineOpts(dir, touch) {
    const c = caps(id, s);
    const o = { ...rect(card), preset: id, duration: s.duration, direction: dir };
    if (c.grain) o.grain = s.grain;
    if (c.origin && s.origin !== 'auto') o.origin = s.origin === 'touch' ? (touch ?? { x: o.w / 2, y: o.h / 2 }) : s.origin;
    if (id === 'fling') o.velocity = FLINGS[s.fling].v;
    if (id === 'stream') { const b = bin.getBoundingClientRect(); o.target = { x: b.left, y: b.top, width: b.width, height: b.height }; }
    if (id === 'pile') o.heap = heap;
    if (s.field) o.field = 'cascade';
    if (c.knob && KNOB[id].key === 'n') o.n = [s.knob];
    return o;
  }

  async function run(dir = s.direction, extra = {}) {
    if (busy || !alive) return;
    busy = true;
    buzz();
    try {
      if (id === 'morph') {
        // Play goes to the other view, reverse: true when B is showing.
        const rev = onB, target = rev ? card : cardB;
        const a = rect(card), b = rect(cardB);
        hide(card); hide(cardB);
        await track(morph(a, b, { grain: s.grain, duration: s.duration, reverse: rev })).done;
        if (!alive) return;
        show(target, false);
        onB = !rev;
        return;
      }
      if (id === 'charge') { hold.start(); return; } // the controller clears busy
      if (id === 'peel' && s.mode === 'hand') { await peel.pull(); return; }
      const o = { ...engineOpts(dir, extra.touch), ...extra.opts };
      if (s.mode === 'scrub') o.origin = 'left';
      hide(card);
      if (id === 'stream' && dir === 'out') setTimeout(() => alive && bump(), s.duration * 0.62);
      await track(play(o)).done;
      if (!alive) return;
      if (dir === 'in') { show(card, false); return; }
      await wait(Math.min(700, s.duration * 0.4));
      if (alive) show(card);
    } finally {
      if (id !== 'charge') busy = false;
    }
  }

  /* gestures on the card */
  const hold = id === 'charge' ? holdController(card, () => ({
    grain: s.grain, duration: s.duration, holdMs: s.knob,
    onStart: () => { busy = true; buzz(); },
    onProgress: (c) => { card.dataset.charge = c; },
    onCommit: async () => { await wait(500); if (alive) show(card); busy = false; },
    onCancel: () => { busy = false; },
  })) : null;
  const peel = id === 'peel' ? peelController(card, () => ({
    grain: s.grain, duration: s.duration, threshold: s.knob,
    onStart: buzz,
    onCommit: async () => { await wait(500); if (alive) show(card); },
  })) : null;

  if (hold) attachHold(card, hold, () => !busy);
  else if (peel) {
    card.classList.add('grab');
    card.addEventListener('pointerdown', (e) => { if (s.mode === 'hand' && !busy) { if (peel.grab(e.clientX, e.clientY)) try { card.setPointerCapture(e.pointerId); } catch {} } });
    card.addEventListener('pointermove', (e) => peel.move(e.clientX, e.clientY));
    card.addEventListener('pointerup', () => peel.drop());
    card.addEventListener('pointercancel', () => peel.drop());
    card.addEventListener('click', () => { if (s.mode === 'auto') run(); });
  } else if (id === 'fling') {
    attachFling(card, { canStart: () => !busy, onTap: () => run(), onFling: (velocity) => run('out', { opts: { velocity, origin: undefined } }) });
  } else if (CLASSIC.includes(id)) {
    attachScrub(card, () => ({
      preset: id, grain: s.grain, duration: s.duration,
      onStart: () => { busy = true; buzz(); },
      onCommit: async () => { await wait(500); if (alive) show(card); busy = false; },
      onCancel: () => { busy = false; },
      onTap: () => { busy = false; },
    }), () => s.mode === 'scrub' && !busy);
    card.addEventListener('click', (e) => { if (s.mode === 'tap') run(s.direction, { touch: touchOf(e) }); });
  } else {
    (cardB ? card.parentElement : card).addEventListener('click', (e) => run(s.direction, { touch: touchOf(e) }));
  }
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
  function touchOf(e) { const r = card.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  /* panel */
  function refresh(full) {
    if (full) panel.innerHTML = panelHTML(id, s);
    hint.textContent = hintFor(id, s);
    codes[0].innerHTML = highlight(nativeSnippet(id, s));
    if (codes[1]) codes[1].innerHTML = highlight(webSnippet(id, s));
    pg.querySelector('[data-act="reverse"]').disabled = !caps(id, s).reverse;
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b || b.type === 'range') return;
    const k = b.dataset.k, v = b.dataset.v;
    if (k === 'haptics') s.haptics = !s.haptics;
    else if (k === 'fling') s.fling = +v;
    else if (k === 'field') s.field = v === '1';
    else if (k === 'direction') { s.direction = v; s.haptics = v === 'out'; }
    else if (k === 'mode') {
      s.mode = v;
      s.duration = durationDef(id, s);
      if (v === 'scrub' || v === 'hand') s.direction = 'out';
      card.classList.toggle('grab', v === 'scrub' || (id === 'peel' && v === 'hand'));
    } else s[k] = v;
    refresh(true);
    panel.querySelector(`[data-k="${k}"]${v != null ? `[data-v="${v}"]` : ''}`)?.focus();
  });
  panel.addEventListener('input', (e) => {
    const inp = e.target;
    if (inp.type !== 'range') return;
    const k = inp.dataset.k, v = r2(+inp.value);
    s[k] = v;
    const spec = k === 'knob' ? KNOB[id] : k === 'grain' ? { min: 2, max: 10, fmt: (x) => `${x} px` } : { min: 400, max: 4000, fmt: (x) => `${x} ms` };
    const text = spec.fmt(v);
    inp.closest('.slider').style.setProperty('--p', `${((v - spec.min) / (spec.max - spec.min)) * 100}%`);
    inp.previousElementSibling.textContent = text;
    inp.setAttribute('aria-valuetext', text);
    refresh(false);
  });

  /* actions */
  pg.querySelector('.pg-actions').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'play') run();
    else if (act === 'reverse') {
      if (id === 'morph') { if (onB) run(); }
      else if (id === 'peel' && s.mode === 'hand') { s.mode = 'auto'; s.duration = durationDef(id, s); refresh(true); run('in'); }
      else run(s.direction === 'in' ? 'out' : 'in');
    } else if (act === 'reset') reset();
    else if (act === 'sweep' && heap && !busy) { busy = true; await heap.sweep('dust'); busy = false; }
  });

  function stop() {
    clearTimeout(timer);
    for (const h of handles) h.cancel();
    handles.clear();
    hold?.cancel();
    peel?.cancel();
    busy = false;
  }
  function reset() {
    stop();
    s = defaults(id);
    heap?.reset();
    onB = false;
    show(card, false);
    if (cardB) cardB.style.opacity = '0';
    if (bin) { const n = bin.querySelector('.bin-count'); n.textContent = '0'; n.hidden = true; }
    card.classList.toggle('grab', id === 'peel');
    refresh(true);
  }
  refresh(false);
  return () => { alive = false; stop(); };
}
