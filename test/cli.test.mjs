// CLI tests: spawn bin/dissolve.mjs against throwaway fixture projects.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cliSandbox, existsSync, offlineEnv, read, registryIndex, REGISTRY_DIR, writeTree } from './helpers.mjs';

const ANSI = /\x1b\[[0-9;]*m/g;
const ALL_DEPS = {
  dependencies: Object.fromEntries(
    [
      'dissolve-ui',
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
  const r = spawnSync(process.execPath, [sandbox.bin, ...args], { cwd, encoding: 'utf8', env: offlineEnv(join(sandbox.dir, 'home')) });
  return { code: r.status, out: (r.stdout + r.stderr).replace(ANSI, '') };
}

/** Index entries whose source file exists (new entries may still be in progress). */
const available = () => registryIndex().filter((c) => existsSync(join(REGISTRY_DIR, c.file)));

const WEB_DIR = join(REGISTRY_DIR, 'web');
/** Components with a React web version: registry/web/<name>.tsx. */
const webAvailable = () => registryIndex().filter((c) => existsSync(join(WEB_DIR, `${c.name}.tsx`)));

const WEB_APP = { dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', next: '*' } };
const config = (cwd) => JSON.parse(read(join(cwd, 'dissolve.json')));

/** registry/web files a web component imports as './x', recursively. */
function webDeps(file, seen = new Set()) {
  for (const m of read(join(WEB_DIR, file)).matchAll(/from\s+['"]\.\/([\w.-]+)['"]/g)) {
    const dep = ['.tsx', '.ts'].map((ext) => m[1] + ext).find((f) => existsSync(join(WEB_DIR, f)));
    if (dep && !seen.has(dep)) { seen.add(dep); webDeps(dep, seen); }
  }
  return seen;
}

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
    assert.match(out, /npx expo install dissolve-ui @shopify\/react-native-skia/);
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
    assert.match(out, /Usage: npx dissolve-ui add/);
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

describe('platforms', () => {
  test('a react-dom / next project is detected as web', () => {
    const cwd = project({ 'package.json': WEB_APP });
    const { code, out } = run(cwd, 'init');
    assert.equal(code, 0);
    assert.deepEqual(config(cwd), { platform: 'web', dir: 'components/dissolve' });
    assert.match(out, /created\s+dissolve\.json \(React \(web\)/);
    assert.ok(!existsSync(join(cwd, 'components/dissolve/tw.tsx')), 'no NativeWind primitives on the web');
    assert.match(out, /Ready\. Add a component: npx dissolve-ui add/);
  });

  test('an expo / react-native project is detected as native', () => {
    const cwd = project({ 'package.json': { dependencies: { expo: '*', 'react-native': '*', react: '*' } } });
    run(cwd, 'init');
    assert.equal(config(cwd).platform, 'native');
    assert.ok(existsSync(join(cwd, 'components/dissolve/tw.tsx')));
  });

  test('a project with both falls back to native, --web picks the web', () => {
    const both = { dependencies: { 'react-native': '*', 'react-dom': '*', react: '^19.0.0' } };
    const asked = project({ 'package.json': both });
    run(asked, 'init', '--yes');
    assert.equal(config(asked).platform, 'native');

    const cwd = project({ 'package.json': both });
    run(cwd, 'init', '--web');
    assert.equal(config(cwd).platform, 'web');
    assert.ok(!existsSync(join(cwd, 'components/dissolve/tw.tsx')));
  });

  test('a second init keeps the platform of dissolve.json', () => {
    const cwd = project({ 'package.json': WEB_APP });
    run(cwd, 'init', '--native');
    const { out } = run(cwd, 'init');
    assert.equal(config(cwd).platform, 'native');
    assert.match(out, /exists\s+dissolve\.json/);
  });

  test('web theme without Tailwind is plain CSS variables', () => {
    const cwd = project({ 'package.json': WEB_APP, 'app/globals.css': 'body { margin: 0; }\n' });
    const { out } = run(cwd, 'init');
    assert.match(out, /updated\s+app\/globals\.css/);
    const css = read(join(cwd, 'app/globals.css'));
    assert.ok(css.includes('--dissolve-surface:'));
    assert.ok(!css.includes('@theme'), 'the @theme block is Tailwind only');
  });

  test('web theme with Tailwind keeps the @theme mapping', () => {
    const cwd = project({ 'package.json': WEB_APP, 'app/globals.css': '@import "tailwindcss";\n' });
    run(cwd, 'init');
    assert.ok(read(join(cwd, 'app/globals.css')).includes('--color-dissolve-surface'));
  });

  test('add on the web copies registry/web files and their ./ imports', () => {
    const items = webAvailable();
    assert.ok(items.length > 0, 'at least one component has a web version');
    const cwd = project({ 'package.json': WEB_APP });
    const { code, out } = run(cwd, 'add', ...items.map((i) => i.name));
    assert.equal(code, 0);
    assert.equal(config(cwd).platform, 'web', 'add runs init first');
    for (const item of items) {
      const file = `${item.name}.tsx`;
      assert.equal(read(join(cwd, 'components/dissolve', file)), read(join(WEB_DIR, file)), `${file} copied verbatim`);
      assert.ok(out.includes(`import { ${item.export ?? exportName(item)} } from './components/dissolve/${item.name}'`), `import printed for ${item.name}`);
      const deps = webDeps(file);
      assert.ok(deps.size > 0, `${file} imports its core`);
      for (const dep of deps) assert.equal(read(join(cwd, 'components/dissolve', dep)), read(join(WEB_DIR, dep)), `${dep} (used by ${item.name}) installed`);
    }
    assert.ok(!existsSync(join(cwd, 'components/dissolve/tw.tsx')));
    assert.doesNotMatch(out, /npx expo install/);
    assert.doesNotMatch(out, /DissolveProvider/);
  });

  test('a web project with src/ and no alias installs into src/components/dissolve', () => {
    const [item] = webAvailable();
    const cwd = project({ 'package.json': { dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '*' } }, 'src/main.tsx': '' });
    const { code, out } = run(cwd, 'add', item.name);
    assert.equal(code, 0);
    assert.equal(config(cwd).dir, 'src/components/dissolve');
    assert.ok(existsSync(join(cwd, 'src/components/dissolve', `${item.name}.tsx`)));
    assert.ok(out.includes(`from './components/dissolve/${item.name}'`), 'import printed from src/');
  });

  test('add on the web skips components without a web version', (t) => {
    const nativeOnly = available().find((c) => !existsSync(join(WEB_DIR, `${c.name}.tsx`)));
    if (!nativeOnly) return t.skip('every component has a web version');
    const cwd = project({ 'package.json': WEB_APP });
    const { out } = run(cwd, 'add', nativeOnly.name);
    assert.match(out, new RegExp(`skipped\\s+${nativeOnly.name} is React Native only`));
    assert.ok(!existsSync(join(cwd, 'components/dissolve', nativeOnly.file)));
  });

  test('add follows the folder saved in dissolve.json', () => {
    const [item] = webAvailable();
    const cwd = project({ 'package.json': WEB_APP, 'dissolve.json': { platform: 'web', dir: 'ui/fx' } });
    run(cwd, 'add', item.name);
    assert.ok(existsSync(join(cwd, 'ui/fx', `${item.name}.tsx`)));
    assert.ok(!existsSync(join(cwd, 'components')));
  });

  // The site shows `add <name> --native` or `add <name> --web` from its platform switch: the flag wins
  // over the detected platform, with or without a dissolve.json.
  test('add --web in a React Native project installs the web version', () => {
    const [item] = webAvailable();
    const cwd = project({ 'package.json': { dependencies: { expo: '*', 'react-native': '*' } } });
    const { code } = run(cwd, 'add', item.name, '--web');
    assert.equal(code, 0);
    assert.equal(config(cwd).platform, 'web');
    assert.equal(read(join(cwd, 'components/dissolve', `${item.name}.tsx`)), read(join(WEB_DIR, `${item.name}.tsx`)));
    assert.ok(!existsSync(join(cwd, 'components/dissolve/tw.tsx')));
  });

  test('add --native in a web project installs the React Native version', () => {
    const [item] = webAvailable();
    const cwd = project({ 'package.json': WEB_APP });
    const { code } = run(cwd, 'add', item.name, '--native');
    assert.equal(code, 0);
    assert.equal(config(cwd).platform, 'native');
    assert.equal(read(join(cwd, 'components/dissolve', item.file)), read(join(REGISTRY_DIR, item.file)));
    assert.ok(existsSync(join(cwd, 'components/dissolve/tw.tsx')));
  });

  test('a platform flag on add switches the platform saved in dissolve.json', () => {
    const [item] = webAvailable();
    const cwd = project({ 'package.json': WEB_APP });
    run(cwd, 'init', '--native');
    run(cwd, 'add', item.name, '--web');
    assert.equal(config(cwd).platform, 'web');
    assert.equal(read(join(cwd, 'components/dissolve', `${item.name}.tsx`)), read(join(WEB_DIR, `${item.name}.tsx`)));
  });

  test('list shows the platforms of each component', () => {
    const { out } = run(project(), 'list');
    for (const item of registryIndex()) {
      const line = out.split('\n').find((l) => l.trim().startsWith(item.name + ' '));
      assert.ok(line, `list is missing ${item.name}`);
      const web = existsSync(join(WEB_DIR, `${item.name}.tsx`));
      assert.equal(line.includes('native, web'), web, `${item.name}: ${line}`);
    }
  });
});
