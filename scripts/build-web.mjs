// Builds the framework free cores of the web components (registry/web/*.core.ts) into web/lib,
// one ES module per component plus the engine and the kit, shared code split into chunks so the
// site runs one engine. The site imports them as plain modules: web/lib is committed and the
// static site needs no build on the server. Run after editing registry/web: npm run web:build
// (npm run web:stamp builds first, then stamps the site for cache busting).
// --out <dir> builds elsewhere (the tests compare it with web/lib).
import { build } from 'esbuild';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'registry', 'web');
const at = process.argv.indexOf('--out');
const OUT = at > 0 ? resolve(process.argv[at + 1]) : join(ROOT, 'web', 'lib');

const entryPoints = { engine: join(SRC, 'engine.ts'), kit: join(SRC, 'kit.ts') };
for (const file of readdirSync(SRC).sort()) {
  const m = file.match(/^(.+)\.core\.ts$/);
  if (m) entryPoints[m[1]] = join(SRC, file);
}

rmSync(OUT, { recursive: true, force: true });
await build({
  entryPoints,
  outdir: OUT,
  bundle: true,
  splitting: true,
  format: 'esm',
  target: 'es2022',
  chunkNames: 'chunks/[name]-[hash]',
  banner: { js: '// Built from registry/web by scripts/build-web.mjs, do not edit.' },
  legalComments: 'none',
  logLevel: 'warning',
  absWorkingDir: ROOT,
});

// The components installable on the web (a registry/web/<name>.tsx wrapper), for the platform
// switch of the component pages.
const web = readdirSync(SRC).filter((f) => f.endsWith('.tsx')).map((f) => f.slice(0, -4)).sort();
writeFileSync(join(OUT, 'available.js'), `// Built from registry/web by scripts/build-web.mjs, do not edit.\nexport const WEB_COMPONENTS = ${JSON.stringify(web)};\n`);
console.log(`built ${Object.keys(entryPoints).length} modules into ${OUT}`);
