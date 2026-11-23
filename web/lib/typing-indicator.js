// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  CALM,
  el,
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  value
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/typing-indicator.core.ts
var DEFAULTS = { maxAvatars: 3, size: 28, showLabel: true };
var POP = { stiffness: 320, damping: 22, eps: 2e-3 };
var SLIDE = { stiffness: 280, damping: 28, eps: 0.05 };
var OUT_MS = 180;
var OVERLAP = 0.36;
function typingLabel(names) {
  const n = names.length;
  if (!n) return "";
  if (n === 1) return `${names[0]} is typing`;
  if (n === 2) return `${names[0]} and ${names[1]} are typing`;
  if (n === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing`;
  return `${names[0]}, ${names[1]} and ${n - 2} others are typing`;
}
var initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
var CSS = `
:where([data-dissolve="typing-indicator"]) { position: relative; display: inline-flex; flex-direction: column; align-items: flex-start; gap: 6px; }
:where(.dissolve-ti-row) { display: flex; align-items: center; gap: 8px; transform-origin: left center; }
:where(.dissolve-ti-stack) { position: relative; flex: none; }
:where(.dissolve-ti-av) { position: absolute; top: 0; left: 0; box-sizing: border-box; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--dissolve-surface-2, rgb(229 229 234)); color: var(--dissolve-foreground, rgb(28 28 30)); box-shadow: 0 0 0 2px var(--dissolve-background, #fff); font-weight: 600; letter-spacing: -0.01em; user-select: none; will-change: transform, opacity; }
:where(.dissolve-ti-av img) { width: 100%; height: 100%; object-fit: cover; display: block; }
:where(.dissolve-ti-av[data-more]) { background: var(--dissolve-surface, rgb(242 242 247)); color: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-ti-bubble) { display: flex; align-items: center; gap: var(--ti-gap); height: var(--ti-h); padding: 0 var(--ti-pad); box-sizing: border-box; border-radius: 999px; background: var(--dissolve-surface, rgb(242 242 247)); flex: none; }
:where(.dissolve-ti-dot) { width: var(--ti-dot); height: var(--ti-dot); border-radius: 50%; background: var(--dissolve-muted, rgb(142 142 147)); animation: dissolve-ti-wave 1.2s infinite; }
:where(.dissolve-ti-dot:nth-child(2)) { animation-delay: 0.15s; }
:where(.dissolve-ti-dot:nth-child(3)) { animation-delay: 0.3s; }
@keyframes dissolve-ti-wave { 0%, 60%, 100% { transform: translateY(0); opacity: 0.45; } 30% { transform: translateY(-3px); opacity: 1; } }
@keyframes dissolve-ti-pulse { 0%, 60%, 100% { opacity: 0.45; } 30% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { :where(.dissolve-ti-dot) { animation-name: dissolve-ti-pulse; } }
:where(.dissolve-ti-sr) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
:where(.dissolve-ti-label) { position: relative; height: 18px; font-size: 13px; line-height: 18px; color: var(--dissolve-muted, rgb(142 142 147)); white-space: nowrap; }
:where(.dissolve-ti-label > span) { position: absolute; left: 0; top: 0; transition: opacity 160ms ease, transform 200ms cubic-bezier(0.32, 0.72, 0, 1); }
:where(.dissolve-ti-label > span:not([data-out])) { transition-delay: 90ms; }
:where(.dissolve-ti-label > span[data-out]) { opacity: 0; transform: translateY(-4px); }
:where(.dissolve-ti-label > span[data-in]) { opacity: 0; transform: translateY(4px); }
`;
function createTypingIndicator(host, initial) {
  injectStyle("dissolve-typing-indicator", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "typing-indicator";
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  const row = el("div", "dissolve-ti-row");
  const stack = el("div", "dissolve-ti-stack");
  const bubble = el("div", "dissolve-ti-bubble", '<i class="dissolve-ti-dot"></i><i class="dissolve-ti-dot"></i><i class="dissolve-ti-dot"></i>');
  bubble.setAttribute("aria-hidden", "true");
  stack.setAttribute("aria-hidden", "true");
  const label = el("div", "dissolve-ti-label");
  label.setAttribute("aria-hidden", "true");
  const sr = el("span", "dissolve-ti-sr");
  row.append(stack, bubble);
  host.append(row, label, sr);
  const nodes = /* @__PURE__ */ new Map();
  const step = () => p().size * (1 - OVERLAP);
  const shown = value(sc, 0, () => {
    const v = shown.v;
    row.style.opacity = String(Math.min(1, v));
    row.style.transform = `scale(${0.85 + 0.15 * v})`;
    label.style.opacity = String(Math.min(1, v));
  });
  const width = value(sc, 0, () => {
    stack.style.width = `${Math.max(0, width.v)}px`;
  });
  const paintNode = (n) => {
    const s = n.s.v;
    const still = reducedMotion();
    n.el.style.opacity = String(Math.max(0, Math.min(1, s)));
    n.el.style.transform = `translateX(${n.x.v}px) scale(${still ? 1 : 0.5 + 0.5 * s})`;
  };
  const makeNode = (key, t, more) => {
    const d = el("div", "dissolve-ti-av");
    const n = { key, el: d, leaving: false, x: null, s: null };
    n.x = value(sc, 0, () => paintNode(n));
    n.s = value(sc, 0, () => paintNode(n));
    fill(n, t, more);
    stack.append(d);
    return n;
  };
  const fill = (n, t, more) => {
    const sz = p().size;
    Object.assign(n.el.style, { width: `${sz}px`, height: `${sz}px`, fontSize: `${Math.round(sz * 0.38)}px` });
    if (!t) {
      n.el.dataset.more = "";
      n.el.textContent = `+${more}`;
      return;
    }
    if (t.avatar) {
      if (n.el.querySelector("img")?.getAttribute("src") !== t.avatar) {
        n.el.textContent = "";
        const img = document.createElement("img");
        img.src = t.avatar;
        img.alt = "";
        img.draggable = false;
        n.el.append(img);
      }
    } else n.el.textContent = initials(t.name);
  };
  let labelText = "";
  const setLabel = (text) => {
    if (text === labelText) return;
    labelText = text;
    sr.textContent = text;
    label.querySelectorAll("span").forEach((old) => {
      old.dataset.out = "";
      sc.wait(220).then(() => old.remove());
    });
    if (!text) return;
    const s = document.createElement("span");
    s.textContent = text;
    s.dataset.in = "";
    label.append(s);
    void s.offsetWidth;
    delete s.dataset.in;
    label.style.width = `${Math.max(label.offsetWidth, s.offsetWidth)}px`;
    sc.wait(220).then(() => {
      if (labelText === text) label.style.width = `${s.offsetWidth}px`;
    });
  };
  const sync = (first = false) => {
    const { typers, maxAvatars, showLabel } = p();
    const still = reducedMotion() || first;
    const over = typers.length > maxAvatars;
    const visible = typers.slice(0, over ? maxAvatars - 1 : maxAvatars);
    const keys = visible.map((t) => [`u:${t.id}`, t]);
    if (over) keys.push(["more", null]);
    const more = typers.length - visible.length;
    keys.forEach(([key, t], i) => {
      let n = nodes.get(key);
      const x = i * step();
      if (n?.leaving) {
        n.leaving = false;
        fill(n, t, more);
        if (still) {
          n.x.set(x);
          n.s.set(1);
        } else {
          n.x.spring(x, SLIDE);
          n.s.spring(1, POP);
        }
      } else if (!n) {
        n = makeNode(key, t, more);
        nodes.set(key, n);
        n.x.set(x);
        if (still) n.s.set(1);
        else n.s.spring(1, POP);
      } else {
        fill(n, t, more);
        if (still) n.x.set(x);
        else n.x.spring(x, SLIDE);
      }
      n.el.style.zIndex = String(keys.length - i);
    });
    const live = new Set(keys.map(([k]) => k));
    for (const n of nodes.values()) {
      if (live.has(n.key) || n.leaving) continue;
      n.leaving = true;
      n.el.style.zIndex = "0";
      const done = () => {
        if (n.leaving && nodes.get(n.key) === n) {
          n.el.remove();
          nodes.delete(n.key);
        }
      };
      if (still) done();
      else n.s.to(0, OUT_MS, CALM).then((ok) => ok && done());
    }
    const w = keys.length ? (keys.length - 1) * step() + p().size : 0;
    row.style.gap = keys.length ? "8px" : "0px";
    const sz = p().size, bh = Math.round(sz * 1.1 + 3);
    stack.style.height = `${sz}px`;
    label.style.marginLeft = `${sz + 8}px`;
    for (const [k, v] of [["h", bh], ["pad", Math.round(bh * 0.38)], ["dot", Math.round(sz * 0.25)], ["gap", Math.round(sz * 0.15)]]) bubble.style.setProperty(`--ti-${k}`, `${v}px`);
    if (still) width.set(w);
    else width.spring(w, SLIDE);
    if (still) shown.set(typers.length ? 1 : 0);
    else shown.spring(typers.length ? 1 : 0, POP);
    label.style.display = showLabel ? "" : "none";
    setLabel(typers.length ? (p().formatLabel ?? typingLabel)(typers.map((t) => t.name)) : "");
  };
  sync(true);
  return {
    update(next) {
      props.update(next);
      sync();
    },
    destroy() {
      sc.dispose();
      row.remove();
      label.remove();
      sr.remove();
      for (const a of ["data-dissolve", "role", "aria-live"]) host.removeAttribute(a);
    }
  };
}
export {
  createTypingIndicator,
  initials,
  typingLabel
};
