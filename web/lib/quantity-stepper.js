// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  createNumberTicker
} from "./chunks/chunk-5BYG7LQO.js";
import {
  CALM,
  clamp,
  el,
  injectStyle,
  plainButton,
  propsOf,
  reducedMotion,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/quantity-stepper.core.ts
var STEPPER_SIZES = {
  sm: { h: 30, btn: 32, icon: 14, font: 13, stroke: 2.2 },
  md: { h: 36, btn: 38, icon: 16, font: 15, stroke: 2.2 }
};
var DEFAULTS = { min: 1, max: 99, size: "md", haptics: true };
var REPEAT_FROM = 380;
var REPEAT_TO = 60;
var REPEAT_RAMP = 1500;
var ROLL = 360;
var ROLL_FAST = 140;
var TRASH_ARM = 320;
var RELEASE = { stiffness: 380, damping: 15, mass: 0.7, eps: 2e-3 };
var MINUS = "M6 12h12";
var PLUS = "M12 6v12M6 12h12";
var TRASH = "M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7M10.2 10.8v5.8M13.8 10.8v5.8";
var STEPPER_ICONS = { minus: MINUS, plus: PLUS, trash: TRASH };
var icon = (d, size, stroke) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${(stroke * 24 / size).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
var CSS = `
:where([data-dissolve="quantity-stepper"]) { display: inline-flex; flex: none; will-change: transform; }
:where(.dissolve-stepper) {
  display: inline-flex; align-items: center; border-radius: 999px; background: var(--dissolve-surface, rgb(242 242 247));
  color: var(--dissolve-foreground, rgb(28 28 30)); user-select: none; -webkit-user-select: none;
}
:where(.dissolve-stepper-btn) { position: relative; height: 100%; display: grid; place-items: center; touch-action: manipulation; outline: none; -webkit-tap-highlight-color: transparent; }
:where(.dissolve-stepper-btn:focus-visible) { box-shadow: inset 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); border-radius: 999px; }
:where(.dissolve-stepper-btn[data-dim]) .dissolve-stepper-ico { opacity: .35; }
:where(.dissolve-stepper-ico) { display: grid; place-items: center; will-change: transform; }
:where(.dissolve-stepper-ic) { grid-area: 1 / 1; display: grid; place-items: center; }
:where(.dissolve-stepper-ic) svg { display: block; }
:where(.dissolve-stepper-trash) { opacity: 0; color: var(--dissolve-danger, rgb(255 59 48)); }
:where(.dissolve-stepper-count) { display: flex; justify-content: center; }
`;
function createQuantityStepper(host, initial) {
  injectStyle("dissolve-quantity-stepper", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "quantity-stepper";
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "Quantity");
  const pill = el("div");
  const minus = plainButton("dissolve-stepper-btn");
  const plus = plainButton("dissolve-stepper-btn");
  plus.setAttribute("aria-label", "Increase");
  const minusIco = el("span", "dissolve-stepper-ico");
  const plusIco = el("span", "dissolve-stepper-ico");
  const mi = el("span", "dissolve-stepper-ic");
  const tr = el("span", "dissolve-stepper-ic dissolve-stepper-trash");
  const pi = el("span", "dissolve-stepper-ic");
  minusIco.append(mi, tr);
  plusIco.append(pi);
  minus.append(minusIco);
  plus.append(plusIco);
  pill.append(minus, plus);
  host.append(pill);
  let current = p().value;
  let lastStep = 0;
  let roll = ROLL;
  const count = el("span", "dissolve-stepper-count");
  minus.after(count);
  let tk = null;
  let tkHost = null;
  const isTrash = () => p().value <= p().min && !!p().onRemove;
  const trash = value(sc, isTrash() ? 1 : 0, () => {
    const t = trash.v, rot = !reducedMotion();
    mi.style.opacity = (1 - t).toFixed(3);
    mi.style.transform = rot ? `rotate(${(90 * t).toFixed(1)}deg)` : "";
    tr.style.opacity = t.toFixed(3);
    tr.style.transform = rot ? `rotate(${(90 * (t - 1)).toFixed(1)}deg)` : "";
  });
  const shake = value(sc, 0, () => {
    host.style.transform = shake.v ? `translate3d(${shake.v.toFixed(2)}px,0,0)` : "";
  });
  const pressOf = (ico) => {
    const k = value(sc, 1, () => {
      ico.style.transform = k.v !== 1 ? `scale(${k.v.toFixed(4)})` : "";
    });
    return k;
  };
  const pm = pressOf(minusIco), pp = pressOf(plusIco);
  function build() {
    const m = STEPPER_SIZES[p().size] ?? STEPPER_SIZES.md;
    pill.style.height = m.h + "px";
    minus.style.width = plus.style.width = m.btn + "px";
    mi.innerHTML = icon(MINUS, m.icon, m.stroke);
    tr.innerHTML = icon(TRASH, m.icon, m.stroke * 0.85);
    pi.innerHTML = icon(PLUS, m.icon, m.stroke);
    tk?.destroy();
    tkHost?.remove();
    tkHost = el("span");
    count.append(tkHost);
    count.style.minWidth = m.font * 0.9 + "px";
    tk = createNumberTicker(tkHost, { value: p().value, fontSize: m.font, duration: ROLL, stagger: 18, separator: "", textClassName: p().textClassName });
  }
  function sync(instant) {
    const o = p();
    const t = isTrash() ? 1 : 0;
    if (instant) trash.set(t);
    else if (t !== trash.v) trash.to(t, reducedMotion() ? 150 : 160, CALM);
    minus.toggleAttribute("data-dim", o.value <= o.min && !o.onRemove);
    minus.setAttribute("aria-label", t ? "Remove" : "Decrease");
    plus.toggleAttribute("data-dim", o.value >= o.max);
    host.setAttribute("aria-valuenow", String(o.value));
  }
  async function bump() {
    if (p().haptics) vibrate([10, 40, 10]);
    if (reducedMotion()) return;
    const swing = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
    for (const to of [-4, 4, -4, 4, 0]) if (!await shake.to(to, 45, swing)) return;
  }
  function step(dir, pace) {
    const { min, max, haptics, onChange } = p();
    const next = current + dir;
    if (next > max || next < min) {
      if (pace === void 0 || dir > 0) bump();
      return false;
    }
    current = next;
    lastStep = performance.now();
    roll = pace === void 0 ? ROLL : clamp(pace * 1.5, ROLL_FAST, ROLL);
    onChange(next);
    if (haptics) vibrate(4);
    return true;
  }
  const tapMinus = () => {
    if (!isTrash()) return step(-1);
    if (performance.now() - lastStep < TRASH_ARM) return;
    if (p().haptics) vibrate(12);
    p().onRemove?.();
  };
  let hold = null;
  function pressIn(k, dir) {
    release(false);
    k.to(0.9, 90, CALM);
    const h = { k, dir, long: false, alive: true };
    hold = h;
    sc.wait(REPEAT_FROM).then(async () => {
      if (hold !== h || !h.alive) return;
      h.long = true;
      if (dir < 0 && isTrash()) {
        tapMinus();
        return;
      }
      const t0 = performance.now();
      while (h.alive && sc.alive) {
        const e = clamp((performance.now() - t0) / REPEAT_RAMP);
        const pace = REPEAT_FROM - (REPEAT_FROM - REPEAT_TO) * (1 - (1 - e) * (1 - e));
        if (!step(dir, pace)) break;
        await sc.wait(pace);
      }
    });
  }
  function release(tap) {
    if (!hold) return;
    const h = hold;
    hold = null;
    h.alive = false;
    h.k.spring(1, RELEASE);
    if (tap && !h.long) h.dir < 0 ? tapMinus() : step(1);
  }
  const offs = [];
  const on = (node, type, fn) => {
    node.addEventListener(type, fn);
    offs.push(() => node.removeEventListener(type, fn));
  };
  for (const [btn, dir, k] of [[minus, -1, pm], [plus, 1, pp]]) {
    on(btn, "pointerdown", (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
      }
      pressIn(k, dir);
    });
    on(btn, "pointerup", (e) => {
      const r = btn.getBoundingClientRect();
      release(e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6);
    });
    on(btn, "pointercancel", () => release(false));
    on(btn, "click", (e) => {
      if (e.detail === 0) dir < 0 ? tapMinus() : step(1);
    });
  }
  on(host, "keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  });
  pill.className = "dissolve-stepper" + (p().className ? " " + p().className : "");
  build();
  sync(true);
  return {
    update(next) {
      const changed = props.update(next);
      current = p().value;
      if (!changed.size) return;
      if (changed.has("className")) pill.className = "dissolve-stepper" + (p().className ? " " + p().className : "");
      if (changed.has("size")) build();
      else {
        if (changed.has("textClassName")) tk.update({ textClassName: p().textClassName });
        if (changed.has("value")) tk.update({ value: p().value, duration: reducedMotion() ? 0 : roll });
      }
      if (["value", "min", "max", "onRemove"].some((k) => changed.has(k))) sync(false);
    },
    destroy() {
      sc.dispose();
      hold = null;
      offs.forEach((off) => off());
      tk?.destroy();
      pill.remove();
      host.style.removeProperty("transform");
      for (const a of ["role", "aria-label", "aria-valuenow"]) host.removeAttribute(a);
      delete host.dataset.dissolve;
    }
  };
}
export {
  STEPPER_ICONS,
  STEPPER_SIZES,
  createQuantityStepper
};
