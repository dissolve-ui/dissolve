// Hero background: a dithered field of grains. Square dots on a grid whose size follows a slow,
// flowing noise, so dunes of grain drift across the right side of the hero and fade out toward the
// text. Under the pointer the grains swell and part, like sand under a finger. Squares, not circles:
// they read as a print dither and cost one fillRect each. Sleeps off screen; one still frame with
// reduced motion. The ink is the text color at a low alpha, so it follows the theme.

const CELL = 9;    // grid pitch, CSS px
const MAX = 6;     // biggest grain, CSS px
const LEVELS = 5;  // sizes are quantized: a dither, not a blur
const REACH = 120; // pointer radius, CSS px

/** Cheap smooth noise: a few rotated sines, 0..1. Enough for slow dunes, no tables to build. */
function field(x, y, t) {
  const a = Math.sin(x * 0.011 + t * 0.00021) + Math.sin(y * 0.017 - t * 0.00017);
  const b = Math.sin((x * 0.7 + y * 0.7) * 0.009 + t * 0.00013) * 1.2;
  const c = Math.sin((x * 0.4 - y * 0.9) * 0.021 - t * 0.00024) * 0.6;
  return (a + b + c + 3.8) / 7.6;
}

const smooth = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };

export function mountHeroBg(cv, sc) {
  if (!cv) return;
  const host = cv.parentElement;
  const ctx = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, ink = [255, 255, 255], raf = 0, seen = false;
  const ptr = { x: -1e4, y: -1e4, k: 0, on: false };

  const readInk = () => {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
    const el = document.createElement('i');
    el.style.color = c;
    document.body.append(el);
    const m = getComputedStyle(el).color.match(/[\d.]+/g) || [255, 255, 255];
    el.remove();
    ink = m.slice(0, 3).map(Number);
  };

  const size = () => {
    const r = host.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  };

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ptr.k += ((ptr.on ? 1 : 0) - ptr.k) * 0.08;
    const step = MAX / LEVELS;
    ctx.fillStyle = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
    // The field lives on the right and fades toward the copy on the left and toward the edges.
    const x0 = W * 0.34, x1 = W * 0.72;
    for (let y = CELL / 2; y < H; y += CELL) {
      const vy = smooth(0, H * 0.22, y) * smooth(H, H * 0.62, y);
      if (vy <= 0.01) continue;
      for (let x = CELL / 2; x < W; x += CELL) {
        const mask = smooth(x0, x1, x) * smooth(W, W * 0.9, x) * vy;
        if (mask <= 0.01) continue;
        // Contrast: the noise mostly sits mid range, stretch it so dunes and gaps read.
        let v = smooth(0.32, 0.86, field(x, y, t)) * mask;
        let gx = x, gy = y;
        if (ptr.k > 0.01) {
          const dx = x - ptr.x, dy = y - ptr.y, d = Math.hypot(dx, dy);
          if (d < REACH) {
            const f = (1 - d / REACH) ** 2 * ptr.k;
            v = Math.min(1, v + f * 0.55);
            gx += (dx / (d || 1)) * f * 9;
            gy += (dy / (d || 1)) * f * 9;
          }
        }
        const s = Math.round((v * MAX) / step) * step;
        if (s < 0.6) continue;
        ctx.globalAlpha = 0.1 + 0.6 * v;
        ctx.fillRect(gx - s / 2, gy - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  const tick = (t) => {
    raf = 0;
    if (!sc.alive) return;
    draw(t);
    if (seen && !still) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && sc.alive) raf = requestAnimationFrame(tick); };

  const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) kick(); });
  io.observe(host);
  const ro = new ResizeObserver(() => { size(); kick(); });
  ro.observe(host);
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true;
    if (still) draw(0);
  };
  const onLeave = () => { ptr.on = false; };
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerleave', onLeave);
  const mo = new MutationObserver(() => { readInk(); kick(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  readInk();
  size();
  kick();
  sc.onDispose(() => {
    cancelAnimationFrame(raf);
    io.disconnect(); ro.disconnect(); mo.disconnect();
    host.removeEventListener('pointermove', onMove);
    host.removeEventListener('pointerleave', onLeave);
  });
}
