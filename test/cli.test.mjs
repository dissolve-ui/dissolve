// CLI tests: spawn bin/dissolve.mjs against throwaway fixture projects.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cliSandbox, existsSync, read, registryIndex, REGISTRY_DIR, writeTree } from './helpers.mjs';

const ANSI = /\x1b\[[0-9;]*m/g;
const ALL_DEPS = {
  dependencies: Object.fromEntries(
    [
      'react-native-dissolve',
      '@shopify/react-native-skia',
      'react-native-reanimated',
      'react-native-worklets',
      'react-native-gesture-handler',
      'expo-haptics',
      'nativewind',
      'react-native-css',
      'tailwindcss',
      '@tailwindcss/postcss',
      'tailwind-merge',
    ].map((d) => [d, '*']),
  ),
  overrides: { lightningcss: '1.30.1' },
};

/** A project with NativeWind fully wired, so the setup check has nothing to report. */
const NATIVEWIND_SETUP = {
  'metro.config.js': "const { withNativewind } = require('nativewind/metro');\nmodule.exports = withNativewind({});\n",
  'postcss.config.mjs': "export default { plugins: { '@tailwindcss/postcss': {} } };\n",
  'global.css': '@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css";\n',
};

let sandbox;
let n = 0;
before(() => {
  sandbox = cliSandbox();
});
after(() => sandbox?.cleanup());

/** A fresh project folder inside the sandbox. */
function project(files = {}) {
  const dir = join(sandbox.dir, `app-${++n}`);
  mkdirSync(dir, { recursive: true });
  writeTree(dir, { 'package.json': ALL_DEPS, ...files });
  return dir;
}

function run(cwd, ...args) {
  const r = spawnSync(process.execPath, [sandbox.bin, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout + r.stderr).replace(ANSI, '') };
}

/** Index entries whose source file exists (new entries may still be in progress). */
const available = () => registryIndex().filter((c) => existsSync(join(REGISTRY_DIR, c.file)));

const exportName = (item) => (item.export ?? '').split(',')[0].trim();
const count = (text, needle) => text.split(needle).length - 1;

describe('help and list', () => {
  test('no command prints help', () => {
    const { code, out } = run(project());
    assert.equal(code, 0);
    assert.match(out, /init/);
    assert.match(out, /add <name\.\.\.>/);
    assert.match(out, /--overwrite/);
  });

  test('list prints every registry component', () => {
    const { code, out } = run(project(), 'list');
    assert.equal(code, 0);
    for (const item of registryIndex()) assert.ok(out.includes(item.name), `list is missing ${item.name}`);
  });

  test('ls is an alias of list', () => {
    assert.equal(run(project(), 'ls').out, run(project(), 'list').out);
  });
});

describe('init', () => {
  test('writes tw.tsx and appends the theme to global.css once', () => {
    const cwd = project({ 'global.css': '@import "tailwindcss";\n' });
    const theme = read(join(REGISTRY_DIR, 'theme.css'));
    const marker = '--dissolve-surface:';

    const first = run(cwd, 'init');
    assert.equal(first.code, 0);
    assert.match(first.out, /created\s+components\/dissolve\/tw\.tsx/);
    assert.match(first.out, /updated\s+global\.css/);
    assert.equal(read(join(cwd, 'components/dissolve/tw.tsx')), read(join(REGISTRY_DIR, 'tw.tsx')));

    const css = read(join(cwd, 'global.css'));
    assert.ok(css.startsWith('@import "tailwindcss";'), 'existing css is kept');
    assert.ok(css.includes(theme.trim()), 'theme appended verbatim');

    const second = run(cwd, 'init');
    assert.equal(second.code, 0);
    assert.match(second.out, /exists\s+components\/dissolve\/tw\.tsx/);
    assert.match(second.out, /exists\s+dissolve theme in global\.css/);
    assert.equal(read(join(cwd, 'global.css')), css, 'second init leaves global.css untouched');
    assert.equal(count(read(join(cwd, 'global.css')), marker), count(theme, marker));
  });

  test('finds a tailwind css entry outside the usual names', () => {
    const cwd = project({ 'styles/app.css': '@import "tailwindcss/theme.css";\n' });
    const { out } = run(cwd, 'init');
    assert.match(out, /updated\s+styles\/app\.css/);
    assert.ok(read(join(cwd, 'styles/app.css')).includes('--color-dissolve-surface'));
  });

  test('without a global.css writes dissolve.css next to the components', () => {
    const cwd = project();
    const { out } = run(cwd, 'init');
    assert.match(out, /no global\.css found/);
    assert.ok(read(join(cwd, 'components/dissolve/dissolve.css')).includes(read(join(REGISTRY_DIR, 'theme.css')).trim()));
  });

  test('reports missing peers and styling packages', () => {
    const cwd = project({ 'package.json': { dependencies: { react: '*' } }, 'global.css': '@import "tailwindcss";' });
    const { out } = run(cwd, 'init');
    assert.match(out, /Missing dependencies/);
    assert.match(out, /npx expo install react-native-dissolve @shopify\/react-native-skia/);
    assert.match(out, /NativeWind v5/);
    assert.match(out, /tailwind-merge/);
    assert.doesNotMatch(out, /Ready\./);
  });

  test('prints Ready when dependencies and NativeWind config are in place', () => {
    const { out } = run(project(NATIVEWIND_SETUP), 'init');
    assert.match(out, /Ready\./);
  });

  test('init --overwrite refreshes tw.tsx and keeps a single theme block', () => {
    const cwd = project(NATIVEWIND_SETUP);
    run(cwd, 'init');
    writeFileSync(join(cwd, 'components/dissolve/tw.tsx'), '// stale\n');
    run(cwd, 'init', '--overwrite');
    assert.equal(read(join(cwd, 'components/dissolve/tw.tsx')), read(join(REGISTRY_DIR, 'tw.tsx')));
    const marker = '--color-dissolve-surface:';
    assert.equal(count(read(join(cwd, 'global.css')), marker), count(read(join(REGISTRY_DIR, 'theme.css')), marker));
  });

  test('src/ layout is detected from tsconfig paths (JSONC)', () => {
    const cwd = project({
      'tsconfig.json': `{
        // Expo template, with comments and a trailing comma
        "extends": "expo/tsconfig.base",
        "compilerOptions": { /* aliases */ "paths": { "@/*": ["./src/*"], }, },
      }`,
      'src/global.css': '@import "tailwindcss";\n',
    });
    const { out } = run(cwd, 'init');
    assert.match(out, /updated\s+src\/global\.css/);
    assert.ok(existsSync(join(cwd, 'src/components/dissolve/tw.tsx')));
    assert.ok(!existsSync(join(cwd, 'components')));
  });

  test('an @/* alias without a src/ folder keeps components/dissolve', () => {
    const cwd = project({ 'tsconfig.json': { compilerOptions: { paths: { '@/*': ['./*'] } } } });
    run(cwd, 'init');
    assert.ok(existsSync(join(cwd, 'components/dissolve/tw.tsx')));
  });
});

describe('add', () => {
  test('copies the component, runs init first and prints the import path', () => {
    const items = available().slice(0, 2);
    assert.ok(items.length > 0, 'registry has at least one component');
    const cwd = project({ 'global.css': '@import "tailwindcss";' });
    const { code, out } = run(cwd, 'add', ...items.map((i) => i.name));
    assert.equal(code, 0);
    assert.ok(existsSync(join(cwd, 'components/dissolve/tw.tsx')), 'add bootstraps tw.tsx');
    for (const item of items) {
      const dest = join(cwd, 'components/dissolve', item.file);
      assert.equal(read(dest), read(join(REGISTRY_DIR, item.file)), `${item.file} copied verbatim`);
      assert.match(out, new RegExp(`added\\s+components/dissolve/${item.file.replace('.', '\\.')}`));
      const base = item.file.replace(/\.tsx?$/, '');
      assert.ok(out.includes(`from './components/dissolve/${base}'`), `import path printed for ${item.name}`);
      assert.ok(out.includes(`import { ${exportName(item)}`), `export name printed for ${item.name}`);
    }
  });

  test('prints alias import paths in a src/ layout', () => {
    const [item] = available();
    const cwd = project({ 'tsconfig.json': { compilerOptions: { paths: { '@/*': ['./src/*'] } } }, 'src/.keep': '' });
    const { out } = run(cwd, 'add', item.name);
    assert.ok(existsSync(join(cwd, 'src/components/dissolve', item.file)));
    assert.ok(out.includes(`from '@/components/dissolve/${item.file.replace(/\.tsx?$/, '')}'`), out);
  });

  test('registry files a component imports are copied with it', (t) => {
    const withDep = available().find((c) => /from\s+['"]\.\/(?!tw['"])[\w-]+['"]/.test(read(join(REGISTRY_DIR, c.file))));
    if (!withDep) return t.skip('no component imports another registry file');
    const dep = read(join(REGISTRY_DIR, withDep.file)).match(/from\s+['"]\.\/(?!tw['"])([\w-]+)['"]/)[1];
    const cwd = project();
    run(cwd, 'add', withDep.name);
    assert.ok(
      ['.tsx', '.ts'].some((ext) => existsSync(join(cwd, 'components/dissolve', dep + ext))),
      `${withDep.name} imports ./${dep}, which should be installed too`,
    );
  });

  test('unknown component is reported and nothing is written for it', () => {
    const [item] = available();
    const cwd = project();
    const { out } = run(cwd, 'add', 'definitely-not-a-component', item.name);
    assert.match(out, /unknown\s+definitely-not-a-component/);
    assert.ok(!existsSync(join(cwd, 'components/dissolve/definitely-not-a-component.tsx')));
    assert.ok(existsSync(join(cwd, 'components/dissolve', item.file)), 'valid names in the same call still install');
  });

  test('add without names prints usage and the list', () => {
    const { out } = run(project(), 'add');
    assert.match(out, /Usage: npx react-native-dissolve add/);
    assert.ok(out.includes(registryIndex()[0].name));
  });

  test('existing files are skipped unless --overwrite', () => {
    const [item] = available();
    const cwd = project();
    run(cwd, 'add', item.name);
    const dest = join(cwd, 'components/dissolve', item.file);
    writeFileSync(dest, '// local edits\n');

    const skipped = run(cwd, 'add', item.name);
    assert.match(skipped.out, /skipped\s+components\/dissolve/);
    assert.match(skipped.out, /use --overwrite/);
    assert.equal(read(dest), '// local edits\n');

    const forced = run(cwd, 'add', item.name, '--overwrite');
    assert.match(forced.out, /(added|replaced)\s+components\/dissolve/);
    assert.equal(read(dest), read(join(REGISTRY_DIR, item.file)));
  });

  test('--path installs into a custom folder', () => {
    const [item] = available();
    const cwd = project();
    const { out } = run(cwd, 'add', item.name, '--path', 'ui/fx');
    assert.ok(existsSync(join(cwd, 'ui/fx/tw.tsx')));
    assert.ok(existsSync(join(cwd, 'ui/fx', item.file)));
    assert.ok(!existsSync(join(cwd, 'components')));
    assert.ok(out.includes(`from './ui/fx/${item.file.replace(/\.tsx?$/, '')}'`));
  });

  test('--cwd targets another project', () => {
    const [item] = available();
    const cwd = project();
    run(sandbox.dir, 'add', item.name, '--cwd', cwd);
    assert.ok(existsSync(join(cwd, 'components/dissolve', item.file)));
  });
});
