// Web port of the react-native-dissolve particle engine (Canvas 2D).
// One fixed overlay canvas renders every burst, so grains can fly outside their element.

export const DPR = Math.min(2, window.devicePixelRatio || 1);
export const PRESETS = ['dust', 'sand', 'ember', 'pixel', 'vortex'];
export const DEFAULT_GRAIN = { dust: 3, sand: 2.5, ember: 3, pixel: 7, vortex: 3 };
const ID = { dust: 0, sand: 1, ember: 2, pixel: 3, vortex: 4 };
const END = 1.2;

const overlay = document.createElement('canvas');
overlay.className = 'dust-overlay';
document.body.appendChild(overlay);
const ctx = overlay.getContext('2d');
const bursts = [];
let running = false;

function resize() {
  overlay.width = innerWidth * DPR;
  overlay.height = innerHeight * DPR;
}
resize();
addEventListener('resize', resize);

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * source: canvas drawn at DPR scale, same size as the element (w x h css px)
 * x, y: viewport position of the element (css px)
 */
export function dissolve({ source, x, y, w, h, preset = 'dust', grain, duration = 1500 }) {
  return new Promise((resolve) => {
    if (reduced.matches) return resolve();
    const g = grain ?? DEFAULT_GRAIN[preset];
    const cols = Math.ceil(w / g);
    const rows = Math.ceil(h / g);
    const n = cols * rows;
    const d = new Float32Array(n * 6);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = (r * cols + c) * 6;
        d[k] = (c + 0.5) * g;
        d[k + 1] = (r + 0.5) * g;
        d[k + 2] = Math.random();
        d[k + 3] = Math.random();
        d[k + 4] = Math.random();
        d[k + 5] = Math.random();
      }
    let tinted = null;
    if (preset === 'ember') {
      tinted = document.createElement('canvas');
      tinted.width = source.width;
      tinted.height = source.height;
      const t = tinted.getContext('2d');
      t.drawImage(source, 0, 0);
      t.globalCompositeOperation = 'source-atop';
      t.fillStyle = 'rgba(255, 96, 20, 0.82)';
      t.fillRect(0, 0, tinted.width, tinted.height);
    }
    bursts.push({
      source, tinted, d, n, g, w, h,
      px: x + scrollX, py: y + scrollY,
      preset: ID[preset], duration, start: performance.now(),
      maxR: Math.hypot(w / 2, h / 2),
    });
    setTimeout(resolve, duration * 0.6);
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });
}

function localT(b, k, p) {
  const lx = b.d[k], ly = b.d[k + 1], r1 = b.d[k + 2];
  let delay, life = 0.42;
  switch (b.preset) {
    case 0: delay = (lx / b.w) * 0.62 + (1 - ly / b.h) * 0.04 + r1 * 0.1; break;
    case 1: delay = (lx / b.w) * 0.5 + r1 * 0.15; life = 0.5; break;
    case 2: delay = (lx / b.w) * 0.52 + ((b.h - ly) / b.h) * 0.12 + r1 * 0.12; life = 0.4; break;
    case 3: delay = r1 * 0.75; life = 0.32; break;
    default: {
      const dx = lx - b.w / 2, dy = ly - b.h / 2;
      delay = (1 - Math.hypot(dx, dy) / b.maxR) * 0.55 + r1 * 0.1;
      life = 0.55;
    }
  }
  const t = (p - delay) / life;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function frame(now) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const p = ((now - b.start) / b.duration) * END;
    if (p >= END) {
      bursts.splice(i, 1);
      continue;
    }
    const ox = b.px - scrollX, oy = b.py - scrollY;
    const sg = b.g * DPR;
    for (let j = 0; j < b.n; j++) {
      const k = j * 6;
      const t = localT(b, k, p);
      if (t >= 1) continue;
      const lx = b.d[k], ly = b.d[k + 1], r2 = b.d[k + 3], r3 = b.d[k + 4], r4 = b.d[k + 5];
      const e = t * t;
      let cx = ox + lx, cy = oy + ly, s = 1, rot = 0;
      let a = 1 - t * t * (3 - 2 * t);
      let src = b.source;
      switch (b.preset) {
        case 0:
          cx += (50 + r2 * 150) * e;
          cy += -(15 + r3 * 110) * e + Math.sin(t * 7 + r4 * 6.28) * 5 * t;
          s = 1 - t * 0.55; rot = (r4 - 0.5) * 6 * e; break;
        case 1:
          cx += (r2 - 0.3) * 30 * e; cy += (60 + r3 * 220) * e; s = 1 - t * 0.3; break;
        case 2: {
          cx += (r2 - 0.5) * 40 * e + Math.sin(t * 5 + r4 * 6.28) * 8 * t;
          cy += -(40 + r3 * 140) * e; s = 1 - t * 0.7; rot = (r4 - 0.5) * 3 * e;
          if (t > 0.12) src = b.tinted;
          const f = t < 0.25 ? 0 : (t - 0.25) / 0.75;
          a = 1 - f * f * (3 - 2 * f);
          break;
        }
        case 3: {
          const q = Math.floor(t * 5) / 5;
          cx += (r2 - 0.5) * 24 * q; cy += (r3 - 0.5) * 24 * q; s = 1 - q; a = 1 - q * q; break;
        }
        default: {
          const dx = lx - b.w / 2, dy = ly - b.h / 2;
          const r0 = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx);
          const an = a0 + e * (2.5 + r2 * 1.5), rr = r0 * (1 - e);
          cx = ox + b.w / 2 + Math.cos(an) * rr; cy = oy + b.h / 2 + Math.sin(an) * rr;
          s = 1 - t * 0.6; rot = an - a0;
        }
      }
      if (a <= 0.01 || s <= 0) continue;
      const cs = Math.cos(rot) * s * DPR, sn = Math.sin(rot) * s * DPR;
      ctx.setTransform(cs, sn, -sn, cs, cx * DPR, cy * DPR);
      ctx.globalAlpha = a;
      ctx.drawImage(src, lx * DPR - sg / 2, ly * DPR - sg / 2, sg, sg, -b.g / 2, -b.g / 2, b.g, b.g);
    }
  }
  ctx.globalAlpha = 1;
  if (bursts.length) requestAnimationFrame(frame);
  else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    running = false;
  }
}

/** Draws with fn(ctx) into a DPR canvas of w x h css px. */
export function snapshot(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * DPR);
  c.height = Math.ceil(h * DPR);
  const x = c.getContext('2d');
  x.scale(DPR, DPR);
  fn(x);
  return c;
}
