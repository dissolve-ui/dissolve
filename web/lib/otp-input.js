// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  play,
  snapshot
} from "./chunks/chunk-6TDGCXIW.js";
import {
  CALM,
  QUAD,
  el,
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/otp-input.core.ts
var DEFAULTS = { length: 6, autoFocus: false, height: 56, gap: 8, fontSize: 26, radius: 14, blurOnSuccess: true, haptics: true };
var TEXT = "var(--dissolve-foreground, rgb(28 28 30))";
var BOX = "var(--dissolve-surface, rgb(242 242 247))";
var GLOW = "var(--dissolve-surface-2, rgb(229 229 234))";
var BORDER = "var(--dissolve-border, rgb(60 60 67 / 0.12))";
var SUCCESS = "var(--dissolve-success, rgb(52 199 89))";
var DANGER = "var(--dissolve-danger, rgb(255 59 48))";
var CSS = `
:where([data-dissolve="otp-input"]) {
  display: block;
  --otp-success-fill: color-mix(in srgb, ${BOX} 88%, ${SUCCESS});
  --otp-danger-fill: color-mix(in srgb, ${BOX} 88%, ${DANGER});
}
:where([data-dissolve="otp-input"][data-fixed]) { width: fit-content; margin-inline: auto; }
:where(.dissolve-otp-shake) { position: relative; will-change: transform; }
:where(.dissolve-otp-row) { display: flex; }
:where(.dissolve-otp-digits) { position: absolute; inset: 0; pointer-events: none; }
:where(.dissolve-otp-box, .dissolve-otp-cell) { flex: 1; min-width: 0; display: grid; place-items: center; }
:where(.dissolve-otp-glyph) { font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; opacity: 0; }
:where(.dissolve-otp-caret) { display: block; width: 2px; border-radius: 1px; background: ${TEXT}; animation: dissolve-otp-caret 1.12s infinite; }
@keyframes dissolve-otp-caret {
  0%, 42.8% { opacity: 1; animation-timing-function: cubic-bezier(0.45, 0, 0.2, 1); }
  57.1%, 85.7% { opacity: 0; animation-timing-function: cubic-bezier(0.45, 0, 0.2, 1); }
  100% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { :where(.dissolve-otp-caret) { animation: none; } }
`;
var FIELD = {
  position: "absolute",
  inset: "0",
  width: "100%",
  height: "100%",
  margin: "0",
  padding: "0",
  border: "0",
  opacity: "0.011",
  color: "transparent",
  caretColor: "transparent",
  background: "transparent",
  fontSize: "16px",
  cursor: "text",
  outline: "none"
};
var SWINGS = [[-11, 55], [9, 85], [-6, 80], [4, 75], [-2, 70], [0, 65]];
var SIN = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
var blend = (a, b, k) => k <= 0 ? a : k >= 1 ? b : `color-mix(in srgb, ${a} ${((1 - k) * 100).toFixed(2)}%, ${b})`;
function createOtpInput(host, initial = {}) {
  injectStyle("dissolve-otp-input", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "otp-input";
  const shaker = el("div", "dissolve-otp-shake");
  const row = el("div", "dissolve-otp-row");
  const digits = el("div", "dissolve-otp-row dissolve-otp-digits");
  const input = el("input");
  Object.assign(input, { type: "text", inputMode: "numeric", autocomplete: "one-time-code", spellcheck: false });
  input.setAttribute("autocorrect", "off");
  Object.assign(input.style, FIELD);
  shaker.append(row, digits, input);
  host.append(shaker);
  let code = "", phase = "idle", focused = false, run = 0, sweeping = false;
  let slots = [];
  const clean = (s) => s.replace(/\D/g, "").slice(0, p().length);
  const sweep = value(sc, 0, () => slots.forEach((s) => s.draw()));
  const shake = value(sc, 0, () => {
    shaker.style.transform = shake.v ? `translate3d(${shake.v.toFixed(2)}px,0,0)` : "";
  });
  function makeSlot(i) {
    const box = el("div");
    const cell = el("div", "dissolve-otp-cell");
    const glyph = el("span");
    cell.append(glyph);
    row.append(box);
    digits.append(cell);
    const s = { box, cell, glyph, caret: null, on: false };
    s.draw = () => {
      const x = sweep.v * (p().length + 2) - 1 - i;
      const glow = sweep.v === 0 ? 0 : Math.max(0, 1 - Math.abs(x) / 1.4);
      const t = s.tone.v;
      const base = blend(BORDER, TEXT, s.a.v);
      const border = t < 0 ? blend(base, DANGER, -t) : blend(base, SUCCESS, t);
      const fillBase = blend(BOX, GLOW, glow);
      box.style.background = t < 0 ? blend(fillBase, "var(--otp-danger-fill)", -t) : blend(fillBase, "var(--otp-success-fill)", t);
      box.style.boxShadow = `inset 0 0 0 ${(1 + 0.5 * Math.max(s.a.v, Math.abs(t))).toFixed(2)}px ${border}`;
      const lift = 1 + s.pop.v * 0.05;
      box.style.transform = cell.style.transform = lift === 1 ? "" : `scale(${lift.toFixed(4)})`;
      glyph.style.color = t < 0 ? blend(TEXT, DANGER, -t) : blend(TEXT, SUCCESS, t);
      const k = s.land.v;
      glyph.style.opacity = k.toFixed(3);
      glyph.style.transform = `translateY(${((1 - k) * 5).toFixed(2)}px) scale(${(0.72 + 0.28 * k).toFixed(4)})`;
    };
    s.a = value(sc, 0, s.draw);
    s.tone = value(sc, 0, s.draw);
    s.pop = value(sc, 0, s.draw);
    s.land = value(sc, 0, s.draw);
    return s;
  }
  function build() {
    row.replaceChildren();
    digits.replaceChildren();
    slots = Array.from({ length: p().length }, (_, i) => makeSlot(i));
    input.maxLength = p().length;
    input.setAttribute("aria-label", `${p().length} digit code`);
    style();
    const shown = code;
    code = "";
    show(shown.slice(0, p().length));
  }
  function style() {
    const { height, boxWidth, gap, fontSize, radius, boxClassName, digitClassName } = p();
    host.toggleAttribute("data-fixed", !!boxWidth);
    row.style.gap = digits.style.gap = gap + "px";
    for (const s of slots) {
      s.box.className = "dissolve-otp-box" + (boxClassName ? " " + boxClassName : "");
      s.glyph.className = "dissolve-otp-glyph" + (digitClassName ? " " + digitClassName : "");
      for (const n of [s.box, s.cell]) {
        n.style.height = height + "px";
        n.style.flex = boxWidth ? `0 0 ${boxWidth}px` : "";
      }
      s.box.style.borderRadius = radius + "px";
      s.glyph.style.fontSize = fontSize + "px";
      s.draw();
    }
    syncActive(true);
  }
  function syncActive(restyle = false) {
    const { length, fontSize } = p();
    const active = Math.min(code.length, length - 1);
    slots.forEach((s, i) => {
      const on = phase === "idle" && i === active && code.length < length;
      if (s.on !== on) {
        s.on = on;
        s.a.to(on ? 1 : 0, 180, CALM);
      }
      s.caret?.remove();
      s.caret = null;
      if (on && focused) {
        s.caret = el("i", "dissolve-otp-caret");
        s.caret.style.height = Math.round(fontSize * 1.05) + "px";
        s.box.append(s.caret);
      }
      if (restyle) s.draw();
    });
    if (code.length) input.setAttribute("aria-description", `${code.length} of ${length} digits entered`);
    else input.removeAttribute("aria-description");
  }
  function show(next) {
    const prev = code;
    code = next;
    input.value = next;
    slots.forEach((s, i) => {
      const ch = next[i] ?? "";
      if (ch === (prev[i] ?? "")) return;
      s.glyph.textContent = ch;
      s.land.set(0);
      if (ch) s.land.to(1, 220, CALM);
    });
    syncActive();
  }
  function setCode(next) {
    if (p().value === void 0) show(next);
    p().onChange?.(next);
  }
  function setPhase(next) {
    phase = next;
    slots.forEach((s, i) => {
      if (next === "success") {
        s.tone.to(1, 260, CALM, i * 40);
        s.pop.to(1, 130, CALM, i * 40).then((ok) => ok && s.pop.to(0, 260, CALM));
      } else if (next === "error") s.tone.to(-1, 200, CALM);
      else s.tone.to(0, 260, CALM);
    });
    syncActive();
  }
  async function sweepLoop() {
    sweeping = true;
    while (sweeping && sc.alive) {
      sweep.set(0);
      await sweep.to(1, 1100, QUAD);
    }
  }
  async function doShake() {
    for (const [to, d] of SWINGS) await shake.to(to, d, SIN);
  }
  function digitsSnapshot() {
    const r = digits.getBoundingClientRect();
    const source = snapshot(r.width, r.height, (ctx) => {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const s of slots) {
        if (!s.glyph.textContent) continue;
        const cs = getComputedStyle(s.glyph), b = s.glyph.getBoundingClientRect(), c = s.cell.getBoundingClientRect();
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        ctx.fillStyle = cs.color;
        ctx.fillText(s.glyph.textContent, c.left - r.left + c.width / 2, b.top - r.top + b.height / 2 + 1);
      }
    });
    return { source, x: r.left, y: r.top, w: r.width, h: r.height };
  }
  async function verify(full) {
    const check = p().onComplete;
    if (!check) return;
    const id = ++run;
    const refocus = focused;
    const out = check(full);
    if (!!out && typeof out.then === "function") {
      setPhase("pending");
      if (!reducedMotion()) sweepLoop();
    }
    let res;
    try {
      res = await out;
    } catch {
      res = false;
    }
    sweeping = false;
    sweep.to(0, 160, QUAD);
    if (!sc.alive || id !== run) return;
    if (res === true) {
      setPhase("success");
      if (p().haptics) vibrate([10, 40, 18]);
      if (p().blurOnSuccess && focused) sc.wait(280).then(() => input.blur());
      return;
    }
    if (res !== false) {
      setPhase("idle");
      return;
    }
    setPhase("error");
    if (p().haptics) vibrate([30, 60, 30]);
    if (!reducedMotion()) doShake();
    await sc.wait(520);
    if (id !== run) return;
    if (reducedMotion()) {
      digits.style.opacity = "0";
    } else {
      const shot = digitsSnapshot();
      digits.style.opacity = "0";
      await sc.track(play({ ...shot, preset: "dust", duration: 900, grain: 2, origin: "left" })).done;
    }
    if (!sc.alive || id !== run) return;
    setCode("");
    digits.style.opacity = "";
    setPhase("idle");
    if (refocus) input.focus({ preventScroll: true });
  }
  function accept(text) {
    if (phase !== "idle") {
      input.value = code;
      return;
    }
    const next = clean(text);
    if (next !== input.value) input.value = next;
    if (next === code) return;
    setCode(next);
    if (next.length === p().length) verify(next);
  }
  const atEnd = () => input.setSelectionRange(input.value.length, input.value.length);
  const onInput = () => accept(input.value);
  const onFocus = () => {
    focused = true;
    atEnd();
    syncActive();
  };
  const onBlur = () => {
    focused = false;
    syncActive();
  };
  const onSelect = () => {
    if (input.selectionStart !== input.value.length) atEnd();
  };
  input.addEventListener("input", onInput);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  input.addEventListener("select", onSelect);
  function reset() {
    run++;
    sweeping = false;
    sweep.to(0, 160, QUAD);
    digits.style.opacity = "";
    setCode("");
    setPhase("idle");
  }
  if (p().value !== void 0) code = clean(p().value);
  build();
  if (p().autoFocus) input.focus();
  return {
    reset,
    focus: () => input.focus({ preventScroll: true }),
    blur: () => input.blur(),
    update(next) {
      const changed = props.update(next);
      if (changed.has("length")) build();
      else if (["height", "boxWidth", "gap", "fontSize", "radius", "boxClassName", "digitClassName"].some((k) => changed.has(k))) style();
      if (changed.has("value") && p().value !== void 0) show(clean(p().value));
    },
    destroy() {
      sc.dispose();
      input.removeEventListener("input", onInput);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("select", onSelect);
      shaker.remove();
      host.removeAttribute("data-fixed");
      delete host.dataset.dissolve;
    }
  };
}
export {
  createOtpInput
};
