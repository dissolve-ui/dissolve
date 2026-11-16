import { mkdtempSync, mkdirSync, rmSync, symlinkSync, copyFileSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTRY_DIR = join(ROOT, 'registry');
export const PKG_DIR = join(ROOT, 'packages', 'react-native-dissolve');

export const read = (file) => readFileSync(file, 'utf8');
export const readJSON = (file) => JSON.parse(read(file));

/** Registry index entries, read fresh so new components are always picked up. */
export const registryIndex = () => readJSON(join(REGISTRY_DIR, 'index.json')).components;

/** Every component source file in registry/ (tw.tsx is the shared primitives, not a component). */
export const registryFiles = () =>
  readdirSync(REGISTRY_DIR)
    .filter((f) => /\.tsx?$/.test(f) && f !== 'tw.tsx')
    .sort();

export function tempDir(prefix = 'dissolve-test-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function writeTree(base, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = join(base, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
}

/** Recursively lists files under dir, skipping node_modules and dot folders. */
export function walk(dir, filter = () => true) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

/**
 * A throwaway copy of the CLI laid out like the published package: bin/dissolve.mjs next to a
 * registry/ that links to the repo registry, so tests run without building the package.
 */
export function cliSandbox() {
  const { dir, cleanup } = tempDir('dissolve-cli-');
  const pkg = join(dir, 'pkg');
  mkdirSync(join(pkg, 'bin'), { recursive: true });
  copyFileSync(join(PKG_DIR, 'bin', 'dissolve.mjs'), join(pkg, 'bin', 'dissolve.mjs'));
  symlinkSync(REGISTRY_DIR, join(pkg, 'registry'), 'dir');
  return { dir, bin: join(pkg, 'bin', 'dissolve.mjs'), cleanup };
}

export { copyFileSync, existsSync, mkdirSync, readdirSync, symlinkSync };
