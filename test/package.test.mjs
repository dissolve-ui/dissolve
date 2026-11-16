// Package build: runs scripts/build-package.sh in a temp copy of the repo (the real
// packages/ folder is never touched), then checks what `npm pack` would publish.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { PKG_DIR, read, readJSON, registryIndex, ROOT, tempDir } from './helpers.mjs';

let tmp;
let files = [];
let built;

before(() => {
  tmp = tempDir('dissolve-pack-');
  const root = tmp.dir;
  const pkg = join(root, 'packages', 'react-native-dissolve');
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
