// Ready-made components (src/dissolve/components/*), ported to the web on the same engine.
// The ports live in cp/*.js, the built-in ones in cp/core.js. This module gathers them, mounts one
// demo, and builds the gallery section and the component pages.
import { scope, onTheme, onWidth, PKG, DIR } from './cp/kit.js';
import { WEB_COMPONENTS } from './lib/available.js';
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
import { ENTRIES as TOGGLE } from './cp/toggle.js';
import { ENTRIES as STEPS } from './cp/steps.js';
import { ENTRIES as SLIDER } from './cp/slider.js';

export const COMPONENTS = { ...CORE, ...INPUTS, ...MESSAGES, ...SURFACES, ...AI, ...CONTROLS, ...PULL, ...REORDER, ...BUTTON, ...SCRATCH, ...SKELETON, ...SEGMENTED, ...TOGGLE, ...STEPS, ...SLIDER };

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
const FX = { 3: { id: 'dust', title: 'Dust', href: '#/dust' }, 7: { id: 'stream', title: 'Stream', href: '#/stream' }, 11: { id: 'scrub', title: 'Scrub', href: '#/effects' } };

/** Masonry columns of the gallery section for the current width. */
export const galleryCols = () => (innerWidth >= 1000 ? 3 : 2);

/** How you interact with each component: the gallery filters. */
export const TAGS = ['Press', 'Drag', 'Swipe', 'Type', 'Select', 'Loading'];
const TAG_OF = {
  'glossy-button': 'Press', 'like-button': 'Press', 'morph-button': 'Press', 'split-button': 'Press', 'gooey-menu': 'Press',
  'reaction-picker': 'Press', 'quantity-stepper': 'Press', 'task-check': 'Press', toast: 'Press',
  'slide-to-confirm': 'Drag', 'elastic-slider': 'Drag', 'reorder-list': 'Drag', 'before-after': 'Drag', 'signature-pad': 'Drag', 'scratch-card': 'Drag',
  'ruler-picker': 'Drag', 'pull-to-refresh': 'Drag',
  'swipe-to-delete': 'Swipe', 'card-stack': 'Swipe',
  'otp-input': 'Type', 'number-ticker': 'Type',
  'segmented-control': 'Select', toggle: 'Press', 'progress-steps': 'Select', 'bar-chart': 'Select', 'mini-player': 'Select', 'voice-note': 'Select',
  'thinking-orb': 'Loading', skeleton: 'Loading', 'upload-tile': 'Loading', 'image-reveal': 'Loading', 'sweep-transition': 'Loading',
};
export const tagOf = (id) => TAG_OF[id] ?? 'Press';

const sliders = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5H3M12 19H3M14 3v4M16 17v4M21 12h-9M21 19h-5M21 5h-7M8 10v4M8 12H3"/></svg>';
const playIcon = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.4v9.2a.6.6 0 0 0 .9.5l7.4-4.6a.6.6 0 0 0 0-1L5.9 2.9a.6.6 0 0 0-.9.5Z"/></svg>';

/** The demos that open the gallery: the biggest ones, side by side on the first row. */
const LEAD = ['bar-chart', 'scratch-card', 'card-stack'];
/** The newest components, right after the lead row. */
const NEW = ['elastic-slider', 'toggle', 'progress-steps'];

export function componentsSectionHTML() {
  // Columns filled in reading order. The page re-renders when the count changes (app.js).
  const cols = galleryCols();
  const items = [];
  // Gallery order: the sidebar order, with a few swaps for the layout.
  // The three biggest demos open the gallery, the newest follow, the rest in the sidebar order.
  const order = [...LEAD, ...NEW, ...COMPONENT_ORDER.filter((id) => !LEAD.includes(id) && !NEW.includes(id))].filter((id) => COMPONENTS[id]);
  order.forEach((id) => {
    // A few engine effects sit among the components.
    while (FX[items.length]) items.push({ fx: FX[items.length] });
    items.push({ id });
  });
  // The demo sits alone on a dot grid; its name, number and interaction are a caption under it.
  // Numbered in reading order (the columns render column by column).
  let n = 0;
  items.forEach((it) => { it.num = it.fx ? 'fx' : String(++n).padStart(2, '0'); });
  const item = (it, i) => {
    const fx = !!it.fx;
    const title = fx ? it.fx.title : COMPONENTS[it.id].title, href = fx ? it.fx.href : `#/${it.id}`;
    const num = it.num;
    const body = fx
      ? `<div class="cp-panel-body cp-fx-body" data-fx="${it.fx.id}" data-rank="${i}"><div class="stage-slot"></div></div>`
      : `<div class="cp-panel-body" data-cp="${it.id}" data-rank="${i}"></div>`;
    return `<figure class="bx-item">
      <section class="cp-panel bx-card${fx ? ' cp-panel-fx' : ''}" aria-label="${title}">
        ${body}
        <span class="bx-acts">${fx ? '' : `<button class="bx-act" data-bx-play aria-label="Play ${title}">${playIcon}</button>`}<a class="bx-act" href="${href}" aria-label="Open ${title}">${sliders}</a></span>
      </section>
      <figcaption class="bx-cap"><span class="bx-num">${num}</span><a class="bx-name" href="${href}">${title}</a><span class="bx-kind">${fx ? 'Effect' : tagOf(it.id)}</span></figcaption>
    </figure>`;
  };
  return `<div class="cp-grid cp-grid-home">${Array.from({ length: cols }, (_, col) => `<div class="cp-col">
    ${items.map((it, i) => (i % cols !== col ? '' : item(it, i))).join('')}
  </div>`).join('')}</div>`;
}

const NO_AUTOPLAY = new Set(['toast']);

/** Mounts every panel of the gallery section. Returns a dispose function. */
export function mountComponentsSection(root) {
  const mounted = [...root.querySelectorAll('[data-cp]')].map((b) => {
    const m = mountComponent(b.dataset.cp, b, { mode: 'panel' });
    // The toast fires over the whole page: in the gallery it only plays when asked.
    const stop = NO_AUTOPLAY.has(b.dataset.cp) ? () => {} : autoplay(b, m, { threshold: 0.35, rank: Number(b.dataset.rank) });
    const play = b.parentElement.querySelector('[data-bx-play]');
    play?.addEventListener('click', () => m.run());
    return { dispose: () => { stop(); m.dispose(); } };
  });
  return () => mounted.forEach((m) => m.dispose());
}

/* ======================================================================================
   Platforms: one doc, a usage snippet per platform
   ====================================================================================== */

const WEB = new Set(WEB_COMPONENTS);
/** True once registry/web/<id>.tsx exists (web/lib/available.js is generated by the web build). */
export const hasWeb = (id) => WEB.has(id);

/** The platform shown on a component page: the last one picked, native when the web is not there yet. */
export const platformOf = (id) => (hasWeb(id) && localStorage.getItem('platform') === 'web' ? 'web' : 'native');
export const choosePlatform = (p) => localStorage.setItem('platform', p);

/** The add command of a component (from the snippet's leading "// npx ... add" line) and the snippet without it. */
export function usage(id) {
  const code = COMPONENTS[id].code;
  const m = code.match(/^\/\/\s*npx \S+ (add [^\n]+)\n+/);
  return { add: `npx ${PKG} ${m ? m[1].trim() : `add ${id}`}`, code: m ? code.slice(m[0].length) : code };
}

/**
 * The React snippet: the native one with DOM elements and the Expo Router layout turned into a
 * Next.js one, unless the entry has its own webCode.
 */
export function webCode(id) {
  const c = COMPONENTS[id];
  if (c.webCode) return c.webCode;
  return usage(id).code
    .replace(/^import [^\n]* from '(react-native|react-native-[\w-]+|expo-[\w-]+)';\n/gm, '')
    .replace(/<(\/?)Text\b/g, '<$1span')
    .replace(/<(\/?)View\b/g, '<$1div')
    .replace(/<(\/?)SymbolView\b/g, '<$1Icon')
    .replace(/<Image source=/g, '<img src=')
    .replace(/ collapsable=\{false\}/g, '')
    .replace(/\btintColor=/g, 'color=')
    .replace(/app\/_layout\.tsx, inside <DissolveProvider>/g, 'app/layout.tsx')
    .replace(/<Stack \/>/g, '{children}')
    .replace(/insets\.top \+ (\d+)/g, '$1');
}

export function propsTable(id) {
  const native = new Set(COMPONENTS[id].nativeOnly ?? []);
  const only = (name) => name.split('/').some((n) => native.has(n.trim())) ? ` <span class="plat-tag" data-for="web">React Native</span>` : '';
  return `<div class="dc-table-wrap">
    <table class="dc-table opt-table">
      <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
      <tbody>${COMPONENTS[id].props.map((o) => `<tr><td><code>${o.name}</code>${only(o.name)}</td><td><code class="opt-type">${o.type}</code></td><td>${o.def ? `<code>${o.def}</code>` : ''}</td><td>${o.desc}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

const TOAST_PROVIDER = (id) => (id === 'toast' || id === 'swipe-to-delete' || id === 'split-button' ? `, and in <ToastProvider> from ${DIR}/toast inside it` : '');

export function componentPrompt(id, platform = 'native') {
  const c = COMPONENTS[id];
  const { add } = usage(id);
  if (platform === 'web') return `Add the ${c.title} component from dissolve to this React app. ${c.desc}
Copy it into the project with ${add} --web (the first run writes dissolve.json and the --dissolve-* theme tokens). It needs React 19 and react-dom, nothing else: the animation runs on a canvas that ships with the component. The file starts with 'use client', so it works in the Next.js App Router.
Restyle it with className and the part classNames, or with the --dissolve-* tokens in your CSS.
Usage:

${webCode(id)}`;
  return `Add the ${c.title} component from dissolve to this React Native / Expo app. ${c.desc}
Install the engine: npx expo install ${PKG} @shopify/react-native-skia react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics
Wrap the root layout once in <DissolveProvider> from ${PKG} (above the navigator)${TOAST_PROVIDER(id)}.
The component is not exported by the package: copy it into the project with ${add} --native (the first run writes dissolve.json, the tw.tsx primitives and the --dissolve-* theme tokens in global.css). It needs NativeWind v5 (Tailwind v4, react-native-css) and tailwind-merge; if they are missing, set them up first.
Restyle it with className and the part classNames (later classes win), or with the --dissolve-* tokens in global.css.
Usage:

${usage(id).code}`;
}
