// Site footer: the links, then a big word made of dots that morphs from one word to the next.
// The dots flee the cursor and spring back; a click scatters them. Same look as the rest of the
// site (grains), drawn on one canvas, only while it is on screen.
import { PKG } from './variants-content.js';
import { pathOf } from './routes.js';

const WORDS = ['dissolve', 'native', 'web', 'grains'];
const HOLD = 3200;

const COLS = [
  { title: 'Library', links: [['Components', pathOf('gallery')], ['Effects', pathOf('effects')], ['Playground', pathOf('dust')]] },
  { title: 'Docs', links: [['Introduction', pathOf('introduction')], ['Installation', pathOf('installation')], ['CLI', pathOf('cli')], ['Theming', pathOf('theming')]] },
  { title: 'Agents', links: [['Agent prompt', pathOf('agent-prompt')], ['MCP server', pathOf('agent-prompt')], ['Claude skill', pathOf('agent-prompt')]] },
  { title: 'Elsewhere', links: [['GitHub', 'https://github.com/rs-4/dissolve'], ['npm', `https://www.npmjs.com/package/${PKG}`], ['X', 'https://x.com/rsStats_']] },
];

export function footerHTML() {
  const a = ([label, href]) => `<a href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  return `<div class="foot-in">
    <div class="foot-top">
      <div class="foot-lead">
        <p>Animated components for React Native and React. Copy them in, they are yours.</p>
        <button class="foot-cmd" data-foot-copy aria-label="Copy the install command"><code>npx ${PKG} add</code><span data-foot-ok>Copy</span></button>
      </div>
      <nav class="foot-cols" aria-label="Footer">${COLS.map((c) => `<div class="foot-col"><p>${c.title}</p>${c.links.map(a).join('')}</div>`).join('')}</nav>
    </div>
    <div class="foot-word" data-foot-word>
      <canvas aria-hidden="true"></canvas>
      <span class="foot-hint" aria-hidden="true">Move through it, click to scatter</span>
    </div>
    <div class="foot-bottom">
      <span>v0.0.7 · MIT · Built in the open</span>
      <div class="foot-theme" role="radiogroup" aria-label="Theme">
        <button role="radio" data-foot-theme="dark">Dark</button><button role="radio" data-foot-theme="light">Light</button>
      </div>
    </div>
  </div>`;
}

/** The points of a word drawn as big as it fits in w x h, sampled every `gap` px. */
function sample(word, w, h, gap) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  let fs = h * 0.92;
  const font = (s) => `820 ${s}px Allo, system-ui, sans-serif`;
  x.font = font(fs);
  const tw = x.measureText(word).width;
  if (tw > w * 0.96) fs *= (w * 0.96) / tw;
  x.font = font(fs);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(word, w / 2, h / 2 + fs * 0.04);
  const px = x.getImageData(0, 0, w, h).data, out = [];
  for (let y = gap / 2; y < h; y += gap)
    for (let xx = gap / 2; xx < w; xx += gap)
      if (px[(Math.floor(y) * w + Math.floor(xx)) * 4 + 3] > 140) out.push([xx, y]);
  return out;
}

export function mountFooter(root) {
  const copy = root.querySelector('[data-foot-copy]');
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(copy.querySelector('code').textContent).catch(() => {});
    const ok = copy.querySelector('[data-foot-ok]');
    ok.textContent = 'Copied';
    setTimeout(() => (ok.textContent = 'Copy'), 1200);
  });
  // Theme: the footer switch drives the same toggle as the rest of the site.
  const marks = () => root.querySelectorAll('[data-foot-theme]').forEach((b) => {
    const on = (document.documentElement.dataset.theme || 'dark') === b.dataset.footTheme;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
  });
  root.querySelectorAll('[data-foot-theme]').forEach((b) => b.addEventListener('click', () => {
    if (document.documentElement.dataset.theme !== b.dataset.footTheme) document.getElementById('theme')?.click();
  }));
  new MutationObserver(marks).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  marks();

  const box = root.querySelector('[data-foot-word]'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, gap = 7, dots = [], targets = [], word = 0, visible = false, raf = 0, last = 0, since = 0;
  let mx = -1e4, my = -1e4, ink = '#fff';
  const readInk = () => { ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff'; };

  const layout = () => {
    const w = box.clientWidth;
    if (!w || w === W) return;
    W = w; H = Math.round(Math.min(300, Math.max(120, w * 0.22)));
    gap = w < 600 ? 5 : 7;
    const dpr = devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Points of every word, sorted left to right so a morph flows across the word.
    targets = WORDS.map((wd) => sample(wd, W, H, gap).sort((a, b) => a[0] - b[0] || a[1] - b[1]));
    const n = Math.max(...targets.map((t) => t.length));
    const first = targets[word];
    dots = Array.from({ length: n }, (_, i) => {
      const t = first[Math.floor((i / n) * first.length)];
      return { x: t[0], y: t[1], vx: 0, vy: 0, tx: t[0], ty: t[1], a: i < first.length ? 1 : 0.35 };
    });
    aim(word);
    if (still) draw();
  };

  // Every dot takes the point of the next word at the same rank; spare dots double up, dimmer.
  const aim = (k) => {
    const t = targets[k], n = dots.length;
    dots.forEach((d, i) => {
      const p = t[Math.floor((i / n) * t.length)];
      d.tx = p[0]; d.ty = p[1];
      d.ta = (i * t.length) % n < t.length ? 1 : 0.3;
    });
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = ink;
    const r = gap * 0.34;
    for (const d of dots) {
      ctx.globalAlpha = d.a;
      ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const step = (now) => {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(3, (now - (last || now)) / 16.67);
    last = now;
    since += dt * 16.67;
    if (since > HOLD) { since = 0; word = (word + 1) % WORDS.length; aim(word); }
    const R = Math.max(60, gap * 12), R2 = R * R;
    for (const d of dots) {
      d.vx += (d.tx - d.x) * 0.045 * dt;
      d.vy += (d.ty - d.y) * 0.045 * dt;
      const dx = d.x - mx, dy = d.y - my, q = dx * dx + dy * dy;
      if (q < R2 && q > 0.01) {
        const f = (1 - q / R2) * 2.4 * dt, l = Math.sqrt(q);
        d.vx += (dx / l) * f; d.vy += (dy / l) * f;
      }
      d.vx *= Math.pow(0.84, dt); d.vy *= Math.pow(0.84, dt);
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.a += ((d.ta ?? 1) - d.a) * 0.08 * dt;
    }
    draw();
    raf = requestAnimationFrame(step);
  };
  const start = () => { if (!raf && !still) { last = 0; raf = requestAnimationFrame(step); } };

  box.addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; });
  box.addEventListener('pointerleave', () => { mx = my = -1e4; });
  box.addEventListener('click', () => {
    // Scatter, then the springs pull everything back into the word.
    for (const d of dots) { const a = Math.random() * Math.PI * 2, s = 6 + Math.random() * 14; d.vx += Math.cos(a) * s; d.vy += Math.sin(a) * s; }
    since = HOLD * 0.4;
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }, { threshold: 0.05 }).observe(box);
  new ResizeObserver(() => layout()).observe(box);
  new MutationObserver(() => { readInk(); if (still) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  readInk();
  document.fonts?.ready.then(() => { W = 0; layout(); });
}
