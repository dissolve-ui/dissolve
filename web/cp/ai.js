// AI components demos: ThinkingOrb, ImageReveal, SweepTransition, UploadTile, TaskCheck. Each one is
// the React web component's core (registry/web/<name>.core.ts, built into web/lib), the same code a
// React app installs. This file keeps the demos: sizes per mode, the content, the state pickers and
// the autoplay, which drives every component through its public API.
import { createThinkingOrb } from '../lib/thinking-orb.js';
import { createImageReveal } from '../lib/image-reveal.js';
import { createSweepTransition } from '../lib/sweep-transition.js';
import { createUploadTile } from '../lib/upload-tile.js';
import { createTaskCheck } from '../lib/task-check.js';
import { el, IMG, FONT, cover, DPR, PKG, DIR, prop } from './kit.js';
import { ready } from '../images.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const CALM_CSS = 'cubic-bezier(0.32, 0.72, 0, 1)';
const cmd = (id) => `// npx ${PKG} add ${id}`;
const imp = (name, id) => `import { ${name} } from '${DIR}/${id}';`;

/** A small segmented row of options under a demo. */
function chips(options, current, onPick, label) {
  const row = el('div', options.length === 6 ? 'cp-ai-chips cp-ai-chips-6' : 'cp-ai-chips');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', label);
  const btns = options.map(([v, text]) => {
    const b = el('button', 'cp-ai-chip', text);
    b.type = 'button';
    b.addEventListener('click', () => onPick(v));
    row.append(b);
    return [v, b];
  });
  const set = (v) => btns.forEach(([k, b]) => { b.classList.toggle('on', k === v); b.setAttribute('aria-pressed', String(k === v)); });
  set(current);
  return { node: row, set };
}

/** Enter and Space click a focusable demo surface. */
const pressable = (node, fn) => node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });

/* ======================================================================================
   ThinkingOrb: a sphere of dots whose motion shows the agent state.
   ====================================================================================== */

const ORB_STATES = [['idle', 'Idle'], ['thinking', 'Thinking'], ['searching', 'Searching'], ['listening', 'Listening'], ['done', 'Done'], ['error', 'Error']];
const CYCLE = ['thinking', 'searching', 'done', 'idle'];
/** The orb reforms after this long in error: the picker goes back to idle with it. */
const ORB_FALL = 900;

function mountOrb(body, { sc, mode }) {
  const tile = mode === 'tile';
  const S = tile ? 118 : mode === 'stage' ? 220 : 150;
  const root = el('div', 'cp-ai cp-orb');
  const host = el('div', 'cp-orb-cv');
  host.tabIndex = 0;
  root.append(host);
  let picker = null;
  if (!tile) { picker = chips(ORB_STATES, 'idle', (s) => go(s), 'Orb state'); root.append(picker.node); }
  body.append(root);

  let state = 'idle', run = 0;
  const orb = createThinkingOrb(host, { size: S, state, interactive: true });
  sc.onDispose(() => orb.destroy());

  async function go(next) {
    if (next === state && next !== 'error') return;
    // Error again while in error: the dots fall again from where they are.
    if (next === 'error' && state === 'error') orb.update({ state: 'idle' });
    const my = ++run;
    state = next;
    picker?.set(next);
    orb.update({ state: next });
    if (next !== 'error') return;
    await sc.wait(REDUCED.matches ? 0 : ORB_FALL);
    if (my === run) go('idle');
  }

  host.addEventListener('click', () => go(CYCLE[(CYCLE.indexOf(state) + 1) % CYCLE.length]));
  pressable(host, () => host.click());

  return {
    async run() {
      go('thinking'); await sc.wait(2200);
      go('searching'); await sc.wait(2000);
      go('done'); await sc.wait(1600);
      go('idle'); await sc.wait(700);
    },
  };
}

/* ======================================================================================
   ImageReveal: thinking mosaic, coarse to fine, crossfade to sharp.
   ====================================================================================== */

const REVEAL_IMGS = ['lake', 'temple', 'valley', 'villa', 'pines', 'cypress'];

function mountReveal(body, { sc, mode }) {
  const tile = mode === 'tile';
  const S = tile ? 140 : mode === 'stage' ? 260 : 172;
  const root = el('div', 'cp-ai cp-rv');
  const frameEl = el('div', 'cp-rv-frame');
  frameEl.style.width = frameEl.style.height = S + 'px';
  frameEl.tabIndex = 0;
  frameEl.setAttribute('role', 'button');
  frameEl.setAttribute('aria-label', 'Generate an image');
  const empty = el('span', 'cp-rv-empty', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg><span>Tap to generate</span>');
  const host = el('div', 'cp-rv-img');
  frameEl.append(empty, host);
  root.append(frameEl);
  if (!tile) {
    const row = el('div', 'cp-ai-chips');
    for (const [text, fail] of [['Generate', false], ['Fail', true]]) {
      const b = el('button', 'cp-ai-chip', text);
      b.type = 'button';
      b.addEventListener('click', () => generate(fail));
      row.append(b);
    }
    root.append(row);
  }
  body.append(root);

  /** Empty frame (Tap to generate) or the loader. */
  const show = (on) => { host.style.opacity = on ? '1' : '0'; empty.style.opacity = on ? '0' : '1'; };
  show(false);
  let run = 0, imgName = null, settle = null;
  const end = () => { frameEl.removeAttribute('aria-busy'); settle?.(); settle = null; };
  // Made on the first tap: until then the frame is empty and nothing runs.
  let reveal = null;
  const loader = () => reveal ??= createImageReveal(host, {
    status: 'pending',
    onRevealed: end,
    onDismissed: () => { show(false); end(); },
  });
  sc.onDispose(() => reveal?.destroy());

  async function generate(fail = false) {
    const my = ++run;
    await ready;
    if (my !== run || !sc.alive) return;
    imgName = REVEAL_IMGS[(REVEAL_IMGS.indexOf(imgName) + 1) % REVEAL_IMGS.length];
    settle?.();
    const done = new Promise((res) => (settle = res));
    loader().update({ status: 'pending', src: undefined });
    show(true);
    frameEl.setAttribute('aria-busy', 'true');
    await sc.wait(fail ? 1500 : 1300); // the model is thinking
    if (my !== run) return;
    reveal.update(fail ? { status: 'error' } : { status: 'ready', src: IMG[imgName].src });
    return done;
  }

  frameEl.addEventListener('click', () => generate(false));
  pressable(frameEl, () => generate(false));

  return {
    async run() {
      await generate(false);
      await sc.wait(1400);
    },
  };
}

/* ======================================================================================
   SweepTransition: a crisp light band leaves the new state behind it.
   ====================================================================================== */

const SWEEP_CARDS = [
  { img: 'lake', title: 'Lake', sub: 'Morning, 7:40' },
  { img: 'temple', title: 'Temple', sub: 'Noon, 12:10' },
  { img: 'valley', title: 'Valley', sub: 'Dusk, 19:55' },
  { img: 'arch', title: 'Arch', sub: 'Night, 22:30' },
];

function mountSweep(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 200 : mode === 'stage' ? 320 : 260, H = Math.round(W * 0.66);
  const root = el('div', 'cp-ai cp-sw');
  const view = el('div', 'cp-sw-view');
  view.style.width = W + 'px';
  view.style.height = H + 'px';
  view.tabIndex = 0;
  view.setAttribute('role', 'button');
  view.setAttribute('aria-label', 'Sweep to the next card');
  root.append(view);
  let sweepMode = 'vertical';
  if (!tile) {
    const pick = chips([['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['radial', 'Radial']], sweepMode, (m) => { sweepMode = m; pick.set(m); sweep.update({ mode: m }); }, 'Sweep mode');
    root.append(pick.node);
  }
  body.append(root);

  const sweep = createSweepTransition(view, { mode: sweepMode });
  sc.onDispose(() => sweep.destroy());
  const content = el('canvas', 'cp-sw-content');
  content.width = Math.round(W * DPR);
  content.height = Math.round(H * DPR);
  content.style.width = W + 'px';
  content.style.height = H + 'px';
  sweep.slot.append(content);
  const cx = content.getContext('2d');
  let idx = 0;

  function drawContent() {
    const c = SWEEP_CARDS[idx];
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cover(cx, IMG[c.img], 0, 0, W, H);
    const g = cx.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#fff';
    cx.font = `600 ${tile ? 16 : 20}px ${FONT}`;
    cx.fillText(c.title, 16, H - (tile ? 30 : 36));
    cx.globalAlpha = 0.8;
    cx.font = `500 ${tile ? 11 : 13}px ${FONT}`;
    cx.fillText(c.sub, 16, H - (tile ? 13 : 16));
    cx.globalAlpha = 1;
  }
  ready.then(() => sc.alive && drawContent());
  drawContent();

  /** Sweeps to the next card, or sends a running sweep back. */
  function next(origin) {
    if (sweep.running()) return sweep.cancel();
    const prev = idx;
    return sweep.run(() => { idx = (idx + 1) % SWEEP_CARDS.length; drawContent(); }, {
      origin,
      revert: () => { idx = prev; drawContent(); },
    });
  }

  view.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const b = view.getBoundingClientRect(), s = b.width / W || 1;
    next({ x: (e.clientX - b.left) / s, y: (e.clientY - b.top) / s });
  });
  view.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next({ x: W / 2, y: H / 2 }); }
    else if (e.key === 'Escape') sweep.cancel();
  });

  return {
    async run() {
      await next({ x: W * 0.5, y: H * 0.75 });
      await sc.wait(900);
    },
  };
}

/* ======================================================================================
   UploadTile: grains land as the upload runs, the cross shows once it is whole.
   ====================================================================================== */

const MB = 1024 * 1024;
const FILES = [
  { name: 'lake.jpg', size: 2.4 * MB, img: 'lake' },
  { name: 'brief.pdf', size: 0.8 * MB },
  { name: 'footage.mov', size: 48 * MB },
  { name: 'villa.jpg', size: 3.1 * MB, img: 'villa' },
  { name: 'assets.zip', size: 31 * MB },
];
const MAX_SIZE = 25 * MB, TILE = 72, GAP = 6, MAX_TILES = 3;

/** The demo upload: progress in steps, aborts on signal. */
async function fakeUpload(sc, onProgress, signal) {
  let p = 0;
  await sc.wait(160);
  while (p < 1) {
    if (signal.aborted || !sc.alive) throw new Error('aborted');
    p = Math.min(1, p + 0.07 + Math.random() * 0.12);
    onProgress(p);
    await sc.wait(110 + Math.random() * 110);
  }
  if (signal.aborted) throw new Error('aborted');
}

function mountUpload(body, { sc, mode }) {
  const tile = mode === 'tile';
  const root = el('div', 'cp-ai cp-up');
  const tray = el('div', 'cp-up-tray');
  tray.setAttribute('role', 'list');
  tray.setAttribute('aria-label', 'Attachments');
  const addBtn = el('button', 'cp-up-add', '<span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span>');
  addBtn.type = 'button';
  addBtn.setAttribute('aria-label', 'Add a file');
  tray.append(addBtn);
  root.append(tray);
  if (!tile) root.append(el('p', 'cp-up-cap', 'Max 25 MB. Videos over it are rejected.'));
  body.append(root);
  let next = 0;
  const tiles = new Map();
  const sync = () => { addBtn.disabled = tiles.size >= MAX_TILES; };
  const drop = (host) => { tiles.get(host)?.destroy(); tiles.delete(host); host.remove(); sync(); };
  sc.onDispose(() => tiles.forEach((t) => t.destroy()));

  /** Adds a tile. Resolves once it is whole, or once a rejected file has gone. */
  function addFile(f = FILES[next++ % FILES.length]) {
    if (tiles.size >= MAX_TILES) return Promise.resolve();
    const host = el('div');
    tray.append(host);
    return new Promise((res) => {
      tiles.set(host, createUploadTile(host, {
        file: { name: f.name, size: f.size, uri: f.img ? IMG[f.img].src : undefined },
        upload: (file, onProgress, signal) => fakeUpload(sc, onProgress, signal),
        maxSize: MAX_SIZE,
        size: TILE,
        spacing: GAP,
        onDone: res,
        onRemove: () => { drop(host); res(); },
      }));
      sync();
    });
  }

  addBtn.addEventListener('click', () => addFile());
  sync();

  return {
    async run() {
      [...tiles.keys()].forEach(drop);
      await addFile(FILES[0]);
      await sc.wait(500);
      await addFile(FILES[2]);
      await sc.wait(500);
      next = 1;
    },
  };
}

/* ======================================================================================
   TaskCheck: box fills, check draws, text strikes, then move or dissolve.
   ====================================================================================== */

const TASKS = ['Draft the launch post', 'Review the onboarding flow', 'Export the app icons', 'Book the demo room'];

function mountTasks(body, { sc, mode }) {
  const tile = mode === 'tile';
  const root = el('div', 'cp-ai cp-tc');
  if (tile) root.classList.add('compact');
  const todoHead = el('div', 'cp-tc-head', 'To do');
  const todo = el('div', 'cp-tc-list');
  const doneHead = el('div', 'cp-tc-head', 'Done');
  const done = el('div', 'cp-tc-list');
  const emptyRow = el('div', 'cp-tc-empty', '<span>All done</span>');
  const reset = el('button', 'cp-ai-chip', 'Reset');
  reset.type = 'button';
  emptyRow.append(reset);
  root.append(todoHead, todo, doneHead, done);
  let after = 'move';
  /** Task host: { task, checked, toggle }. */
  const rows = new Map();
  sc.onDispose(() => rows.forEach((r) => r.task.destroy()));

  const flip = (mutate, ms = 380) => {
    const nodes = [...root.querySelectorAll('.cp-tc-item, .cp-tc-head, .cp-tc-empty, .cp-ai-chips')];
    const first = new Map(nodes.map((n) => [n, n.getBoundingClientRect().top]));
    mutate();
    if (REDUCED.matches) return;
    for (const [n, top] of first) {
      if (!n.isConnected) continue;
      const dy = top - n.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: ms, easing: CALM_CSS });
    }
  };
  const syncEmpty = () => {
    const pending = [...todo.children].some((n) => rows.has(n));
    if (!pending && !emptyRow.isConnected) todo.append(emptyRow);
    if (pending && emptyRow.isConnected) emptyRow.remove();
    doneHead.hidden = after !== 'move' && done.children.length === 0;
  };
  const fadeIn = (host) => host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 140, easing: 'linear', fill: 'backwards' }).finished.catch(() => {});

  function makeRow(label) {
    const host = el('div', 'cp-tc-item');
    todo.append(host);
    const row = { checked: false };

    /** Moves to Done: fade out, the list moves, fade in. */
    async function moved() {
      await host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear' }).finished.catch(() => {});
      if (!row.checked) return;
      host.style.opacity = '0';
      flip(() => { done.prepend(host); syncEmpty(); });
      await fadeIn(host);
      host.style.opacity = '';
    }
    /** Dissolved: the dust has gone and the gap has closed. */
    function dissolved() {
      rows.delete(host);
      row.task.destroy();
      flip(() => { host.remove(); syncEmpty(); });
    }

    row.toggle = async (on = !row.checked) => {
      const inDone = host.parentNode === done;
      row.checked = on;
      row.after = inDone ? 'stay' : after;
      row.task.update({ checked: on, after: row.after });
      if (on || !inDone) return;
      await sc.wait(REDUCED.matches ? 150 : 160);
      if (row.checked || host.parentNode !== done) return;
      host.style.opacity = '0';
      flip(() => { todo.prepend(host); syncEmpty(); });
      await fadeIn(host);
      host.style.opacity = '';
    };
    row.task = createTaskCheck(host, {
      label,
      checked: false,
      after,
      rowClassName: 'cp-tc-row',
      labelClassName: 'cp-tc-text',
      onCheckedChange: (on) => row.toggle(on),
      onSettled: () => (row.after === 'dissolve' ? dissolved() : moved()),
    });
    rows.set(host, row);
  }

  function fill() {
    rows.forEach((r) => r.task.destroy());
    rows.clear();
    todo.textContent = '';
    done.textContent = '';
    (tile ? TASKS.slice(0, 3) : TASKS).forEach(makeRow);
    syncEmpty();
  }
  reset.addEventListener('click', () => { fill(); todo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); });

  let pick = null;
  if (!tile) {
    pick = chips([['move', 'Move'], ['dissolve', 'Dissolve']], after, (m) => { after = m; pick.set(m); syncEmpty(); }, 'After checking');
    root.append(pick.node);
  }
  body.append(root);
  fill();

  return {
    async run() {
      const pending = () => [...todo.children].filter((n) => rows.has(n));
      if (pending().length < 2 || done.children.length > 1) fill();
      for (let k = 0; k < 2; k++) {
        const host = pending()[0];
        if (!host) break;
        rows.get(host).toggle();
        await sc.wait(900 + 1100);
      }
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'thinking-orb': {
    title: 'ThinkingOrb',
    note: 'A sphere of dots that shows what the agent is doing.',
    desc: 'An agent status indicator made of 180 dots. Idle, it breathes as a sphere; thinking, the dots split into three tilted rings; searching, the sphere flattens into a disc swept by a radar arc; listening, it pulses with the voice level; done, the dots fly into a checkmark; error, they fall and reform. Every state change moves each dot from where it is to its new place on the calm curve, staggered, never instant. With interactive on, dots flee the finger and spring back.',
    hint: 'Pick a state, or tap the orb. Hover to push the dots',
    tileHint: 'Tap the orb',
    mount: mountOrb,
    code: `${cmd('thinking-orb')}
${imp('ThinkingOrb', 'thinking-orb')}

<ThinkingOrb
  state={agent.status} // 'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error'
  size={96}
  level={micLevel}
  interactive
/>`,
    webCode: `${imp('ThinkingOrb', 'thinking-orb')}

<ThinkingOrb
  state={agent.status} // 'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error'
  size={96}
  level={micLevel} // a number, or an object whose value is read every frame
  interactive
/>`,
    props: [
      prop('state', `'idle' | 'thinking' | 'searching' | 'listening' | 'done' | 'error'`, `'idle'`, 'What the agent is doing. Each change moves every dot to its new place in 600 ms, staggered.'),
      prop('size', 'number', '64', 'Diameter of the orb.'),
      prop('dots', 'number', '180', 'Number of dots.'),
      prop('dotSize', 'number', '2.5', 'Dot diameter in points.'),
      prop('level', 'SharedValue&lt;number&gt;', '', 'Voice level 0 to 1 that drives the listening pulse.'),
      prop('interactive', 'boolean', 'false', 'Dots flee the finger within 40 pt and spring back.'),
      prop('haptics', 'boolean', 'true', 'Light impact on done, warning on error.'),
      prop('className', 'string', '', 'Classes of the container. Dots use the foreground token, done the success token, error the danger token.'),
    ],
  },
  'image-reveal': {
    title: 'ImageReveal',
    note: 'A generation loader that resolves coarse to fine.',
    desc: 'A loader for generated images. While pending, a 12 by 12 mosaic pulses with a slow diagonal wave. When the image arrives, it resolves from 8 to 128 cells in 1.4 s on a smoothstep, one even step per doubling, each cell switching to the real color past its own random threshold, then the finest mosaic crossfades into the sharp image in 180 ms. On error, the mosaic freezes, tints red and leaves as dust. The mosaic is one shader, no view per cell.',
    hint: 'Tap the frame to generate, Fail to see the error',
    tileHint: 'Tap to generate',
    mount: mountReveal,
    code: `${cmd('image-reveal')}
${imp('ImageReveal', 'image-reveal')}

<ImageReveal
  src={result?.uri}
  status={failed ? 'error' : result ? 'ready' : 'pending'}
  onRevealed={() => setShowActions(true)}
  onDismissed={retry}
  className="rounded-[20px]"
/>`,
    props: [
      prop('src', 'DataSourceParam', '', 'The generated image (require(...) or a uri). Reveals once loaded and status is ready.'),
      prop('status', `'pending' | 'ready' | 'error'`, `src ? 'ready' : 'pending'`, 'Pending shows the thinking mosaic, error sends it away as dust.'),
      prop('duration', 'number', '1400', 'Coarse to fine resolve, in ms. A 180 ms crossfade to the sharp image follows.'),
      prop('cells', 'number', '160', 'Finest mosaic across the width before the sharp image (8, 16, 32, 64, 128).'),
      prop('aspectRatio', 'number', '1', 'Width / height of the frame.'),
      prop('onRevealed', '() =&gt; void', '', 'Called once the sharp image is fully shown.'),
      prop('onDismissed', '() =&gt; void', '', 'Error: called once the mosaic has left as dust.'),
      prop('haptics', 'boolean', 'true', 'A tick at each resolution doubling, success at the end.'),
      prop('className', 'string', '', 'Classes of the frame: size, radius.'),
    ],
  },
  'sweep-transition': {
    title: 'SweepTransition',
    note: 'A crisp band sweeps across and leaves the new state.',
    desc: 'Wrap any view and call run() with your state change. The current view is captured, the new state mounts under it, and a 28 pt band sweeps across the capture, bending what it passes with a light refraction, a hint of RGB split and a 1 pt accent rim. Vertical, horizontal, or a circle growing from a touch point. cancel() sends the band back and restores the old state. No blur.',
    hint: 'Tap the card to sweep, tap again mid sweep to cancel',
    tileHint: 'Tap the card',
    mount: mountSweep,
    code: `${cmd('sweep-transition')}
import { useRef } from 'react';
import { SweepTransition, type SweepTransitionHandle } from '@/components/dissolve/sweep-transition';

const sweep = useRef<SweepTransitionHandle>(null);

<SweepTransition ref={sweep} mode="vertical" className="rounded-3xl">
  <PlanCard plan={plan} />
</SweepTransition>

sweep.current?.run(() => setPlan('pro'), { revert: () => setPlan('free') });`,
    props: [
      prop('mode', `'vertical' | 'horizontal' | 'radial'`, `'vertical'`, 'Bottom to top, left to right, or a circle from the origin.'),
      prop('duration', 'number', '720', 'Sweep length in ms, calm curve.'),
      prop('bandWidth', 'number', '28', 'Width of the refractive band.'),
      prop('ref.run', '(apply, { origin?, mode?, revert? }) =&gt; Promise&lt;void&gt;', '', 'Captures the view, runs apply under the capture, then sweeps it away. origin is the radial center in local points.'),
      prop('ref.cancel', '() =&gt; void', '', 'Sends the front back in 300 ms, then calls the run revert to put the old state back.'),
      prop('ref.running', '() =&gt; boolean', '', 'True while a sweep is on screen.'),
      prop('haptics', 'boolean', 'true', 'Light at start, soft when the front passes half.'),
      prop('className', 'string', '', 'Classes of the wrapper.'),
      prop('children', 'ReactNode', 'required', 'The view that changes.'),
    ],
  },
  'upload-tile': {
    title: 'UploadTile',
    note: 'Attachments that assemble from grains as they upload.',
    desc: 'An attachment tile for chat composers. The upload progress is the tile itself: from 0 to 1, its grains land one by one, a front running left to right, and at 1 the tile is whole. Only then the remove cross fades in. No ring, no badge. A file over maxSize, or an upload that rejects, completes, shakes three times, turns red and leaves as dust while the row closes up. Tap the tile during the upload to abort: the grains that have landed snap away from your finger. No picker dependency, you pass the files.',
    hint: 'Add files. Tap one while it uploads to cancel',
    tileHint: 'Add a file',
    mount: mountUpload,
    code: `${cmd('upload-tile')}
${imp('UploadTray', 'upload-tile')}

<UploadTray
  files={files}
  upload={(file, onProgress, signal) => api.upload(file, { onProgress, signal })}
  maxSize={25 * 1024 * 1024}
  onAdd={pickFiles}
  onRemove={(file) => setFiles((all) => all.filter((f) => f.id !== file.id))}
/>`,
    props: [
      prop('file', '{ id?, name, size, uri?, source? }', 'required', 'The file. An image uri or source shows as a thumbnail, anything else as a file icon, name and size.'),
      prop('upload', '(file, onProgress, signal) =&gt; Promise&lt;void&gt;', 'required', 'Your upload. Report progress 0 to 1: it drives how many grains have landed. Stop when the signal aborts (a tap on the tile aborts it), reject to show the error state.'),
      prop('maxSize', 'number', '', 'Bytes. A bigger file is rejected without starting the upload.'),
      prop('size', 'number', '72', 'Tile side. 6 pt of room are kept around it for the cross and the grains.'),
      prop('spacing', 'number', '0', 'Space after the tile in a row. It closes up with the tile.'),
      prop('onDone', '(file) =&gt; void', '', 'Called once the upload resolved and the tile is whole, as the cross appears.'),
      prop('onRemove', `(file, reason: 'rejected' | 'cancelled' | 'removed') =&gt; void`, '', 'Called once the tile has gone and its space has closed: drop the file here.'),
      prop('haptics', 'boolean', 'true', 'Success when whole, error on reject, light impact on cancel and remove.'),
      prop('className', 'string', '', 'Outer wrapper classes (margins).'),
      prop('tileClassName', 'string', '', 'Tile classes (background, radius).'),
    ],
  },
  'task-check': {
    title: 'TaskCheck',
    note: 'Check a task: box fills, text strikes, then it moves or dissolves.',
    desc: 'A to do row. Tap it: the box fills with a small spring, the check draws in 220 ms, the strike runs across each real line of text and the label goes muted. After a short delay the task moves to Done, or dissolves into dust from the left and the list closes up. Tap again before the delay to undo.',
    hint: 'Tap a task. Tap again quickly to undo',
    tileHint: 'Tap a task',
    mount: mountTasks,
    code: `${cmd('task-check')}
${imp('TaskCheck', 'task-check')}

<TaskCheck
  label={task.title}
  checked={task.done}
  onCheckedChange={(done) => update(task.id, { done })}
  after="move"
  onSettled={() => moveToDone(task.id)}
/>`,
    props: [
      prop('label', 'string', 'required', 'The task. The strike follows each line it wraps to.'),
      prop('checked', 'boolean', 'required', 'Checked state.'),
      prop('onCheckedChange', '(checked: boolean) =&gt; void', 'required', 'Called on tap.'),
      prop('after', `'stay' | 'move' | 'dissolve'`, `'stay'`, 'Once checked: nothing, onSettled so you move it to Done, or dust from the left, the gap closes, then onSettled.'),
      prop('settleDelay', 'number', '900', 'Pause before the task settles. A tap within it undoes.'),
      prop('onSettled', '() =&gt; void', '', 'Called when the task settles: move it, or drop it after the dust.'),
      prop('boxSize', 'number', '24', 'Checkbox side.'),
      prop('disabled', 'boolean', 'false', 'Turns the tap off.'),
      prop('haptics', 'boolean', 'true', 'Light impact on check.'),
      prop('className', 'string', '', 'Outer wrapper classes (margins, separators). This is the part that closes up.'),
      prop('rowClassName', 'string', '', 'Row classes (padding, gap).'),
      prop('labelClassName', 'string', '', 'Label classes (size, weight). The color is animated from the tokens.'),
    ],
  },
};
