// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  DPR,
  play,
  snapshot
} from "./chunks/chunk-6TDGCXIW.js";
import {
  CALM,
  clamp,
  el,
  fit,
  fontOf,
  frame,
  hash,
  injectStyle,
  onThemeChange,
  propsOf,
  reducedMotion,
  rr,
  scope,
  token,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/upload-tile.core.ts
var DEFAULTS = { size: 72, spacing: 0, haptics: true };
var PAD = 6;
var GRAIN = 2;
var WINDOW = 0.18;
var DRIFT = 10;
var CHASE = 240;
var INTRO = 420;
var CROSS_IN = 220;
var OPEN = 300;
var CALM_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";
var DOC = "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5";
var X_ICON = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5"/></svg>';
var CSS = `
:where([data-dissolve="upload-tile"]) { position: relative; flex: none; }
:where(.dissolve-upload-box) { position: absolute; left: 0; top: 0; box-sizing: border-box; }
:where(.dissolve-upload-box[role="button"]) { cursor: pointer; -webkit-tap-highlight-color: transparent; }
:where(.dissolve-upload-box:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: -2px; border-radius: 22px; }
:where(.dissolve-upload-spot) { position: absolute; border-radius: 16px; box-shadow: inset 0 0 0 1px var(--dissolve-border, rgb(60 60 67 / 0.12)); pointer-events: none; }
:where(.dissolve-upload-face) { display: block; border-radius: 16px; background: var(--dissolve-surface-2, rgb(229 229 234)); }
:where(.dissolve-upload-cross:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 2px; }
:where(.dissolve-upload-asm) { position: absolute; left: 0; top: 0; display: block; pointer-events: none; }
`;
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function grainField(size) {
  const n = Math.floor(size / GRAIN), data = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, lx = (c + 0.5) * GRAIN, ly = (r + 0.5) * GRAIN;
    data.push(lx, ly, (0.78 * (lx / size) + 0.22 * hash(i, 1)) * (1 - WINDOW), (hash(i, 2) - 0.5) * 2 * DRIFT, (hash(i, 3) - 0.5) * 2 * DRIFT);
  }
  return { n, data };
}
function cover(x, img, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / s, sh = h / s;
  x.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
}
function createUploadTile(host, initial) {
  injectStyle("dissolve-upload-tile", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const file = p().file;
  const TILE = p().size, OUT = TILE + PAD * 2;
  const plain = reducedMotion();
  host.dataset.dissolve = "upload-tile";
  host.setAttribute("role", "listitem");
  Object.assign(host.style, { width: "0px", height: OUT + "px" });
  const box = el("div", "dissolve-upload-box");
  Object.assign(box.style, { width: OUT + "px", height: OUT + "px", padding: PAD + "px" });
  box.setAttribute("aria-label", file.name);
  const spot = el("div", "dissolve-upload-spot");
  Object.assign(spot.style, { left: PAD + "px", top: PAD + "px", width: TILE + "px", height: TILE + "px" });
  const face = el("canvas");
  face.width = face.height = Math.round(TILE * DPR);
  Object.assign(face.style, { width: TILE + "px", height: TILE + "px", opacity: plain ? "0.15" : "0" });
  const fx = face.getContext("2d");
  const asm = el("canvas", "dissolve-upload-asm");
  asm.width = asm.height = Math.round(OUT * DPR);
  Object.assign(asm.style, { width: OUT + "px", height: OUT + "px" });
  const ax = asm.getContext("2d");
  const cross = el("button", "dissolve-upload-cross", X_ICON);
  cross.type = "button";
  cross.tabIndex = -1;
  cross.setAttribute("aria-label", `Remove ${file.name}`);
  Object.assign(cross.style, {
    position: "absolute",
    right: "0",
    top: "0",
    width: "20px",
    height: "20px",
    padding: "0",
    border: "0",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    opacity: "0",
    pointerEvents: "none",
    background: "var(--dissolve-primary, rgb(28 28 30))",
    color: "var(--dissolve-primary-foreground, rgb(255 255 255))"
  });
  box.append(spot, face, asm, cross);
  host.append(box);
  let img = null;
  let bad = false, whole = false, phase = "enter";
  const ctrl = new AbortController();
  sc.onDispose(() => ctrl.abort());
  function decorate() {
    face.className = "dissolve-upload-face" + (p().tileClassName ? " " + p().tileClassName : "");
  }
  const radius = () => parseFloat(getComputedStyle(face).borderTopLeftRadius) || 0;
  const paper = document.createElement("canvas");
  paper.width = paper.height = face.width;
  const px = paper.getContext("2d");
  function paintFace() {
    const x = px, T = TILE, font = fontOf(host);
    const col = (name, fallback) => token(host, name, fallback);
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    x.clearRect(0, 0, T, T);
    x.save();
    rr(x, 0, 0, T, T, radius());
    x.clip();
    if (img) cover(x, img, T, T);
    else {
      const bg = getComputedStyle(face).backgroundColor;
      x.fillStyle = bg && bg !== "rgba(0, 0, 0, 0)" ? bg : col("surface-2", "rgb(229 229 234)");
      x.fillRect(0, 0, T, T);
      const muted = col("muted", "rgb(142 142 147)");
      x.strokeStyle = muted;
      x.lineWidth = 1.4;
      x.lineJoin = "round";
      x.save();
      x.translate(8, 8);
      x.scale(20 / 24, 20 / 24);
      x.stroke(new Path2D(DOC));
      x.restore();
      x.fillStyle = muted;
      x.font = `700 9px ${font}`;
      x.fillText((file.name.split(".").pop() ?? "").slice(0, 4).toUpperCase(), 31, 21.5);
      x.fillStyle = col("foreground", "rgb(28 28 30)");
      x.font = `600 11px ${font}`;
      x.fillText(fit(x, file.name, T - 16), 8, T - 20);
      x.fillStyle = muted;
      x.font = `400 10px ${font}`;
      x.fillText(formatBytes(file.size), 8, T - 8);
    }
    if (bad) {
      const danger = col("danger", "rgb(255 59 48)");
      x.fillStyle = danger;
      x.globalAlpha = 0.16;
      x.fillRect(0, 0, T, T);
      x.globalAlpha = 1;
      x.strokeStyle = danger;
      x.lineWidth = 1.5;
      rr(x, 0.75, 0.75, T - 1.5, T - 1.5, radius() - 0.75);
      x.stroke();
      x.font = `700 9px ${font}`;
      const w = x.measureText("Too large").width + 12;
      x.fillStyle = danger;
      rr(x, (T - w) / 2, T - 6 - 15, w, 15, 7.5);
      x.fill();
      x.fillStyle = col("danger-foreground", "#fff");
      x.textAlign = "center";
      x.fillText("Too large", T / 2, T - 6 - 4.5);
      x.textAlign = "left";
    }
    x.restore();
    fx.clearRect(0, 0, face.width, face.height);
    fx.drawImage(paper, 0, 0);
  }
  const field = grainField(TILE);
  function drawAsm(P) {
    const G = GRAIN * DPR, d = field.data, n = field.n;
    ax.setTransform(DPR, 0, 0, DPR, 0, 0);
    ax.clearRect(0, 0, OUT, OUT);
    for (let i = 0; i < n * n; i++) {
      const k = i * 5;
      const t = clamp((P - d[k + 2]) / WINDOW);
      if (t <= 0) continue;
      const e = 1 - (1 - t) ** 3, w = e * GRAIN;
      const cx = PAD + d[k] + d[k + 3] * (1 - e), cy = PAD + d[k + 1] + d[k + 4] * (1 - e);
      ax.drawImage(face, i % n * G, (i / n | 0) * G, G, G, cx - w / 2, cy - w / 2, w, w);
    }
  }
  const prog = value(sc, 0, () => {
    if (plain) face.style.opacity = (0.15 + 0.85 * prog.v).toFixed(3);
    else drawAsm(prog.v);
  });
  const crossIn = value(sc, 0, () => {
    cross.style.opacity = crossIn.v.toFixed(3);
    cross.style.transform = plain ? "" : `scale(${(0.6 + 0.4 * crossIn.v).toFixed(3)})`;
  });
  async function complete(ms) {
    await prog.to(1, plain ? 150 : ms, CALM);
    whole = true;
    spot.remove();
    face.style.opacity = "1";
    asm.style.visibility = "hidden";
  }
  async function close(reason) {
    host.style.width = "0px";
    await sc.wait(reducedMotion() ? 150 : OPEN);
    p().onRemove?.(file, reason);
  }
  async function leave(reason, preset, origin) {
    phase = "gone";
    box.removeAttribute("role");
    box.tabIndex = -1;
    cross.style.pointerEvents = "none";
    if (reducedMotion()) {
      box.style.visibility = "hidden";
      return close(reason);
    }
    const r = box.getBoundingClientRect();
    const src = whole ? snapshot(OUT, OUT, (c) => c.drawImage(face, PAD, PAD, TILE, TILE)) : snapshot(OUT, OUT, (c) => c.drawImage(asm, 0, 0, OUT, OUT));
    box.style.visibility = "hidden";
    await sc.track(play({ source: src, x: r.left, y: r.top, w: OUT, h: OUT, preset, origin, duration: preset === "snap" ? 900 : 1100, grain: 2 })).done;
    if (sc.alive) await close(reason);
  }
  async function reject(ms) {
    phase = "gone";
    await complete(ms);
    if (!sc.alive) return;
    bad = true;
    paintFace();
    if (p().haptics) vibrate([20, 60, 20]);
    box.setAttribute("aria-label", `${file.name} is too large`);
    await box.animate([0, 6, -6, 6, -6, 6, 0].map((v) => ({ transform: `translateX(${v}px)` })), { duration: reducedMotion() ? 1 : 240 }).finished.catch(() => {
    });
    await sc.wait(260);
    if (sc.alive) leave("rejected", "dust");
  }
  function cancel(origin) {
    if (phase !== "uploading") return;
    ctrl.abort();
    if (p().haptics) vibrate(6);
    leave("cancelled", "snap", origin);
  }
  const onBoxClick = (e) => {
    const r = box.getBoundingClientRect(), s = r.width / OUT || 1;
    cancel({ x: clamp((e.clientX - r.left) / s, 0, OUT), y: clamp((e.clientY - r.top) / s, 0, OUT) });
  };
  const onBoxKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cancel({ x: OUT / 2, y: OUT / 2 });
    }
  };
  const onCross = (e) => {
    e.stopPropagation();
    if (phase !== "done") return;
    if (p().haptics) vibrate(6);
    leave("removed", "snap", { x: OUT - 10, y: 10 });
  };
  box.addEventListener("click", onBoxClick);
  box.addEventListener("keydown", onBoxKey);
  cross.addEventListener("click", onCross);
  async function start() {
    if (file.uri) {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = file.uri;
      await Promise.race([im.decode().then(() => {
        img = im;
      }, () => {
      }), sc.wait(1500)]);
    }
    if (!sc.alive) return;
    paintFace();
    await frame();
    if (!sc.alive) return;
    host.style.transition = `width ${OPEN}ms ${CALM_CSS}`;
    host.style.width = OUT + p().spacing + "px";
    await sc.wait(260);
    if (!sc.alive) return;
    const { maxSize } = p();
    if (maxSize != null && file.size > maxSize) return reject(INTRO);
    phase = "uploading";
    box.tabIndex = 0;
    box.setAttribute("role", "button");
    box.setAttribute("aria-label", `Uploading ${file.name}, press to cancel`);
    try {
      await p().upload(file, (v) => {
        if (!ctrl.signal.aborted && sc.alive) prog.to(Math.max(prog.v, Math.min(1, v)), CHASE, CALM);
      }, ctrl.signal);
    } catch {
      if (!ctrl.signal.aborted && sc.alive && phase === "uploading") reject(CHASE);
      return;
    }
    if (ctrl.signal.aborted || phase !== "uploading") return;
    await complete(CHASE);
    if (phase !== "uploading" || !sc.alive) return;
    phase = "done";
    box.removeAttribute("role");
    box.tabIndex = -1;
    box.setAttribute("aria-label", file.name);
    cross.tabIndex = 0;
    cross.style.pointerEvents = "auto";
    crossIn.to(1, reducedMotion() ? 150 : CROSS_IN, CALM);
    if (p().haptics) vibrate([10, 40, 18]);
    p().onDone?.(file);
  }
  onThemeChange(sc, () => {
    paintFace();
    if (!whole && !plain) drawAsm(prog.v);
  });
  decorate();
  start();
  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has("tileClassName")) {
        decorate();
        paintFace();
      }
      if (changed.has("spacing") && phase !== "gone" && host.style.width !== "0px") host.style.width = OUT + p().spacing + "px";
    },
    destroy() {
      sc.dispose();
      box.remove();
      delete host.dataset.dissolve;
      host.removeAttribute("role");
      for (const k of ["width", "height", "transition"]) host.style.removeProperty(k);
    }
  };
}
export {
  createUploadTile,
  formatBytes
};
