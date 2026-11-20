// "Built in the open", under the gallery: the repo's GitHub history, drawn in dots like the rest of
// the site. Star history (cumulative, with the releases marked on it) and the commit rhythm (day x
// hour, like GitHub's contribution graph). Data comes from the public GitHub API, cached an hour.
import { onTheme } from './cp/kit.js';

const REPO = 'rs-4/dissolve';
const API = `https://api.github.com/repos/${REPO}`;
const CACHE = 'gh-history';
const HOUR = 3600e3, DAY = 24 * HOUR;

async function get(path, accept) {
  const r = await fetch(`${API}${path}`, accept ? { headers: { Accept: accept } } : undefined);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

/** Every page of a list endpoint (stops at the first short page, at most `max` pages). */
async function all(path, accept, max = 6) {
  const out = [];
  for (let p = 1; p <= max; p++) {
    const page = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${p}`, accept);
    out.push(...page);
    if (page.length < 100) break;
  }
  return out;
}

async function load() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c && Date.now() - c.t < HOUR) return c.d;
  } catch {}
  // Stargazer dates need an authenticated call: they come from a snapshot taken at deploy
  // (scripts/build-history.mjs). Stars given since then are counted at the current hour.
  const [repo, snap, commits, releases] = await Promise.all([
    get(''),
    fetch('/gh-stars.json').then((r) => (r.ok ? r.json() : { at: [] })).catch(() => ({ at: [] })),
    all('/commits'),
    get('/releases?per_page=30'),
  ]);
  const starred = [...snap.at];
  for (let i = starred.length; i < repo.stargazers_count; i++) starred.push(Date.now());
  const d = {
    stars: repo.stargazers_count, forks: repo.forks_count, created: Date.parse(repo.created_at),
    starred: starred.slice(0, repo.stargazers_count).sort((a, b) => a - b),
    commits: commits.map((c) => Date.parse(c.commit?.author?.date)).filter(Number.isFinite).sort((a, b) => a - b),
    releases: releases.filter((r) => !r.draft).map((r) => ({ tag: r.tag_name, at: Date.parse(r.published_at) })).sort((a, b) => a.at - b.at),
  };
  try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), d })); } catch {}
  return d;
}

export function historyHTML() {
  return `<section class="gh" data-gh hidden>
    <header class="gh-head">
      <div>
        <h2>Built in the open</h2>
        <p class="gh-sub" data-gh-sub></p>
      </div>
      <a class="bx-pill gh-repo" href="https://github.com/${REPO}" target="_blank" rel="noopener">View on GitHub</a>
    </header>
    <div class="gh-stats" data-gh-stats></div>
    <div class="gh-card">
      <div class="gh-card-head"><span>Stars</span><span class="gh-tip" data-gh-tip></span></div>
      <canvas class="gh-stars" data-gh-stars></canvas>
    </div>
    <div class="gh-card">
      <div class="gh-card-head"><span>Commits</span><span class="gh-legend">Less <i style="--a:.12"></i><i style="--a:.35"></i><i style="--a:.6"></i><i style="--a:1"></i> More</span></div>
      <canvas class="gh-commits" data-gh-commits></canvas>
    </div>
  </section>`;
}

const fmtDay = (t) => new Date(t).toLocaleDateString('en', { month: 'short', day: 'numeric' });
const fmtTime = (t) => new Date(t).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric' });
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** A canvas sized to its box at the device pixel ratio. Returns its 2D context in css pixels. */
function fit(cv, h) {
  const w = cv.clientWidth, dpr = devicePixelRatio || 1;
  cv.style.height = `${h}px`;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { x, w, h };
}

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * Star history: one column of dots per time step, filled up to the stars count at that time.
 * Releases are thin lines with their tag. Hover shows the count at that moment.
 */
function drawStars(cv, d, k, hover) {
  const { x, w, h } = fit(cv, 220);
  const text = css('--text'), faint = css('--faint'), muted = css('--muted');
  const padB = 22, padT = 18, gap = 6, r = 1.6;
  const t0 = Math.min(d.created, d.starred[0] ?? d.created), t1 = Date.now();
  const cols = Math.max(12, Math.floor(w / gap));
  const rows = Math.floor((h - padB - padT) / gap);
  const max = Math.max(1, d.starred.length);
  const at = (t) => { let lo = 0, hi = d.starred.length; while (lo < hi) { const m = (lo + hi) >> 1; if (d.starred[m] <= t) lo = m + 1; else hi = m; } return lo; };
  const out = { cols, t0, t1, at };
  for (let c = 0; c < cols; c++) {
    const t = t0 + ((c + 1) / cols) * (t1 - t0);
    const n = at(t);
    const fill = (n / max) * rows;
    // Columns rise in from left to right on first view.
    const grow = ease(k * 1.6 - (c / cols) * 0.6);
    const lit = Math.round(fill * grow);
    const cx = c * gap + gap / 2;
    const on = hover != null && Math.abs(hover - c) < 0.5;
    for (let rr = 0; rr < rows; rr++) {
      const cy = h - padB - rr * gap - gap / 2;
      x.globalAlpha = rr < lit ? (on ? 1 : 0.35 + 0.55 * (rr / Math.max(1, fill))) : 0.07;
      x.fillStyle = rr < lit ? text : faint;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
  }
  x.globalAlpha = 1;
  // Releases
  x.font = '500 11px Allo, system-ui, sans-serif';
  x.textBaseline = 'top';
  let lastX = -1e9;
  for (const rel of d.releases) {
    if (rel.at < t0) continue;
    const rx = ((rel.at - t0) / (t1 - t0)) * cols * gap;
    x.globalAlpha = 0.35 * ease(k * 2);
    x.fillStyle = muted;
    x.fillRect(Math.round(rx), padT - 4, 1, h - padB - padT + 4);
    x.globalAlpha = ease(k * 2);
    if (rx - lastX > 44) { x.fillStyle = muted; x.fillText(rel.tag, Math.min(rx + 4, w - 40), 0); lastX = rx; }
  }
  // Day ticks
  x.globalAlpha = 1; x.fillStyle = faint; x.textBaseline = 'bottom';
  const days = Math.ceil((t1 - t0) / DAY);
  const every = Math.max(1, Math.ceil(days / Math.max(2, Math.floor(w / 90))));
  for (let i = 0; i <= days; i += every) {
    const t = new Date(t0); t.setHours(0, 0, 0, 0);
    const tt = t.getTime() + (i + 1) * DAY;
    if (tt > t1) break;
    const tx = ((tt - t0) / (t1 - t0)) * cols * gap;
    x.fillText(fmtDay(tt), Math.min(Math.max(0, tx - 14), w - 40), h);
  }
  return out;
}

/** Commit rhythm: one row per day, 24 hour dots, brighter with more commits. */
function drawCommits(cv, d, k) {
  const t0 = new Date(Math.min(d.created, d.commits[0] ?? d.created)); t0.setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.ceil((Date.now() - t0) / DAY));
  const labelW = 60, gap = 24;
  const h = days * gap + 18;
  const { x, w } = fit(cv, h);
  const text = css('--text'), faint = css('--faint');
  const grid = Array.from({ length: days }, () => new Array(24).fill(0));
  for (const t of d.commits) {
    const day = Math.floor((t - t0) / DAY), hr = new Date(t).getHours();
    if (day >= 0 && day < days) grid[day][hr]++;
  }
  const peak = Math.max(1, ...grid.flat());
  const cw = (w - labelW) / 24;
  x.font = '500 11px Allo, system-ui, sans-serif';
  x.textBaseline = 'middle';
  for (let dd = 0; dd < days; dd++) {
    const cy = dd * gap + gap / 2;
    x.globalAlpha = 1; x.fillStyle = faint;
    x.fillText(fmtDay(t0.getTime() + dd * DAY), 0, cy);
    for (let hr = 0; hr < 24; hr++) {
      const n = grid[dd][hr];
      const appear = ease(k * 2 - (dd * 24 + hr) / (days * 24));
      const cx = labelW + hr * cw + cw / 2;
      const rad = n ? 2.6 + 3.4 * Math.sqrt(n / peak) * appear : 1.5;
      x.globalAlpha = n ? (0.25 + 0.75 * (n / peak)) * appear : 0.08;
      x.fillStyle = n ? text : faint;
      x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
    }
  }
  x.globalAlpha = 1; x.fillStyle = faint; x.textBaseline = 'bottom';
  for (const hr of [0, 6, 12, 18]) x.fillText(`${String(hr).padStart(2, '0')}:00`, labelW + hr * cw, h);
}

/** Loads the data and draws the section once it scrolls into view. Returns a dispose function. */
export function mountHistory(root) {
  const el = root.querySelector('[data-gh]');
  if (!el) return () => {};
  let alive = true, data = null, k = 0, raf = 0, hover = null, meta = null;
  const stars = el.querySelector('[data-gh-stars]'), commits = el.querySelector('[data-gh-commits]'), tip = el.querySelector('[data-gh-tip]');
  const draw = () => { if (!data) return; meta = drawStars(stars, data, k, hover); drawCommits(commits, data, k); };
  const animate = () => {
    const start = performance.now();
    const step = (now) => { if (!alive) return; k = Math.min(1, (now - start) / 1400); draw(); if (k < 1) raf = requestAnimationFrame(step); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { k = 1; draw(); } else raf = requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && data) { io.disconnect(); animate(); } }, { threshold: 0.25 });
  load().then((d) => {
    if (!alive) return;
    data = d;
    el.hidden = false;
    const first = Math.min(d.created, d.commits[0] ?? d.created);
    const days = Math.max(1, Math.ceil((Date.now() - first) / DAY));
    el.querySelector('[data-gh-sub]').textContent = `Started ${fmtDay(first)}, ${days} day${days > 1 ? 's' : ''} ago. Every commit is public.`;
    const latest = d.releases.at(-1);
    const stat = (n, l) => `<div class="gh-stat"><b>${n}</b><span>${l}</span></div>`;
    el.querySelector('[data-gh-stats]').innerHTML = stat(d.stars, 'Stars') + stat(d.forks, 'Forks') + stat(d.commits.length + (d.commits.length >= 600 ? '+' : ''), 'Commits') + stat(latest ? latest.tag : '-', 'Latest release');
    tip.textContent = `${d.starred.length} stars`;
    draw();
    io.observe(el);
  }).catch(() => {});
  stars.addEventListener('pointermove', (e) => {
    if (!meta) return;
    const c = Math.floor((e.offsetX / stars.clientWidth) * meta.cols);
    hover = c;
    const t = meta.t0 + ((c + 1) / meta.cols) * (meta.t1 - meta.t0);
    tip.textContent = `${meta.at(t)} stars · ${fmtTime(t)}`;
    if (k >= 1) draw();
  });
  stars.addEventListener('pointerleave', () => { hover = null; if (data) tip.textContent = `${data.starred.length} stars`; if (k >= 1) draw(); });
  const ro = new ResizeObserver(() => draw());
  ro.observe(el);
  const offTheme = onTheme(null, () => requestAnimationFrame(draw));
  return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); offTheme(); };
}
