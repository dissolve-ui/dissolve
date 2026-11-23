// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  injectStyle,
  propsOf,
  reducedMotion,
  scope
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/text-scramble.core.ts
var SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/?";
var DEFAULTS = { duration: 900, rate: 45, monospace: false, playOnMount: false };
function glyphPool(ch) {
  if (/[ilj|!.,:;'"I1]/.test(ch)) return "il|!:1";
  if (/[ftr]/.test(ch)) return "ftrj";
  if (/[MW]/.test(ch)) return "MW";
  if (/[mw]/.test(ch)) return "mw";
  if (/[A-Z]/.test(ch)) return "ABCDEFGHKLNOPRSTUVXYZ";
  if (/[a-z]/.test(ch)) return "abcdeghknopqsuvxyz";
  if (/[0-9]/.test(ch)) return "023456789";
  return "#%&*+=<>/?";
}
var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
var CSS = `
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
function landings(n, duration, rnd = Math.random) {
  return Array.from({ length: n }, (_, i) => {
    const k = n > 1 ? i / (n - 1) : 1;
    return Math.max(60, Math.min(duration, duration * (0.25 + 0.75 * k) + (rnd() - 0.5) * 0.16 * duration));
  });
}
function createTextScramble(host, initial) {
  injectStyle("dissolve-text-scramble", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "text-scramble";
  let cells = [];
  let raf = 0;
  let fadeTimer;
  const look = () => {
    if (p().monospace) host.dataset.mono = "";
    else delete host.dataset.mono;
    if (p().glyphColor) host.style.setProperty("--dissolve-ts-glyph", p().glyphColor);
    else host.style.removeProperty("--dissolve-ts-glyph");
  };
  const render = () => {
    host.textContent = "";
    cells = [];
    const sr = document.createElement("span");
    sr.className = "dissolve-ts-sr";
    sr.textContent = p().text;
    host.append(sr);
    const words = p().text.split(/( +)/);
    for (const w of words) {
      if (!w) continue;
      if (w.trim() === "") {
        const gap = document.createElement("span");
        gap.setAttribute("aria-hidden", "true");
        gap.textContent = w;
        host.append(gap);
        continue;
      }
      const word = document.createElement("span");
      word.className = "dissolve-ts-w";
      word.setAttribute("aria-hidden", "true");
      for (const ch of w) {
        const c = document.createElement("span");
        c.className = "dissolve-ts-c";
        c.textContent = ch;
        word.append(c);
        cells.push(c);
      }
      host.append(word);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const play = () => {
    stop();
    clearTimeout(fadeTimer);
    if (reducedMotion()) {
      cells.forEach((c) => c.removeAttribute("data-g"));
      delete host.dataset.fade;
      void host.offsetWidth;
      host.dataset.fade = "";
      fadeTimer = setTimeout(() => {
        delete host.dataset.fade;
        p().onDone?.();
      }, 240);
      return;
    }
    const { duration, rate, glyphs } = p();
    const lands = landings(cells.length, duration);
    const pools = cells.map((c) => glyphs ?? (p().monospace ? SCRAMBLE_GLYPHS : glyphPool(c.textContent ?? "")));
    const pick = (i) => pools[i][Math.floor(Math.random() * pools[i].length)] ?? "";
    const t0 = performance.now();
    let step = -1;
    const f = (now) => {
      raf = 0;
      if (!sc.alive) return;
      const t = now - t0;
      const s = Math.floor(t / rate);
      let left = 0;
      cells.forEach((c, i) => {
        if (t >= lands[i]) {
          if (c.hasAttribute("data-g")) c.removeAttribute("data-g");
          return;
        }
        left++;
        if (s !== step || !c.hasAttribute("data-g")) c.dataset.g = pick(i);
      });
      step = s;
      if (left) raf = requestAnimationFrame(f);
      else p().onDone?.();
    };
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
      if (changed.has("text")) {
        render();
        play();
      } else if (changed.has("trigger")) play();
    },
    destroy() {
      stop();
      clearTimeout(fadeTimer);
      sc.dispose();
      host.textContent = "";
      for (const a of ["data-dissolve", "data-mono", "data-fade"]) host.removeAttribute(a);
      host.style.removeProperty("--dissolve-ts-glyph");
    }
  };
}
export {
  MONO,
  SCRAMBLE_GLYPHS,
  createTextScramble,
  glyphPool,
  landings
};
