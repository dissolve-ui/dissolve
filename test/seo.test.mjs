// Crawlable site: one static page per URL (scripts/build-seo.mjs), with its own head and JSON-LD,
// markdown twins, llms.txt, sitemap.xml and robots.txt, all current with the site data.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { read, registryIndex, ROOT, existsSync } from './helpers.mjs';

const WEB = join(ROOT, 'web');
const SITE = 'https://dissolve.rselmi.com';
const seo = await import(pathToFileURL(join(ROOT, 'scripts', 'build-seo.mjs')).href);
const routes = await import(pathToFileURL(join(WEB, 'routes.js')).href);
const data = await import(pathToFileURL(join(WEB, 'data.js')).href);

/** web/ file served at a site path: /a/b/ is a/b/index.html. */
const fileOf = (path) => join(WEB, decodeURI(path.split(/[?#]/)[0]).replace(/^\//, '').replace(/(^|\/)$/, '$1index.html'));
const filesUnder = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? filesUnder(join(dir, f)) : [join(dir, f)]));
const ldOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

let files;
before(async () => { files = await seo.buildSeo(); });

describe('generated files', () => {
  test('web/ holds the current build, run npm run web:stamp after editing the site', () => {
    for (const [rel, content] of files) assert.equal(read(join(WEB, rel)), content, `web/${rel} is stale`);
    for (const d of seo.OWNED_DIRS) {
      for (const f of filesUnder(join(WEB, d))) {
        const rel = relative(WEB, f).split(sep).join('/');
        assert.ok(files.has(rel), `web/${rel} is left over from an older build`);
      }
    }
  });

  test('a page for every component, effect and docs page', () => {
    const ids = [...registryIndex().map((c) => c.name), ...data.ORDER, ...data.GETTING_STARTED.map((p) => p.id), 'gallery', 'components', 'effects'];
    for (const id of ids) {
      const path = routes.pathOf(id);
      const html = files.get(relative(WEB, fileOf(path)).split(sep).join('/'));
      assert.ok(html, `${id}: ${path} is generated`);
      assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}${path}" />`), `${id}: canonical`);
      assert.match(html, /<title>[^<]{10,70}<\/title>/, `${id}: title`);
      assert.match(html, /<meta name="description" content="[^"]{50,}" \/>/, `${id}: description`);
      assert.match(html, /<meta property="og:image" content="https:\/\/dissolve\.rselmi\.com\/og\.png" \/>/, `${id}: og:image`);
      assert.match(html, /<article data-prerender[^>]*>[\s\S]*<h1>/, `${id}: static content with a heading`);
      assert.match(html, /<script type="module" src="\/app\.js\?v=/, `${id}: still loads the app`);
      const graph = ldOf(html)['@graph'];
      assert.ok(graph.some((n) => n['@type'] === 'SoftwareSourceCode'), `${id}: library in JSON-LD`);
      if (id !== 'gallery') assert.ok(graph.some((n) => n['@type'] === 'BreadcrumbList'), `${id}: breadcrumbs`);
    }
  });

  test('the title in the HTML is the one the app sets', () => {
    for (const [rel, html] of files) {
      if (!rel.endsWith('.html')) continue;
      const path = '/' + rel.replace(/index\.html$/, '');
      const id = routes.idOf(path);
      const comp = registryIndex().find((c) => c.name === id);
      const title = routes.titleOf(id, comp && { title: 'x', web: existsSync(join(ROOT, 'registry', 'web', `${id}.tsx`)) });
      assert.ok(html.includes(`<title>${seo.esc(title)}</title>`), `${rel}: ${title}`);
    }
  });

  test('every link of the static pages leads to a page or a file of the site', () => {
    for (const [rel, html] of files) {
      if (!rel.endsWith('.html')) continue;
      for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
        assert.ok(existsSync(fileOf(href)) || files.has(relative(WEB, fileOf(href)).split(sep).join('/')), `${rel} links to ${href}`);
      }
    }
  });

  test('sitemap.xml lists every page, robots.txt welcomes AI crawlers', () => {
    const pages = [...files.keys()].filter((f) => f.endsWith('index.html')).map((f) => `${SITE}/${f.replace(/index\.html$/, '')}`);
    const locs = [...files.get('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual([...locs].sort(), [...pages].sort());
    const robots = files.get('robots.txt');
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) assert.match(robots, new RegExp(`User-agent: ${bot}\\n`));
    assert.doesNotMatch(robots, /Disallow: \//);
    assert.match(robots, /Sitemap: https:\/\/dissolve\.rselmi\.com\/sitemap\.xml/);
  });

  test('llms.txt links every component with its install command and markdown twin', () => {
    const llms = files.get('llms.txt');
    assert.match(llms, /^# dissolve\n\n> /);
    for (const { name } of registryIndex()) {
      assert.ok(llms.includes(`(${SITE}/components/${name}/)`), `${name} linked`);
      assert.ok(llms.includes(`npx dissolve-ui add ${name}`), `${name} install command`);
      assert.ok(files.has(`components/${name}.md`), `${name}.md`);
    }
    const full = files.get('llms-full.txt');
    for (const { name } of registryIndex()) assert.ok(full.includes(`Source: ${SITE}/components/${name}/`), `${name} in llms-full.txt`);
  });

  test('no em dash in the generated text', () => {
    for (const [rel, content] of files) assert.doesNotMatch(content, /—|&mdash;/, rel);
  });
});

describe('routes', () => {
  test('every page id has a path that maps back to it', () => {
    const ids = [...registryIndex().map((c) => c.name), ...data.ORDER, ...data.GETTING_STARTED.map((p) => p.id), 'gallery', 'components', 'effects'];
    for (const id of ids) assert.equal(routes.idOf(routes.pathOf(id)), id, id);
  });

  test('paths with or without the trailing slash, files are not pages', () => {
    assert.equal(routes.idOf('/components/toggle'), 'toggle');
    assert.equal(routes.idOf('/effects/dust/index.html'), 'dust');
    assert.equal(routes.idOf('/docs/'), 'introduction');
    assert.equal(routes.idOf('/effects/nope/'), null);
    assert.equal(routes.idOf('/r/toggle.json'), null);
    assert.equal(routes.idOf('/skills/dissolve/SKILL.md'), null);
    assert.equal(routes.idOf('/components/nope/', () => false), null);
  });
});

describe('htmlToMd', () => {
  test('headings, paragraphs, inline code, links made absolute', () => {
    assert.equal(seo.htmlToMd('<h2>Props</h2><p>Use <code>a &lt; b</code>, see <a href="/docs/cli/">CLI</a>.</p>', SITE),
      '## Props\n\nUse `a < b`, see [CLI](https://dissolve.rselmi.com/docs/cli/).\n');
  });

  test('code blocks keep their language and title', () => {
    const md = seo.htmlToMd('<figure class="code"><figcaption>app.tsx</figcaption><pre><code class="language-tsx">&lt;View /&gt;\n</code></pre></figure>');
    assert.equal(md, 'app.tsx:\n\n```tsx\n<View />\n```\n');
  });

  test('tables escape pipes, lists stay tight and numbered', () => {
    const md = seo.htmlToMd('<table><tr><th>A</th></tr><tr><td><code>\'sm\' | \'md\'</code></td></tr></table><ol><li>one</li><li>two</li></ol><ul><li>x</li><li>y</li></ul>');
    assert.equal(md, "| A |\n| --- |\n| `'sm' \\| 'md'` |\n\n1. one\n2. two\n- x\n- y\n");
  });
});
