/**
 * TextScramble for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (text-scramble.tsx) wraps it; it also runs on its own:
 *
 *   const ts = createTextScramble(h1, { text: 'Built to dissolve' });
 *   ts.update({ text: 'Every letter lands' }); // decodes into the new text
 *   ts.scramble();                             // replays on demand
 *
 * Text that decodes into place: every letter turns into random glyphs that keep changing, then
 * the letters resolve one by one, left to right with a little randomness, into the final text.
 * It plays when the text changes, when trigger changes, on scramble(), and on mount with
 * playOnMount. Letters keep the width of their final character while they scramble, so the line
 * never shifts and wraps where the final text wraps; monospace sets a monospace font. Glyphs
 * show in --dissolve-muted (glyphColor), resolved letters in the text color of the host. The text
 * stays real text: selectable, copyable, read once by screen readers. Reduced motion: no glyphs,
 * the new text fades in.
 */
import { injectStyle, propsOf, reducedMotion, scope } from './kit';

export const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/?';

export type TextScrambleProps = {
  /** The text it decodes into. A change plays the scramble. */
  text: string;
  /** Any value: each change replays the scramble on the same text. */
  trigger?: unknown;
  /** Time until the last letter lands, ms. Default 900. */
  duration?: number;
  /** How often a scrambling letter changes glyph, ms. Default 45. */
  rate?: number;
  /**
   * Characters drawn while scrambling. Default: glyphs of the same kind and about the same width as
   * each letter (lowercase for lowercase, narrow for narrow...); with monospace, A-Z, 0-9 and signs.
   */
  glyphs?: string;
  /** A monospace font (ui-monospace, Menlo...). Default false. */
  monospace?: boolean;
  /** Plays once on mount. Default false: the text shows as is. */
  playOnMount?: boolean;
  /** Color of the glyphs. Default: the muted token. */
  glyphColor?: string;
  /** Called when the last letter lands. */
  onDone?: () => void;
};

export type TextScrambleInstance = {
  /** Plays the scramble on the current text. */
  scramble: () => void;
  update: (props: Partial<TextScrambleProps>) => void;
  destroy: () => void;
};

const DEFAULTS = { duration: 900, rate: 45, monospace: false, playOnMount: false };

/** Glyphs close in kind and width to ch, so a proportional line keeps its rhythm. Same as native. */
export function glyphPool(ch: string) {
  if (/[ilj|!.,:;'"I1]/.test(ch)) return 'il|!:1';
  if (/[ftr]/.test(ch)) return 'ftrj';
  if (/[MW]/.test(ch)) return 'MW';
  if (/[mw]/.test(ch)) return 'mw';
  if (/[A-Z]/.test(ch)) return 'ABCDEFGHKLNOPRSTUVXYZ';
  if (/[a-z]/.test(ch)) return 'abcdeghknopqsuvxyz';
  if (/[0-9]/.test(ch)) return '023456789';
  return '#%&*+=<>/?';
}
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const CSS = `
:where([data-dissolve="text-scramble"]) { font-variant-ligatures: none; font-variant-numeric: tabular-nums; }
:where([data-dissolve="text-scramble"][data-mono]) { font-family: ${MONO}; }
:where(.dissolve-ts-sr) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; user-select: none; }
:where(.dissolve-ts-w) { white-space: nowrap; }
:where(.dissolve-ts-c) { position: relative; display: inline-block; }
:where(.dissolve-ts-c[data-g]) { color: transparent; }
:where(.dissolve-ts-c[data-g])::after { content: attr(data-g); position: absolute; left: 50%; top: 0; transform: translateX(-50%); color: var(--dissolve-ts-glyph, var(--dissolve-muted, rgb(142 142 147))); pointer-events: none; }
:where([data-dissolve="text-scramble"][data-fade]) { animation: dissolve-ts-fade 220ms ease-out; }
@keyframes dissolve-ts-fade { from { opacity: 0; } }
`;

/**
 * When each letter lands, ms from the start: the first after a quarter of the duration, the last
 * at the end, in reading order with a little jitter. Same as the native version.
 */
export function landings(n: number, duration: number, rnd = Math.random) {
  return Array.from({ length: n }, (_, i) => {
    const k = n > 1 ? i / (n - 1) : 1;
    return Math.max(60, Math.min(duration, duration * (0.25 + 0.75 * k) + (rnd() - 0.5) * 0.16 * duration));
  });
}

export function createTextScramble(host: HTMLElement, initial: TextScrambleProps): TextScrambleInstance {
  injectStyle('dissolve-text-scramble', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = 'text-scramble';

  let cells: HTMLElement[] = [];
  let raf = 0;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;

  const look = () => {
    if (p().monospace) host.dataset.mono = ''; else delete host.dataset.mono;
    if (p().glyphColor) host.style.setProperty('--dissolve-ts-glyph', p().glyphColor!); else host.style.removeProperty('--dissolve-ts-glyph');
  };

  /** One inline-block per letter, words kept whole so the text wraps like plain text. */
  const render = () => {
    host.textContent = '';
    cells = [];
    // Screen readers get the final text once; the letters are hidden from them.
    const sr = document.createElement('span');
    sr.className = 'dissolve-ts-sr';
    sr.textContent = p().text;
    host.append(sr);
    const words = p().text.split(/( +)/);
    for (const w of words) {
      if (!w) continue;
      if (w.trim() === '') { const gap = document.createElement('span'); gap.setAttribute('aria-hidden', 'true'); gap.textContent = w; host.append(gap); continue; }
      const word = document.createElement('span');
      word.className = 'dissolve-ts-w';
      word.setAttribute('aria-hidden', 'true');
      for (const ch of w) {
        const c = document.createElement('span');
        c.className = 'dissolve-ts-c';
        c.textContent = ch;
        word.append(c);
        cells.push(c);
      }
      host.append(word);
    }
  };

  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  const play = () => {
    stop();
    clearTimeout(fadeTimer);
    if (reducedMotion()) {
      cells.forEach((c) => c.removeAttribute('data-g'));
      delete host.dataset.fade;
      void host.offsetWidth;
      host.dataset.fade = '';
      fadeTimer = setTimeout(() => { delete host.dataset.fade; p().onDone?.(); }, 240);
      return;
    }
    const { duration, rate, glyphs } = p();
    const lands = landings(cells.length, duration);
    const pools = cells.map((c) => glyphs ?? (p().monospace ? SCRAMBLE_GLYPHS : glyphPool(c.textContent ?? '')));
    const pick = (i: number) => pools[i][Math.floor(Math.random() * pools[i].length)] ?? '';
    const t0 = performance.now();
    let step = -1;
    const f = (now: number) => {
      raf = 0;
      if (!sc.alive) return;
      const t = now - t0;
      const s = Math.floor(t / rate);
      let left = 0;
      cells.forEach((c, i) => {
        if (t >= lands[i]) { if (c.hasAttribute('data-g')) c.removeAttribute('data-g'); return; }
        left++;
        if (s !== step || !c.hasAttribute('data-g')) c.dataset.g = pick(i);
      });
      step = s;
      if (left) raf = requestAnimationFrame(f);
      else p().onDone?.();
    };
    // The first frame scrambles at once, so the old text never shows.
    f(t0);
  };

  look();
  render();
  if (p().playOnMount) play();

  return {
    scramble: play,
    update(next) {
      const changed = props.update(next);
      look();
      if (changed.has('text')) { render(); play(); } else if (changed.has('trigger')) play();
    },
    destroy() {
      stop();
      clearTimeout(fadeTimer);
      sc.dispose();
      host.textContent = '';
      for (const a of ['data-dissolve', 'data-mono', 'data-fade']) host.removeAttribute(a);
      host.style.removeProperty('--dissolve-ts-glyph');
    },
  };
}
