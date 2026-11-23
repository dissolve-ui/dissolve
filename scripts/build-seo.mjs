// Static pages for search engines and AI crawlers. The site is a single page app: without this, a
// crawler that does not run JavaScript sees one empty page. From the same data the app renders
// (the ENTRIES of web/cp, web/data.js, web/variants-content.js, the docs pages, registry/index.json)
// this writes, into web/:
//   index.html, components/<name>/index.html, effects/<name>/index.html, docs/<page>/index.html ...
//     one real page per URL: the app shell (it still loads the interactive app) with its own title,
//     description, canonical, Open Graph and JSON-LD, and the page content as plain HTML, which the
//     app replaces with the live page once it runs (see [data-prerender] in styles.css).
//   components/<name>.md, effects/<name>.md, docs/<page>.md   the same content as markdown
//   llms.txt, llms-full.txt   the llms.txt convention: a summary and links, then every page in full
//   sitemap.xml, robots.txt
// Run after the stamp (npm run web:stamp does), since the pages copy the stamped head of index.html.
// test/seo.test.mjs checks the committed files are the current build.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');
const GITHUB = 'https://github.com/dissolve-ui/dissolve';
const NPM = 'https://www.npmjs.com/package/dissolve-ui';
/** Folders of web/ this script owns entirely: emptied before each build, so a removed page goes away. */
export const OWNED_DIRS = ['components', 'effects', 'docs'];
/** Files of web/ this script writes besides the pages. */
export const OWNED_FILES = ['index.html', 'llms.txt', 'llms-full.txt', 'sitemap.xml', 'robots.txt'];

/* ---------- text helpers ---------- */

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Text of an HTML fragment: tags dropped, entities decoded, white space collapsed. */
export const plain = (html) => decode(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function decode(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/**
 * Markdown of the HTML this script and the docs pages write: headings, paragraphs, lists, tables,
 * code blocks (<pre><code class="language-x">), inline code, links, bold. Anything else is dropped.
 */
export function htmlToMd(html, base = '') {
  const keep = [];
  const hold = (s) => `\u0000${keep.push(s) - 1}\u0000`;
  const expand = (s) => { while (/\u0000\d+\u0000/.test(s)) s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[Number(i)]); return s; };
  const abs = (href) => (/^(https?:|mailto:)/.test(href) ? href : base + (href.startsWith('/') ? href : `/${href}`));
  const inline = (s) => decode(String(s)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (_, c) => hold('`' + decode(c.replace(/<[^>]+>/g, '')) + '`'))
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/g, '**$2**')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, t) => `[${t.replace(/<[^>]+>/g, '').trim()}](${abs(decode(href))})`)
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ').trim();

  let s = String(html)
    .replace(/<(svg|button|script|style|summary)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<span class="(dc-num|badge)">[^<]*<\/span>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  // Code blocks, with their title (a figcaption) on the line above.
  s = s.replace(/<figure class="code">\s*(?:<figcaption>([\s\S]*?)<\/figcaption>)?\s*<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>\s*<\/figure>/g,
    (_, title, lang, code) => `\n\n${hold(`${title ? `${plain(title)}:\n\n` : ''}\`\`\`${lang ?? ''}\n${decode(code).replace(/\n+$/, '')}\n\`\`\``)}\n\n`);
  s = s.replace(/<pre\b[^>]*>(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?<\/pre>/g, (_, code) => `\n\n${hold('```\n' + decode(code.replace(/<[^>]+>/g, '')).replace(/\n+$/, '') + '\n```')}\n\n`);
  // Tables.
  s = s.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/g, (_, t) => {
    const rows = [...t.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => expand(inline(c[1])).replace(/\|/g, '\\|')));
    if (!rows.length) return '';
    const line = (r) => `| ${r.join(' | ')} |`;
    return `\n\n${hold([line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n'))}\n\n`;
  });
  // Ordered lists get their numbers, the others a dash.
  s = s.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/g, (_, l) => {
    let n = 0;
    return `\n\n${l.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/g, (__, t) => `\n${hold(`${++n}. ${inline(t)}`)}\n`)}\n\n`;
  });
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/g, (_, t) => `\n${hold(`- ${inline(t)}`)}\n`);
  s = s.replace(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/g, (_, n, t) => `\n\n${hold(`${'#'.repeat(Number(n))} ${inline(t)}`)}\n\n`);
  s = s.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/g, (_, t) => `\n\n${hold(inline(t))}\n\n`);
  // Links outside a paragraph (button rows) become list items.
  s = s.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, (a) => `\n${hold(`- ${inline(a)}`)}\n`);
  // Whatever is left (div, section, nav...) only separates blocks.
  s = s.replace(/<[^>]+>/g, '\n');
  s = s.split('\n').map((l) => l.trim()).filter((l, i, a) => l || (a[i - 1] ?? '') !== '').join('\n');
  // Text outside any block element.
  s = s.replace(/^(?!\u0000)(.+)$/gm, (l) => decode(l));
  s = expand(s).replace(/\n{3,}/g, '\n\n');
  // Items of one list sit on consecutive lines.
  s = s.replace(/(?<=^(?:- |\d+\. ).*)\n\n(?=- |\d+\. )/gm, '\n');
  return s.trim() + '\n';
}

/* ---------- the site data, read from the site modules ---------- */

/** Inert stand ins for the browser globals the site modules touch when they load. */
function browserStubs(site) {
  const stub = () => new Proxy(function () {}, {
    get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : stub()),
    apply: () => stub(),
    construct: () => stub(),
  });
  const names = ['matchMedia', 'document', 'window', 'localStorage', 'Image', 'devicePixelRatio', 'addEventListener', 'requestAnimationFrame',
    'cancelAnimationFrame', 'getComputedStyle', 'CSS', 'HTMLElement', 'innerWidth', 'innerHeight', 'OffscreenCanvas', 'FontFace',
    'ResizeObserver', 'IntersectionObserver', 'customElements', 'history'];
  for (const k of names) if (!(k in globalThis)) globalThis[k] = stub();
  // docs.js builds the skill URL from the page location.
  if (!('location' in globalThis)) globalThis.location = new URL(`${site}/`);
}

async function loadSite() {
  const mod = (f) => import(pathToFileURL(join(WEB, f)).href);
  const routes = await mod('routes.js');
  browserStubs(routes.SITE);
  const [components, data, content, docs, playground] = await Promise.all(
    ['components.js', 'data.js', 'variants-content.js', 'docs.js', 'playground.js'].map(mod),
  );
  const registry = JSON.parse(readFileSync(join(ROOT, 'registry', 'index.json'), 'utf8')).components;
  const pkg = JSON.parse(readFileSync(join(ROOT, 'packages', 'dissolve-ui', 'package.json'), 'utf8'));
  return { routes, components, data, content, docs, playground, registry, pkg };
}

/* ---------- pages ---------- */

const code = (src, { title, lang = 'tsx' } = {}) =>
  `<figure class="code">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}<pre><code class="language-${lang}">${esc(src)}</code></pre></figure>`;
const cmd = (c) => code(c, { lang: 'sh' });
const table = (head, rows) =>
  `<div class="dc-table-wrap"><table class="dc-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

/** Every page of the site: { id, path, title, description, crumbs, body, md, kind }. */
export async function sitePages(site) {
  const S = site ?? (await loadSite());
  const { routes, data, content, docs, playground, registry, pkg } = S;
  const { COMPONENTS, COMPONENT_ORDER, usage, webCode, hasWeb } = S.components;
  const { VARIANTS, ORDER, GROUPS, GETTING_STARTED } = data;
  const { OPTIONS, PRACTICES, INSTALL, PROVIDER, PKG } = content;
  const { pathOf, titleOf, words, SITE } = routes;
  /** 'Swipe to delete' as it reads inside a sentence: 'swipe to delete', 'OTP input'. */
  const lower = (id) => { const w = words(id); return /^[A-Z]{2}/.test(w) ? w : w[0].toLowerCase() + w.slice(1); };
  const regOf = Object.fromEntries(registry.map((c) => [c.name, c]));
  const SHADCN = docs.SHADCN;
  const link = (id, text) => `<a href="${pathOf(id)}">${esc(text)}</a>`;
  const platforms = (id) => (hasWeb(id) ? 'React Native and React' : 'React Native');
  const lede = `<code>${PKG}</code> is an open source (MIT) animation library for React Native, with animated UI components for React Native and React.`;
  const pages = [];

  // Home.
  const componentItems = COMPONENT_ORDER.map((id) => `${link(id, COMPONENTS[id].title)}: ${esc(regOf[id]?.description ?? plain(COMPONENTS[id].note))}`);
  const effectItems = (ids) => ids.map((id) => `${link(id, VARIANTS[id].title)}: ${esc(VARIANTS[id].desc)}`);
  pages.push({
    id: 'gallery', kind: 'home',
    title: titleOf('gallery'),
    description: pkg.description,
    crumbs: [],
    body: `
      <h1>dissolve</h1>
      <p>dissolve (npm: <code>${PKG}</code>) is an open source animation library for React Native, with ${COMPONENT_ORDER.length} animated UI components for React Native and React. Components are copied into your app with <code>npx ${PKG} add &lt;name&gt;</code> or the shadcn CLI: the source is yours to edit, styled with classNames and the <code>--dissolve-*</code> theme tokens.</p>
      <p>The React Native engine turns any view into dust: the view is snapshotted with Skia <code>makeImageFromView</code>, cut into grains drawn with one <code>&lt;Atlas&gt;</code>, and animated on the UI thread with Reanimated 4. Grain counts are capped at 6000 per burst. It works on iOS and Android, and in Expo Go.</p>
      <p>On the web, each component is a React component with the same props. It needs only React 19 and <code>react-dom</code>, draws on a canvas, and works in the Next.js App Router and Vite.</p>
      <h2>Get started</h2>
      <p>React Native: install the engine and its peers, wrap the app once in <code>&lt;DissolveProvider&gt;</code>, then add components.</p>
      ${cmd(INSTALL)}
      ${cmd(`npx ${PKG} add swipe-to-delete --native`)}
      <p>React: no engine and no provider, one command per component.</p>
      ${cmd(`npx ${PKG} add scratch-card --web`)}
      ${cmd(`npx shadcn@latest add ${SHADCN}/scratch-card.json`)}
      <p>Step by step: ${link('installation', 'Installation')}. With a coding agent: ${link('agent-prompt', 'Agent prompt')}.</p>
      <h2>Components</h2>
      ${list(componentItems)}
      <h2>Effects</h2>
      ${GROUPS.map((g) => `<h3>${esc(g.label)}</h3>${list(effectItems(g.ids))}`).join('')}
      <h2>Docs</h2>
      ${list(GETTING_STARTED.map((p) => link(p.id, p.title)))}`,
  });

  // All components.
  pages.push({
    id: 'components', kind: 'list',
    title: titleOf('components'),
    description: `${COMPONENT_ORDER.length} animated components for React Native and React. Each one is a file you copy into your app and own: npx ${PKG} add <name>.`,
    crumbs: [['Components', 'components']],
    items: COMPONENT_ORDER,
    body: `
      <h1>Components</h1>
      <p>${COMPONENT_ORDER.length} animated components for React Native and React. Each one is a file you copy into your app and own: <code>npx ${PKG} add &lt;name&gt;</code>, or <code>npx shadcn@latest add ${SHADCN}/&lt;name&gt;.json</code>.</p>
      ${list(componentItems)}`,
  });

  // All effects.
  pages.push({
    id: 'effects', kind: 'list',
    title: titleOf('effects'),
    description: `${ORDER.length} effects that turn any React Native view into grains: exits, entrances, gestures, morph, peel and melt. Skia snapshot, Reanimated 4 on the UI thread.`,
    crumbs: [['Effects', 'effects']],
    items: ORDER,
    body: `
      <h1>Effects</h1>
      <p>${ORDER.length} effects of the dissolve engine for React Native. Put a ref on any view, call <code>dissolve()</code>, and it dissolves, melts, peels or rebuilds itself. Every effect runs on the UI thread with Reanimated 4.</p>
      ${cmd(INSTALL)}
      ${GROUPS.map((g) => `<h2>${esc(g.label)}</h2>${list(effectItems(g.ids))}`).join('')}`,
  });

  // Components.
  COMPONENT_ORDER.forEach((id, i) => {
    const c = COMPONENTS[id];
    const reg = regOf[id] ?? {};
    const web = hasWeb(id);
    const snip = usage(id);
    const native = new Set(c.nativeOnly ?? []);
    const prev = COMPONENT_ORDER[i - 1], next = COMPONENT_ORDER[i + 1];
    const summary = reg.description ?? plain(c.note);
    pages.push({
      id, kind: 'component', md: true,
      title: titleOf(id, { title: c.title, web }),
      description: `${summary} ${c.title} for ${platforms(id)}: npx ${PKG} add ${id}.`,
      crumbs: [['Components', 'components'], [c.title, id]],
      name: c.title, file: reg.file, headline: `${c.title}: ${lower(id)} component for ${platforms(id)}`,
      body: `
        <h1>${esc(c.title)}</h1>
        <p><strong>${esc(c.title)}</strong> is an animated ${esc(lower(id))} component for ${platforms(id)}, from the dissolve library. ${esc(summary)}</p>
        <p>${c.desc}</p>
        <h2>Install</h2>
        <h3>React Native</h3>
        <p>Install the engine once per app and wrap the root layout in <code>&lt;DissolveProvider&gt;</code> (see ${link('installation', 'Installation')}), then copy the component into <code>components/dissolve</code>:</p>
        ${cmd(INSTALL)}
        ${cmd(`${snip.add} --native`)}
        ${cmd(`npx shadcn@latest add ${SHADCN}/native/${id}.json`)}
        ${web ? `<h3>React</h3>
        <p>Needs React 19 and <code>react-dom</code>, nothing else: no engine, no provider, no Tailwind. Works in the Next.js App Router.</p>
        ${cmd(`${snip.add} --web`)}
        ${cmd(`npx shadcn@latest add ${SHADCN}/${id}.json`)}` : ''}
        <h2>Usage</h2>
        ${code(snip.code, { title: web ? `${c.title}.tsx (React Native)` : `${c.title}.tsx` })}
        ${web ? code(webCode(id), { title: `${c.title}.tsx (React)` }) : ''}
        <h2>Props</h2>
        ${table(['Prop', 'Type', 'Default', 'Description'], c.props.map((o) => [
          `<code>${o.name}</code>${o.name.split('/').some((n) => native.has(n.trim())) ? ' (React Native only)' : ''}`,
          `<code>${o.type}</code>`, o.def ? `<code>${o.def}</code>` : '', o.desc,
        ]))}
        <h2>Source</h2>
        ${list([
          reg.file ? `React Native: <a href="${GITHUB}/blob/main/registry/${reg.file}">registry/${esc(reg.file)}</a>` : null,
          web ? `React: <a href="${GITHUB}/blob/main/registry/web/${id}.tsx">registry/web/${id}.tsx</a> and <a href="${GITHUB}/blob/main/registry/web/${id}.core.ts">registry/web/${id}.core.ts</a>` : null,
        ].filter(Boolean))}
        <p>${[prev && `Previous: ${link(prev, COMPONENTS[prev].title)}`, next && `Next: ${link(next, COMPONENTS[next].title)}`, link('components', 'All components')].filter(Boolean).join(' · ')}</p>`,
    });
  });

  // Effects.
  ORDER.forEach((id, i) => {
    const v = VARIANTS[id];
    const prev = ORDER[i - 1], next = ORDER[i + 1];
    let snippet = '';
    playground.playgroundHTML(id, { title: v.title, codeBlock: (src) => { snippet ||= src; return ''; } });
    pages.push({
      id, kind: 'effect', md: true,
      title: titleOf(id),
      description: `${v.desc} The ${v.title} effect of ${PKG}, an animation library for React Native (Skia, Reanimated 4). Runs with ${v.hook}.`,
      crumbs: [['Effects', 'effects'], [v.title, id]],
      name: v.title, headline: `${v.title} effect for React Native`,
      body: `
        <h1>${esc(v.title)}</h1>
        <p><strong>${esc(v.title)}</strong> is one of the ${ORDER.length} effects of dissolve, an animation library for React Native. ${esc(v.desc)} It runs with <code>${v.hook}</code> from <code>${PKG}</code>.</p>
        <h2>Usage</h2>
        ${code(snippet, { title: `${v.title} (React Native)` })}
        <h2>Options</h2>
        ${table(['Option', 'Type', 'Default', 'Description'], OPTIONS[id].map((o) => [`<code>${o.name}</code>`, `<code>${o.type}</code>`, `<code>${o.def}</code>`, o.desc]))}
        <h2>Best practices</h2>
        ${list(PRACTICES[id].map(([, t]) => t))}
        <h2>Install</h2>
        <p>Install the package and its peers, then wrap the app once in <code>&lt;DissolveProvider&gt;</code>, above the navigator.</p>
        ${cmd(INSTALL)}
        ${code(PROVIDER, { title: 'app/_layout.tsx' })}
        <p>${[prev && `Previous: ${link(prev, VARIANTS[prev].title)}`, next && `Next: ${link(next, VARIANTS[next].title)}`, link('effects', 'All effects')].filter(Boolean).join(' · ')}</p>`,
    });
  });

  // Docs pages, from the same page builders as the app.
  const BUILDERS = { introduction: docs.introductionPage, installation: docs.installationPage, cli: docs.cliPage, theming: docs.themingPage, 'agent-prompt': docs.agentPromptPage };
  for (const p of GETTING_STARTED) {
    let sub = '';
    const helpers = {
      pageHead: (_, title, desc) => { sub = plain(desc); return `<h1>${title}</h1><p>${desc}</p>`; },
      codeBlock: (src, { title, lang } = {}) => code(src, { title, lang }),
      cmd, copyIcon: '', icon: () => '',
      GLYPH: new Proxy({}, { get: () => '' }),
    };
    const html = BUILDERS[p.id](helpers)
      .replace(/<(svg|button)\b[\s\S]*?<\/\1>/g, '')
      .replace(/<pre class="dc-prompt">([\s\S]*?)<\/pre>/g, '<pre><code class="language-text">$1</code></pre>');
    pages.push({
      id: p.id, kind: 'doc', md: true,
      title: titleOf(p.id),
      description: p.id === 'introduction' ? pkg.description : sub,
      crumbs: [['Docs', 'introduction'], ...(p.id === 'introduction' ? [] : [[p.title, p.id]])],
      name: p.title, headline: p.id === 'introduction' ? 'Introduction to dissolve' : `dissolve ${p.title}`,
      body: html,
    });
  }

  for (const p of pages) p.path = pathOf(p.id);
  return { pages, S };
}

/* ---------- head, JSON-LD, shell ---------- */

function jsonLd(page, { SITE, pkg, pathOf }) {
  const url = SITE + page.path;
  const author = { '@type': 'Person', '@id': `${SITE}/#author`, name: pkg.author, url: 'https://github.com/rs-4' };
  const website = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'dissolve', description: pkg.description, inLanguage: 'en', publisher: { '@id': author['@id'] } };
  const library = {
    '@type': 'SoftwareSourceCode', '@id': `${SITE}/#library`, name: pkg.name, description: pkg.description, url: `${SITE}/`,
    codeRepository: GITHUB, programmingLanguage: ['TypeScript', 'JavaScript'], runtimePlatform: ['React Native', 'React', 'Expo'],
    license: 'https://opensource.org/licenses/MIT', version: pkg.version, keywords: pkg.keywords.join(', '),
    author: { '@id': author['@id'] }, sameAs: [GITHUB, NPM],
  };
  const graph = [website, library, author];
  const image = `${SITE}/og.png`;
  if (page.kind === 'home') {
    graph.push({ '@type': 'WebPage', '@id': `${url}#webpage`, url, name: page.title, description: page.description, isPartOf: { '@id': website['@id'] }, about: { '@id': library['@id'] }, primaryImageOfPage: image, inLanguage: 'en' });
  } else if (page.kind === 'list') {
    graph.push({
      '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: page.title, description: page.description, isPartOf: { '@id': website['@id'] }, about: { '@id': library['@id'] }, inLanguage: 'en',
      mainEntity: { '@type': 'ItemList', itemListElement: page.items.map((id, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + pathOf(id) })) },
    });
  } else {
    const article = {
      '@type': 'TechArticle', '@id': `${url}#article`, headline: page.headline, description: page.description, url,
      mainEntityOfPage: url, isPartOf: { '@id': website['@id'] }, about: { '@id': library['@id'] }, author: { '@id': author['@id'] }, image, inLanguage: 'en',
    };
    if (page.kind === 'component') {
      article.about = {
        '@type': 'SoftwareSourceCode', name: page.name, description: page.description, codeRepository: GITHUB,
        url: page.file ? `${GITHUB}/blob/main/registry/${page.file}` : GITHUB, programmingLanguage: 'TypeScript',
        runtimePlatform: page.title.includes('React Native and React') ? ['React Native', 'React'] : ['React Native'],
        isPartOf: { '@id': library['@id'] }, license: 'https://opensource.org/licenses/MIT',
      };
    }
    graph.push(article);
  }
  if (page.crumbs.length) {
    const items = [['dissolve', 'gallery'], ...page.crumbs];
    graph.push({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, id], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + pathOf(id) })) });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function headFor(page, ctx) {
  const url = ctx.SITE + page.path;
  const type = page.kind === 'home' || page.kind === 'list' ? 'website' : 'article';
  const m = (k, v, attr = 'property') => `<meta ${attr}="${k}" content="${esc(v)}" />`;
  return [
    `<title>${esc(page.title)}</title>`,
    m('description', page.description, 'name'),
    `<link rel="canonical" href="${url}" />`,
    page.md ? `<link rel="alternate" type="text/markdown" href="${page.path.replace(/\/$/, '')}.md" />` : null,
    m('og:type', type), m('og:site_name', 'dissolve'), m('og:title', page.title), m('og:description', page.description), m('og:url', url),
    m('og:image', `${ctx.SITE}/og.png`), m('og:image:width', '1200'), m('og:image:height', '630'),
    m('og:image:alt', 'dissolve: animated components for React Native and React'),
    m('twitter:card', 'summary_large_image', 'name'), m('twitter:title', page.title, 'name'), m('twitter:description', page.description, 'name'),
    m('twitter:image', `${ctx.SITE}/og.png`, 'name'),
    `<script type="application/ld+json">${jsonLd(page, ctx)}</script>`,
  ].filter(Boolean).map((l) => `    ${l}`).join('\n');
}

/** The sidebar links, for crawlers: every page of the site from every page. */
function navFor({ pathOf, COMPONENTS, COMPONENT_ORDER, VARIANTS, GROUPS, GETTING_STARTED }) {
  const a = (id, t) => `<a class="side-link" href="${pathOf(id)}">${esc(t)}</a>`;
  const group = (label, links) => `<div class="side-group"><p class="side-label">${esc(label)}</p>${links.join('')}</div>`;
  return `<div data-prerender>${[
    group('Getting started', [a('gallery', 'Gallery'), a('effects', 'Effects'), ...GETTING_STARTED.map((p) => a(p.id, p.title))]),
    group('Components', [a('components', 'All components'), ...COMPONENT_ORDER.map((id) => a(id, COMPONENTS[id].title))]),
    ...GROUPS.map((g) => group(g.label, g.ids.map((id) => a(id, VARIANTS[id].title)))),
  ].join('')}</div>`;
}

function viewFor(page, { pathOf }) {
  const crumbs = page.crumbs.length
    ? `<nav aria-label="Breadcrumb"><ol class="dc-crumbs"><li><a href="/">dissolve</a></li>${page.crumbs.map(([name, id]) => `<li><a href="${pathOf(id)}">${esc(name)}</a></li>`).join('')}</ol></nav>`
    : '';
  const foot = `<p>dissolve is MIT licensed. Source on <a href="${GITHUB}">GitHub</a>, package on <a href="${NPM}">npm</a>.${page.md ? ` This page as <a href="${page.path.replace(/\/$/, '')}.md">markdown</a>.` : ''} For AI agents: <a href="/llms.txt">llms.txt</a>.</p>`;
  return `<article data-prerender class="dc-static">${crumbs}${page.body}${foot}</article>`;
}

/** Puts `inner` between <!-- name ... --> and <!-- /name --> in html. */
function fill(html, name, inner) {
  const re = new RegExp(`(<!-- ${name}(?: [^>]*)? -->)[\\s\\S]*?(\\s*)<!-- /${name} -->`);
  if (!re.test(html)) throw new Error(`web/index.html has no <!-- ${name} --> marker`);
  return html.replace(re, (_, open, ws) => `${open}${inner}${ws}<!-- /${name} -->`);
}

/* ---------- llms.txt, sitemap, robots ---------- */

function llmsTxt(pages, { SITE, pkg, PKG, SHADCN, INSTALL }) {
  const of = (kind) => pages.filter((p) => p.kind === kind);
  const md = (p) => `${SITE}${p.path.replace(/\/$/, '')}.md`;
  const comp = (p) => `- [${p.name}](${SITE}${p.path}): ${p.description.replace(/ [^.]+: npx \S+ add \S+\.$/, '')} Install: \`npx ${PKG} add ${p.id}\` (\`--native\` for React Native, \`--web\` for React)${p.title.includes('React Native and React') ? ` or \`npx shadcn@latest add ${SHADCN}/${p.id}.json\`` : ''}. Markdown: ${md(p)}`;
  return `# dissolve

> dissolve (npm package \`${PKG}\`, version ${pkg.version}, MIT) is an open source animation library for React Native with ${of('component').length} animated UI components for React Native and React. Components are copied into your app as source with \`npx ${PKG} add <name>\` or the shadcn CLI. The React Native engine snapshots any view with Skia, cuts it into grains and animates them on the UI thread with Reanimated 4.

- Website: ${SITE}/
- Source: ${GITHUB}
- npm: ${NPM}
- React Native setup: \`${INSTALL}\`, then wrap the root layout once in \`<DissolveProvider>\` from \`${PKG}\`.
- Add a component: \`npx ${PKG} add <name> --native\` (React Native, needs NativeWind v5) or \`npx ${PKG} add <name> --web\` (React 19 and react-dom only).
- shadcn: \`npx shadcn@latest add ${SHADCN}/<name>.json\` (React) or \`npx shadcn@latest add ${SHADCN}/native/<name>.json\` (React Native).
- MCP server for coding agents: \`npx -y dissolve-ui-mcp\`. Claude skill: ${SITE}/skills/dissolve/SKILL.md

## Docs

${of('doc').map((p) => `- [${p.name}](${SITE}${p.path}): ${p.description} Markdown: ${md(p)}`).join('\n')}

## Components

${of('component').map(comp).join('\n')}

## Effects

${of('effect').map((p) => `- [${p.name}](${SITE}${p.path}): ${p.description.replace(/ The .+$/, '')} Markdown: ${md(p)}`).join('\n')}

## Optional

- [Every page in one file](${SITE}/llms-full.txt): the docs, every component and every effect as markdown.
- [shadcn registry](${SHADCN}/registry.json): every installable item.
- [Changelog](${GITHUB}/blob/main/CHANGELOG.md)
`;
}

function llmsFull(pages, mdOf, { SITE, pkg }) {
  const order = [...pages.filter((p) => p.kind === 'doc'), ...pages.filter((p) => p.kind === 'component'), ...pages.filter((p) => p.kind === 'effect')];
  return `# dissolve: full documentation

> ${pkg.description}

Every page of ${SITE} as markdown: the docs, then every component, then every effect. The summary with links is ${SITE}/llms.txt.

${order.map((p) => `---\n\nSource: ${SITE}${p.path}\n\n${mdOf(p)}`).join('\n')}`;
}

const sitemap = (pages, SITE) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE}${p.path}</loc></url>`).join('\n')}
</urlset>
`;

/** Search engines and AI crawlers are all welcome: the AI user agents are named so the intent is explicit. */
export const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Amazonbot', 'meta-externalagent', 'CCBot', 'cohere-ai', 'DuckAssistBot', 'MistralAI-User'];
const robots = (SITE) => `# dissolve: every page may be crawled, indexed and used by search engines and AI assistants.
User-agent: *
Allow: /

${AI_BOTS.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

/* ---------- build ---------- */

/** Every generated file, relative to web/, and its content. */
export async function buildSeo() {
  const { pages, S } = await sitePages();
  const { routes, pkg } = S;
  const { SITE, pathOf } = routes;
  const ctx = {
    SITE, pkg, pathOf, PKG: S.content.PKG, SHADCN: S.docs.SHADCN, INSTALL: S.content.INSTALL,
    COMPONENTS: S.components.COMPONENTS, COMPONENT_ORDER: S.components.COMPONENT_ORDER,
    VARIANTS: S.data.VARIANTS, GROUPS: S.data.GROUPS, GETTING_STARTED: S.data.GETTING_STARTED,
  };
  // The shell: web/index.html without the content of a previous build.
  let shell = readFileSync(join(WEB, 'index.html'), 'utf8');
  shell = fill(fill(fill(shell, 'seo:head', ''), 'seo:nav', ''), 'seo:view', '');
  const nav = navFor(ctx);
  const files = new Map();
  const mdOf = (p) => htmlToMd(p.body, SITE) + `\nSource: ${SITE}${p.path}\n`;
  for (const p of pages) {
    let html = fill(shell, 'seo:head', `\n${headFor(p, ctx)}`);
    html = fill(html, 'seo:nav', nav);
    html = fill(html, 'seo:view', viewFor(p, ctx));
    files.set(p.path === '/' ? 'index.html' : `${p.path.slice(1)}index.html`, html);
    if (p.md) files.set(`${p.path.slice(1).replace(/\/$/, '')}.md`, mdOf(p));
  }
  files.set('llms.txt', llmsTxt(pages, ctx));
  files.set('llms-full.txt', llmsFull(pages, mdOf, ctx));
  files.set('sitemap.xml', sitemap(pages, SITE));
  files.set('robots.txt', robots(SITE));
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = await buildSeo();
  for (const d of OWNED_DIRS) rmSync(join(WEB, d), { recursive: true, force: true });
  for (const [rel, content] of files) {
    mkdirSync(dirname(join(WEB, rel)), { recursive: true });
    writeFileSync(join(WEB, rel), content);
  }
  console.log(`seo: ${[...files.keys()].filter((f) => f.endsWith('.html')).length} pages, ${[...files.keys()].filter((f) => f.endsWith('.md')).length} markdown files, llms.txt, sitemap.xml, robots.txt`);
}
