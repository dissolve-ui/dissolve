// Builds the shadcn registry served by the site, so any shadcn project can install a component with
// its own CLI:
//   npx shadcn add https://dissolve.rselmi.com/r/scratch-card.json          React (web)
//   npx shadcn add https://dissolve.rselmi.com/r/native/scratch-card.json   React Native
// Items are generated from registry/ (the same files `npx dissolve-ui add` copies) into web/r.
// Shared files (engine, kit, the React hook, tw primitives, helpers) are their own items, pulled in
// through registryDependencies, so two components never fight over the same file.
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REG = join(ROOT, 'registry');
const WEB = join(REG, 'web');
/** Output folder; DISSOLVE_REGISTRY_OUT builds elsewhere (the test compares a fresh build with web/r). */
const OUT = process.env.DISSOLVE_REGISTRY_OUT || join(ROOT, 'web', 'r');
/** Where the items are served. DISSOLVE_REGISTRY_URL overrides it to test against a local server. */
const BASE_URL = (process.env.DISSOLVE_REGISTRY_URL || 'https://dissolve.rselmi.com/r').replace(/\/$/, '');
const SCHEMA_ITEM = 'https://ui.shadcn.com/schema/registry-item.json';
const SCHEMA_REG = 'https://ui.shadcn.com/schema/registry.json';
const TARGET = 'components/dissolve';
const HOMEPAGE = 'https://dissolve.rselmi.com';

const index = JSON.parse(readFileSync(join(REG, 'index.json'), 'utf8'));
const read = (f) => readFileSync(f, 'utf8');
const stem = (f) => f.replace(/\.(tsx|ts)$/, '');
/** `./x` imports of a source file, as file names that exist next to it. */
function localImports(dir, file) {
  const out = [];
  for (const m of read(join(dir, file)).matchAll(/from\s+['"]\.\/([\w.-]+)['"]/g)) {
    const hit = [`${m[1]}.tsx`, `${m[1]}.ts`].find((f) => existsSync(join(dir, f)));
    if (hit) out.push(hit);
  }
  return out;
}
/** Bare package imports (not relative, not react / react-native themselves). */
function packages(dir, file) {
  const out = new Set();
  for (const m of read(join(dir, file)).matchAll(/(?:from|import)\s+['"]([^./'"][^'"]*)['"]/g)) {
    const name = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
    if (!['react', 'react-dom', 'react-native'].includes(name)) out.add(name);
  }
  return out;
}

/** The theme tokens of registry/theme.css as shadcn cssVars (light on :root, dark on .dark). */
function themeVars() {
  const css = read(join(REG, 'theme.css'));
  const block = (re) => Object.fromEntries([...(css.match(re)?.[1] ?? '').matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = block(/^:root\s*\{([^}]*)\}/m);
  const dark = block(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
  const theme = Object.fromEntries(Object.keys(light).map((k) => [`color-${k}`, `var(--${k})`]));
  return { theme, light, dark };
}

const file = (dir, f, type) => ({ path: `registry/${dir === WEB ? 'web/' : ''}${f}`, content: read(join(dir, f)), type, target: `${TARGET}/${f}` });
const url = (path) => `${BASE_URL}/${path}.json`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'native'), { recursive: true });
const write = (path, json) => writeFileSync(join(OUT, `${path}.json`), JSON.stringify(json, null, 2) + '\n');
const items = { web: [], native: [] };

/* ---------- React (web) ---------- */
const webShared = new Set(['engine.ts', 'kit.ts', 'react.ts', 'gl.ts']);
const sharedItem = (f, desc) => {
  const name = `dissolve-${stem(f)}`;
  const deps = localImports(WEB, f).filter((x) => webShared.has(x)).map((x) => url(`dissolve-${stem(x)}`));
  const item = { $schema: SCHEMA_ITEM, name, type: 'registry:lib', title: name, description: desc, ...(deps.length && { registryDependencies: deps }), files: [file(WEB, f, 'registry:lib')] };
  write(name, item);
  items.web.push({ name, type: item.type, title: name, description: desc });
};
sharedItem('kit.ts', 'Shared helpers of the dissolve web components: easing, springs, DOM and canvas helpers.');
sharedItem('engine.ts', 'The dissolve grain engine for the web (Canvas 2D).');
sharedItem('react.ts', 'The hook that mounts a dissolve core in React.');
if (existsSync(join(WEB, 'gl.ts'))) sharedItem('gl.ts', 'WebGL2 helper for the dissolve shaders.');

const theme = themeVars();
write('dissolve-theme', {
  $schema: SCHEMA_ITEM,
  name: 'dissolve-theme',
  type: 'registry:theme',
  title: 'dissolve theme',
  description: 'The --dissolve-* tokens every component reads, light and dark. Optional: components fall back to the same values.',
  cssVars: theme,
});
items.web.push({ name: 'dissolve-theme', type: 'registry:theme', title: 'dissolve theme', description: 'The --dissolve-* tokens, light and dark.' });

for (const c of index.components) {
  const wrapper = `${c.name}.tsx`;
  if (!existsSync(join(WEB, wrapper))) continue;
  // The wrapper and its own core; shared files and other components' cores come as dependencies.
  const own = [wrapper];
  const deps = new Set([url('dissolve-theme')]);
  const walk = (f) => {
    for (const d of localImports(WEB, f)) {
      if (webShared.has(d)) deps.add(url(`dissolve-${stem(d)}`));
      else if (d === `${c.name}.core.ts`) { if (!own.includes(d)) { own.push(d); walk(d); } }
      else deps.add(url(stem(d).replace(/\.core$/, '')));
    }
  };
  walk(wrapper);
  const npm = new Set();
  own.forEach((f) => packages(WEB, f).forEach((p) => npm.add(p)));
  const item = {
    $schema: SCHEMA_ITEM,
    name: c.name,
    type: 'registry:component',
    title: c.export,
    description: c.description,
    docs: `${HOMEPAGE}/components/${c.name}/`,
    ...(npm.size && { dependencies: [...npm] }),
    registryDependencies: [...deps],
    files: own.map((f) => file(WEB, f, 'registry:component')),
  };
  write(c.name, item);
  items.web.push({ name: c.name, type: item.type, title: c.export, description: c.description });
}

/* ---------- React Native ---------- */
const NATIVE_PEERS = ['dissolve-ui', '@shopify/react-native-skia', 'react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler', 'expo-haptics'];
const nativeHelpers = new Set(['tw.tsx', ...(index.helpers ?? []).map((h) => h.file ?? `${h.name}.ts`)]);
const nativeShared = (f, desc) => {
  const name = `dissolve-${stem(f)}`;
  const npm = [...packages(REG, f)];
  const deps = localImports(REG, f).filter((x) => nativeHelpers.has(x)).map((x) => url(`native/dissolve-${stem(x)}`));
  write(`native/${name}`, { $schema: SCHEMA_ITEM, name, type: 'registry:lib', title: name, description: desc, ...(npm.length && { dependencies: npm }), ...(deps.length && { registryDependencies: deps }), files: [file(REG, f, 'registry:lib')] });
  items.native.push({ name: `native/${name}`, type: 'registry:lib', title: name, description: desc });
};
nativeShared('tw.tsx', 'NativeWind primitives (Animated, Pressable, Text, View, cn) the dissolve components are styled with.');
for (const f of nativeHelpers) if (f !== 'tw.tsx' && existsSync(join(REG, f))) nativeShared(f, `Shared helper ${stem(f)} of the dissolve components.`);

for (const c of index.components) {
  const deps = new Set([url('dissolve-theme')]);
  for (const d of localImports(REG, c.file)) deps.add(url(nativeHelpers.has(d) ? `native/dissolve-${stem(d)}` : `native/${stem(d)}`));
  const npm = new Set(NATIVE_PEERS);
  packages(REG, c.file).forEach((p) => npm.add(p));
  const item = {
    $schema: SCHEMA_ITEM,
    name: c.name,
    type: 'registry:component',
    title: c.export,
    description: c.description,
    docs: `${HOMEPAGE}/components/${c.name}/. Wrap the app once in <DissolveProvider> from dissolve-ui, see ${HOMEPAGE}/docs/installation/.`,
    dependencies: [...npm],
    ...(deps.size && { registryDependencies: [...deps] }),
    files: [file(REG, c.file, 'registry:component')],
  };
  write(`native/${c.name}`, item);
  items.native.push({ name: `native/${c.name}`, type: item.type, title: c.export, description: c.description });
}

/* ---------- Indexes ---------- */
const registry = (name, list) => ({ $schema: SCHEMA_REG, name, homepage: HOMEPAGE, items: list });
write('registry', registry('dissolve', items.web));
write('native/registry', registry('dissolve-native', items.native));
console.log(`shadcn registry: ${items.web.length} web items, ${items.native.length} native items in ${OUT === join(ROOT, 'web', 'r') ? 'web/r' : OUT}`);
