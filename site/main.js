import { dissolve, snapshot, DEFAULT_GRAIN, PRESETS } from './dissolve.js';
import { SCENES, layout, rr } from './scenes.js';

await document.fonts.ready;

/* ---------- Stage: canvas scene with dissolvable items ---------- */

class Stage {
  constructor(canvas, { onScene } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.onScene = onScene;
    this.opts = {};
    canvas.addEventListener('click', (e) => this.click(e));
    canvas.addEventListener('mousemove', (e) => {
      canvas.style.cursor = this.hit(e) ? 'pointer' : 'default';
    });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    // Only repaint while something moves and the stage is on screen.
    this.visible = true;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.wake(); }).observe(canvas);
    this.wake();
  }
  wake() {
    if (this.looping) return;
    this.looping = true;
    const loop = () => {
      const moving = this.draw();
      if (moving && this.visible) requestAnimationFrame(loop);
      else this.looping = false;
    };
    requestAnimationFrame(loop);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = r.width * this.dpr;
    this.canvas.height = r.height * this.dpr;
    this.wake?.();
  }
  load(scene) {
    this.scene = scene;
    // mutate in place: some items read their own state (task.done) from a closure
    this.items = scene.make().map((it) => Object.assign(it, { alpha: 0, cur: null }));
    this.onScene?.(scene);
    this.wake?.();
  }
  targets() {
    const live = this.items.filter((i) => !i.gone);
    const rects = layout(live, this.W, this.H, this.ctx);
    live.forEach((it, i) => {
      it.target = rects[i];
      if (!it.cur) it.cur = { ...rects[i] };
    });
  }
  draw() {
    const { ctx, dpr } = this;
    if (!this.W) return false;
    this.targets();
    let moving = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    for (const it of this.items) {
      if (it.gone) continue;
      const c = it.cur, t = it.target;
      c.x += (t.x - c.x) * 0.16;
      c.y += (t.y - c.y) * 0.16;
      it.alpha += (1 - it.alpha) * 0.12;
      if (Math.abs(t.x - c.x) > 0.1 || Math.abs(t.y - c.y) > 0.1 || it.alpha < 0.995) moving = true;
      if (it.hidden) continue;
      ctx.save();
      ctx.globalAlpha = it.alpha;
      ctx.translate(c.x, c.y);
      it.draw(ctx, c.w, c.h);
      ctx.restore();
    }
    return moving;
  }
  hit(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return this.items.find((it) => !it.gone && !it.hidden && it.cur && x >= it.cur.x && x <= it.cur.x + it.cur.w && y >= it.cur.y && y <= it.cur.y + it.cur.h);
  }
  click(e) {
    const it = this.hit(e);
    if (!it || it.busy) return;
    it.busy = true;
    this.wake();
    if ('done' in it) {
      it.done = true;
      setTimeout(() => this.burst(it), 280);
    } else this.burst(it);
  }
  async burst(it) {
    const { w, h, x, y } = it.cur;
    const source = snapshot(w, h, (c) => it.draw(c, w, h));
    const r = this.canvas.getBoundingClientRect();
    it.hidden = true;
    this.wake();
    const preset = this.opts.preset ?? this.scene.preset;
    await dissolve({
      source, x: r.left + x, y: r.top + y, w, h,
      preset,
      grain: this.opts.grain,
      duration: this.opts.duration ?? this.scene.duration ?? 1500,
    });
    it.gone = true;
    this.wake();
    if (this.items.every((i) => i.gone) && this.autoRefill) setTimeout(() => this.load(this.scene), 700);
  }
}

/* ---------- Hero ---------- */

let sceneIndex = 0;
const caption = document.querySelector('#hero-caption');
const hero = new Stage(document.querySelector('#hero-canvas'), {
  onScene: (s) => (caption.textContent = s.caption),
});
hero.autoRefill = true;
hero.load(SCENES[0]);

const go = (d) => {
  sceneIndex = (sceneIndex + d + SCENES.length) % SCENES.length;
  hero.load(SCENES[sceneIndex]);
};
document.querySelector('#prev').onclick = () => go(-1);
document.querySelector('#next').onclick = () => go(1);
document.querySelector('#reset').onclick = () => hero.load(SCENES[sceneIndex]);

/* ---------- Presets ---------- */

const SWATCH = {
  dust: ['#C49A6C', '#8B5E3C'],
  sand: ['#F3D9A4', '#D4A256'],
  ember: ['#FFC15E', '#E4572E'],
  pixel: ['#8FB4FF', '#3D7BFF'],
  vortex: ['#C3A8FF', '#7B4DFF'],
};

document.querySelectorAll('[data-preset-row]').forEach((row) => {
  const preset = row.dataset.presetRow;
  const bar = row.querySelector('.bar');
  const [a, b] = SWATCH[preset];
  bar.style.background = `linear-gradient(90deg, ${a}, ${b})`;
  const play = async () => {
    if (bar.dataset.busy) return;
    bar.dataset.busy = '1';
    const r = bar.getBoundingClientRect();
    const source = snapshot(r.width, r.height, (c) => {
      const g = c.createLinearGradient(0, 0, r.width, 0);
      g.addColorStop(0, a); g.addColorStop(1, b);
      c.fillStyle = g;
      rr(c, 0, 0, r.width, r.height, r.height / 2); c.fill();
    });
    bar.style.transition = 'none';
    bar.style.opacity = 0;
    await dissolve({ source, x: r.left, y: r.top, w: r.width, h: r.height, preset, grain: Math.max(2, DEFAULT_GRAIN[preset] * 0.8) });
    setTimeout(() => {
      bar.style.transition = 'opacity 500ms cubic-bezier(0.32, 0.72, 0, 1)';
      bar.style.opacity = 1;
      delete bar.dataset.busy;
    }, 900);
  };
  bar.onclick = play;
  row.querySelector('.eye').onclick = play;
});

/* ---------- Playground ---------- */

const state = { preset: 'dust', grain: null, duration: 1500 };
const card = {
  h: 88,
  draw(ctx, w, h) {
    ctx.fillStyle = '#fff';
    rr(ctx, 0, 0, w, h, 20); ctx.fill();
    ctx.fillStyle = '#F4B860';
    rr(ctx, 12, 12, 64, 64, 14); ctx.fill();
    ctx.fillStyle = '#E4572E';
    rr(ctx, 22, 22, 44, 44, 6); ctx.fill();
    ctx.fillStyle = '#242529';
    ctx.font = '600 16px Inter, sans-serif';
    ctx.fillText('Summer trip', 90, 40);
    ctx.fillStyle = '#525252';
    ctx.font = '400 13px Inter, sans-serif';
    ctx.fillText('48 photos · Lisbon', 90, 60);
  },
};
const pg = new Stage(document.querySelector('#pg-canvas'));
pg.autoRefill = true;
pg.load({ name: 'Playground', preset: 'dust', make: () => [{ ...card }], caption: '' });
pg.targets = function () {
  const it = this.items[0];
  if (!it || it.gone) return;
  const w = Math.min(260, this.W - 40);
  it.target = { x: (this.W - w) / 2, y: (this.H - card.h) / 2, w, h: card.h };
  if (!it.cur) it.cur = { ...it.target };
};

const code = document.querySelector('#pg-code');
const grainOut = document.querySelector('#grain-out');
const durOut = document.querySelector('#dur-out');
const grainIn = document.querySelector('#grain');
const durIn = document.querySelector('#duration');
const info = document.querySelector('#preset-info');
const INFO = {
  dust: 'Blown away to the right, like a breath of wind.',
  sand: 'Grains pour down with gravity.',
  ember: 'Burns from the edge and rises as sparks.',
  pixel: 'Blocky, stepped collapse. Very digital.',
  vortex: 'Spirals into the center and vanishes.',
};

function sync() {
  const g = state.grain ?? DEFAULT_GRAIN[state.preset];
  pg.opts = { preset: state.preset, grain: g, duration: state.duration };
  grainOut.textContent = `${g} pt`;
  grainIn.value = g;
  durOut.textContent = `${(state.duration / 1000).toFixed(1)}s`;
  info.textContent = INFO[state.preset];
  document.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('on', b.dataset.pick === state.preset));
  code.innerHTML = `<span class="k">await</span> <span class="f">dissolve</span>({
  preset: <span class="s">'${state.preset}'</span>,
  grain: <span class="n">${g}</span>,
  duration: <span class="n">${state.duration}</span>,
})`;
}
document.querySelectorAll('[data-pick]').forEach((b) => {
  b.onclick = () => {
    state.preset = b.dataset.pick;
    state.grain = null;
    sync();
    playPg();
  };
});
grainIn.oninput = () => { state.grain = +grainIn.value; sync(); };
durIn.oninput = () => { state.duration = +durIn.value; sync(); };
function playPg() {
  const it = pg.items[0];
  if (it && !it.gone && !it.busy) { it.busy = true; pg.burst(it); }
}
document.querySelector('#pg-play').onclick = playPg;
sync();

/* ---------- Copy buttons ---------- */

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.onclick = async () => {
    const src = document.querySelector(btn.dataset.copy);
    await navigator.clipboard.writeText(src.innerText.replace(/^\$ /, ''));
    btn.classList.add('ok');
    setTimeout(() => btn.classList.remove('ok'), 1200);
  };
});

/* ---------- Tabs ---------- */

document.querySelectorAll('[data-tabs]').forEach((group) => {
  const tabs = group.querySelectorAll('[data-tab]');
  tabs.forEach((t) => {
    t.onclick = () => {
      tabs.forEach((x) => x.classList.toggle('on', x === t));
      document.querySelectorAll(`[data-panel^="${group.dataset.tabs}:"]`).forEach((p) => {
        p.hidden = p.dataset.panel !== `${group.dataset.tabs}:${t.dataset.tab}`;
      });
    };
  });
});

/* ---------- Scrollspy ---------- */

const links = [...document.querySelectorAll('.nav a')];
const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === `#${e.target.id}`));
    });
  },
  { rootMargin: '-30% 0px -60% 0px' },
);
document.querySelectorAll('section[id]').forEach((s) => spy.observe(s));

void PRESETS;
