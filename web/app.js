import { GETTING_STARTED, GROUPS, VARIANTS, ORDER } from './data.js';
import { icon, GLYPH } from './icons.js';
import { mountDemo, HINTS } from './demo.js';
import { PORTED } from './engine/atlas.js';
import { showcaseHTML, mountShowcase } from './showcase.js';
import { ready } from './images.js';
import { introductionPage, installationPage, agentPromptPage, agentsStripHTML } from './docs.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- Sidebar ---------- */

function link(id, title, badge) {
  return `<a class="side-link" href="#/${id}" data-id="${id}"><span>${title}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</a>`;
}

function renderSidebar() {
  $('#side').innerHTML = `
    <div class="side-group">
      <p class="side-label">Getting started</p>
      ${link('gallery', 'Gallery')}
      ${GETTING_STARTED.map((p) => link(p.id, p.title, p.badge)).join('')}
    </div>
    ${GROUPS.map((g) => `
      <div class="side-group">
        <p class="side-label">${g.label}</p>
        ${g.ids.map((id) => link(id, VARIANTS[id].title, PORTED.includes(id) ? '' : 'Soon')).join('')}
      </div>`).join('')}
    <div class="side-foot">
      <div class="socials">
        <a class="social" href="https://github.com/rs-4" target="_blank" rel="noopener" aria-label="GitHub">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        </a>
        <a class="social" href="https://x.com/rsStats_" target="_blank" rel="noopener" aria-label="X (Twitter)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
      </div>
      <p>v0.0.1 · MIT</p>
    </div>`;
}

/* ---------- Building blocks ---------- */

const ph = (label, note = '', cls = '') =>
  `<div class="ph ${cls}"><span class="ph-tag">Placeholder</span><p class="ph-label">${label}</p>${note ? `<p class="ph-note">${note}</p>` : ''}</div>`;

function highlight(code) {
  return esc(code)
    .replace(/(&#39;|'[^'\n]*')/g, '<span class="tk-s">$1</span>')
    .replace(/\b(import|from|const|await|return|export|function)\b/g, '<span class="tk-k">$1</span>')
    .replace(/(&lt;\/?)([A-Z][A-Za-z]*)/g, '$1<span class="tk-t">$2</span>')
    .replace(/\b(\d+)\b/g, '<span class="tk-n">$1</span>');
}

const copyIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>';

function codeBlock(code, { lang = 'tsx', title } = {}) {
  return `<div class="code">
    ${title ? `<div class="code-head"><span>${title}</span><span class="code-lang">${lang}</span></div>` : ''}
    <button class="icon-btn code-copy" aria-label="Copy code" data-copy>${copyIcon}</button>
    <pre><code>${highlight(code)}</code></pre>
  </div>`;
}

const cmd = (c) => `<div class="cmd"><span class="cmd-dollar">$</span><code>${esc(c)}</code><button class="icon-btn" aria-label="Copy command" data-copy>${copyIcon}</button></div>`;

const arrow = (dir) => `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${dir === 'l' ? '<path d="M13 8H3M7 4 3 8l4 4"/>' : '<path d="M3 8h10M9 4l4 4-4 4"/>'}</svg>`;

function pageHead(id, title, desc, glyph) {
  const i = ORDER.indexOf(id);
  const prev = i > 0 ? ORDER[i - 1] : null, next = i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
  return `<header class="head">
    <div class="head-top">
      <div class="head-icon">${glyph}</div>
      ${i >= 0 ? `<div class="head-nav">
        <a class="round" ${prev ? `href="#/${prev}" title="${VARIANTS[prev].title}"` : 'aria-disabled="true"'} aria-label="Previous variant">${arrow('l')}</a>
        <a class="round" ${next ? `href="#/${next}" title="${VARIANTS[next].title}"` : 'aria-disabled="true"'} aria-label="Next variant">${arrow('r')}</a>
      </div>` : ''}
    </div>
    <h1>${title}</h1>
    <p class="sub">${desc}</p>
  </header>`;
}

/* ---------- Variant page (dust is the reference skeleton) ---------- */

function chips(label, opts, on = 0) {
  return `<div class="ctl"><p class="ctl-label">${label}</p><div class="chips">${opts.map((o, i) => `<button class="chip${i === on ? ' on' : ''}">${o}</button>`).join('')}</div></div>`;
}
function slider(label, val, unit, pct) {
  return `<div class="ctl"><div class="slider" style="--p:${pct}%"><span>${label}</span><span class="slider-val">${val}${unit}</span></div></div>`;
}

function variantPage(id) {
  const v = VARIANTS[id];
  const full = id === 'dust';
  const live = PORTED.includes(id);
  const code = v.code ?? `// ${v.title} usage snippet goes here (see README.md)\nimport { ${v.hook} } from 'react-native-dissolve';`;
  return `
  ${pageHead(id, v.title, v.desc, `<span class="glyph-lg">${icon(id, 26)}</span>`)}

  <div class="toolbar">
    <div class="seg" role="tablist">
      <button class="seg-btn on" data-tab="preview" role="tab">Preview</button>
      <button class="seg-btn" data-tab="install" role="tab">Install</button>
    </div>
    <div class="toolbar-right">
      <div class="platforms" role="radiogroup" aria-label="Platform">
        <button class="plat on" data-plat="rn">React Native</button>
        <button class="plat" data-plat="web">Web<span class="soon">Port</span></button>
      </div>
      <button class="btn btn-accent" data-scroll="playground"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 4h7M12 4h2M2 12h3M8 12h6"/><circle cx="10.5" cy="4" r="1.5"/><circle cx="6.5" cy="12" r="1.5"/></svg>Tune in Playground</button>
      <button class="btn" data-copy>${copyIcon}Copy prompt</button>
    </div>
  </div>

  <div class="tab-panel" data-panel="preview">
    <section class="stage" id="main-stage">
      <div class="stage-slot"></div>
      <p class="stage-hint">${HINTS[id]}</p>
      ${live ? '<button class="btn btn-sm stage-replay" data-replay>Replay</button>' : '<span class="stage-flag">Native only for now</span>'}
    </section>

    <div class="tiles">
      ${full ? ph('Demo tile: inbox row swipe', 'Small scene, 1/3 width') + ph('Demo tile: photo grid delete', 'Wide scene, 2/3 width', 'tile-wide')
             : ph('Demo tile', '') + ph('Demo tile', '', 'tile-wide')}
    </div>

    <h2 class="section-title" id="playground">Playground</h2>
    <div class="pg">
      <div class="pg-stage">
        ${ph('Playground canvas', 'Same scene as the stage, driven by the panel on the right')}
        <div class="pg-actions"><button class="chip on">Play</button><button class="chip">Reverse</button><button class="chip">Reset</button></div>
      </div>
      <aside class="panel" aria-label="Controls (not wired yet)">
        ${chips('Origin', ['left', 'right', 'top', 'bottom', 'center'])}
        ${chips('Direction', ['out', 'in'])}
        ${slider('Grain', 3, ' px', 30)}
        ${slider('Duration', 1500, ' ms', 55)}
        ${slider('Spread', 1, 'x', 40)}
        <div class="ctl ctl-row"><span>Haptics</span><span class="switch on" role="switch" aria-checked="true"></span></div>
        <p class="panel-note">Controls are not wired in the blank version.</p>
      </aside>
    </div>

    <div class="code-swap" data-code="rn">${codeBlock(code, { title: `${v.hook} · React Native` })}</div>
    <div class="code-swap" data-code="web" hidden>${codeBlock(v.web ?? '// Web snippet', { title: 'Canvas 2D port · Web', lang: 'js' })}</div>

    <h2 class="section-title">Options</h2>
    ${ph('API table', 'Prop, type, default, description. One row per option (origin, direction, grain, duration, haptics, field, n).', 'ph-table')}

    <h2 class="section-title">Best practices</h2>
    ${ph('Do and don\'t list', 'When to use this variant, grain budget, accessibility (reduced motion).')}
  </div>

  <div class="tab-panel" data-panel="install" hidden>
    ${cmd('npx expo install react-native-dissolve @shopify/react-native-skia react-native-reanimated')}
    ${codeBlock(`import { DissolveProvider } from 'react-native-dissolve';\n\nexport default function Layout() {\n  return <DissolveProvider><Stack /></DissolveProvider>;\n}`, { title: 'app/_layout.tsx' })}
    ${ph('Peer dependency matrix', 'Expo SDK, Skia, Reanimated 4, worklets versions')}
  </div>`;
}

/* ---------- Getting started + gallery ---------- */

const DOC = { pageHead, codeBlock, cmd, copyIcon, icon, GLYPH };
const PAGES = {
  introduction: () => introductionPage(DOC),
  installation: () => installationPage(DOC),
  'agent-prompt': () => agentPromptPage(DOC),
  gallery: () => showcaseHTML() + agentsStripHTML(),
};

function tiles() {
  return ORDER.map((id) => {
    const group = GROUPS.find((g) => g.ids.includes(id)).label;
    return `<div class="g-tile" data-group="${group}">
      <div class="g-thumb" data-demo="${id}"><div class="stage-slot"></div></div>
      <a class="g-meta" href="#/${id}"><span class="g-name">${VARIANTS[id].title}<span class="g-group">${group}</span></span><span class="g-hint">${HINTS[id]}${arrow('r')}</span></a>
    </div>`;
  }).join('');
}

/* ---------- Router ---------- */

function route(keepScroll) {
  const id = location.hash.replace(/^#\/?/, '') || 'gallery';
  const view = $('#view');
  view.innerHTML = VARIANTS[id] ? variantPage(id) : (PAGES[id] ?? PAGES.gallery)();
  document.querySelectorAll('.side-link').forEach((a) => a.classList.toggle('on', a.dataset.id === id));
  document.title = `${VARIANTS[id]?.title ?? (GETTING_STARTED.find((p) => p.id === id)?.title || (id === 'gallery' ? 'Gallery' : 'Introduction'))} · dissolve`;
  document.body.classList.remove('side-open');
  if (keepScroll !== true) window.scrollTo(0, 0);
  wire(view);
  if (VARIANTS[id]) mountDemo($('#main-stage'), id);
  if (id === 'gallery' || !(VARIANTS[id] || PAGES[id])) {
    document.body.classList.add('is-showcase');
    $('#sc-all').innerHTML = tiles();
    view.querySelectorAll('[data-demo]').forEach((el, i) => mountDemo(el, el.dataset.demo, { size: 'sm', autoplay: 500 + (i % 3) * 180 }));
    mountShowcase(view);
  } else document.body.classList.remove('is-showcase');
}

function wire(root) {
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    root.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  }));
  root.querySelectorAll('[data-plat]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-plat]').forEach((x) => x.classList.toggle('on', x === b));
    root.querySelectorAll('[data-code]').forEach((c) => (c.hidden = c.dataset.code !== b.dataset.plat));
  }));
  root.querySelectorAll('.chips').forEach((g) => g.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    g.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
  }));
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('.g-tile').forEach((t) => (t.hidden = b.dataset.filter !== 'All' && t.dataset.group !== b.dataset.filter));
  }));
  root.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    document.getElementById(b.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const src = b.closest('.code,.cmd,.prompt')?.querySelector('code,.prompt-body');
    if (src) navigator.clipboard?.writeText(src.innerText).catch(() => {});
    b.classList.add('done');
    setTimeout(() => b.classList.remove('done'), 900);
  }));
}

renderSidebar();
const applyTheme = (t) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#F9FAFB' : '#121212';
};
applyTheme(localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
$('#theme').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', t);
  applyTheme(t);
  route(true); // demo cards are canvas snapshots, redraw them in the new theme
});
$('#menu').addEventListener('click', () => document.body.classList.toggle('side-open'));
$('#scrim').addEventListener('click', () => document.body.classList.remove('side-open'));
addEventListener('hashchange', () => route());
let lastW = innerWidth, rt = 0;
addEventListener('resize', () => {
  if (Math.abs(innerWidth - lastW) < 40) return;
  clearTimeout(rt);
  rt = setTimeout(() => { lastW = innerWidth; route(true); }, 250);
});
await Promise.all([ready, document.fonts.load('400 14px Geist'), document.fonts.load('500 14px Geist'), document.fonts.load('600 14px Geist'), document.fonts.ready]);
route();
