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
const STYLING = ['nativewind', 'react-native-css', 'tailwindcss', 'tailwind-merge'];

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

function readJSONC(file) {
  try {
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(text);
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

function findGlobalCss(cwd) {
  const candidates = ['global.css', 'src/global.css', 'app/global.css', 'src/app/global.css', 'styles/global.css'];
  for (const f of candidates) if (existsSync(join(cwd, f))) return join(cwd, f);
  // Any css importing tailwind, two levels deep, outside node_modules.
  const scan = (dir, depth) => {
    if (depth > 2) return null;
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        const hit = scan(p, depth + 1);
        if (hit) return hit;
      } else if (name.endsWith('.css') && /@import\s+["']tailwindcss/.test(readFileSync(p, 'utf8'))) return p;
    }
    return null;
  };
  return scan(cwd, 0);
}

function writeFile(file, content, overwrite) {
  if (existsSync(file) && !overwrite) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return true;
}

function checkSetup(cwd) {
  const d = deps(cwd);
  const missingPeers = [PKG, ...PEERS].filter((p) => !d[p]);
  const missingStyling = STYLING.filter((p) => !d[p]);
  if (missingPeers.length) {
    console.log(c.yellow('\nMissing dependencies, install them with:'));
    console.log(`  npx expo install ${missingPeers.join(' ')}`);
  }
  if (missingStyling.length) {
    console.log(c.yellow('\nThe dissolve components are styled with NativeWind v5 (Tailwind v4). Missing:'));
    console.log(`  ${missingStyling.join(', ')}`);
    console.log(c.dim('  Setup: https://www.nativewind.dev/v5  (metro withNativewind, postcss @tailwindcss/postcss, global.css)'));
  }
  return !missingPeers.length && !missingStyling.length;
}

function init(opts) {
  const dir = targetDir(opts.cwd, opts.path);
  const tw = join(dir, 'tw.tsx');
  if (writeFile(tw, readFileSync(join(REGISTRY, 'tw.tsx'), 'utf8'), opts.overwrite)) console.log(c.green('created ') + relative(opts.cwd, tw));
  else console.log(c.dim('exists  ') + relative(opts.cwd, tw));

  const theme = readFileSync(join(REGISTRY, 'theme.css'), 'utf8');
  const css = findGlobalCss(opts.cwd);
  if (css) {
    const text = readFileSync(css, 'utf8');
    if (text.includes('--dissolve-surface') && !opts.overwrite) console.log(c.dim('exists  ') + `dissolve theme in ${relative(opts.cwd, css)}`);
    else {
      writeFileSync(css, text.replace(/\s*$/, '\n\n') + theme);
      console.log(c.green('updated ') + `${relative(opts.cwd, css)} (dissolve theme tokens)`);
    }
  } else {
    const out = join(dir, 'dissolve.css');
    writeFile(out, theme, opts.overwrite);
    console.log(c.yellow('note    ') + `no global.css found, wrote ${relative(opts.cwd, out)}: import it from your Tailwind css entry.`);
  }
  const ok = checkSetup(opts.cwd);
  console.log(ok ? c.green('\nReady. Add a component: npx react-native-dissolve add slide-to-confirm') : '');
  return dir;
}

function add(opts) {
  const names = opts._.slice(1);
  const all = registry();
  if (!names.length) {
    console.log('Usage: npx react-native-dissolve add <component> [...more]\n');
    return list();
  }
  const dir = targetDir(opts.cwd, opts.path);
  if (!existsSync(join(dir, 'tw.tsx'))) init({ ...opts, overwrite: false });
  const from = importPath(opts.cwd, dir);
  for (const name of names) {
    const item = all.find((x) => x.name === name);
    if (!item) {
      console.log(c.red('unknown ') + `${name}. Run npx react-native-dissolve list`);
      continue;
    }
    const file = join(dir, item.file);
    const wrote = writeFile(file, readFileSync(join(REGISTRY, item.file), 'utf8'), opts.overwrite);
    console.log((wrote ? c.green('added   ') : c.yellow('skipped ')) + relative(opts.cwd, file) + (wrote ? '' : c.dim('  (exists, use --overwrite)')));
    if (wrote) {
      const exp = item.export ?? item.name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
      console.log(c.dim(`        import { ${exp} } from '${from}/${item.file.replace(/\.tsx?$/, '')}';`));
    }
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

  --path <dir>   target folder (default components/dissolve)
  --overwrite    replace existing files`);
}

const opts = parseArgs(process.argv.slice(2));
const cmd = opts._[0] ?? 'help';
if (cmd === 'init') init(opts);
else if (cmd === 'add') add(opts);
else if (cmd === 'list' || cmd === 'ls') list();
else help();
