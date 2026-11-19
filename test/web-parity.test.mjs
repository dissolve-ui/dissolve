// React web components: one implementation, one doc. Every component the site runs from web/lib has
// its React wrapper and core in registry/web, the wrapper's props cover the documented props (the
// prop(...) lists of the web/cp entries, shared with React Native), and web/lib is the current build.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { existsSync, read, registryIndex, REGISTRY_DIR, ROOT, tempDir, walk } from './helpers.mjs';

const WEB_DIR = join(REGISTRY_DIR, 'web');
const CP_DIR = join(ROOT, 'web', 'cp');
const LIB_DIR = join(ROOT, 'web', 'lib');
/** Shared modules of registry/web, not components. */
const SHARED = new Set(['engine', 'kit', 'react']);

const pascal = (name) => name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const cpFiles = () => readdirSync(CP_DIR).filter((f) => f.endsWith('.js'));

/** Components a site port runs from web/lib: import ... from '../lib/<name>.js'. */
function converted() {
  const out = new Map();
  for (const f of cpFiles()) {
    for (const m of read(join(CP_DIR, f)).matchAll(/from\s+['"]\.\.\/lib\/([\w-]+)\.js['"]/g)) {
      if (!SHARED.has(m[1])) out.set(m[1], f);
    }
  }
  return out;
}

/** Components with a React wrapper: registry/web/<name>.tsx. */
const wrappers = () => readdirSync(WEB_DIR).filter((f) => f.endsWith('.tsx')).map((f) => f.slice(0, -4));

/** The `'<name>': { ... }` (or `<name>: { ... }`) entry of a web/cp file, brace balanced. */
function entryOf(src, name) {
  const at = src.search(new RegExp(`\\n\\s*'?${name}'?:\\s*\\{`));
  if (at === -1) return null;
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

/**
 * Documented props of a component ('width / height' is two props, '&lt;ToastProvider top&gt;' is
 * top) and the ones marked native only.
 */
function documented(name) {
  for (const f of cpFiles()) {
    const entry = entryOf(read(join(CP_DIR, f)), name);
    if (!entry) continue;
    const props = [...entry.matchAll(/\bprop\(\s*'([^']+)'/g)].flatMap((m) => m[1].replace(/^&lt;\w+\s+(.+)&gt;$/, '$1').split('/').map((s) => s.trim().replace(/^ref\..*/, 'ref'))); // ref.run documents the ref handle
    const nativeOnly = [...(entry.match(/nativeOnly:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    return { props, nativeOnly: new Set(nativeOnly), file: f };
  }
  return null;
}

/** Keys declared in the `export type ...Props = ...` (or ...Options) object types of a source file. */
function propKeys(src) {
  const keys = new Set();
  for (const m of src.matchAll(/export\s+type\s+\w*(?:Props|Options)(?:<[^=]*>)?\s*=/g)) {
    let i = src.indexOf('{', m.index), depth = 0;
    const end = src.indexOf(';\n', m.index);
    if (i === -1 || (end !== -1 && i > end)) continue;
    let line = '';
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      if (ch === '}' && --depth === 0) break;
      if (ch === '\n') {
        const k = depth === 1 && line.match(/^\s*([A-Za-z_$][\w$]*)\??\s*:/);
        if (k) keys.add(k[1]);
        line = '';
      } else line += ch;
    }
  }
  return keys;
}

describe('web components', () => {
  test('every component the site runs from web/lib has a wrapper and a core', () => {
    const problems = [];
    for (const [name, port] of converted()) {
      for (const f of [`${name}.tsx`, `${name}.core.ts`]) if (!existsSync(join(WEB_DIR, f))) problems.push(`web/cp/${port} uses lib/${name}.js, registry/web/${f} is missing`);
      if (!existsSync(join(LIB_DIR, `${name}.js`))) problems.push(`web/lib/${name}.js is missing, run npm run web:build`);
    }
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  test('every wrapper is a registry component, and the site runs its core (one implementation)', () => {
    const index = new Set(registryIndex().map((c) => c.name));
    const used = converted();
    const problems = [];
    for (const name of wrappers()) {
      if (!index.has(name)) problems.push(`registry/web/${name}.tsx has no registry/index.json entry`);
      if (!used.has(name)) problems.push(`no web/cp port imports ../lib/${name}.js: the site must run the same core`);
    }
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  test('wrappers follow the pattern: use client, the shared hook, the named export, the core', () => {
    const problems = [];
    for (const name of wrappers()) {
      const src = read(join(WEB_DIR, `${name}.tsx`));
      const exp = registryIndex().find((c) => c.name === name)?.export.split(',')[0].trim() ?? pascal(name);
      if (!src.startsWith("'use client';")) problems.push(`${name}.tsx: first line must be 'use client';`);
      if (!/from\s+'\.\/react'/.test(src)) problems.push(`${name}.tsx: build on useDissolveCore from './react'`);
      if (!new RegExp(`from\\s+'\\./${name}\\.core'`).test(src)) problems.push(`${name}.tsx: import the core from './${name}.core'`);
      if (!new RegExp(`export\\s+function\\s+${exp}\\b`).test(src)) problems.push(`${name}.tsx: export function ${exp}`);
      if (!new RegExp(`export\\s+type\\s+${exp}Props\\b`).test(src)) problems.push(`${name}.tsx: export type ${exp}Props`);
      const core = existsSync(join(WEB_DIR, `${name}.core.ts`)) ? read(join(WEB_DIR, `${name}.core.ts`)) : '';
      if (!new RegExp(`export\\s+function\\s+create${pascal(name)}\\b`).test(core)) problems.push(`${name}.core.ts: export function create${pascal(name)}`);
    }
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  test('wrapper props cover every documented prop, except the native only ones', () => {
    const problems = [];
    for (const name of wrappers()) {
      const doc = documented(name);
      if (!doc) { problems.push(`${name}: no entry with props in web/cp`); continue; }
      const core = existsSync(join(WEB_DIR, `${name}.core.ts`)) ? read(join(WEB_DIR, `${name}.core.ts`)) : '';
      const wrapper = read(join(WEB_DIR, `${name}.tsx`));
      const keys = new Set([...propKeys(wrapper), ...propKeys(core)]);
      // A capitalized entry documents a companion component (PullItem, SkeletonBlock): the wrapper exports it.
      const companion = (p) => /^[A-Z]/.test(p) && new RegExp(`export\\s+function\\s+${p}\\b`).test(wrapper);
      for (const p of doc.props) if (!doc.nativeOnly.has(p) && !keys.has(p) && !companion(p)) problems.push(`${name}: documented prop '${p}' (web/cp/${doc.file}) is not in ${pascal(name)}Props`);
    }
    assert.deepEqual(problems, [], `${problems.join('\n')}\nAdd the prop, or list it in the entry's nativeOnly: ['...'] when it cannot exist on the web.`);
  });

  test('cores and wrappers only import react, react-dom and ./ files of registry/web', () => {
    const problems = [];
    for (const f of readdirSync(WEB_DIR)) {
      for (const m of read(join(WEB_DIR, f)).matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (spec === 'react' || spec === 'react-dom' || spec.startsWith('react-dom/')) {
          if (f.endsWith('.core.ts') || ['engine.ts', 'kit.ts'].includes(f)) problems.push(`${f}: cores are framework free, '${spec}' belongs in the wrapper`);
          continue;
        }
        const local = spec.startsWith('./') && ['.ts', '.tsx'].some((ext) => existsSync(join(WEB_DIR, spec.slice(2) + ext)));
        if (!local) problems.push(`${f} imports '${spec}'`);
      }
    }
    assert.deepEqual(problems, [], problems.join('\n'));
  });
});

describe('web/lib', () => {
  let tmp;
  let built;
  before(() => {
    tmp = tempDir('dissolve-web-lib-');
    built = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-web.mjs'), '--out', tmp.dir], { encoding: 'utf8' });
  });
  after(() => tmp?.cleanup());

  test('is the current build of registry/web (run npm run web:stamp)', () => {
    assert.equal(built.status, 0, built.stderr);
    const list = (dir) => walk(dir).map((f) => relative(dir, f)).sort();
    assert.deepEqual(list(LIB_DIR), list(tmp.dir), 'web/lib files differ from a fresh build');
    for (const f of list(tmp.dir)) assert.equal(read(join(LIB_DIR, f)), read(join(tmp.dir, f)), `web/lib/${f} is stale`);
  });
});
