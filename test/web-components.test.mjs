// React web components in registry/web: every wrapper is a registry component, follows the wrapper
// pattern (the shared hook, its core, the named exports) and imports only React and its own files.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { existsSync, read, registryIndex, REGISTRY_DIR } from './helpers.mjs';

const WEB_DIR = join(REGISTRY_DIR, 'web');

const pascal = (name) => name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');

/** Components with a React wrapper: registry/web/<name>.tsx. */
const wrappers = () => readdirSync(WEB_DIR).filter((f) => f.endsWith('.tsx')).map((f) => f.slice(0, -4));

describe('web components', () => {
  test('every wrapper is a registry component', () => {
    const index = new Set(registryIndex().map((c) => c.name));
    const problems = wrappers().filter((name) => !index.has(name)).map((name) => `registry/web/${name}.tsx has no registry/index.json entry`);
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
