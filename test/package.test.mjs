// dissolve-ui, the one npm package (React Native engine, CLI, registry): runs scripts/build-package.sh
// in a temp copy of the repo (the real packages/ folder is never touched), then checks what
// `npm pack` would publish and that the packed CLI runs under its own name.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { PKG_DIR, read, readJSON, registryIndex, REGISTRY_DIR, ROOT, tempDir } from './helpers.mjs';

let tmp;
let files = [];
let built;

before(() => {
  tmp = tempDir('dissolve-pack-');
  const root = tmp.dir;
  const pkg = join(root, 'packages', 'dissolve-ui');
  mkdirSync(pkg, { recursive: true });
  for (const p of ['scripts', 'registry', 'LICENSE', 'README.md']) cpSync(join(ROOT, p), join(root, p), { recursive: true });
  cpSync(join(ROOT, 'src', 'dissolve'), join(root, 'src', 'dissolve'), { recursive: true });
  for (const p of ['package.json', 'tsconfig.build.json', 'bin']) cpSync(join(PKG_DIR, p), join(pkg, p), { recursive: true });
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');

  built = spawnSync('sh', [join(root, 'scripts', 'build-package.sh')], { cwd: root, encoding: 'utf8' });
  if (built.status !== 0) return;
  const pack = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: pkg, encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr);
  files = JSON.parse(pack.stdout)[0].files.map((f) => f.path);
  built.pkg = pkg;
});
after(() => tmp?.cleanup());

test('build-package.sh succeeds', () => {
  assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
  assert.match(built.stdout, /d\.ts refs rewritten/);
  assert.ok(!files.some((f) => f.endsWith('.bak')), 'no sed backup files left');
});

test('the tarball ships lib, bin, registry, README and LICENSE', () => {
  for (const required of ['lib/index.js', 'lib/index.d.ts', 'bin/dissolve.mjs', 'registry/index.json', 'registry/theme.css', 'registry/tw.tsx', 'README.md', 'LICENSE', 'package.json']) {
    assert.ok(files.includes(required), `${required} missing from the tarball`);
  }
});

test('every registry component is in the tarball', () => {
  for (const entry of registryIndex()) assert.ok(files.includes(`registry/${entry.file}`), `registry/${entry.file}`);
});

test('the package is engine only: no app UI components', () => {
  const leaked = files.filter((f) => /^(src|lib)\/components\//.test(f) || f.startsWith('app/') || f.startsWith('src/demos/'));
  assert.deepEqual(leaked, []);
});

test('package.json bin and entry points resolve inside the tarball', () => {
  const pkg = readJSON(join(PKG_DIR, 'package.json'));
  for (const bin of Object.values(pkg.bin)) assert.ok(files.includes(bin.replace(/^\.\//, '')), bin);
  for (const key of ['main', 'types']) assert.ok(files.includes(pkg[key]), `${key}: ${pkg[key]}`);
  assert.equal(pkg.license, 'MIT');
});

test('the CLI is executable with a node shebang', () => {
  assert.match(read(join(PKG_DIR, 'bin', 'dissolve.mjs')), /^#!\/usr\/bin\/env node/);
});

test('the package README points imports at the npm name', () => {
  const readme = read(join(built.pkg, 'README.md'));
  assert.ok(!readme.includes("from '@/dissolve'"), 'README still imports @/dissolve');
  const relative = [...readme.matchAll(/\]\(((?!https?:|#|mailto:)[^)]+)\)/g)].map((m) => m[1]);
  assert.deepEqual(relative, [], 'relative links break on npmjs.com, make them absolute in build-package.sh');
});

test('every web component and the shared web files are in the tarball', () => {
  const web = readdirSync(join(REGISTRY_DIR, 'web'));
  assert.ok(web.length > 0);
  for (const f of web) assert.ok(files.includes(`registry/web/${f}`), `registry/web/${f}`);
});

test('package.json is dissolve-ui, with a dissolve-ui bin', () => {
  const pkg = readJSON(join(PKG_DIR, 'package.json'));
  assert.equal(pkg.name, 'dissolve-ui');
  assert.deepEqual(Object.keys(pkg.bin), ['dissolve-ui']);
});

test('peers are optional, so npx dissolve-ui in a web app does not pull React Native', () => {
  const pkg = readJSON(join(PKG_DIR, 'package.json'));
  const peers = Object.keys(pkg.peerDependencies);
  assert.ok(peers.includes('@shopify/react-native-skia'));
  for (const p of peers) assert.equal(pkg.peerDependenciesMeta?.[p]?.optional, true, `${p} optional`);
});

test('the packed CLI speaks as dissolve-ui', () => {
  const r = spawnSync(process.execPath, [join(built.pkg, 'bin', 'dissolve.mjs'), 'help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /npx dissolve-ui add/);
});

test('nothing in the repo still points at the old package name', () => {
  const old = 'react-native' + '-dissolve';
  const hits = spawnSync('git', ['grep', '--untracked', '-l', old, '--', '.', ':!CHANGELOG.md', ':!web/lib'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  assert.equal(hits, '', `still mentions ${old}: ${hits}`);
});
