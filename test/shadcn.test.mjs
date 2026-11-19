// The shadcn registry served by the site (web/r): one item per component and platform, generated
// from registry/ by scripts/build-shadcn.mjs. Checks it is current, complete and self consistent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { read, readJSON, registryIndex, REGISTRY_DIR, ROOT, tempDir } from './helpers.mjs';

const R = join(ROOT, 'web', 'r');
const BASE = 'https://dissolve.rselmi.com/r/';
const item = (path) => readJSON(join(R, `${path}.json`));
const allItems = () => [
  ...readdirSync(R).filter((f) => f.endsWith('.json') && f !== 'registry.json').map((f) => f.slice(0, -5)),
  ...readdirSync(join(R, 'native')).filter((f) => f.endsWith('.json') && f !== 'registry.json').map((f) => `native/${f.slice(0, -5)}`),
];

test('web/r is the current build of registry/', (t) => {
  const tmp = tempDir('dissolve-shadcn-');
  t.after(() => tmp.cleanup());
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-shadcn.mjs')], { encoding: 'utf8', env: { ...process.env, DISSOLVE_REGISTRY_URL: '', DISSOLVE_REGISTRY_OUT: tmp.dir } });
  assert.equal(r.status, 0, r.stderr);
  const fresh = [
    ...readdirSync(tmp.dir).filter((f) => f.endsWith('.json')),
    ...readdirSync(join(tmp.dir, 'native')).map((f) => `native/${f}`),
  ];
  assert.deepEqual(fresh.sort(), [...allItems().map((p) => `${p}.json`), 'registry.json', 'native/registry.json'].sort(), 'same items');
  for (const f of fresh) assert.equal(read(join(R, f)), read(join(tmp.dir, f)), `web/r/${f} is stale, run npm run web:stamp`);
});

test('every component has a React Native item, and a React item when it runs on the web', () => {
  for (const c of registryIndex()) {
    assert.ok(existsSync(join(R, 'native', `${c.name}.json`)), `native/${c.name}`);
    if (existsSync(join(REGISTRY_DIR, 'web', `${c.name}.tsx`))) assert.ok(existsSync(join(R, `${c.name}.json`)), c.name);
  }
});

test('items ship the registry files verbatim into components/dissolve', () => {
  for (const p of allItems()) {
    for (const f of item(p).files ?? []) {
      assert.equal(f.content, read(join(ROOT, f.path)), `${p}: ${f.path}`);
      assert.match(f.target, /^components\/dissolve\/[\w.-]+$/, `${p}: ${f.target}`);
    }
  }
});

test('registryDependencies point at items that exist, on the production URL', () => {
  for (const p of allItems()) {
    for (const dep of item(p).registryDependencies ?? []) {
      assert.ok(dep.startsWith(BASE), `${p}: ${dep}`);
      assert.ok(existsSync(join(R, dep.slice(BASE.length))), `${p}: ${dep} has no file`);
    }
  }
});

test('every ./ import of an installed file is installed too (by the item or a dependency)', () => {
  const closure = (p, seen = new Set()) => {
    if (seen.has(p)) return seen;
    seen.add(p);
    for (const dep of item(p).registryDependencies ?? []) closure(dep.slice(BASE.length, -5), seen);
    return seen;
  };
  for (const p of allItems()) {
    const files = new Set([...closure(p)].flatMap((q) => (item(q).files ?? []).map((f) => f.target.split('/').pop())));
    for (const f of item(p).files ?? []) {
      for (const m of f.content.matchAll(/from\s+['"]\.\/([\w.-]+)['"]/g)) {
        assert.ok([`${m[1]}.ts`, `${m[1]}.tsx`].some((x) => files.has(x)), `${p}: ${f.target} imports ./${m[1]}`);
      }
    }
  }
});

test('native items install the engine package', () => {
  for (const c of registryIndex()) assert.ok(item(`native/${c.name}`).dependencies.includes('dissolve-ui'), c.name);
});
