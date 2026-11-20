import { GETTING_STARTED, GROUPS, VARIANTS, ORDER } from './data.js';
import { icon, GLYPH } from './icons.js';
import { mountDemo, HINTS, tilesHTML, mountTiles } from './demo.js';
import { cancelAll } from './lib/engine.js';
import { playgroundHTML, mountPlayground } from './playground.js';
import { OPTIONS, PRACTICES, PEERS, INSTALL, PROVIDER, PKG } from './variants-content.js';
import { showcaseHTML, effectsHTML, mountShowcase, mountScrub } from './showcase.js';
import { ready } from './images.js';
import { introductionPage, installationPage, cliPage, themingPage, agentPromptPage, agentsStripHTML, SHADCN } from './docs.js';
import { COMPONENTS, COMPONENT_ORDER, mountComponent, componentsSectionHTML, filtersHTML, tagOf, galleryCols, mountComponentsSection, propsTable, componentPrompt, hasWeb, platformOf, choosePlatform, usage, webCode } from './components.js';
import { autoplay, sequence } from './autoplay.js';
import { clearToasts } from './cp/core.js';
import { onWidth } from './cp/kit.js';
import { historyHTML, mountHistory } from './history.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- Sidebar ---------- */

function link(id, title, badge) {
  return `<a class="side-link" href="#/${id}" data-id="${id}"><span>${title}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</a>`;
}

/** GitHub stars of the repo, cached for an hour, shown in the sidebar. */
async function loadStars() {
  const els = document.querySelectorAll('.star-count');
  if (!els.length) return;
  const show = (n) => els.forEach((el) => { el.textContent = n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n); el.hidden = false; });
  try {
    const cached = JSON.parse(localStorage.getItem('stars') || 'null');
    if (cached && Date.now() - cached.t < 3600e3) return show(cached.n);
    const r = await fetch('https://api.github.com/repos/rs-4/dissolve');
    if (!r.ok) return;
    const n = (await r.json()).stargazers_count;
    if (typeof n !== 'number') return;
    localStorage.setItem('stars', JSON.stringify({ n, t: Date.now() }));
    show(n);
  } catch {}
}

function renderSidebar() {
  $('#side').innerHTML = `
    <div class="side-head">
      <a href="#/gallery" class="brand"><span class="brand-name">dissolve</span></a>
      <div class="side-actions">
        <button id="theme" class="icon-btn theme-btn" aria-label="Toggle light and dark theme">
            <svg class="i-sun" width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="9" cy="9" r="3.2"/><path d="M9 1.8v1.6M9 14.6v1.6M1.8 9h1.6M14.6 9h1.6M3.9 3.9l1.1 1.1M13 13l1.1 1.1M3.9 14.1 5 13M13 5l1.1-1.1"/></svg>
            <svg class="i-moon" width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M15 10.6A6.2 6.2 0 0 1 7.4 3a6.2 6.2 0 1 0 7.6 7.6Z"/></svg>
          </button>
      <a class="side-star" href="https://github.com/rs-4/dissolve" target="_blank" rel="noopener" aria-label="Star dissolve on GitHub">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        <span class="star-count" id="star-count" hidden></span>
      </a>
      </div>
    </div>
    <div class="side-group">
      <p class="side-label">Getting started</p>
      ${link('gallery', 'Gallery')}
      ${link('effects', 'Effects')}
      ${GETTING_STARTED.map((p) => link(p.id, p.title, p.badge)).join('')}
    </div>
    <div class="side-group">
      <p class="side-label">Components</p>
      ${COMPONENT_ORDER.map((id) => link(id, COMPONENTS[id].title)).join('')}
    </div>
    ${GROUPS.map((g) => `
      <div class="side-group">
        <p class="side-label">${g.label}</p>
        ${g.ids.map((id) => link(id, VARIANTS[id].title)).join('')}
      </div>`).join('')}
    <div class="side-foot">
      <div class="socials">
        <a class="social" href="https://x.com/rsStats_" target="_blank" rel="noopener" aria-label="X (Twitter)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
      </div>
      <p>v0.0.6 · MIT</p>
    </div>`;
}

/* ---------- Top bar ---------- */

const GH = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
/** The mark: a white disc whose dots come loose on the right, like a view turning to grains. */
const MARK = `<svg class="top-mark" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="15" fill="currentColor"/>${
  [[9, 9], [13, 9], [9, 13], [13, 13], [9, 17], [13, 17], [9, 21], [13, 21], [17.2, 10], [17, 14.2], [17.4, 18.6], [21, 12.4], [20.6, 17.4], [23.4, 15.2]]
    .map(([cx, cy], i) => `<circle cx="${cx}" cy="${cy}" r="${i < 8 ? 1.45 : i < 11 ? 1.2 : 0.85}" fill="var(--bg)"${i >= 11 ? ' opacity=".7"' : ''}/>`).join('')
}</svg>`;
const SEARCH = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.6"/><path d="m10.4 10.4 3.1 3.1"/></svg>';
/** Top bar sections: each one lights up on its own pages. */
const TOP = [
  { href: '#/gallery', label: 'Components', on: (id) => isGallery(id) || !!COMPONENTS[id] },
  { href: '#/effects', label: 'Effects', on: (id) => id === 'effects' || !!VARIANTS[id] },
  { href: '#/introduction', label: 'Docs', on: (id) => !!GETTING_STARTED.find((p) => p.id === id) && id !== 'agent-prompt' },
  { href: '#/agent-prompt', label: 'Agents', on: (id) => id === 'agent-prompt' },
];

function renderTop() {
  $('#top').innerHTML = `
    <a href="#/gallery" class="top-brand" aria-label="dissolve home">${MARK}<span>dissolve</span></a>
    <nav class="top-nav">${TOP.map((t) => `<a class="top-link" href="${t.href}">${t.label}</a>`).join('')}</nav>
    <button class="top-search" data-palette aria-label="Search components">${SEARCH}<span>Search</span><kbd>⌘K</kbd></button>
    <div class="top-right">
      <a class="top-gh" href="https://github.com/rs-4/dissolve" target="_blank" rel="noopener" aria-label="Star dissolve on GitHub">${GH}<span class="star-count" hidden></span></a>
      <a class="bx-pill bx-pill-light top-cta" href="#/installation">Get started</a>
    </div>`;
  $('#top').querySelector('[data-palette]').addEventListener('click', openPalette);
}

function markTop(id) {
  document.querySelectorAll('.top-link').forEach((a, i) => a.classList.toggle('on', TOP[i].on(id)));
}

/* ---------- Search (⌘K) ---------- */

const ENTRIES_ALL = () => [
  ...COMPONENT_ORDER.map((id) => ({ id, title: COMPONENTS[id].title, kind: tagOf(id) })),
  ...ORDER.map((id) => ({ id, title: VARIANTS[id].title, kind: 'Effect' })),
  ...GETTING_STARTED.map((p) => ({ id: p.id, title: p.title, kind: 'Docs' })),
];

function openPalette() {
  if ($('.pal')) return;
  const all = ENTRIES_ALL();
  const el = document.createElement('div');
  el.className = 'pal';
  el.innerHTML = `<div class="pal-box" role="dialog" aria-label="Search">
    <div class="pal-in">${SEARCH}<input placeholder="Search components, effects, docs" aria-label="Search" autocomplete="off" spellcheck="false" /><kbd>esc</kbd></div>
    <div class="pal-list" role="listbox"></div>
  </div>`;
  document.body.append(el);
  const input = el.querySelector('input'), list = el.querySelector('.pal-list');
  let hits = all, sel = 0;
  const draw = () => {
    list.innerHTML = hits.length
      ? hits.map((h, i) => `<a class="pal-item${i === sel ? ' on' : ''}" href="#/${h.id}" role="option" data-i="${i}"><span>${esc(h.title)}</span><span class="pal-kind">${h.kind}</span></a>`).join('')
      : '<p class="pal-empty">Nothing matches.</p>';
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 160); removeEventListener('keydown', key, true); };
  const key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % Math.max(1, hits.length); draw(); }
    else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); location.hash = `#/${hits[sel].id}`; close(); }
  };
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    hits = !q ? all : all.filter((h) => h.title.toLowerCase().includes(q) || h.id.includes(q) || h.kind.toLowerCase() === q);
    sel = 0; draw();
  });
  list.addEventListener('click', (e) => { if (e.target.closest('.pal-item')) close(); });
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  addEventListener('keydown', key, true);
  draw();
  requestAnimationFrame(() => input.focus());
}

addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openPalette(); }
});

/* ---------- Building blocks ---------- */

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

const VARIANT_NAV = { order: ORDER, title: (k) => VARIANTS[k].title, noun: 'variant' };
const COMPONENT_NAV = { order: COMPONENT_ORDER, title: (k) => COMPONENTS[k].title, noun: 'component' };

function pageHead(id, title, desc, glyph, nav = VARIANT_NAV) {
  const order = nav.order;
  const i = order.indexOf(id);
  const prev = i > 0 ? order[i - 1] : null, next = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  return `<header class="head">
    <div class="head-top">
      ${glyph ? `<div class="head-icon">${glyph}</div>` : '<span></span>'}
      ${i >= 0 ? `<div class="head-nav">
        <a class="round" ${prev ? `href="#/${prev}" title="${nav.title(prev)}"` : 'aria-disabled="true"'} aria-label="Previous ${nav.noun}">${arrow('l')}</a>
        <a class="round" ${next ? `href="#/${next}" title="${nav.title(next)}"` : 'aria-disabled="true"'} aria-label="Next ${nav.noun}">${arrow('r')}</a>
      </div>` : ''}
    </div>
    <h1>${title}</h1>
    <p class="sub">${desc}</p>
  </header>`;
}

/* ---------- Variant page ---------- */

function optionsTable(id) {
  return `<div class="dc-table-wrap">
    <table class="dc-table opt-table">
      <thead><tr><th>Option</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
      <tbody>${OPTIONS[id].map((o) => `<tr><td><code>${o.name}</code></td><td><code class="opt-type">${o.type}</code></td><td><code>${o.def}</code></td><td>${o.desc}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

const DO = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>';
const DONT = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>';

function practicesList(id) {
  return `<ul class="bp">${PRACTICES[id].map(([k, t]) => `<li class="bp-${k}"><span class="bp-icon" aria-label="${k === 'do' ? 'Do' : 'Don\'t'}">${k === 'do' ? DO : DONT}</span><span>${t}</span></li>`).join('')}</ul>`;
}

function variantPage(id) {
  const v = VARIANTS[id];
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
        <button class="plat" data-plat="web">Web<span class="plat-tag">Port</span></button>
      </div>
      <button class="btn btn-accent" data-scroll="playground"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 4h7M12 4h2M2 12h3M8 12h6"/><circle cx="10.5" cy="4" r="1.5"/><circle cx="6.5" cy="12" r="1.5"/></svg>Tune in Playground</button>
      <button class="btn" data-copy-prompt>${copyIcon}Copy prompt</button>
    </div>
  </div>

  <div class="tab-panel" data-panel="preview">
    <section class="stage" id="main-stage">
      <div class="stage-slot"></div>
      <p class="stage-hint">${HINTS[id]}</p>
      <button class="btn btn-sm stage-replay" data-replay>Replay</button>
    </section>

    ${tilesHTML(id)}

    ${playgroundHTML(id, { codeBlock, title: v.title })}

    <h2 class="section-title">Options</h2>
    ${optionsTable(id)}

    <h2 class="section-title">Best practices</h2>
    ${practicesList(id)}
  </div>

  <div class="tab-panel" data-panel="install" hidden>
    ${installPanel(`${v.title} needs nothing more than the provider.`)}
  </div>`;
}

function installPanel(extra) {
  return `
    <p class="dc-text">Install the package and its peers. ${extra}</p>
    ${cmd(INSTALL)}
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead><tr><th>Peer</th><th>Tested</th><th>Used for</th></tr></thead>
        <tbody>${PEERS.map(([p, ver, u]) => `<tr><td><code>${p}</code></td><td>${ver}</td><td>${u}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="dc-note">Expo's Babel preset already adds the worklets plugin. In a bare React Native app, add <code>'react-native-worklets/plugin'</code> to <code>babel.config.js</code>.</p>
    <h2 class="section-title">Provider</h2>
    <p class="dc-text">Wrap the app once, above the navigator, so effects survive a screen pop. Grains are drawn in a full screen overlay that ignores touches.</p>
    ${codeBlock(PROVIDER, { title: 'app/_layout.tsx' })}`;
}

/* ---------- Component page ---------- */

const TOAST_LAYOUT = `import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DissolveProvider } from 'dissolve-ui';
import { ToastProvider } from '@/components/dissolve/toast';

export default function Layout() {
  const insets = useSafeAreaInsets();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DissolveProvider>
        <ToastProvider top={insets.top + 8}>
          <Stack />
        </ToastProvider>
      </DissolveProvider>
    </GestureHandlerRootView>
  );
}`;

/** React Native / React switch of a component page. React shows up once registry/web/<id>.tsx exists. */
function platformSwitch(id, plat) {
  const btn = (p, label) => `<button class="plat${p === plat ? ' on' : ''}" data-platform="${p}" role="radio" aria-checked="${p === plat}">${label}</button>`;
  return `<div class="platforms" role="radiogroup" aria-label="Platform">${btn('native', 'React Native')}${hasWeb(id) ? btn('web', 'React') : ''}</div>`;
}

/** Web notes of a component: what its native only props become in a browser. */
function webNotes(c) {
  const notes = [];
  if (c.props.some((o) => o.name === 'haptics')) notes.push('<code>haptics</code> maps to <code>navigator.vibrate</code> where the browser has it.');
  if (c.nativeOnly?.length) notes.push('Props tagged React Native in the table only apply on native.');
  return notes.length ? `<p class="dc-note">${notes.join(' ')}</p>` : '';
}

/** The same component through the shadcn CLI. */
const shadcnAdd = (path) => `<p class="dc-label">Or with the shadcn CLI</p>${cmd(`npx shadcn@latest add ${SHADCN}/${path}.json`)}`;

/** A numbered step of a component's Install tab. */
const installStep = (n, title, body) => `<h2 class="section-title dc-step"><span class="dc-num">${n}</span>${title}</h2>${body}`;

/** Install tab, React Native: the engine and the provider once per app, then the component. */
function nativeInstall(id, c, add) {
  const toast = id === 'toast';
  return `
    <p class="dc-lead">Steps 1 and 2 happen once per app. Already using dissolve? Go to step 3.</p>
    ${installStep(1, 'Install the engine', `
      ${cmd(INSTALL)}
      <details class="dc-more"><summary>Peer versions</summary>
        <div class="dc-table-wrap">
          <table class="dc-table">
            <thead><tr><th>Peer</th><th>Tested</th><th>Used for</th></tr></thead>
            <tbody>${PEERS.map(([p, ver, u]) => `<tr><td><code>${p}</code></td><td>${ver}</td><td>${u}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <p class="dc-note">Expo's Babel preset already adds the worklets plugin. In a bare React Native app, add <code>'react-native-worklets/plugin'</code> to <code>babel.config.js</code>.</p>
      </details>`)}
    ${installStep(2, toast ? 'Wrap your app, with the toast provider' : 'Wrap your app', `
      <p class="dc-text">Once, in the root layout, above the navigator.</p>
      ${codeBlock(toast ? TOAST_LAYOUT : PROVIDER, { title: 'app/_layout.tsx' })}`)}
    ${installStep(3, `Add ${c.title}`, `
      ${add}
      <p class="dc-text">Copies <code>${id}.tsx</code> into <code>components/dissolve</code>. The code is yours to edit. The first run also sets up NativeWind styling (<code>tw.tsx</code>, the theme tokens) and tells you if anything is missing.</p>
      ${shadcnAdd(`native/${id}`)}`)}`;
}

/** Install tab, React: one command, nothing to set up. */
function webInstall(id, c, add) {
  return `
    <p class="dc-lead">One command. No engine, no provider, no Tailwind: React 19 and <code>react-dom</code> are enough.</p>
    ${installStep(1, `Add ${c.title}`, `
      ${add}
      <p class="dc-text">Copies <code>${id}.tsx</code> and its core <code>${id}.core.ts</code> into <code>components/dissolve</code> (<code>src/components/dissolve</code> in a Vite app). The code is yours to edit. Works in the Next.js App Router as is.</p>
      ${shadcnAdd(id)}`)}
    ${installStep(2, 'Use it', codeBlock(webCode(id), { title: 'App.tsx' }))}
    ${webNotes(c)}`;
}

function componentPage(id) {
  const c = COMPONENTS[id];
  const web = hasWeb(id);
  const plat = platformOf(id);
  const only = (p) => `data-for="${p}"${p === plat ? '' : ' hidden'}`;
  const snip = usage(id);
  // The command follows the switch: the flag picks the platform even before dissolve.json exists.
  const addFor = (p) => cmd(`${snip.add} --${p}`);
  return `
  ${pageHead(id, c.title, c.note, null, COMPONENT_NAV)}

  <div class="toolbar">
    <div class="seg" role="tablist">
      <button class="seg-btn on" data-tab="preview" role="tab">Preview</button>
      <button class="seg-btn" data-tab="install" role="tab">Install</button>
    </div>
    <div class="toolbar-right">
      ${platformSwitch(id, plat)}
      <button class="btn" data-copy-prompt>${copyIcon}Copy prompt</button>
    </div>
  </div>

  <div class="tab-panel" data-panel="preview">
    <section class="stage cp-stage" id="cp-stage">
      <div class="stage-slot"><div class="cp-stage-body" data-cp-stage="${id}"></div></div>
      <p class="stage-hint">${c.hint}</p>
      <button class="btn btn-sm stage-replay" data-replay>Play demo</button>
    </section>

    <h2 class="section-title">Usage</h2>
    <div ${only('native')}>${addFor('native')}${codeBlock(snip.code, { title: `${c.title}.tsx` })}</div>
    ${web ? `<div ${only('web')}>${addFor('web')}${codeBlock(webCode(id), { title: `${c.title}.tsx` })}</div>` : ''}

    <h2 class="section-title">Props</h2>
    ${propsTable(id)}

    <h2 class="section-title">How it works</h2>
    <p class="dc-text">${c.desc}</p>
  </div>

  <div class="tab-panel" data-panel="install" hidden>
    <div ${only('native')}>${nativeInstall(id, c, addFor('native'))}</div>
    ${web ? `<div ${only('web')}>${webInstall(id, c, addFor('web'))}</div>` : ''}
  </div>`;
}

function promptFor(id, root) {
  const v = VARIANTS[id];
  const code = root.querySelector('[data-code="rn"] code')?.innerText ?? '';
  return `Add the ${v.title} effect from ${PKG} to this React Native / Expo app. ${v.desc}
Install: ${INSTALL}
Wrap the root layout once in <DissolveProvider> (above the navigator).
Use these exact settings:

${code}

Hide the original view while it dissolves and update state after the promise resolves. Keep grains reasonable (6000 max per burst) and respect reduced motion (the provider already skips effects).`;
}

/* ---------- Getting started + gallery ---------- */

const DOC = { pageHead, codeBlock, cmd, copyIcon, icon, GLYPH };
const PAGES = {
  introduction: () => introductionPage(DOC),
  installation: () => installationPage(DOC),
  cli: () => cliPage(DOC),
  theming: () => themingPage(DOC),
  'agent-prompt': () => agentPromptPage(DOC),
  gallery: () => showcaseHTML({ components: () => filtersHTML(galleryTag) + componentsSectionHTML(galleryTag) }) + historyHTML() + agentsStripHTML(),
  effects: () => effectsHTML(),
};

/** The "Every variant" grid: the principal exits and entrances, then the components. */
const GRID = [
  ...['dust', 'sand', 'ember', 'pixel', 'snap', 'stream'].map((id) => ({ id, group: 'Exits' })),
  ...['gather', 'rain'].map((id) => ({ id, group: 'Entrances' })),
];

function tiles() {
  return GRID.map(({ id, group, component }) => {
    const title = component ? COMPONENTS[id].title : VARIANTS[id].title;
    return `<div class="g-tile" data-group="${group}">
      <div class="g-thumb${component ? ' g-thumb-cp' : ''}" ${component ? 'data-cp-tile' : 'data-demo'}="${id}"><div class="stage-slot"></div></div>
      <a class="g-meta" href="#/${id}"><span class="g-name">${title}</span>${arrow('r')}</a>
    </div>`;
  }).join('');
}

/* ---------- Router ---------- */

let teardown = [];
let galleryDispose = null, lastCols = 0, galleryTag = 'All';

const routeId = () => location.hash.replace(/^#\/?/, '') || 'gallery';
const isGallery = (id) => !(VARIANTS[id] || PAGES[id] || COMPONENTS[id]) || id === 'gallery';

function route(keepScroll) {
  const id = routeId();
  const view = $('#view');
  // Stop everything the previous render started (bursts, loops, timers, observers).
  teardown.forEach((f) => f());
  teardown = [];
  galleryDispose = null;
  cancelAll();
  clearToasts();
  const comp = COMPONENTS[id];
  view.innerHTML = VARIANTS[id] ? variantPage(id) : comp ? componentPage(id) : (PAGES[id] ?? PAGES.gallery)();
  document.querySelectorAll('.side-link').forEach((a) => a.classList.toggle('on', a.dataset.id === id));
  markTop(id);
  // The gallery takes the full width, without the sidebar.
  document.body.classList.toggle('bx-wide', isGallery(id));
  document.title = `${VARIANTS[id]?.title ?? comp?.title ?? (GETTING_STARTED.find((p) => p.id === id)?.title || (id === 'gallery' ? 'Gallery' : id === 'effects' ? 'Effects' : 'Introduction'))} · dissolve`;
  document.body.classList.remove('side-open');
  if (keepScroll !== true) window.scrollTo(0, 0);
  wire(view);
  if (VARIANTS[id]) {
    teardown.push(mountDemo($('#main-stage'), id).dispose, mountPlayground(view, id, { highlight }), mountTiles(view, id));
    const cp = view.querySelector('[data-copy-prompt]');
    cp?.addEventListener('click', () => {
      navigator.clipboard?.writeText(promptFor(id, view)).catch(() => {});
      cp.classList.add('done');
      setTimeout(() => cp.classList.remove('done'), 900);
    });
  }
  if (comp) teardown.push(mountComponentPage(view, id));
  if (isGallery(id) || id === 'effects') {
    document.body.classList.add('is-showcase');
    teardown.push(mountShowcase(view));
    if (id !== 'effects') {
      lastCols = galleryCols();
      galleryDispose = mountGallery(view);
      teardown.push(() => galleryDispose?.());
      wireFilters(view);
      teardown.push(mountHistory(view));
    }
  } else document.body.classList.remove('is-showcase');
  if (id === 'effects') {
    $('#sc-all').innerHTML = tiles();
    const demos = [...view.querySelectorAll('#sc-all [data-demo], #sc-all [data-cp-tile]')].map((el) => {
      const api = el.dataset.demo
        ? mountDemo(el, el.dataset.demo, { size: 'sm', autoplay: false })
        : mountComponent(el.dataset.cpTile, el.querySelector('.stage-slot'), { mode: 'tile' });
      teardown.push(api.dispose);
      return { el, api, component: !el.dataset.demo };
    });
    teardown.push(sequence($('#sc-all'), demos));
  }
}

/**
 * A demo that mounts again once its box width changes a lot (the gallery reflows on resize).
 * mount() returns { run, dispose }; so does this.
 */
function refitting(el, mount) {
  let cur = mount();
  const off = onWidth(null, el, () => { cur.dispose(); cur = mount(); });
  return { run: () => cur.run(), dispose: () => { off(); cur.dispose(); } };
}

/** The gallery grid: every component panel and the engine effects among them. Returns a dispose function. */
function mountGallery(view) {
  const stops = [mountComponentsSection(view)];
  view.querySelectorAll('[data-fx]').forEach((el) => {
    const slot = el.querySelector('.stage-slot');
    const api = el.dataset.fx === 'scrub'
      ? refitting(el, () => ({ run() {}, dispose: mountScrub(slot) }))
      : refitting(el, () => mountDemo(el, el.dataset.fx, { size: 'sm', autoplay: false }));
    stops.push(api.dispose);
    if (el.dataset.fx !== 'scrub') stops.push(autoplay(el, api, { threshold: 0.35, rank: Number(el.dataset.rank) }));
  });
  return () => stops.forEach((f) => f());
}

/** Gallery filters: rebuild the grid for the picked interaction. */
function wireFilters(view) {
  view.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tag === galleryTag) return;
    galleryTag = b.dataset.tag;
    view.querySelectorAll('[data-tag]').forEach((x) => x.classList.toggle('on', x === b));
    galleryDispose?.();
    $('#view .cp-grid').outerHTML = componentsSectionHTML(galleryTag);
    galleryDispose = mountGallery(view);
  }));
}

/** Mounts the live parts of a component page (stage, autoplay, buttons). Returns a dispose function. */
function mountComponentPage(root, id) {
  const stage = mountComponent(id, root.querySelector('[data-cp-stage]'), { mode: 'stage' });
  const stopAuto = autoplay(root.querySelector('#cp-stage'), stage, { threshold: 0.4 });
  root.querySelector('[data-replay]').addEventListener('click', () => stage.run());
  const cp = root.querySelector('[data-copy-prompt]');
  cp.addEventListener('click', () => {
    navigator.clipboard?.writeText(componentPrompt(id, platformOf(id))).catch(() => {});
    cp.classList.add('done');
    setTimeout(() => cp.classList.remove('done'), 900);
  });
  return () => { stopAuto(); stage.dispose(); };
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
  root.querySelectorAll('[data-platform]').forEach((b) => b.addEventListener('click', () => {
    choosePlatform(b.dataset.platform);
    root.querySelectorAll('[data-platform]').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
    root.querySelectorAll('[data-for]').forEach((n) => (n.hidden = n.dataset.for !== b.dataset.platform));
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

renderTop();
renderSidebar();
loadStars();
const applyTheme = (t) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t === 'light' ? '#F9FAFB' : '#121212';
};
applyTheme(localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
// Canvases follow the theme on their own (onTheme in cp/kit.js): no re-render here.
$('#theme').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', t);
  applyTheme(t);
});
$('#menu').addEventListener('click', () => document.body.classList.toggle('side-open'));
$('#scrim').addEventListener('click', () => document.body.classList.remove('side-open'));
addEventListener('hashchange', () => route());
// Resize: the gallery panels refit themselves (onWidth), only a new column count rebuilds its grid.
// The variant and effects pages lay their scenes out once, so a real width change renders them again.
let lastW = innerWidth, rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    const id = routeId(), wide = Math.abs(innerWidth - lastW) >= 40;
    if (wide) lastW = innerWidth;
    if (isGallery(id)) {
      const cols = galleryCols();
      if (cols === lastCols || !galleryDispose) return;
      lastCols = cols;
      galleryDispose();
      $('#view .cp-grid').outerHTML = componentsSectionHTML(galleryTag);
      galleryDispose = mountGallery($('#view'));
    } else if (wide && (VARIANTS[id] || id === 'effects')) route(true);
  }, 250);
});
await Promise.all([ready, document.fonts.load('400 14px Allo'), document.fonts.load('500 14px Allo'), document.fonts.load('600 14px Allo'), document.fonts.ready]);
route();
