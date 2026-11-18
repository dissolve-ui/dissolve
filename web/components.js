// Ready-made components (src/dissolve/components/*), ported to the web on the same engine.
// The ports live in cp/*.js, the built-in ones in cp/core.js. This module gathers them, mounts one
// demo, and builds the gallery section and the component pages.
import { scope, onTheme, onWidth, PKG, DIR } from './cp/kit.js';
import { autoplay } from './autoplay.js';
import { ENTRIES as CORE } from './cp/core.js';
import { ENTRIES as INPUTS } from './cp/inputs.js';
import { ENTRIES as MESSAGES } from './cp/messages.js';
import { ENTRIES as SURFACES } from './cp/surfaces.js';
import { ENTRIES as AI } from './cp/ai.js';
import { ENTRIES as CONTROLS } from './cp/controls.js';
import { ENTRIES as PULL } from './cp/pull.js';
import { ENTRIES as REORDER } from './cp/reorder.js';
import { ENTRIES as BUTTON } from './cp/button.js';
import { ENTRIES as SCRATCH } from './cp/scratch.js';
import { ENTRIES as SKELETON } from './cp/skeleton.js';
import { ENTRIES as SEGMENTED } from './cp/segmented.js';

export const COMPONENTS = { ...CORE, ...INPUTS, ...MESSAGES, ...SURFACES, ...AI, ...CONTROLS, ...PULL, ...REORDER, ...BUTTON, ...SCRATCH, ...SKELETON, ...SEGMENTED };

// Sidebar and gallery order: registry order, with the glossy button brought up front.
export const COMPONENT_ORDER = (() => {
  const ids = Object.keys(COMPONENTS).filter((id) => id !== 'glossy-button');
  if (COMPONENTS['glossy-button']) ids.splice(2, 0, 'glossy-button');
  return ids;
})();

/**
 * Mounts one component demo into `body`. mode: 'panel' (gallery section), 'stage' (its page),
 * 'tile' (Every variant grid). Returns { run, dispose }: run() plays the demo once by itself.
 * Most ports follow a theme switch live; the few that read the theme once (remountOnTheme)
 * start over in the new one, as does any port whose box width changes a lot.
 */
export function mountComponent(id, body, { mode = 'panel' } = {}) {
  const entry = COMPONENTS[id];
  body.classList.add('cp-body', `cp-mode-${mode}`, `cp-is-${id}`);
  let sc, api, current = null;
  const start = () => { sc = scope(); current = null; api = entry.mount(body, { sc, mode }); };
  const restart = () => { sc.dispose(); body.replaceChildren(); start(); };
  start();
  // Ports are laid out for the width they get at mount: a box that grows or shrinks a lot mounts again.
  const offWidth = onWidth(null, body, restart);
  const offTheme = entry.remountOnTheme ? onTheme(null, restart) : null;
  // One run at a time: Play demo during an autoplay (or the reverse) joins the run in flight.
  const run = () => {
    if (!sc.alive) return Promise.resolve();
    current ??= Promise.resolve(api.run()).finally(() => { current = null; });
    return current;
  };
  return { run, dispose: () => { offWidth(); offTheme?.(); sc.dispose(); } };
}

/* ======================================================================================
   Gallery section + component pages
   ====================================================================================== */

const arrowR = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

/** A few engine effects sit among the components, so the gallery shows why dissolve from the first row. */
const FX = { 0: { id: 'dust', title: 'Dust', href: '#/dust' }, 4: { id: 'stream', title: 'Stream', href: '#/stream' }, 8: { id: 'scrub', title: 'Scrub', href: '#/effects' } };

/** Masonry columns of the gallery section for the current width. */
export const galleryCols = () => (innerWidth >= 1400 ? 3 : 2);

export function componentsSectionHTML() {
  // Columns filled in reading order. The page re-renders when the count changes (app.js).
  const cols = galleryCols();
  const items = [];
  // Gallery order: the sidebar order, with a few swaps for the layout.
  const order = [...COMPONENT_ORDER];
  const swap = (a, b) => { const i = order.indexOf(a), j = order.indexOf(b); if (i >= 0 && j >= 0) [order[i], order[j]] = [order[j], order[i]]; };
  swap('bar-chart', 'before-after');
  order.forEach((id) => {
    while (FX[items.length]) items.push({ fx: FX[items.length] });
    items.push({ id });
  });
  const panel = (it, i) => it.fx
    ? `<section class="cp-panel cp-panel-fx" aria-label="${it.fx.title}">
      <a class="cp-panel-head" href="${it.fx.href}">
        <span class="cp-panel-text"><span class="cp-name">${it.fx.title}</span></span>
        <span class="cp-go">${arrowR}</span>
      </a>
      <div class="cp-panel-body cp-fx-body" data-fx="${it.fx.id}" data-rank="${i}"><div class="stage-slot"></div></div>
    </section>`
    : `<section class="cp-panel" aria-label="${COMPONENTS[it.id].title}">
      <a class="cp-panel-head" href="#/${it.id}">
        <span class="cp-panel-text"><span class="cp-name">${COMPONENTS[it.id].title}</span></span>
        <span class="cp-go">${arrowR}</span>
      </a>
      <div class="cp-panel-body" data-cp="${it.id}" data-rank="${i}"></div>
    </section>`;
  return `<div class="cp-grid cp-grid-home">${Array.from({ length: cols }, (_, col) => `<div class="cp-col">
    ${items.map((it, i) => (i % cols !== col ? '' : panel(it, i))).join('')}
  </div>`).join('')}</div>`;
}

/** Mounts every panel of the gallery section. Returns a dispose function. */
export function mountComponentsSection(root) {
  const mounted = [...root.querySelectorAll('[data-cp]')].map((b) => {
    const m = mountComponent(b.dataset.cp, b, { mode: 'panel' });
    const stop = autoplay(b, m, { threshold: 0.35, rank: Number(b.dataset.rank) });
    return { dispose: () => { stop(); m.dispose(); } };
  });
  return () => mounted.forEach((m) => m.dispose());
}

export function propsTable(id) {
  return `<div class="dc-table-wrap">
    <table class="dc-table opt-table">
      <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
      <tbody>${COMPONENTS[id].props.map((o) => `<tr><td><code>${o.name}</code></td><td><code class="opt-type">${o.type}</code></td><td>${o.def ? `<code>${o.def}</code>` : ''}</td><td>${o.desc}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

export function componentPrompt(id) {
  const c = COMPONENTS[id];
  return `Add the ${c.title} component from dissolve to this React Native / Expo app. ${c.desc}
Install the engine: npx expo install ${PKG} @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
Wrap the root layout once in <DissolveProvider> from ${PKG} (above the navigator)${id === 'toast' || id === 'swipe-to-delete' || id === 'split-button' ? `, and in <ToastProvider> from ${DIR}/toast inside it` : ''}.
The component is not exported by the package: copy it into the project with npx ${PKG} add ${id} (it runs init the first time: tw.tsx primitives and --dissolve-* theme tokens in global.css). It needs NativeWind v5 (Tailwind v4, react-native-css) and tailwind-merge; if they are missing, set them up first.
Restyle it with className and the part classNames (later classes win), or with the --dissolve-* tokens in global.css.
Usage:

${c.code}`;
}
