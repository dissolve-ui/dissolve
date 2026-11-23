// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  clamp,
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/avatar-stack.core.ts
var AVATAR_STACK_SIZES = {
  sm: { size: 28, ring: 1.5, font: 11 },
  md: { size: 36, ring: 2, font: 13 },
  lg: { size: 44, ring: 2, font: 15 }
};
var DEFAULTS = { avatars: [], max: 4, size: "md", overlap: 0.3, spreadGap: 6, haptics: true };
var SPRING = { stiffness: 260, damping: 20, mass: 1, eps: 2e-3 };
var TAP_HOLD = 2200;
var HOLD = 140;
var TIP_GAP = 8;
var MORE = "\0more";
var CSS = `
:where([data-dissolve="avatar-stack"]) { position: relative; display: block; flex: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: pan-y; outline: none; }
:where([data-dissolve="avatar-stack"]:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 4px; border-radius: 999px; }
:where(.dissolve-avatar) { position: absolute; left: 0; box-sizing: content-box; border-radius: 50%; background: var(--dissolve-background, rgb(255 255 255)); will-change: transform, opacity; }
:where(.dissolve-avatar-face) { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: var(--dissolve-surface-2, rgb(229 229 234)); color: var(--dissolve-foreground, rgb(28 28 30)); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; outline: 1px solid var(--dissolve-border, rgb(60 60 67 / 0.12)); outline-offset: -1px; }
:where(.dissolve-avatar-face img) { display: block; width: 100%; height: 100%; object-fit: cover; }
:where(.dissolve-avatar-tip) { position: absolute; left: 0; bottom: calc(100% + ${TIP_GAP}px); width: 0; display: flex; flex-direction: column; align-items: center; pointer-events: none; opacity: 0; z-index: 200; }
:where(.dissolve-avatar-tip-pill) { padding: 5px 9px; border-radius: 8px; white-space: nowrap; font: 600 12px/16px system-ui, -apple-system, sans-serif; background: var(--dissolve-foreground, rgb(28 28 30)); color: var(--dissolve-background, rgb(255 255 255)); }
:where(.dissolve-avatar-tip-arrow) { width: 8px; height: 8px; margin-top: -5px; border-radius: 1.5px; transform: rotate(45deg); background: var(--dissolve-foreground, rgb(28 28 30)); }
`;
var initials = (name) => {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
};
function createAvatarStack(host, initial = {}) {
  injectStyle("dissolve-avatar-stack", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "avatar-stack";
  host.setAttribute("role", "group");
  if (!host.hasAttribute("tabindex")) host.tabIndex = 0;
  const tip = document.createElement("div");
  tip.className = "dissolve-avatar-tip";
  tip.setAttribute("aria-hidden", "true");
  const pill = document.createElement("div");
  pill.className = "dissolve-avatar-tip-pill";
  const arrow = document.createElement("div");
  arrow.className = "dissolve-avatar-tip-arrow";
  tip.append(pill, arrow);
  host.append(tip);
  let raf = 0;
  const schedule = () => {
    if (!raf && sc.alive) raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  };
  sc.onDispose(() => cancelAnimationFrame(raf));
  const sp = value(sc, 0, schedule);
  const count = value(sc, 0, schedule);
  const tipX = value(sc, 0, schedule);
  const tipA = value(sc, 0, schedule);
  const slots = /* @__PURE__ */ new Map();
  let order = [];
  let shownN = 0;
  let hover = -1;
  const geo = () => {
    const s = AVATAR_STACK_SIZES[p().size] ?? AVATAR_STACK_SIZES.md;
    return { ...s, closed: s.size * (1 - p().overlap), open: s.size + p().spreadGap };
  };
  const anim = (v, to, ms = 160) => reducedMotion() ? v.to(to, ms === 0 ? 0 : Math.min(ms, 120)) : v.spring(to, SPRING);
  function render() {
    const g = geo();
    const step = g.closed + (g.open - g.closed) * sp.v;
    host.style.width = Math.max(0, (count.v - 1) * step + g.size) + "px";
    host.style.height = g.size + "px";
    for (const s of slots.values()) {
      const scale = reducedMotion() ? 1 : 0.6 + 0.4 * s.life.v;
      s.node.style.transform = `translate(${s.idx.v * step - g.ring}px, ${-g.ring - s.lift.v * 3}px) scale(${scale})`;
      s.node.style.opacity = String(clamp(s.life.v));
    }
    tip.style.opacity = String(tipA.v);
    tip.style.transform = `translate(${tipX.v * step + g.size / 2}px, ${(1 - tipA.v) * 4}px) scale(${0.96 + tipA.v * 0.04})`;
  }
  function slotNode() {
    const node = document.createElement("div");
    node.className = "dissolve-avatar";
    const face = document.createElement("div");
    face.className = "dissolve-avatar-face";
    node.append(face);
    return { node, face };
  }
  function sizeSlot(s) {
    const g = geo();
    Object.assign(s.node.style, { width: g.size + "px", height: g.size + "px", padding: g.ring + "px", top: "0" });
    s.face.style.fontSize = g.font + "px";
  }
  function paintFace(s, item, rest) {
    if (!item) {
      const t = `+${rest}`;
      if (s.label !== t) {
        s.face.textContent = t;
        s.label = t;
      }
      return;
    }
    if (s.src === item.src && s.label === item.name) return;
    s.src = item.src;
    s.label = item.name;
    s.face.replaceChildren();
    if (item.src) {
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.src = item.src;
      img.onerror = () => {
        img.remove();
        s.face.textContent = initials(item.name);
      };
      s.face.append(img);
    } else s.face.textContent = initials(item.name);
  }
  function build(instant = false) {
    const { avatars, max } = p();
    const shown = avatars.length > max ? avatars.slice(0, max) : avatars;
    const rest = avatars.length - shown.length;
    shownN = shown.length;
    const keys = [...shown.map((a) => a.id), ...rest > 0 ? [MORE] : []];
    keys.forEach((key, i) => {
      let s = slots.get(key);
      if (!s || s.leaving) {
        if (s) s.node.remove();
        const { node, face } = slotNode();
        s = { key, node, face, idx: value(sc, i, schedule), life: value(sc, instant ? 1 : 0, schedule), lift: value(sc, 0, schedule), leaving: false, label: "" };
        slots.set(key, s);
        host.insertBefore(node, tip);
        if (!instant) anim(s.life, 1, 180);
      } else if (s.idx.v !== i) anim(s.idx, i);
      sizeSlot(s);
      paintFace(s, key === MORE ? null : shown[i], rest);
      s.node.style.zIndex = String(keys.length - i);
    });
    for (const s of slots.values()) {
      if (keys.includes(s.key) || s.leaving) continue;
      s.leaving = true;
      s.node.style.zIndex = "0";
      s.life.to(0, 160).then((done) => {
        if (done && s.leaving) {
          s.node.remove();
          slots.delete(s.key);
        }
      });
    }
    order = keys;
    if (instant) count.set(keys.length);
    else anim(count, keys.length);
    const names = shown.map((a) => a.name).join(", ");
    host.setAttribute("aria-label", rest > 0 ? `${names} and ${rest} more` : names);
    if (hover >= shownN) name(-1);
    schedule();
  }
  function spread(on2) {
    anim(sp, on2 ? 1 : 0);
  }
  function name(i) {
    if (i === hover) return;
    const prev = hover;
    hover = i;
    if (prev >= 0) {
      const s = slots.get(order[prev]);
      if (s) {
        anim(s.lift, 0);
        s.node.style.zIndex = String(order.length - prev);
      }
    }
    if (i >= 0) {
      const s = slots.get(order[i]);
      if (s) {
        anim(s.lift, reducedMotion() ? 0 : 1);
        s.node.style.zIndex = "100";
      }
      pill.textContent = p().avatars.find((a) => a.id === order[i])?.name ?? "";
      if (tipA.v < 0.05) tipX.set(i);
      else anim(tipX, i);
      tipA.to(1, 160);
      if (p().haptics) vibrate(3);
    } else tipA.to(0, 120);
  }
  const at = (clientX, spreadNow = sp.v > 0.5) => {
    const g = geo();
    const x = clientX - host.getBoundingClientRect().left;
    const i = Math.floor(x / (spreadNow ? g.open : g.closed));
    return i >= 0 && i < shownN ? i : spreadNow ? -1 : Math.min(shownN - 1, Math.max(0, i));
  };
  let tapTimer;
  let holdTimer;
  let touch = null;
  const closeLater = () => {
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      spread(false);
      name(-1);
    }, TAP_HOLD);
  };
  const onEnter = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(tapTimer);
    spread(true);
  };
  const onMove = (e) => {
    if (e.pointerType === "mouse") return name(at(e.clientX, true));
    if (!touch || touch.id !== e.pointerId) return;
    if (touch.held) return name(at(e.clientX, true));
    if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) {
      clearTimeout(holdTimer);
      touch = null;
    }
  };
  const onLeave = (e) => {
    if (e.pointerType !== "mouse") return;
    spread(false);
    name(-1);
  };
  const onDown = (e) => {
    if (e.pointerType === "mouse") return;
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, held: false };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (!touch) return;
      touch.held = true;
      clearTimeout(tapTimer);
      try {
        host.setPointerCapture(touch.id);
      } catch {
      }
      spread(true);
      name(at(touch.x, true));
    }, HOLD);
  };
  const onUp = (e) => {
    if (!touch || touch.id !== e.pointerId) return;
    clearTimeout(holdTimer);
    if (touch.held) {
      spread(false);
      name(-1);
    } else if (e.type === "pointerup") {
      const i = at(e.clientX);
      spread(true);
      name(i);
      closeLater();
    }
    touch = null;
  };
  const onFocus = () => {
    if (host.matches(":focus-visible")) {
      spread(true);
      name(0);
    }
  };
  const onBlur = () => {
    spread(false);
    name(-1);
  };
  const onKey = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    spread(true);
    const last = shownN - 1;
    name(e.key === "Home" ? 0 : e.key === "End" ? last : Math.max(0, Math.min(last, hover + (e.key === "ArrowRight" ? 1 : -1))));
  };
  const on = [
    ["pointerenter", onEnter],
    ["pointermove", onMove],
    ["pointerleave", onLeave],
    ["pointerdown", onDown],
    ["pointerup", onUp],
    ["pointercancel", onUp],
    ["focus", onFocus],
    ["blur", onBlur],
    ["keydown", onKey]
  ];
  for (const [t, f] of on) host.addEventListener(t, f);
  build(true);
  render();
  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has("avatars") || changed.has("max")) build();
      if (changed.has("size") || changed.has("overlap") || changed.has("spreadGap")) {
        for (const s of slots.values()) sizeSlot(s);
        schedule();
      }
    },
    destroy() {
      sc.dispose();
      clearTimeout(tapTimer);
      clearTimeout(holdTimer);
      for (const [t, f] of on) host.removeEventListener(t, f);
      for (const s of slots.values()) s.node.remove();
      slots.clear();
      tip.remove();
      for (const k of ["width", "height"]) host.style.removeProperty(k);
      for (const a of ["role", "aria-label", "data-dissolve", "tabindex"]) host.removeAttribute(a);
    }
  };
}
export {
  AVATAR_STACK_SIZES,
  createAvatarStack
};
