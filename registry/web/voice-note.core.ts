/**
 * VoiceNote for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (voice-note.tsx) wraps it; it also runs on its own:
 *
 *   const note = createVoiceNote(el, { mine: true, duration: 14, seed: 'msg-42', onUnsend: remove });
 *
 * The bubble, the button and the label are elements styled by the --dissolve-* tokens (or your
 * classes); the play icon and the waveform are canvases painted in the CSS color of the button and
 * the bubble. Same geometry, timings and curves as the React Native version.
 */
import { DPR, play, snapshot } from './engine';
import { CALM, clamp, el, frame, injectStyle, propsOf, rectOf, reducedMotion, rr, scope, value, vibrate, type Ease } from './kit';

export type VoiceNoteProps = {
  /** Length of the note in seconds. Playback is simulated with a timer. */
  duration?: number;
  /** Loudness per sample, 0 to 1. Resampled to the number of bars that fit. */
  levels?: number[];
  /** Used to generate a deterministic waveform when `levels` is not given. Default 1. */
  seed?: number | string;
  /** Your own message: accent bubble with white content. Default false (surface bubble). */
  mine?: boolean;
  /** Bubble width. Default 248. */
  width?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  /** Called once the bubble has dissolved: remove it from your data here. */
  onUnsend?: () => void;
  /** Flip to true to unsend from outside (a menu, a swipe...). */
  unsent?: boolean;
  /** Long press the bubble (480 ms) to unsend. Default true when onUnsend is set. */
  unsendOnLongPress?: boolean;
  /** Exit used when the note is unsent (an engine variant). Default 'dust'. */
  preset?: string;
  /** A tap on play, a tick per bar while seeking, where the browser has it. Default true. */
  haptics?: boolean;
  /** Bubble classes (background, radius, padding...). */
  className?: string;
  /** Play and pause button classes. The icon is drawn in the button's CSS color. */
  buttonClassName?: string;
  /** Time label classes. */
  labelClassName?: string;
};

export type VoiceNoteInstance = {
  /** Brings an unsent note back, fresh, gathering it from the dust. */
  reset: () => Promise<void>;
  update: (props: Partial<VoiceNoteProps>) => void;
  destroy: () => void;
};

const DEFAULTS = { duration: 0, seed: 1 as number | string, mine: false, width: 248, preset: 'dust', haptics: true };

const BAR = 3, GAP = 2, WAVE_H = 28, BTN = 34;
/** Room above and below the waveform for the scrub stretch. */
const OVER = 6;
const LONG_PRESS = 480;
const PLAY_PATH = 'M13 10.6c0-1 1.1-1.6 1.9-1.1l9.4 6.4c.7.5.7 1.6 0 2.1l-9.4 6.4c-.8.5-1.9-.1-1.9-1.1z';
const OUT_QUAD: Ease = (t) => 1 - (1 - t) * (1 - t);
const LINEAR: Ease = (t) => t;

const CSS = `
:where([data-dissolve="voice-note"]) { display: inline-block; flex: none; }
:where(.dissolve-voice-note) {
  position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 10px;
  padding: 8px 14px 8px 8px; border-radius: 25px; cursor: pointer; will-change: transform;
  background: var(--dissolve-surface, rgb(242 242 247)); color: var(--dissolve-foreground, rgb(28 28 30));
  touch-action: pan-y; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
}
:where(.dissolve-voice-note[data-mine]) { background: var(--dissolve-accent, rgb(10 132 255)); color: #FFFFFF; }
:where(.dissolve-voice-button) {
  flex: none; width: ${BTN}px; height: ${BTN}px; border-radius: 50%;
  background: var(--dissolve-foreground, rgb(28 28 30)); color: var(--dissolve-surface, rgb(242 242 247));
}
:where(.dissolve-voice-note[data-mine] .dissolve-voice-button) { background: #FFFFFF; color: var(--dissolve-accent, rgb(10 132 255)); }
:where(.dissolve-voice-button) canvas, :where(.dissolve-voice-wave) canvas { display: block; }
:where(.dissolve-voice-wave) { flex: 1; min-width: 0; height: ${WAVE_H}px; }
:where(.dissolve-voice-wave) canvas { margin: -${OVER}px 0; }
:where(.dissolve-voice-label) {
  min-width: 30px; text-align: right; font-size: 13px; font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums;
  color: var(--dissolve-muted, rgb(142 142 147));
}
:where(.dissolve-voice-note[data-mine] .dissolve-voice-label) { color: rgba(255, 255, 255, 0.7); }
`;

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(s: number | string) {
  if (typeof s === 'number') return Math.floor(s * 2654435761);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h;
}

/** A waveform that reads like speech: syllable bursts, short pauses, soft edges. */
export function voiceLevels(seed: number | string, count = 64) {
  const r = rng(seedOf(seed));
  const out: number[] = [];
  let syllable = 0, amp = 0.6;
  for (let i = 0; i < count; i++) {
    if (syllable <= 0) {
      // A new syllable, sometimes a short breath first.
      syllable = 3 + Math.floor(r() * 6);
      amp = r() < 0.16 ? 0.08 : 0.35 + r() * 0.65;
    }
    const k = 1 - Math.abs((syllable - 3) / 6);
    out.push(amp * (0.55 + 0.45 * k) * (0.7 + 0.3 * r()));
    syllable--;
  }
  // Light smoothing, then taper the ends.
  return out.map((v, i) => {
    const a = out[i - 1] ?? v, b = out[i + 1] ?? v;
    const edge = Math.min(1, (i + 1) / 4, (count - i) / 4);
    return Math.max(0.06, ((a + 2 * v + b) / 4) * (0.5 + 0.5 * edge));
  });
}

function resample(levels: number[], n: number) {
  if (!levels.length || n <= 0) return [];
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    const a = Math.floor((j / n) * levels.length);
    const b = Math.max(a + 1, Math.floor(((j + 1) / n) * levels.length));
    let m = 0;
    for (let i = a; i < b && i < levels.length; i++) m = Math.max(m, levels[i]);
    out.push(clamp(m));
  }
  return out;
}

const fmt = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * A voice message bubble in host. Play and pause, the played part of the waveform takes the ink,
 * drag along the waveform to seek. Unsent, it blows away as dust. No audio: playback is a timer,
 * hook your player on onPlay and onPause.
 */
export function createVoiceNote(host: HTMLElement, initial: VoiceNoteProps = {}): VoiceNoteInstance {
  injectStyle('dissolve-voice-note', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();

  host.dataset.dissolve = 'voice-note';
  const bubble = el('div');
  bubble.setAttribute('role', 'slider');
  bubble.tabIndex = 0;
  bubble.setAttribute('aria-valuemin', '0');
  const button = el('div');
  const iconCv = el('canvas');
  iconCv.width = iconCv.height = Math.ceil(BTN * DPR);
  iconCv.style.width = iconCv.style.height = BTN + 'px';
  button.append(iconCv);
  const wave = el('div', 'dissolve-voice-wave');
  const waveCv = el('canvas');
  wave.append(waveCv);
  const label = el('span');
  bubble.append(button, wave, label);
  host.append(bubble);
  const ix = iconCv.getContext('2d')!;
  const wx = waveCv.getContext('2d')!;
  const playPath = new Path2D(PLAY_PATH);

  let waveW = 0, count = 0, bars: number[] = [];
  let playing = false, engaged = false, gone = false;
  const px = 1 / DPR, snapPx = (v: number) => Math.round(v / px) * px;
  const longPress = () => p().unsendOnLongPress ?? !!p().onUnsend;

  function drawIcon() {
    ix.setTransform(DPR, 0, 0, DPR, 0, 0);
    ix.clearRect(0, 0, BTN, BTN);
    ix.fillStyle = getComputedStyle(button).color;
    const ic = icon.v, c = BTN / 2;
    if (ic < 1) {
      ix.save();
      ix.globalAlpha = 1 - ic;
      ix.translate(c, c); ix.scale(1 - 0.4 * ic, 1 - 0.4 * ic); ix.translate(-c, -c);
      ix.fill(playPath);
      ix.restore();
    }
    if (ic > 0) {
      ix.save();
      ix.globalAlpha = ic;
      const s = 0.6 + 0.4 * ic;
      ix.translate(c, c); ix.scale(s, s); ix.translate(-c, -c);
      rr(ix, 11.5, 10.5, 4, 13, 1.4); ix.fill();
      rr(ix, 18.5, 10.5, 4, 13, 1.4); ix.fill();
      ix.restore();
    }
  }

  function drawWave() {
    const H = WAVE_H + OVER * 2;
    wx.setTransform(DPR, 0, 0, DPR, 0, 0);
    wx.clearRect(0, 0, waveW, H);
    const used = count * (BAR + GAP) - GAP, x0 = snapPx((waveW - used) / 2);
    const path = new Path2D();
    bars.forEach((v, i) => {
      const h = snapPx(Math.max(BAR, v * WAVE_H));
      path.roundRect(x0 + i * (BAR + GAP), OVER + snapPx((WAVE_H - h) / 2), BAR, h, BAR / 2);
    });
    wx.save();
    wx.translate(0, H / 2); wx.scale(1, 1 + 0.14 * scrub.v); wx.translate(0, -H / 2);
    wx.fillStyle = getComputedStyle(wave).color;
    wx.globalAlpha = p().mine ? 0.3 : 0.22;
    wx.fill(path);
    wx.globalAlpha = 1;
    wx.beginPath(); wx.rect(0, 0, progress.v * waveW, H); wx.clip();
    wx.fill(path);
    wx.restore();
    const sec = Math.floor(progress.v * p().duration + 1e-4);
    label.textContent = playing || engaged ? fmt(sec) : fmt(p().duration);
    bubble.setAttribute('aria-valuenow', String(sec));
  }

  const progress = value(sc, 0, drawWave);
  const scrub = value(sc, 0, drawWave);
  const icon = value(sc, 0, drawIcon);
  const btn = value(sc, 1, () => { button.style.transform = btn.v === 1 ? '' : `scale(${btn.v.toFixed(4)})`; });
  const hold = value(sc, 0, () => { bubble.style.transform = hold.v ? `scale(${(1 - 0.035 * hold.v).toFixed(4)})` : ''; });

  /** Sizes the waveform to the room the bubble leaves it, with as many bars as fit. */
  function layout() {
    bubble.style.width = p().width + 'px';
    waveW = Math.floor(wave.clientWidth);
    count = Math.max(0, Math.floor((waveW + GAP) / (BAR + GAP)));
    bars = resample(p().levels ?? voiceLevels(p().seed, 96), count);
    waveCv.width = Math.ceil(waveW * DPR);
    waveCv.height = Math.ceil((WAVE_H + OVER * 2) * DPR);
    waveCv.style.width = waveW + 'px';
    waveCv.style.height = WAVE_H + OVER * 2 + 'px';
    drawWave();
  }

  function decorate() {
    const o = p();
    bubble.className = 'dissolve-voice-note' + (o.className ? ' ' + o.className : '');
    bubble.toggleAttribute('data-mine', o.mine);
    button.className = 'dissolve-voice-button' + (o.buttonClassName ? ' ' + o.buttonClassName : '');
    label.className = 'dissolve-voice-label' + (o.labelClassName ? ' ' + o.labelClassName : '');
    bubble.setAttribute('aria-label', `Voice message, ${fmt(o.duration)}. Space to play, arrows to seek${o.onUnsend ? ', Delete to unsend' : ''}.`);
    bubble.setAttribute('aria-valuemax', String(o.duration));
  }

  const setPlaying = (v: boolean) => { playing = v; icon.to(v ? 1 : 0, 220, CALM); drawWave(); };
  function ended() {
    setPlaying(false);
    p().onEnd?.();
    progress.to(0, 420, CALM, 260).then((ok) => { if (ok) { engaged = false; drawWave(); } });
  }
  function run() {
    const from = progress.v >= 0.999 ? 0 : progress.v;
    progress.set(from);
    progress.to(1, (1 - from) * p().duration * 1000, LINEAR).then((ok) => ok && ended());
  }
  /** Stops the running playback timing where it is. */
  const stopAt = () => progress.set(progress.v);
  function playNote() {
    if (gone) return;
    engaged = true;
    setPlaying(true);
    run();
    p().onPlay?.();
  }
  function pause() {
    stopAt();
    setPlaying(false);
    p().onPause?.();
  }
  function toggle() {
    if (p().haptics) vibrate(6);
    if (playing) pause(); else playNote();
  }

  /** The bubble as it looks now, for the dust: background, button, icon, waveform and label. */
  function replica() {
    const W = bubble.offsetWidth, H = bubble.offsetHeight;
    const bs = getComputedStyle(bubble), ls = getComputedStyle(label);
    return snapshot(W, H, (x) => {
      x.fillStyle = bs.backgroundColor;
      rr(x, 0, 0, W, H, Math.min(H / 2, parseFloat(bs.borderTopLeftRadius) || 0)); x.fill();
      x.fillStyle = getComputedStyle(button).backgroundColor;
      x.beginPath(); x.arc(button.offsetLeft + BTN / 2, button.offsetTop + BTN / 2, BTN / 2, 0, Math.PI * 2); x.fill();
      x.drawImage(iconCv, button.offsetLeft, button.offsetTop, BTN, BTN);
      x.drawImage(waveCv, wave.offsetLeft, wave.offsetTop - OVER, waveW, WAVE_H + OVER * 2);
      x.font = `${ls.fontWeight} ${ls.fontSize} ${ls.fontFamily}`;
      x.fillStyle = ls.color;
      x.textAlign = 'right';
      x.textBaseline = 'middle';
      x.fillText(label.textContent ?? '', label.offsetLeft + label.offsetWidth, label.offsetTop + label.offsetHeight / 2 + 0.5);
    });
  }

  async function unsend() {
    if (gone) return;
    gone = true;
    stopAt();
    playing = false;
    icon.set(0);
    hold.to(0, 220, CALM);
    if (p().haptics) vibrate(10);
    if (reducedMotion()) {
      bubble.style.transition = 'opacity .22s';
      bubble.style.opacity = '0';
      await sc.wait(220);
      bubble.style.transition = '';
    } else {
      const r = rectOf(bubble);
      const src = replica();
      bubble.style.opacity = '0';
      await sc.track(play({ source: src, ...r, preset: p().preset, duration: 1300 })).done;
    }
    if (sc.alive) p().onUnsend?.();
  }

  async function reset() {
    if (!gone) return;
    progress.set(0); scrub.set(0); btn.set(1); hold.set(0); icon.set(0);
    engaged = false;
    drawWave();
    await frame();
    if (!sc.alive) return;
    if (!reducedMotion()) await sc.track(play({ source: replica(), ...rectOf(bubble), preset: 'gather', direction: 'in', duration: 900 })).done;
    if (!sc.alive) return;
    bubble.style.opacity = '';
    gone = false;
  }

  /* ---- gestures: play button, tap or drag on the waveform, long press anywhere to unsend ---- */
  let lastBar = -1;
  function seekTo(clientX: number) {
    const b = wave.getBoundingClientRect();
    const v = b.width ? clamp((clientX - b.left) / b.width) : 0;
    progress.set(v);
    const bar = Math.min(count - 1, Math.floor(v * count));
    if (bar !== lastBar) {
      if (lastBar >= 0 && p().haptics) vibrate(4);
      lastBar = bar;
    }
  }

  type Press = { x0: number; y0: number; id: number; region: 'btn' | 'wave' | null; scrubbing: boolean; long: boolean; resume: boolean; timer: ReturnType<typeof setTimeout> | 0 };
  let g: Press | null = null;
  const onDown = (e: PointerEvent) => {
    if (gone || e.button > 0) return;
    const br = button.getBoundingClientRect(), wr = wave.getBoundingClientRect();
    const region = e.clientX <= br.right + 8 ? 'btn' : e.clientX >= wr.left - 4 && e.clientX <= wr.right + 4 ? 'wave' : null;
    const my: Press = { x0: e.clientX, y0: e.clientY, id: e.pointerId, region, scrubbing: false, long: false, resume: false, timer: 0 };
    g = my;
    try { bubble.setPointerCapture(e.pointerId); } catch { /* synthetic pointers cannot be captured */ }
    if (region === 'btn') btn.to(0.9, 120, CALM);
    if (!longPress()) return;
    hold.to(1, LONG_PRESS, OUT_QUAD);
    my.timer = setTimeout(() => {
      if (g !== my || !sc.alive) return;
      my.long = true;
      btn.to(1, 260, CALM);
      void unsend();
    }, LONG_PRESS);
  };
  const onMove = (e: PointerEvent) => {
    if (!g || g.long || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (dx * dx + dy * dy > 100 && g.timer) { clearTimeout(g.timer); g.timer = 0; hold.to(0, 220, CALM); }
    if (g.region !== 'wave') return;
    if (!g.scrubbing) {
      if (Math.abs(dy) > 12) { g.region = null; return; }
      if (Math.abs(dx) <= 4) return;
      g.scrubbing = true;
      g.resume = playing;
      stopAt();
      lastBar = -1;
      engaged = true;
      scrub.to(1, 180, CALM);
    }
    seekTo(e.clientX);
  };
  const onEnd = (e: PointerEvent) => {
    if (!g || e.pointerId !== g.id) return;
    const st = g;
    g = null;
    clearTimeout(st.timer);
    if (st.long) return;
    if (longPress()) hold.to(0, 220, CALM);
    if (st.region === 'btn') {
      btn.to(1, 260, CALM);
      if (e.type === 'pointerup') toggle();
      return;
    }
    if (st.scrubbing) {
      scrub.to(0, 260, CALM);
      if (st.resume) run();
      return;
    }
    if (st.region === 'wave' && e.type === 'pointerup') {
      const was = playing;
      stopAt();
      lastBar = -1;
      seekTo(e.clientX);
      if (p().haptics) vibrate(4);
      engaged = true;
      drawWave();
      if (was) run();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (gone) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const was = playing;
      stopAt();
      engaged = true;
      progress.set(clamp(progress.v + (e.key === 'ArrowRight' ? 1 : -1) / p().duration));
      if (was) run();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && p().onUnsend) { e.preventDefault(); void unsend(); }
  };
  bubble.addEventListener('pointerdown', onDown);
  bubble.addEventListener('pointermove', onMove);
  bubble.addEventListener('pointerup', onEnd);
  bubble.addEventListener('pointercancel', onEnd);
  bubble.addEventListener('contextmenu', (e) => e.preventDefault());
  bubble.addEventListener('keydown', onKey);

  // The canvases follow the theme tokens: repaint when the color scheme flips.
  const scheme = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)');
  const repaint = () => { drawIcon(); drawWave(); };
  scheme?.addEventListener('change', repaint);
  sc.onDispose(() => {
    scheme?.removeEventListener('change', repaint);
    clearTimeout(g?.timer);
  });

  decorate();
  layout();
  drawIcon();
  if (p().unsent) void unsend();

  return {
    reset,
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      decorate();
      if (changed.has('width') || changed.has('levels') || changed.has('seed') || changed.has('className')) layout();
      else drawWave();
      if (changed.has('mine') || changed.has('buttonClassName')) drawIcon();
      if (changed.has('unsent') && p().unsent) void unsend();
    },
    destroy() {
      sc.dispose();
      bubble.remove();
      delete host.dataset.dissolve;
    },
  };
}
