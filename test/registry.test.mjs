// Registry consistency: index.json, files, imports, exports, colors and copy rules.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join, relative } from 'node:path';
import { existsSync, read, readJSON, registryFiles, registryIndex, REGISTRY_DIR, ROOT, walk } from './helpers.mjs';

/**
 * Shared helper files (index.json "helpers"): not components, never listed by the CLI, copied by
 * `add` with the components that import them.
 */
const registryHelpers = () => readJSON(join(REGISTRY_DIR, 'index.json')).helpers ?? [];

/** './name' imports of a registry file, resolved to registry file names. */
const localImports = (file) =>
  importsOf(read(join(REGISTRY_DIR, file)))
    .filter((spec) => spec.startsWith('./') && spec !== './tw')
    .map((spec) => ['.tsx', '.ts'].map((ext) => spec.slice(2) + ext).find((f) => existsSync(join(REGISTRY_DIR, f))))
    .filter(Boolean);

/** Packages a registry component may import (subpaths included). */
const ALLOWED_PACKAGES = [
  'react',
  'react-native',
  'dissolve-ui',
  '@shopify/react-native-skia',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
  'expo-haptics',
  'expo-symbols',
  'expo-image',
  'expo-glass-effect',
  'expo-blur',
  'expo-clipboard',
  'expo-linear-gradient',
];

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** Module specifiers from import/export ... from, side effect imports, dynamic import and require. */
function importsOf(src) {
  const code = stripComments(src);
  const specs = new Set();
  for (const re of [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s+['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    for (const m of code.matchAll(re)) specs.add(m[1]);
  }
  return [...specs];
}

function isAllowedImport(spec) {
  if (spec === './tw') return true;
  if (spec.startsWith('./')) {
    const name = spec.slice(2);
    return !name.includes('/') && ['.tsx', '.ts'].some((ext) => existsSync(join(REGISTRY_DIR, name + ext)));
  }
  return ALLOWED_PACKAGES.some((p) => spec === p || spec.startsWith(p + '/'));
}

/** Names exported by a module: declarations and export lists (aliases resolved). */
function exportsOf(src) {
  const code = stripComments(src);
  const names = new Set();
  for (const m of code.matchAll(/\bexport\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const declaredExports = (entry) =>
  String(entry.export ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

describe('registry/index.json', () => {
  const index = registryIndex();

  test('has well formed, unique entries', () => {
    assert.ok(Array.isArray(index) && index.length > 0, 'components is a non empty array');
    const names = new Set();
    const files = new Set();
    for (const entry of index) {
      for (const key of ['name', 'file', 'export', 'description']) {
        assert.equal(typeof entry[key], 'string', `${entry.name ?? JSON.stringify(entry)}: "${key}" must be a string`);
        assert.ok(entry[key].trim(), `${entry.name}: "${key}" must not be empty`);
      }
      assert.match(entry.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${entry.name}: name must be kebab-case`);
      assert.match(entry.file, /^[\w-]+\.tsx?$/, `${entry.name}: file must be a .ts/.tsx file at the registry root`);
      assert.notEqual(entry.file, 'tw.tsx', 'tw.tsx is installed by init, not listed as a component');
      assert.ok(!names.has(entry.name), `duplicate name ${entry.name}`);
      assert.ok(!files.has(entry.file), `duplicate file ${entry.file}`);
      names.add(entry.name);
      files.add(entry.file);
    }
  });

  test('every entry points to an existing file', () => {
    const missing = index.filter((e) => !existsSync(join(REGISTRY_DIR, e.file))).map((e) => `${e.name} -> registry/${e.file}`);
    assert.deepEqual(missing, [], `index.json entries without a file:\n  ${missing.join('\n  ')}`);
  });

  test('every registry file is listed in index.json, as a component or a helper', () => {
    const listed = new Set([...index.map((e) => e.file), ...registryHelpers().map((h) => h.file)]);
    const unlisted = registryFiles().filter((f) => !listed.has(f));
    assert.deepEqual(
      unlisted,
      [],
      `registry files missing from registry/index.json (add a component entry with name, file, export, description, or a helpers entry with file, description):\n  ${unlisted.join('\n  ')}`,
    );
  });

  test('helpers are well formed, exist, export something and are not components', () => {
    const helpers = registryHelpers();
    assert.ok(Array.isArray(helpers), '"helpers" is an array');
    const components = new Set(index.map((e) => e.file));
    const seen = new Set();
    for (const h of helpers) {
      for (const key of ['file', 'description']) {
        assert.equal(typeof h[key], 'string', `${h.file ?? JSON.stringify(h)}: "${key}" must be a string`);
        assert.ok(h[key].trim(), `${h.file}: "${key}" must not be empty`);
      }
      assert.match(h.file, /^[\w-]+\.tsx?$/, `${h.file}: file must be a .ts/.tsx file at the registry root`);
      assert.notEqual(h.file, 'tw.tsx', 'tw.tsx is installed by init, not a helper');
      assert.ok(!components.has(h.file), `${h.file} is both a component and a helper`);
      assert.ok(!seen.has(h.file), `duplicate helper ${h.file}`);
      seen.add(h.file);
      assert.ok(existsSync(join(REGISTRY_DIR, h.file)), `helper registry/${h.file} does not exist`);
      assert.ok(exportsOf(read(join(REGISTRY_DIR, h.file))).size > 0, `${h.file} exports nothing`);
    }
  });

  test('every helper is imported by a component, and imports no component', () => {
    const helpers = new Set(registryHelpers().map((h) => h.file));
    const used = new Set();
    const visit = (file) => {
      for (const dep of localImports(file)) {
        if (!helpers.has(dep) || used.has(dep)) continue;
        used.add(dep);
        visit(dep);
      }
    };
    for (const entry of index) if (existsSync(join(REGISTRY_DIR, entry.file))) visit(entry.file);
    const orphans = [...helpers].filter((f) => !used.has(f));
    assert.deepEqual(orphans, [], `helpers no component imports (remove them or their index.json entry):\n  ${orphans.join('\n  ')}`);
    const problems = [];
    for (const f of helpers) for (const dep of localImports(f)) if (!helpers.has(dep)) problems.push(`${f} imports ./${dep}`);
    assert.deepEqual(problems, [], `helpers may only import packages and other helpers:\n  ${problems.join('\n  ')}`);
  });

  test('declared export names exist in each file', () => {
    const problems = [];
    for (const entry of index) {
      const file = join(REGISTRY_DIR, entry.file);
      if (!existsSync(file)) continue; // reported by the existence test
      const exported = exportsOf(read(file));
      for (const name of declaredExports(entry)) if (!exported.has(name)) problems.push(`${entry.file} does not export ${name}`);
    }
    assert.deepEqual(problems, [], problems.join('\n'));
  });
});

describe('registry sources', () => {
  const files = [...registryFiles(), 'tw.tsx'];

  test('components only import allowed packages', () => {
    const problems = [];
    for (const f of registryFiles()) {
      for (const spec of importsOf(read(join(REGISTRY_DIR, f)))) {
        if (!isAllowedImport(spec)) problems.push(`${f} imports '${spec}'`);
      }
    }
    assert.deepEqual(
      problems,
      [],
      `imports outside the allowlist (${ALLOWED_PACKAGES.join(', ')}, ./tw, ./<registry file>):\n  ${problems.join('\n  ')}`,
    );
  });

  test('tw.tsx only depends on the styling stack', () => {
    const allowed = ['react', 'react-native', 'react-native-reanimated', 'react-native-css', 'tailwind-merge'];
    const extra = importsOf(read(join(REGISTRY_DIR, 'tw.tsx'))).filter((s) => !allowed.includes(s));
    assert.deepEqual(extra, []);
  });

  test('no hardcoded hex colors in class names', () => {
    const problems = [];
    for (const f of files) {
      read(join(REGISTRY_DIR, f))
        .split('\n')
        .forEach((line, i) => {
          // Tailwind arbitrary values (bg-[#fff]) or a hex inside a className / cn() string.
          const arbitrary = /-\[#[0-9a-fA-F]{3,8}\]/.test(line);
          const inClass = /(className\s*=\s*\{?\s*|\bcn\()\s*['"`][^'"`]*#[0-9a-fA-F]{3,8}\b/.test(line);
          if (arbitrary || inClass) problems.push(`${f}:${i + 1}: ${line.trim()}`);
        });
    }
    assert.deepEqual(problems, [], `use theme tokens (bg-dissolve-*, text-dissolve-*) instead of hex:\n  ${problems.join('\n  ')}`);
  });

  test('every dissolve token class and useToken() name exists in theme.css', () => {
    const theme = read(join(REGISTRY_DIR, 'theme.css'));
    const tokens = new Set([...theme.matchAll(/--color-dissolve-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const problems = [];
    const classRe = /(?<![\w-])(?:bg|text|border(?:-[trblxyse])?|ring|fill|stroke|outline|divide|placeholder|from|via|to|decoration|caret|accent|shadow)-dissolve-([a-z0-9-]+)/g;
    for (const f of files) {
      const src = read(join(REGISTRY_DIR, f));
      for (const m of src.matchAll(classRe)) if (!tokens.has(m[1])) problems.push(`${f}: ${m[0]}`);
      for (const m of src.matchAll(/useToken\(\s*['"]([^'"]+)['"]/g)) if (!tokens.has(m[1])) problems.push(`${f}: useToken('${m[1]}')`);
    }
    assert.deepEqual([...new Set(problems)], [], `unknown theme tokens:\n  ${problems.join('\n  ')}`);
  });
});

describe('copy rules', () => {
  test('no em dash in registry, engine and docs copy', () => {
    const textFile = (p) => /\.(tsx?|mjs|js|css|html|md|json|ya?ml)$/.test(p);
    const targets = [
      ...walk(REGISTRY_DIR, textFile),
      ...walk(join(ROOT, 'src', 'dissolve'), textFile),
      ...walk(join(ROOT, 'docs'), textFile),
      ...walk(join(ROOT, 'mcp'), textFile),
      ...walk(join(ROOT, 'plugins'), textFile),
      ...walk(join(ROOT, '.github'), textFile),
      ...['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'SECURITY.md'].map((f) => join(ROOT, f)).filter(existsSync),
    ];
    const problems = [];
    for (const file of targets) {
      read(file)
        .split('\n')
        .forEach((line, i) => {
          if (line.includes('\u2014') || line.includes('&mdash;')) problems.push(`${relative(ROOT, file)}:${i + 1}`);
        });
    }
    assert.deepEqual(problems, [], `em dash found, use a comma, colon or parentheses:\n  ${problems.join('\n  ')}`);
  });
});
