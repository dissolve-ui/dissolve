// "Built in the open", under the gallery: the repo's GitHub history as a git graph. Main down the
// left, every pull request as a branch beside it (merged ones curve back in, closed ones stop, open
// ones keep going). Data comes from the public GitHub API, cached an hour.
const REPO = 'rs-4/dissolve';
const API = `https://api.github.com/repos/${REPO}`;
const CACHE = 'gh-history-3';
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
  const [repo, commits, releases, pulls, tags] = await Promise.all([
    get(''),
    all('/commits'),
    get('/releases?per_page=30'),
    get('/pulls?state=all&per_page=50'),
    get('/tags?per_page=50'),
  ]);
  const tagOf = new Map(tags.map((t) => [t.commit.sha, t.name]));
  const d = {
    created: Date.parse(repo.created_at),
    // Main in its real order; committer dates (a rebased commit keeps its old author date).
    log: commits.map((c) => ({
      sha: c.sha, msg: (c.commit?.message ?? '').split('\n')[0], at: Date.parse(c.commit?.committer?.date ?? c.commit?.author?.date),
      author: c.author?.login ?? c.commit?.author?.name ?? '', avatar: c.author?.avatar_url ?? '', tag: tagOf.get(c.sha) ?? '',
    })),
    pulls: pulls.map((p) => ({
      n: p.number, title: p.title, author: p.user?.login ?? '', avatar: p.user?.avatar_url ?? '', bot: p.user?.type === 'Bot',
      created: Date.parse(p.created_at), merged: p.merged_at ? Date.parse(p.merged_at) : null, open: p.state === 'open',
      closed: p.closed_at ? Date.parse(p.closed_at) : null,
    })),
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
    <div class="gh-card gh-graph-card">
      <div class="gh-card-head"><span>History of main</span><span class="gh-lanes" data-gh-lanes></span></div>
      <div class="gh-graph" data-gh-graph></div>
    </div>
  </section>`;
}

const fmtDay = (t) => new Date(t).toLocaleDateString('en', { month: 'short', day: 'numeric' });

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60e3);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
const escH = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ROW = 56, GAP = 34, LANE = 26, X0 = 18;
/** Lane colors: main in the text color, branches in soft hues. */
const HUES = ['#8AB4FF', '#C9A2FF', '#7FD6B0', '#F5B97A', '#FF9DB4'];

/**
 * The whole history of main, newest first, with every pull request as a lane beside it: it leaves
 * main at the last commit before it was opened, and comes back into the commit that merged it.
 * Closed ones stop where they were opened, open ones run to the top. Plain commits between two
 * moments that matter (a release, a merge, a fork, the latest ones) fold into "N commits".
 */
function graph(d) {
  const log = d.log;
  if (!log.length) return null;
  const prs = [...d.pulls].sort((a, b) => a.created - b.created);
  const forkOf = (t) => { const i = log.findIndex((c) => c.at <= t); return i < 0 ? log.length - 1 : i; };
  const info = prs.map((p) => {
    let merge = -1;
    if (p.merged) {
      merge = log.findIndex((c) => c.msg.includes(`(#${p.n})`));
      if (merge < 0) for (let i = log.length - 1; i >= 0; i--) if (log[i].at >= p.merged) { merge = i; break; }
    }
    return { p, fork: forkOf(p.created), merge };
  });
  const keep = new Set([0, 1, log.length - 1]);
  log.forEach((c, i) => { if (c.tag) keep.add(i); });
  info.forEach((x) => { keep.add(x.fork); if (x.merge >= 0) keep.add(x.merge); });
  // Rows: kept commits, folds, and each pull request just above the commit it left from.
  const rows = [];
  let fold = 0;
  log.forEach((c, i) => {
    const here = info.filter((x) => x.fork === i);
    if (!keep.has(i)) { fold++; return; }
    if (fold) { rows.push({ kind: 'fold', n: fold }); fold = 0; }
    here.forEach((x) => rows.push({ kind: 'pr', x }));
    rows.push({ kind: 'commit', c, i });
  });
  if (fold) rows.push({ kind: 'fold', n: fold });
  // Row positions (folds are shorter).
  let y = 0;
  for (const r of rows) { const h = r.kind === 'fold' ? GAP : ROW; r.y = y + h / 2; r.h = h; y += h; }
  const rowOfCommit = (i) => rows.findIndex((r) => r.kind === 'commit' && r.i === i);
  const lanes = [];
  for (const x of info) {
    const prRow = rows.findIndex((r) => r.kind === 'pr' && r.x === x);
    const fork = rowOfCommit(x.fork), merge = x.merge >= 0 ? rowOfCommit(x.merge) : -1;
    const top = x.p.open ? -1 : merge >= 0 ? merge : prRow, low = fork;
    let lane = 1;
    while (lanes.some((l) => l.lane === lane && !(top > l.low || low < l.top))) lane++;
    lanes.push({ p: x.p, lane, top, low, fork, merge, prRow });
  }
  return { rows, lanes, height: y, width: X0 + (Math.max(0, ...lanes.map((l) => l.lane)) + 1) * LANE };
}

function graphHTML(g) {
  const lx = (lane) => X0 + lane * LANE;
  const ry = (row) => g.rows[row].y;
  const h = g.height;
  const color = (l) => HUES[(l.lane - 1) % HUES.length];
  const paths = [];
  // main: solid between commits, dotted across folded runs.
  g.rows.forEach((r, i) => {
    const top = i === 0 ? r.y : r.y - r.h / 2, bottom = i === g.rows.length - 1 ? r.y : r.y + r.h / 2;
    paths.push(`<path class="gh-line gh-main${r.kind === 'fold' ? ' gh-dots' : ''}" data-y0="${top}" data-y1="${bottom}" d="M${lx(0)} ${top} V${bottom}" />`);
  });
  for (const l of g.lanes) {
    const x = lx(l.lane), c = color(l), r = 22;
    const fy = ry(l.fork);
    let dPath = `M${lx(0)} ${fy} C${lx(0)} ${fy - r}, ${x} ${fy - r * 0.5}, ${x} ${fy - r}`;
    if (l.merge >= 0) {
      const my = ry(l.merge);
      dPath += ` V${my + r} C${x} ${my + r * 0.5}, ${lx(0)} ${my + r}, ${lx(0)} ${my}`;
    } else dPath += ` V${ry(l.prRow)}`;
    const topY = l.merge >= 0 ? ry(l.merge) : ry(l.prRow);
    paths.push(`<path class="gh-line" data-rev data-y0="${topY}" data-y1="${fy}" style="--c:${c}" d="${dPath}" />`);
    if (l.p.open) paths.push(`<path class="gh-line gh-dots" data-y0="0" data-y1="${ry(l.prRow)}" style="--c:${c}" d="M${x} ${ry(l.prRow)} V0" />`);
  }
  const nodes = g.rows.map((r, i) => {
    if (r.kind === 'fold') return '';
    if (r.kind === 'commit') {
      const merged = g.lanes.find((l) => l.merge === i);
      return `<circle class="gh-node${r.c.tag ? ' gh-node-tag' : ''}" data-y="${r.y}" style="--i:${i}${merged ? `;--c:${color(merged)}` : ''}" cx="${lx(0)}" cy="${r.y}" r="${r.c.tag ? 6 : 4.5}" />`;
    }
    const l = g.lanes.find((x) => x.p === r.x.p);
    const shut = !l.p.open && !l.p.merged;
    return shut
      ? `<g class="gh-node gh-node-x" data-y="${r.y}" style="--i:${i};--c:${color(l)}"><circle cx="${lx(l.lane)}" cy="${r.y}" r="6" /><path d="M${lx(l.lane) - 2.5} ${r.y - 2.5}l5 5m0-5l-5 5" /></g>`
      : `<circle class="gh-node gh-node-pr" data-y="${r.y}" style="--i:${i};--c:${color(l)}" cx="${lx(l.lane)}" cy="${r.y}" r="5" />`;
  }).join('');
  const avatar = (u) => (u ? `<img src="${u}${u.includes('?') ? '&' : '?'}s=40" alt="" width="16" height="16" loading="lazy">` : '');
  const rows = g.rows.map((r, i) => {
    if (r.kind === 'fold') return `<div class="gh-fold" data-y="${r.y}">${r.n} commit${r.n > 1 ? 's' : ''}</div>`;
    if (r.kind === 'commit') {
      const c = r.c, merged = g.lanes.find((l) => l.merge === i);
      return `<a class="gh-row" data-y="${r.y}" href="https://github.com/${REPO}/commit/${c.sha}" target="_blank" rel="noopener">
        <span class="gh-msg"><span class="gh-text">${escH(c.msg.replace(/\s*\(#\d+\)$/, ''))}</span>${c.tag ? `<span class="gh-tag">${escH(c.tag)}</span>` : ''}${merged ? `<span class="gh-pr" style="--c:${color(merged)}">#${merged.p.n} merged</span>` : ''}</span>
        <span class="gh-meta">${avatar(c.avatar)}${escH(c.author)} · <code>${c.sha.slice(0, 7)}</code> · ${ago(c.at)}</span>
      </a>`;
    }
    const p = r.x.p, l = g.lanes.find((x) => x.p === p);
    const state = p.open ? 'open' : p.merged ? 'merged' : 'closed';
    return `<a class="gh-row gh-row-pr" data-y="${r.y}" style="--c:${color(l)}" href="https://github.com/${REPO}/pull/${p.n}" target="_blank" rel="noopener">
      <span class="gh-msg"><span class="gh-text">${escH(p.title)}</span><span class="gh-pr gh-${state}">#${p.n} ${state}</span></span>
      <span class="gh-meta">${avatar(p.avatar)}${escH(p.author.replace(/\[bot\]$/, ''))} opened a pull request · ${ago(p.created)}</span>
    </a>`;
  }).join('');
  return `<svg class="gh-svg" width="${g.width}" height="${h}" viewBox="0 0 ${g.width} ${h}" aria-hidden="true">${paths.join('')}${nodes}</svg>
    <div class="gh-rows" style="--gw:${g.width + 14}px">${rows}</div>`;
}

/**
 * Loads the data and draws the graph with the scroll: a drawing head sits at 70% of the viewport,
 * every line is drawn down to it, and each node and row lights up once the head passes it.
 * Scrolling back up undraws it. Returns a dispose function.
 */
export function mountHistory(root) {
  const el = root.querySelector('[data-gh]');
  if (!el) return () => {};
  let alive = true, raf = 0, parts = null, svg = null;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const update = () => {
    raf = 0;
    if (!parts) return;
    const head = still ? 1e9 : innerHeight * 0.7 - svg.getBoundingClientRect().top;
    for (const p of parts.lines) {
      const f = Math.min(1, Math.max(0, (head - p.y0) / Math.max(1, p.y1 - p.y0)));
      if (p.dots) { p.el.classList.toggle('on', f > 0.5); continue; }
      // A lane is drawn from its fork upward: reveal it from its end so it grows top down.
      p.el.style.strokeDashoffset = String((p.rev ? -1 : 1) * p.len * (1 - f));
    }
    for (const n of parts.marks) n.el.classList.toggle('on', head >= n.y);
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  load().then((d) => {
    if (!alive) return;
    const g = graph(d);
    if (!g) return;
    el.hidden = false;
    const first = Math.min(d.created, d.log.at(-1)?.at ?? d.created);
    const days = Math.max(1, Math.ceil((Date.now() - first) / DAY));
    el.querySelector('[data-gh-sub]').textContent = `Started ${fmtDay(first)}, ${days} day${days > 1 ? 's' : ''} ago. Every commit and pull request is public.`;
    el.querySelector('[data-gh-graph]').innerHTML = graphHTML(g);
    const n = g.lanes.length;
    el.querySelector('[data-gh-lanes]').textContent = `${d.log.length} commits · ${n} pull request${n > 1 ? 's' : ''}`;
    svg = el.querySelector('.gh-svg');
    parts = {
      lines: [...el.querySelectorAll('.gh-line')].map((p) => {
        const len = Math.ceil(p.getTotalLength());
        if (!p.classList.contains('gh-dots')) { p.style.strokeDasharray = `${len} ${len}`; }
        return { el: p, len, y0: +p.dataset.y0, y1: +p.dataset.y1, rev: p.hasAttribute('data-rev'), dots: p.classList.contains('gh-dots') };
      }),
      marks: [...el.querySelectorAll('[data-y]')].map((m) => ({ el: m, y: +m.dataset.y })),
    };
    update();
  }).catch(() => {});
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); };
}
