#!/usr/bin/env node
/**
 * dissolve CLI, shadcn style: copies component source into your project so you own it.
 *
 *   npx react-native-dissolve init                 tw primitives + theme tokens + setup check
 *   npx react-native-dissolve add slide-to-confirm one or more components
 *   npx react-native-dissolve list                 available components
 *
 * Options: --path <dir> (default components/dissolve, or src/components/dissolve with a src/
 * layout), --overwrite, --cwd <dir>.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY = resolve(HERE, '..', 'registry');
const PKG = 'react-native-dissolve';

const PEERS = ['@shopify/react-native-skia', 'react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler', 'expo-haptics'];
const STYLING = ['nativewind', 'react-native-css', 'tailwindcss', '@tailwindcss/postcss', 'tailwind-merge'];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function parseArgs(argv) {
  const out = { _: [], overwrite: false, path: null, cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--overwrite' || a === '-o') out.overwrite = true;
    else if (a === '--path' || a === '-p') out.path = argv[++i];
    else if (a === '--cwd') out.cwd = resolve(argv[++i]);
    else if (a === '--help' || a === '-h') out._.unshift('help');
    else out._.push(a);
  }
  return out;
}

const registry = () => JSON.parse(readFileSync(join(REGISTRY, 'index.json'), 'utf8')).components;

/** JSON with comments and trailing commas (tsconfig). String aware: "@/*" is not a comment. */
function readJSONC(file) {
  try {
    const src = readFileSync(file, 'utf8');
    let out = '';
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"') {
        let j = i + 1;
        while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
        out += src.slice(i, j + 1);
        i = j;
      } else if (ch === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        out += '\n';
      } else if (ch === '/' && src[i + 1] === '*') {
        i = src.indexOf('*/', i + 2);
        if (i === -1) break;
        i++;
      } else out += ch;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    return null;
  }
}

/** components/dissolve, or src/components/dissolve when the project maps @/* to ./src/*. */
function targetDir(cwd, override) {
  if (override) return resolve(cwd, override);
  const ts = readJSONC(join(cwd, 'tsconfig.json'));
  const alias = ts?.compilerOptions?.paths?.['@/*']?.[0];
  if (alias && /^\.?\/?src\//.test(alias) && existsSync(join(cwd, 'src'))) return join(cwd, 'src', 'components', 'dissolve');
  return join(cwd, 'components', 'dissolve');
}

function importPath(cwd, dir) {
  const ts = readJSONC(join(cwd, 'tsconfig.json'));
  const alias = ts?.compilerOptions?.paths?.['@/*']?.[0];
  const rel = relative(cwd, dir).split('\\').join('/');
  if (alias) {
    const base = alias.replace(/^\.\//, '').replace(/\*$/, '');
    if (rel.startsWith(base)) return '@/' + rel.slice(base.length);
  }
  return './' + rel;
}

function deps(cwd) {
  const pkg = readJSONC(join(cwd, 'package.json')) ?? {};
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

const TAILWIND_IMPORT = /@import\s+["']tailwindcss/;

/** The Tailwind css entry: a css importing tailwindcss first, then the usual global.css spots. */
function findGlobalCss(cwd) {
  const candidates = ['global.css', 'src/global.css', 'app/global.css', 'src/app/global.css', 'styles/global.css'];
  const hasTailwind = (f) => TAILWIND_IMPORT.test(readFileSync(f, 'utf8'));
  for (const f of candidates) if (existsSync(join(cwd, f)) && hasTailwind(join(cwd, f))) return join(cwd, f);
  // Any css importing tailwind, three levels deep, outside node_modules.
  const scan = (dir, depth) => {
    if (depth > 3) return null;
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'ios' || name === 'android' || name.startsWith('.')) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        const hit = scan(p, depth + 1);
        if (hit) return hit;
      } else if (name.endsWith('.css') && hasTailwind(p)) return p;
    }
    return null;
  };
  const hit = scan(cwd, 0);
  if (hit) return hit;
  for (const f of candidates) if (existsSync(join(cwd, f))) return join(cwd, f);
  return null;
}

function writeFile(file, content, overwrite) {
  if (existsSync(file) && !overwrite) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return true;
}

const NATIVEWIND_VERSIONS = 'nativewind@5.0.0-preview.4 react-native-css@3.0.7 tailwindcss@^4 @tailwindcss/postcss tailwind-merge';

/** Prints what is missing, with the commands to fix it. Returns true when everything is in place. */
function checkSetup(cwd) {
  const d = deps(cwd);
  const missingPeers = [PKG, ...PEERS].filter((p) => !d[p]);
  const missingStyling = STYLING.filter((p) => !d[p]);
  const issues = [];
  if (missingPeers.length) {
    console.log(c.yellow('\nMissing dependencies, install them with:'));
    console.log(`  npx expo install ${missingPeers.join(' ')}`);
  }
  if (missingStyling.length) {
    console.log(c.yellow('\nNativeWind v5 is not set up. The dissolve components are styled with NativeWind v5 (Tailwind v4).'));
    console.log(c.dim(`  missing: ${missingStyling.join(', ')}`));
    console.log('  1. npm pkg set overrides.lightningcss=1.30.1');
    console.log(`  2. npm install --legacy-peer-deps ${NATIVEWIND_VERSIONS}`);
    console.log('  3. then run this command again, it checks metro, postcss and global.css');
  } else {
    const read = (f) => (existsSync(join(cwd, f)) ? readFileSync(join(cwd, f), 'utf8') : null);
    const metro = ['metro.config.js', 'metro.config.cjs', 'metro.config.ts'].map(read).find(Boolean);
    if (!metro || !/withNativewind|withNativeWind/.test(metro)) {
      issues.push(`metro.config.js must wrap the config with withNativewind:
     const { getDefaultConfig } = require('expo/metro-config');
     const { withNativewind } = require('nativewind/metro');
     module.exports = withNativewind(getDefaultConfig(__dirname), { inlineVariables: false, globalClassNamePolyfill: false });`);
    }
    const postcss = ['postcss.config.mjs', 'postcss.config.js', 'postcss.config.cjs', '.postcssrc.json', '.postcssrc'].map(read).find(Boolean);
    if (!postcss || !postcss.includes('@tailwindcss/postcss')) {
      issues.push(`postcss.config.mjs:
     export default { plugins: { '@tailwindcss/postcss': {} } };`);
    }
    const css = findGlobalCss(cwd);
    if (!css || !TAILWIND_IMPORT.test(readFileSync(css, 'utf8'))) {
      issues.push(`${css ? relative(cwd, css) : 'global.css'} must import Tailwind (and be imported once from your root layout):
     @import "tailwindcss/theme.css" layer(theme);
     @import "tailwindcss/preflight.css" layer(base);
     @import "tailwindcss/utilities.css";`);
    }
    if (!readJSONC(join(cwd, 'package.json'))?.overrides?.lightningcss) {
      issues.push('package.json "overrides": { "lightningcss": "1.30.1" } (then npm install), newer lightningcss breaks react-native-css');
    }
    if (issues.length) {
      console.log(c.yellow('\nNativeWind setup incomplete:'));
      issues.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    }
  }
  return !missingPeers.length && !missingStyling.length && !issues.length;
}

const THEME_START = '/* dissolve:theme:start */';
const THEME_END = '/* dissolve:theme:end */';

function init(opts, { quiet = false } = {}) {
  const dir = targetDir(opts.cwd, opts.path);
  const tw = join(dir, 'tw.tsx');
  const twExisted = existsSync(tw);
  if (writeFile(tw, readFileSync(join(REGISTRY, 'tw.tsx'), 'utf8'), opts.overwrite)) console.log(c.green(twExisted ? 'replaced ' : 'created ') + relative(opts.cwd, tw));
  else console.log(c.dim('exists  ') + relative(opts.cwd, tw));

  const theme = `${THEME_START}\n${readFileSync(join(REGISTRY, 'theme.css'), 'utf8').trim()}\n${THEME_END}\n`;
  const css = findGlobalCss(opts.cwd);
  if (css) {
    const text = readFileSync(css, 'utf8');
    const start = text.indexOf(THEME_START);
    const end = text.indexOf(THEME_END);
    if (start !== -1 && end > start) {
      if (opts.overwrite) {
        writeFileSync(css, text.slice(0, start) + theme + text.slice(end + THEME_END.length).replace(/^\n/, ''));
        console.log(c.green('updated ') + `${relative(opts.cwd, css)} (dissolve theme tokens replaced)`);
      } else console.log(c.dim('exists  ') + `dissolve theme in ${relative(opts.cwd, css)}`);
    } else if (text.includes('--dissolve-surface')) {
      console.log(c.dim('exists  ') + `dissolve theme in ${relative(opts.cwd, css)}` + c.dim('  (edit it by hand, no markers to replace)'));
    } else {
      writeFileSync(css, text.replace(/\s*$/, '\n\n') + theme);
      console.log(c.green('updated ') + `${relative(opts.cwd, css)} (dissolve theme tokens)`);
    }
  } else {
    const out = join(dir, 'dissolve.css');
    writeFile(out, theme, opts.overwrite);
    console.log(c.yellow('note    ') + `no global.css found, wrote ${relative(opts.cwd, out)}: import it from your Tailwind css entry.`);
  }
  const ok = checkSetup(opts.cwd);
  if (ok && !quiet) console.log(c.green('\nReady. Add a component: npx react-native-dissolve add slide-to-confirm'));
  return dir;
}

/** Registry files a component imports as './<name>' (besides tw), recursively. */
function localDeps(file, seen = new Set()) {
  const src = readFileSync(join(REGISTRY, file), 'utf8');
  for (const m of src.matchAll(/from\s+['"]\.\/([\w-]+)['"]/g)) {
    if (m[1] === 'tw') continue;
    const dep = ['.tsx', '.ts'].map((ext) => m[1] + ext).find((f) => existsSync(join(REGISTRY, f)));
    if (!dep || seen.has(dep)) continue;
    seen.add(dep);
    localDeps(dep, seen);
  }
  return seen;
}

function add(opts) {
  const names = opts._.slice(1);
  const all = registry();
  if (!names.length) {
    console.log('Usage: npx react-native-dissolve add <component> [...more]\n');
    return list();
  }
  const dir = targetDir(opts.cwd, opts.path);
  if (!existsSync(join(dir, 'tw.tsx'))) init({ ...opts, overwrite: false }, { quiet: true });
  else if (!checkSetup(opts.cwd)) console.log('');
  const from = importPath(opts.cwd, dir);
  const requested = [];
  for (const name of names) {
    const item = all.find((x) => x.name === name || x.file === name);
    if (!item) console.log(c.red('unknown ') + `${name}. Run npx react-native-dissolve list`);
    else requested.push(item);
  }
  const done = new Set();
  const copy = (file, note) => {
    if (done.has(file)) return null;
    done.add(file);
    const out = join(dir, file);
    const existed = existsSync(out);
    const wrote = writeFile(out, readFileSync(join(REGISTRY, file), 'utf8'), opts.overwrite);
    console.log((wrote ? c.green(existed ? 'replaced ' : 'added   ') : c.yellow('skipped ')) + relative(opts.cwd, out) + (note ? c.dim(`  (${note})`) : '') + (wrote ? '' : c.dim('  (exists, use --overwrite)')));
    return wrote;
  };
  for (const item of requested) {
    const wrote = copy(item.file);
    if (wrote) {
      const exp = item.export ?? item.name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
      console.log(c.dim(`        import { ${exp} } from '${from}/${item.file.replace(/\.tsx?$/, '')}';`));
    }
    for (const dep of localDeps(item.file)) copy(dep, `used by ${item.name}`);
  }
  const src = (f) => readFileSync(join(REGISTRY, f), 'utf8');
  // Packages the copied files import that the project does not have yet (e.g. expo-glass-effect).
  const have = deps(opts.cwd);
  const external = new Set();
  for (const f of done) for (const m of src(f).matchAll(/from\s+['"]([^'".][^'"]*)['"]/g)) {
    const spec = m[1];
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!['react', 'react-native'].includes(pkg)) external.add(pkg);
  }
  const missing = [...external].filter((p) => !have[p]);
  if (missing.length) {
    console.log(c.yellow('\nThese components need packages your app does not have yet:'));
    console.log(`  npx expo install ${missing.join(' ')}`);
  }
  if ([...done].some((f) => /from\s+['"]react-native-dissolve['"]/.test(src(f)))) {
    console.log(c.dim(`\nThese use the dissolve engine: wrap your root layout once, inside GestureHandlerRootView:
        import { DissolveProvider } from 'react-native-dissolve';
        <GestureHandlerRootView style={{ flex: 1 }}><DissolveProvider>{children}</DissolveProvider></GestureHandlerRootView>`));
  }
}

function list() {
  console.log(c.bold('dissolve components\n'));
  for (const item of registry()) console.log(`  ${item.name.padEnd(20)} ${c.dim(item.description)}`);
  console.log(c.dim('\nnpx react-native-dissolve add <name>'));
}

function help() {
  console.log(`${c.bold('dissolve')}  components you own, for React Native

  npx ${PKG} init                set up tw primitives and theme tokens
  npx ${PKG} add <name...>       copy components into your project
  npx ${PKG} list                list components

  --path <dir>   target folder (default components/dissolve, src/components/dissolve with a src/ layout)
  --overwrite    replace existing files`);
}

const opts = parseArgs(process.argv.slice(2));
const cmd = opts._[0] ?? 'help';
if (cmd === 'init') init(opts);
else if (cmd === 'add') add(opts);
else if (cmd === 'list' || cmd === 'ls') list();
else help();
