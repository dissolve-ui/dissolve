// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  DPR,
  play,
  snapshot
} from "./chunks/chunk-6TDGCXIW.js";
import {
  CALM,
  el,
  frame,
  injectStyle,
  propsOf,
  rectOf,
  reducedMotion,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/signature-pad.core.ts
var DEFAULTS = { strokeWidth: 3.2, placeholder: "Sign here", height: 200, controls: true, haptics: true };
var CSS = `
:where([data-dissolve="signature-pad"]) {
  position: relative; overflow: hidden; border-radius: 20px;
  background: var(--dissolve-surface, rgb(242 242 247));
}
:where(.dissolve-signature-guide) { position: absolute; left: 22px; right: 22px; height: 1px; pointer-events: none; background: var(--dissolve-border, rgb(60 60 67 / 0.12)); }
:where(.dissolve-signature-mark, .dissolve-signature-placeholder) { position: absolute; pointer-events: none; color: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-signature-mark) { left: 24px; font-size: 22px; font-weight: 300; line-height: 26px; }
:where(.dissolve-signature-placeholder) { left: 0; right: 0; text-align: center; font-size: 15px; font-weight: 500; letter-spacing: -0.1px; line-height: 20px; }
:where(.dissolve-signature-ink) { position: absolute; inset: 0; }
:where(.dissolve-signature-ink) canvas { display: block; cursor: crosshair; touch-action: none; }
:where(.dissolve-signature-tools) { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; opacity: 0; pointer-events: none; }
:where(.dissolve-signature-tools[data-on]) { pointer-events: auto; }
button:where(.dissolve-signature-control) {
  height: 28px; padding: 0 12px; border: 0; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600;
  background: var(--dissolve-surface-2, rgb(229 229 234)); color: var(--dissolve-foreground, rgb(28 28 30));
  transition: opacity .15s; -webkit-tap-highlight-color: transparent;
}
button:where(.dissolve-signature-control):active { opacity: .6; }
`;
function outline(pts) {
  const path = new Path2D();
  const n = Math.floor(pts.length / 3);
  if (n === 0) return path;
  if (n === 1) {
    path.arc(pts[0], pts[1], pts[2] / 2, 0, Math.PI * 2);
    return path;
  }
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : i - 1, b = i === n - 1 ? n - 1 : i + 1;
    const dx = pts[b * 3] - pts[a * 3], dy = pts[b * 3 + 1] - pts[a * 3 + 1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len, hw = pts[i * 3 + 2] / 2;
    L.push(pts[i * 3] + nx * hw, pts[i * 3 + 1] + ny * hw);
    R.push(pts[i * 3] - nx * hw, pts[i * 3 + 1] - ny * hw);
  }
  const last = n - 1;
  path.moveTo(L[0], L[1]);
  for (let i = 1; i < last; i++) path.quadraticCurveTo(L[i * 2], L[i * 2 + 1], (L[i * 2] + L[i * 2 + 2]) / 2, (L[i * 2 + 1] + L[i * 2 + 3]) / 2);
  path.lineTo(L[last * 2], L[last * 2 + 1]);
  let ex = pts[last * 3] - pts[(last - 1) * 3], ey = pts[last * 3 + 1] - pts[(last - 1) * 3 + 1];
  let el2 = Math.sqrt(ex * ex + ey * ey) || 1, k = pts[last * 3 + 2] / 2 * 1.333;
  ex = ex / el2 * k;
  ey = ey / el2 * k;
  path.bezierCurveTo(L[last * 2] + ex, L[last * 2 + 1] + ey, R[last * 2] + ex, R[last * 2 + 1] + ey, R[last * 2], R[last * 2 + 1]);
  for (let i = last - 1; i > 0; i--) path.quadraticCurveTo(R[i * 2], R[i * 2 + 1], (R[i * 2] + R[i * 2 - 2]) / 2, (R[i * 2 + 1] + R[i * 2 - 1]) / 2);
  path.lineTo(R[0], R[1]);
  ex = pts[0] - pts[3];
  ey = pts[1] - pts[4];
  el2 = Math.sqrt(ex * ex + ey * ey) || 1;
  k = pts[2] / 2 * 1.333;
  ex = ex / el2 * k;
  ey = ey / el2 * k;
  path.bezierCurveTo(R[0] + ex, R[1] + ey, L[0] + ex, L[1] + ey, L[0], L[1]);
  path.closePath();
  return path;
}
function createSignaturePad(host, initial = {}) {
  injectStyle("dissolve-signature-pad", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "signature-pad";
  host.setAttribute("aria-label", "Signature pad");
  const guide = el("div");
  const mark = el("span");
  mark.textContent = "\xD7";
  const holder = el("span");
  const inkBox = el("div", "dissolve-signature-ink");
  const cv = el("canvas");
  inkBox.append(cv);
  const tools = el("div", "dissolve-signature-tools");
  const pill = (label, aria) => {
    const b = el("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    tools.append(b);
    return b;
  };
  const undoBtn = pill("Undo", "Undo last stroke");
  const clearBtn = pill("Clear", "Clear signature");
  host.append(guide, mark, holder, inkBox, tools);
  const ctx = cv.getContext("2d");
  let W = 0, H = 0;
  const strokes = [];
  let paths = [], cur = [], nib = 0, clearing = false, had = false;
  const ink = () => p().strokeColor ?? token(host, "foreground", "rgb(28 28 30)");
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = ink();
    paths.forEach((path) => ctx.fill(path));
    if (cur.length) ctx.fill(outline(cur));
  }
  const inked = value(sc, 0, () => {
    holder.style.opacity = (1 - inked.v).toFixed(3);
    holder.style.transform = `translateY(${(inked.v * -4).toFixed(2)}px)`;
  });
  const shown = value(sc, 0, () => {
    tools.style.opacity = shown.v.toFixed(3);
    tools.style.transform = `translateY(${((1 - shown.v) * -4).toFixed(2)}px)`;
  });
  inked.set(0);
  shown.set(0);
  function sync() {
    const has = strokes.length > 0;
    inked.to(has || cur.length ? 1 : 0, 280, CALM);
    shown.to(has ? 1 : 0, 280, CALM);
    tools.toggleAttribute("data-on", has);
    undoBtn.tabIndex = clearBtn.tabIndex = has ? 0 : -1;
    if (has !== had) {
      had = has;
      p().onChange?.(has);
    }
  }
  function layout() {
    H = p().height;
    host.style.height = H + "px";
    const baseline = H * 0.7;
    guide.style.top = baseline + "px";
    mark.style.top = baseline - 26 + "px";
    holder.style.top = baseline - 34 + "px";
    W = Math.round(host.clientWidth);
    cv.width = Math.ceil(W * DPR);
    cv.height = Math.ceil(H * DPR);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    draw();
  }
  function decorate() {
    const o = p();
    guide.className = "dissolve-signature-guide" + (o.guideClassName ? " " + o.guideClassName : "");
    mark.className = "dissolve-signature-mark" + (o.placeholderClassName ? " " + o.placeholderClassName : "");
    holder.className = "dissolve-signature-placeholder" + (o.placeholderClassName ? " " + o.placeholderClassName : "");
    holder.textContent = o.placeholder;
    for (const b of [undoBtn, clearBtn]) b.className = "dissolve-signature-control" + (o.controlClassName ? " " + o.controlClassName : "");
    tools.style.display = o.controls ? "" : "none";
  }
  function begin(x, y) {
    nib = p().strokeWidth * 0.75;
    cur = [x, y, nib];
    inked.to(1, 220, CALM);
    draw();
  }
  function move(x, y, speed) {
    const n = cur.length;
    if (!n) return;
    const dx = x - cur[n - 3], dy = y - cur[n - 2];
    if (dx * dx + dy * dy < 2.25) return;
    const s = p().strokeWidth;
    const target = Math.min(s * 1.45, Math.max(s * 0.42, s * (1.45 - speed / 1700)));
    nib += (target - nib) * 0.22;
    cur.push(x, y, nib);
    draw();
  }
  function commit() {
    if (!cur.length) return;
    const out = cur.slice();
    if (out.length >= 6) out[out.length - 1] *= 0.5;
    strokes.push(out);
    paths.push(outline(out));
    cur = [];
    draw();
    sync();
  }
  let g = null;
  const local = (e) => {
    const b = cv.getBoundingClientRect();
    return [(e.clientX - b.left) * (W / b.width), (e.clientY - b.top) * (H / b.height)];
  };
  cv.addEventListener("pointerdown", (e) => {
    if (clearing || g || e.button > 0) return;
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
    }
    const [x, y] = local(e);
    g = { id: e.pointerId, t: e.timeStamp, x, y, v: 0 };
    begin(x, y);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id) return;
    const events = e.getCoalescedEvents?.();
    for (const ev of events?.length ? events : [e]) {
      const [x, y] = local(ev);
      const dt = Math.max(1, ev.timeStamp - g.t);
      const inst = Math.hypot(x - g.x, y - g.y) / dt * 1e3;
      g.v = g.v ? g.v * 0.6 + inst * 0.4 : inst;
      g.t = ev.timeStamp;
      g.x = x;
      g.y = y;
      move(x, y, g.v);
    }
  });
  const up = (e) => {
    if (!g || e.pointerId !== g.id) return;
    g = null;
    commit();
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  function undo() {
    if (clearing || !strokes.length) return;
    cur = [];
    strokes.pop();
    paths.pop();
    if (p().haptics) vibrate(4);
    draw();
    sync();
  }
  async function clear() {
    if (clearing || !strokes.length) return;
    clearing = true;
    if (!reducedMotion()) {
      const color = ink();
      const src = snapshot(W, H, (x) => {
        x.fillStyle = color;
        paths.forEach((path) => x.fill(path));
      });
      sc.track(play({ source: src, ...rectOf(cv), preset: "dust", origin: "left", duration: 1200 }));
      if (p().haptics) vibrate(12);
      await frame();
      await frame();
      inkBox.style.opacity = "0";
      await sc.wait(1200 * 0.35);
    }
    strokes.length = 0;
    paths = [];
    cur = [];
    draw();
    sync();
    await frame();
    await frame();
    inkBox.style.opacity = "";
    clearing = false;
  }
  function toImage() {
    if (!strokes.length || !W) return null;
    const image = document.createElement("canvas");
    image.width = Math.round(W * DPR);
    image.height = Math.round(H * DPR);
    const x = image.getContext("2d");
    const bg = p().exportBackground;
    if (bg) {
      x.fillStyle = bg;
      x.fillRect(0, 0, image.width, image.height);
    }
    x.scale(DPR, DPR);
    x.fillStyle = ink();
    paths.forEach((path) => x.fill(path));
    return { image, base64: image.toDataURL("image/png").split(",")[1], width: W, height: H };
  }
  function save() {
    const out = toImage();
    if (out) p().onSave?.(out);
    return out;
  }
  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", () => void clear());
  const ro = new ResizeObserver(() => {
    if (Math.round(host.clientWidth) !== W) layout();
  });
  ro.observe(host);
  decorate();
  layout();
  sync();
  return {
    undo,
    clear,
    isEmpty: () => strokes.length === 0,
    toImage,
    save,
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      decorate();
      if (changed.has("height")) layout();
      else if (changed.has("strokeColor")) draw();
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      guide.remove();
      mark.remove();
      holder.remove();
      inkBox.remove();
      tools.remove();
      delete host.dataset.dissolve;
      host.removeAttribute("aria-label");
      host.style.removeProperty("height");
    }
  };
}
export {
  createSignaturePad
};
