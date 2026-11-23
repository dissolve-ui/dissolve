// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  DPR
} from "./chunks/chunk-R2UPSOGD.js";
import {
  injectStyle,
  propsOf,
  reducedMotion,
  scope,
  token,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/confetti-burst.core.ts
var DEFAULTS = { count: 40, shapes: ["rect", "strip"], size: 8, spread: 70, power: 1, haptics: true };
var GRAVITY = 1500;
var DRAG = 2.4;
var LIFE = 1.7;
var FADE = 0.35;
function throwPieces(x, y, n, p) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (-90 + (Math.random() - 0.5) * p.spread) * (Math.PI / 180);
    const sp = (540 + Math.random() * 420) * p.power;
    const shape = p.shapes[Math.floor(Math.random() * p.shapes.length)] ?? "rect";
    const s = p.size * (0.8 + Math.random() * 0.4);
    out.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 10,
      flip: Math.random() * Math.PI * 2,
      vf: 7 + Math.random() * 7,
      wob: Math.random() * Math.PI * 2,
      vw: 3 + Math.random() * 3,
      w: shape === "strip" ? s * 0.45 : shape === "dot" ? s * 0.7 : s,
      h: shape === "strip" ? s * 1.6 : shape === "dot" ? s * 0.7 : s * 0.62,
      dot: shape === "dot",
      color: p.colors[i % p.colors.length],
      age: 0,
      life: LIFE * (0.75 + Math.random() * 0.25)
    });
  }
  return out;
}
function stepPiece(q, dt) {
  q.age += dt;
  const k = Math.exp(-dt * DRAG);
  q.vx *= k;
  q.vy = q.vy * k + GRAVITY * dt * 0.55;
  q.flip += q.vf * dt;
  q.wob += q.vw * dt;
  q.rot += q.vr * dt;
  const face = Math.abs(Math.cos(q.flip));
  q.x += (q.vx + Math.sin(q.wob) * 40 * face) * dt;
  q.y += q.vy * dt * (1 - 0.35 * face);
  return q.age < q.life;
}
function createConfettiBurst(host = document.body, initial = {}) {
  injectStyle("dissolve-confetti", `:where(.dissolve-confetti) { position: fixed; inset: 0; pointer-events: none; z-index: var(--dissolve-confetti-z, 1000); }
:where(.dissolve-confetti[data-contained]) { position: absolute; }`);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  let cv = null;
  let ctx = null;
  let pieces = [];
  let raf = 0, last = 0, w = 0, h = 0;
  let waiting = [];
  const box = () => (p().container ?? null)?.getBoundingClientRect() ?? { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const ensure = () => {
    if (cv) return;
    cv = document.createElement("canvas");
    cv.className = "dissolve-confetti";
    cv.setAttribute("aria-hidden", "true");
    const c = p().container;
    if (c) {
      if (getComputedStyle(c).position === "static") c.style.position = "relative";
      cv.dataset.contained = "";
      c.append(cv);
    } else document.body.append(cv);
    ctx = cv.getContext("2d");
  };
  const size = () => {
    const b = box();
    if (b.width !== w || b.height !== h) {
      w = b.width;
      h = b.height;
      cv.width = Math.round(w * DPR);
      cv.height = Math.round(h * DPR);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    }
  };
  const teardown = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    w = 0;
    h = 0;
    cv?.remove();
    cv = null;
    ctx = null;
    waiting.forEach((r) => r());
    waiting = [];
  };
  const frame = (now) => {
    raf = 0;
    if (!sc.alive || !ctx) return;
    const dt = last ? Math.min(0.04, (now - last) / 1e3) : 1 / 60;
    last = now;
    size();
    pieces = pieces.filter((q) => stepPiece(q, dt) && q.y < h + 40);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const q of pieces) {
      const left = q.life - q.age;
      ctx.globalAlpha = left < FADE ? Math.max(0, left / FADE) : 1;
      ctx.fillStyle = q.color;
      ctx.setTransform(DPR, 0, 0, DPR, q.x * DPR, q.y * DPR);
      ctx.rotate(q.rot);
      ctx.scale(1, Math.max(0.08, Math.abs(Math.cos(q.flip))));
      if (q.dot) {
        ctx.beginPath();
        ctx.arc(0, 0, q.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
    }
    ctx.globalAlpha = 1;
    if (pieces.length) raf = requestAnimationFrame(frame);
    else teardown();
  };
  return {
    fire(at = {}) {
      if (reducedMotion() || !sc.alive) return Promise.resolve();
      ensure();
      size();
      const b = box();
      let x = at.x ?? b.left + b.width / 2, y = at.y ?? b.top + b.height / 2;
      if (at.from) {
        const r = at.from.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + Math.min(8, r.height / 2);
      }
      const colors = p().colors?.length ? p().colors : [token(host, "foreground", "rgb(28 28 30)"), token(host, "muted", "rgb(142 142 147)")];
      pieces.push(...throwPieces(x - b.left, y - b.top, p().count, { ...p(), colors }));
      if (p().haptics) vibrate(12);
      if (!raf) raf = requestAnimationFrame(frame);
      return new Promise((res) => waiting.push(res));
    },
    update(next) {
      const changed = props.update(next);
      if (changed.has("container") && cv) {
        pieces = [];
        teardown();
      }
    },
    destroy() {
      sc.dispose();
      pieces = [];
      teardown();
    }
  };
}
export {
  createConfettiBurst,
  stepPiece,
  throwPieces
};
