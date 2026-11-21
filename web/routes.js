// Page URLs of the site. Every page has a real path, so search engines and AI crawlers index each
// one (scripts/build-seo.mjs writes a static index.html per path), and the app routes on the path:
//   /                      gallery (home)
//   /components/           all components        /components/<name>/   one component
//   /effects/              all effects           /effects/<name>/      one effect (variant)
//   /docs/<page>/          introduction, installation, cli, theming, agent-prompt
// Old hash links (#/toggle) still work: the app swaps them for the path on load.
import { GETTING_STARTED, VARIANTS } from './data.js';

export const SITE = 'https://dissolve.rselmi.com';

const DOCS = new Set(GETTING_STARTED.map((p) => p.id));

/** The path of a page id (the ids of the hash routes: 'gallery', 'toggle', 'dust', 'cli'...). */
export function pathOf(id) {
  if (!id || id === 'gallery') return '/';
  if (id === 'components' || id === 'effects') return `/${id}/`;
  if (VARIANTS[id]) return `/effects/${id}/`;
  if (DOCS.has(id)) return `/docs/${id}/`;
  return `/components/${id}/`;
}

/**
 * The page id of a path, or null when the path is not a page of the app (a file such as /r/x.json).
 * isComponent(id) says whether a /components/<id>/ path names a real component.
 */
export function idOf(pathname, isComponent = () => true) {
  const p = pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  if (p === '/') return 'gallery';
  if (p === '/components' || p === '/effects') return p.slice(1);
  if (p === '/docs') return 'introduction';
  const m = p.match(/^\/(components|effects|docs)\/([a-z0-9-]+)$/);
  if (!m) return null;
  const [, kind, id] = m;
  if (kind === 'effects') return VARIANTS[id] ? id : null;
  if (kind === 'docs') return DOCS.has(id) ? id : null;
  return isComponent(id) ? id : null;
}

/**
 * The <title> of a page. The static pages and the app use the same one, so the title a crawler
 * reads in the HTML is the one the rendered page keeps. component: { title, web } of a component.
 */
export function titleOf(id, component) {
  if (!id || id === 'gallery') return 'dissolve · Animated components for React Native and React';
  if (id === 'components') return 'Components for React Native and React · dissolve';
  if (id === 'effects') return 'Effects: turn any React Native view into dust · dissolve';
  if (VARIANTS[id]) return `${VARIANTS[id].title} effect for React Native · dissolve`;
  const doc = GETTING_STARTED.find((p) => p.id === id);
  if (doc) return `${doc.title} · dissolve docs`;
  if (component) return `${words(id)} component for ${component.web ? 'React Native and React' : 'React Native'} · dissolve`;
  return 'dissolve';
}

/** A component id in words, the way people search for it: 'swipe-to-delete' is 'Swipe to delete'. */
export function words(id) {
  const s = id.split('-').map((w) => (w === 'otp' ? 'OTP' : w)).join(' ');
  return s[0].toUpperCase() + s.slice(1);
}

/** Client side navigation to a path of the site: pushes it, the app routes on popstate. */
export function go(href) {
  const url = new URL(href, location.href);
  if (url.pathname !== location.pathname) history.pushState(null, '', url.pathname);
  dispatchEvent(new PopStateEvent('popstate'));
}
