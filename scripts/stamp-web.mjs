// Cache busting for the static site: stamps every CSS link and every JS module of web/ with a
// short hash of its content, in web/index.html only. Stylesheets get ?v=hash, modules go through
// an import map, so the sources keep plain relative imports and an unchanged file stays cached.
// Run after editing the site: node scripts/stamp-web.mjs (npm run web:stamp).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const WEB = join(import.meta.dirname, '..', 'web');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const index = join(WEB, 'index.html');
let html = readFileSync(index, 'utf8');

// Stylesheets: href="x.css" or href="x.css?v=old" -> href="x.css?v=hash".
html = html.replace(/href="([^"?:]+\.css)(\?v=[^"]*)?"/g, (_, href) => `href="${href}?v=${hash(join(WEB, href))}"`);

// Modules: an import map from each module URL to its stamped URL, and the entry script stamped too.
const imports = {};
for (const file of walk(WEB).sort()) {
  const url = '/' + relative(WEB, file).split(sep).join('/');
  imports[url] = `${url}?v=${hash(file)}`;
}
const map = `<script type="importmap" data-stamp>${JSON.stringify({ imports }, null, 2)}</script>`;
html = html.replace(/<script type="importmap" data-stamp>[\s\S]*?<\/script>\n?\s*/, '');
html = html.replace(/(\s*)<script type="module" src="[^"]*"><\/script>/, `$1${map}$1<script type="module" src="${imports['/app.js']}"></script>`);

writeFileSync(index, html);
console.log(`stamped ${Object.keys(imports).length} modules and the stylesheets`);
