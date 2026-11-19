// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  play,
  snapshot
} from "./chunks/chunk-6TDGCXIW.js";
import {
  el,
  fit,
  fontOf,
  frame,
  injectStyle,
  propsOf,
  rectOf,
  rr,
  scope,
  token
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/toast.core.ts
var DEFAULTS = { top: 56, max: 3 };
var DOT = {
  default: ["muted", "rgb(142 142 147)"],
  success: ["success", "rgb(52 199 89)"],
  error: ["danger", "rgb(255 59 48)"]
};
var CSS = `
:where([data-dissolve="toast"]) {
  position: fixed; top: var(--dissolve-toast-top, 56px); left: 12px; right: 12px; z-index: 50;
  max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; pointer-events: none;
}
:where(.dissolve-toast-slot) { margin-bottom: 8px; transition: height .32s cubic-bezier(0.32, 0.72, 0, 1), margin .32s cubic-bezier(0.32, 0.72, 0, 1); }
:where(.dissolve-toast-slot[data-gone]) { height: 0 !important; margin-bottom: 0; }
:where(.dissolve-toast-card) {
  display: block; border-radius: 18px; cursor: pointer; pointer-events: auto;
  background-color: var(--dissolve-primary, rgb(28 28 30)); color: var(--dissolve-primary-foreground, rgb(255 255 255));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18); -webkit-user-select: none; user-select: none;
}
`;
function layoutOf(ctx, w, o, font) {
  const h = o.message ? 62 : 46;
  if (!o.action) return { w, h, action: null };
  ctx.font = `600 14px ${font}`;
  const aw = Math.ceil(ctx.measureText(o.action.label).width) + 24, ah = 32;
  return { w, h, action: { x: w - 14 - aw, y: (h - ah) / 2, w: aw, h: ah } };
}
function draw(ctx, { w, h, action }, o, k) {
  const text = (str, x, y, size, weight, alpha, align = "left") => {
    ctx.font = `${weight} ${size}px ${k.font}`;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = k.fg;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
    ctx.globalAlpha = 1;
  };
  ctx.fillStyle = k.bg;
  rr(ctx, 0, 0, w, h, k.radius);
  ctx.fill();
  ctx.fillStyle = k.dot;
  ctx.beginPath();
  ctx.arc(18, h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  const tx = 34, right = (action ? action.x - 12 : w - 14) - tx;
  ctx.font = `600 15px ${k.font}`;
  text(fit(ctx, o.title, right), tx, o.message ? h / 2 - 3 : h / 2 + 5.5, 15, 600, 1);
  if (o.message) {
    ctx.font = `400 13px ${k.font}`;
    text(fit(ctx, o.message, right), tx, h / 2 + 15, 13, 400, 0.7);
  }
  if (action && o.action) {
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = k.fg;
    rr(ctx, action.x, action.y, action.w, action.h, action.h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    text(o.action.label, action.x + action.w / 2, action.y + 21, 14, 600, 1, "center");
  }
}
function createToast(host, initial = {}) {
  injectStyle("dissolve-toast", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const items = [];
  let next = 1;
  host.dataset.dissolve = "toast";
  host.setAttribute("aria-live", "polite");
  const place = () => host.style.setProperty("--dissolve-toast-top", p().top + "px");
  place();
  function show(o) {
    const id = next++;
    if (!sc.alive) return id;
    const w = Math.round(host.clientWidth);
    const fixed = getComputedStyle(host).position === "fixed";
    const cls = "dissolve-toast-card" + (p().cardClassName ? " " + p().cardClassName : "");
    const probe = el("canvas", cls);
    const slot = el("div", "dissolve-toast-slot");
    slot.append(probe);
    host.append(slot);
    const cs = getComputedStyle(probe);
    const font = fontOf(host);
    const [dotToken, dotFallback] = DOT[o.tone ?? "default"];
    const look = {
      bg: cs.backgroundColor,
      fg: cs.color,
      dot: token(probe, dotToken, dotFallback),
      radius: parseFloat(cs.borderTopLeftRadius) || 0,
      font
    };
    const L = layoutOf(probe.getContext("2d"), w, o, font);
    const card = snapshot(w, L.h, (ctx) => draw(ctx, L, o, look));
    card.className = cls;
    Object.assign(card.style, { width: w + "px", height: L.h + "px", opacity: "0", backgroundColor: "transparent" });
    probe.replaceWith(card);
    card.setAttribute("role", "status");
    card.setAttribute("aria-label", [o.title, o.message, o.action ? `${o.action.label} available` : ""].filter(Boolean).join(". "));
    const it = {
      id,
      o,
      slot,
      gone: false,
      timer: void 0,
      async leave() {
        if (it.gone) return;
        it.gone = true;
        clearTimeout(it.timer);
        const r = rectOf(card);
        card.style.opacity = "0";
        await sc.track(play({ source: card, ...r, preset: o.exit ?? "dust", duration: 1100, fixed })).done;
        if (!sc.alive) return;
        slot.style.height = slot.offsetHeight + "px";
        void slot.offsetHeight;
        slot.dataset.gone = "";
        await sc.wait(330);
        slot.remove();
        items.splice(items.indexOf(it), 1);
      }
    };
    items.push(it);
    card.addEventListener("click", (e) => {
      const b = card.getBoundingClientRect(), s = b.width / card.offsetWidth || 1;
      const x = (e.clientX - b.left) / s, y = (e.clientY - b.top) / s, a = L.action;
      if (a && x >= a.x - 8 && x <= a.x + a.w + 8 && y >= a.y - 8 && y <= a.y + a.h + 8) o.action?.onPress();
      it.leave();
    });
    const live = items.filter((x) => !x.gone);
    live.slice(0, Math.max(0, live.length - p().max)).forEach((x) => x.leave());
    (async () => {
      await frame();
      if (!sc.alive) return;
      await sc.track(play({ source: card, ...rectOf(card), preset: o.enter ?? "gather", direction: "in", duration: 900, fixed })).done;
      if (!sc.alive || it.gone) return;
      card.style.opacity = "1";
      const ms = o.duration ?? 3200;
      if (ms) it.timer = setTimeout(it.leave, ms);
    })();
    return id;
  }
  return {
    show,
    hide: (id) => {
      items.find((x) => x.id === id)?.leave();
    },
    update(nextProps) {
      if (props.update(nextProps).has("top")) place();
    },
    destroy() {
      sc.dispose();
      items.forEach((x) => {
        clearTimeout(x.timer);
        x.slot.remove();
      });
      items.length = 0;
      delete host.dataset.dissolve;
      host.removeAttribute("aria-live");
      host.style.removeProperty("--dissolve-toast-top");
    }
  };
}
export {
  createToast
};
