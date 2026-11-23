#!/usr/bin/env node
/**
 * dissolve CLI, shadcn style: copies component source into your project so you own it, for React
 * Native or React on the web. Shipped by dissolve-ui.
 *
 *   npx dissolve-ui init                 asks the platform, writes dissolve.json, theme tokens, setup check
 *   npx dissolve-ui add scratch-card     one or more components, for the platform in dissolve.json
 *   npx dissolve-ui list                 available components and their platforms
 *   npx dissolve-ui login | logout | whoami   dissolve pro account
 *
 * Free components come from the registry bundled in the package (works offline). A name that is not
 * in it is asked to the dissolve pro API (see pro.mjs): 401 starts the device login, 402 prints the
 * checkout link.
 *
 * Options: --native / --web (skip the platform question), --yes (take the detected platform),
 * --path <dir> (default components/dissolve, or src/components/dissolve with a src/ layout),
 * --overwrite, --cwd <dir>, --no-login (exit with code 3 instead of starting the login).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { clearPendingLogin, clearToken, ensureLogin, isItemName, me, OfflineError, openBrowser, proIndex, proItem, readToken, waitForLogin } from './pro.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY = resolve(HERE, '..', 'registry');
/** The React web components: registry/web/<name>.tsx, with their framework free cores. */
const WEB = join(REGISTRY, 'web');
/** The package: the native engine the React Native components import, and this CLI. */
const PKG = 'dissolve-ui';
/** The command users type: the package that ships this file. */
const CLI = (() => {
  try {
    return JSON.parse(readFileSync(resolve(HERE, '..', 'package.json'), 'utf8')).name ?? 'dissolve-ui';
  } catch {
    return 'dissolve-ui';
  }
})();
const CONFIG = 'dissolve.json';
const PLATFORMS = { native: 'React Native', web: 'React (web)' };

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
  const out = { _: [], overwrite: false, path: null, cwd: process.cwd(), platform: null, yes: false, noLogin: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--overwrite' || a === '-o') out.overwrite = true;
    else if (a === '--native') out.platform = 'native';
    else if (a === '--web') out.platform = 'web';
    else if (a === '--yes' || a === '-y') out.yes = true;
    else if (a === '--no-login') out.noLogin = true;
    else if (a === '--path' || a === '-p') out.path = argv[++i];
    else if (a === '--cwd') out.cwd = resolve(argv[++i]);
    else if (a === '--help' || a === '-h') out._.unshift('help');
    else out._.push(a);
  }
  return out;
}

const registry = () => JSON.parse(readFileSync(join(REGISTRY, 'index.json'), 'utf8')).components;
/** A component has a web version when registry/web/<name>.tsx exists. */
const hasWeb = (item) => existsSync(join(WEB, `${item.name}.tsx`));

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

/**
 * components/dissolve, or src/components/dissolve when the project maps @/* to ./src/*.
 * Web projects with a src/ folder (Vite, CRA) get src/components/dissolve even without the alias.
 */
function targetDir(cwd, override, platform) {
  if (override) return resolve(cwd, override);
  const ts = readJSONC(join(cwd, 'tsconfig.json'));
  const alias = ts?.compilerOptions?.paths?.['@/*']?.[0];
  const src = existsSync(join(cwd, 'src'));
  if (src && ((alias && /^\.?\/?src\//.test(alias)) || (!alias && platform === 'web'))) return join(cwd, 'src', 'components', 'dissolve');
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
  // Without an alias the app entry usually lives in src/ (src/App.tsx), so print the path from there.
  return './' + rel.replace(/^src\//, '');
}

function deps(cwd) {
  const pkg = readJSONC(join(cwd, 'package.json')) ?? {};
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

const WEB_SIGNS = ['react-dom', 'next', 'vite', '@vitejs/plugin-react', 'react-scripts', '@remix-run/react', '@react-router/dev', 'gatsby'];

/** The platform package.json points to: native, web, or null when it has both or neither. */
function detectPlatform(cwd) {
  const d = deps(cwd);
  const native = Object.keys(d).some((p) => p === 'expo' || p.startsWith('react-native'));
  const web = WEB_SIGNS.some((p) => d[p]);
  return native === web ? null : native ? 'native' : 'web';
}

const readConfig = (cwd) => readJSONC(join(cwd, CONFIG));

/** --native / --web, else the question (detected answer preselected), else the detected one. */
async function choosePlatform(opts) {
  if (opts.platform) return opts.platform;
  const saved = readConfig(opts.cwd)?.platform;
  const detected = detectPlatform(opts.cwd);
  const preselected = PLATFORMS[saved] ? saved : detected ?? 'native';
  if (opts.yes || !process.stdin.isTTY) return preselected;
  const keys = Object.keys(PLATFORMS);
  const why = PLATFORMS[saved] ? 'current' : detected ? 'detected' : 'default';
  console.log(c.bold('Which platform is this project?'));
  keys.forEach((k, i) => console.log(`  ${i + 1}. ${PLATFORMS[k]}${k === preselected ? c.dim(`  (${why})`) : ''}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Enter or a closed input (Ctrl+D) keeps the preselected answer.
  const answer = await new Promise((res) => {
    rl.once('close', () => res(''));
    rl.question(`Choose 1 or 2 ${c.dim(`[${keys.indexOf(preselected) + 1}]`)} `).then((a) => res(a.trim().toLowerCase()));
  });
  rl.close();
  return keys[Number(answer) - 1] ?? keys.find((k) => k.startsWith(answer) && answer) ?? preselected;
}

const TAILWIND_IMPORT = /@import\s+["']tailwindcss/;

/** The Tailwind css entry: a css importing tailwindcss first, then the usual global.css spots. */
function findGlobalCss(cwd) {
  const candidates = ['global.css', 'src/global.css', 'app/global.css', 'src/app/global.css', 'styles/global.css', 'app/globals.css', 'src/app/globals.css', 'styles/globals.css', 'src/index.css', 'src/styles.css'];
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

/** The theme tokens; without Tailwind, only the CSS variables (the @theme block is Tailwind's). */
function themeBlock(tailwind = true) {
  const css = readFileSync(join(REGISTRY, 'theme.css'), 'utf8');
  const cut = css.indexOf('@layer theme');
  const tokens = tailwind || cut === -1 ? css : css.slice(0, cut);
  return `${THEME_START}\n${tokens.trim()}\n${THEME_END}\n`;
}

/**
 * Appends the theme tokens to the project's css entry once, or writes dissolve.css next to the
 * components. Native always runs Tailwind (NativeWind); a web project may not.
 */
function writeTheme(opts, dir, platform) {
  const css = findGlobalCss(opts.cwd);
  const tailwind = platform === 'native' || !!deps(opts.cwd).tailwindcss || (css && TAILWIND_IMPORT.test(readFileSync(css, 'utf8')));
  if (!css) {
    const out = join(dir, 'dissolve.css');
    writeFile(out, themeBlock(tailwind), opts.overwrite);
    console.log(c.yellow('note    ') + `no global.css found, wrote ${relative(opts.cwd, out)}: import it ${platform === 'native' ? 'from your Tailwind css entry' : 'once from your root layout or css entry'}.`);
    return;
  }
  const text = readFileSync(css, 'utf8');
  const theme = themeBlock(tailwind);
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
}

/** Web components need React 19 (ref as a prop) and react-dom, nothing else. */
function checkWebSetup(cwd) {
  const d = deps(cwd);
  const missing = ['react', 'react-dom'].filter((p) => !d[p]);
  if (missing.length) {
    console.log(c.yellow('\nMissing dependencies, install them with:'));
    console.log(`  npm install ${missing.join(' ')}`);
  }
  const major = Number(String(d.react ?? '').match(/\d+/)?.[0]);
  if (major && major < 19) console.log(c.yellow('\nThe dissolve web components need React 19 or later (they take ref as a prop).'));
  return !missing.length && !(major && major < 19);
}

async function init(opts, { quiet = false } = {}) {
  const platform = await choosePlatform(opts);
  const config = readConfig(opts.cwd);
  const dir = targetDir(opts.cwd, opts.path ?? config?.dir, platform);
  const configFile = join(opts.cwd, CONFIG);
  const next = { platform, dir: relative(opts.cwd, dir).split('\\').join('/') };
  if (config?.platform !== next.platform || config?.dir !== next.dir) {
    writeFileSync(configFile, JSON.stringify(next, null, 2) + '\n');
    console.log(c.green(config ? 'updated ' : 'created ') + `${CONFIG} (${PLATFORMS[platform]}, ${next.dir})`);
  } else console.log(c.dim('exists  ') + `${CONFIG} (${PLATFORMS[platform]})`);

  if (platform === 'native') {
    const tw = join(dir, 'tw.tsx');
    const twExisted = existsSync(tw);
    if (writeFile(tw, readFileSync(join(REGISTRY, 'tw.tsx'), 'utf8'), opts.overwrite)) console.log(c.green(twExisted ? 'replaced ' : 'created ') + relative(opts.cwd, tw));
    else console.log(c.dim('exists  ') + relative(opts.cwd, tw));
  }
  writeTheme(opts, dir, platform);
  const ok = platform === 'native' ? checkSetup(opts.cwd) : checkWebSetup(opts.cwd);
  if (ok && !quiet) console.log(c.green(`\nReady. Add a component: npx ${CLI} add ${platform === 'native' ? 'slide-to-confirm' : 'scratch-card'}`));
  return { platform, dir };
}

/** Files of the base folder a source imports as './<name>' (besides tw), recursively. */
function localImports(base, src, seen = new Set()) {
  for (const m of src.matchAll(/from\s+['"]\.\/([\w.-]+)['"]/g)) {
    if (m[1] === 'tw') continue;
    const dep = ['.tsx', '.ts'].map((ext) => m[1] + ext).find((f) => existsSync(join(base, f)));
    if (!dep || seen.has(dep)) continue;
    seen.add(dep);
    localImports(base, readFileSync(join(base, dep), 'utf8'), seen);
  }
  return seen;
}

/** Files of the base folder a component imports as './<name>' (besides tw), recursively. */
const localDeps = (base, file) => localImports(base, readFileSync(join(base, file), 'utf8'));

const pascal = (name) => name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');

/** 'paywall', 'native/paywall' or 'https://.../r/native/paywall.json' -> 'paywall'. */
const depName = (dep) => String(dep).split('?')[0].replace(/\.json$/, '').split('/').pop();

/**
 * Where a pro file goes, relative to the dissolve folder: its target (or path) without the
 * components/dissolve prefix. Null for anything that would escape the folder.
 */
function proFilePath(file) {
  const raw = String(file?.target || file?.path || '').split('\\').join('/');
  if (raw.split('/').includes('..')) return null;
  let rel = raw.replace(/^(\.\/)?(src\/)?components\/dissolve\//, '');
  if (rel === raw) rel = raw.split('/').pop();
  if (!rel || rel.startsWith('/') || rel.split('/').some((s) => s === '' || s === '.' || s === '..')) return null;
  return rel;
}

const NON_TTY_WAIT = 90_000;

/**
 * Device login, inline: prints the link and the code, opens the browser, polls. Without a terminal
 * (an agent running the command) it waits 90 s, then asks to run the command again: the next run
 * keeps polling the same code. Resolves the token or null.
 */
async function deviceLogin() {
  let pending;
  try {
    pending = await ensureLogin(`dissolve-ui CLI on ${hostname()}`);
  } catch (e) {
    console.log(c.red('error   ') + e.message);
    return null;
  }
  console.log(`\n${c.bold('Connect your dissolve account')}`);
  console.log(`  Open  ${pending.verify_url}`);
  console.log(`  Code  ${c.bold(pending.user_code)}`);
  openBrowser(pending.verify_url);
  console.log(c.dim('\nWaiting for you to confirm in the browser...'));
  const r = await waitForLogin(pending, { maxWait: process.stdin.isTTY ? Infinity : NON_TTY_WAIT });
  if (r?.token) {
    console.log(c.green('logged in') + c.dim(`  token saved in ~/.config/dissolve/auth.json\n`));
    return r.token;
  }
  if (r === 'expired') console.log(c.red('\nThe code expired.') + ' Run the command again for a new one.');
  else console.log(c.yellow('\nStill waiting.') + ` Open ${pending.verify_url}, enter ${pending.user_code}, then run the command again.`);
  return null;
}

/**
 * A pro item, logging in when the API asks for it (401). Resolves the proItem() result, or
 * { status: 'env' } when DISSOLVE_TOKEN itself was rejected, or { status: 'nologin' }.
 */
async function fetchPro(name, opts, platform) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const auth = readToken();
    const r = await proItem(name, { token: auth?.token, platform });
    if (r.status !== 'login') return r;
    if (auth?.source === 'env') return { status: 'env' };
    if (auth) clearToken();
    if (opts.noLogin) return r;
    if (!(await deviceLogin())) return { status: 'nologin' };
  }
  return { status: 'login' };
}

/**
 * Resolves names that are not in the bundled registry against dissolve pro, with the pro items they
 * depend on. Free registryDependencies come back as free names for the regular add path.
 */
async function resolvePro(names, opts, platform, isFree) {
  const items = [];
  const free = [];
  const checkout = [];
  const queue = [...names];
  const seen = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    if (!isItemName(name)) {
      console.log(c.red('unknown ') + `${name}. Run npx ${CLI} list`);
      continue;
    }
    let r;
    try {
      r = await fetchPro(name, opts, platform);
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      console.log(c.red('unknown ') + `${name}: not a free component, and dissolve pro could not be reached (offline?). Run npx ${CLI} list`);
      continue;
    }
    if (r.status === 'ok') {
      items.push(r.item);
      for (const dep of r.item.registryDependencies ?? []) {
        const d = depName(dep);
        // dissolve-theme, dissolve-tw and other shared files come with init and the components.
        if (!d || d.startsWith('dissolve-')) continue;
        if (isFree(d)) free.push(d);
        else queue.push(d);
      }
    } else if (r.status === 'pay') checkout.push({ name, url: r.checkout_url });
    else if (r.status === 'missing') console.log(c.red('unknown ') + `${name}: not found. Run npx ${CLI} list`);
    else if (r.status === 'login' && opts.noLogin) {
      console.log(`login required: ${name} is part of dissolve pro. Run npx ${CLI} login`);
      process.exit(3);
    } else if (r.status === 'login' || r.status === 'nologin') {
      if (r.status === 'login') console.log(c.red('error   ') + `the dissolve API did not accept the new login. Run npx ${CLI} login`);
      process.exitCode = 1;
      return null;
    } else if (r.status === 'env') {
      console.log(c.red('error   ') + `DISSOLVE_TOKEN was not accepted. Unset it, or set a valid token.`);
      process.exitCode = 1;
      return null;
    } else console.log(c.red('error   ') + `${name}: the dissolve API answered ${r.code}. Try again in a moment.`);
  }
  return { items, free, checkout };
}

async function add(opts) {
  const names = opts._.slice(1);
  const all = registry();
  if (!names.length) {
    console.log(`Usage: npx ${CLI} add <component> [...more]\n`);
    return list();
  }
  let config = readConfig(opts.cwd);
  if (!config?.platform || (opts.platform && opts.platform !== config.platform)) {
    await init({ ...opts, overwrite: false }, { quiet: true });
    config = readConfig(opts.cwd);
  }
  const web = config.platform === 'web';
  const dir = targetDir(opts.cwd, opts.path ?? config.dir);
  const base = web ? WEB : REGISTRY;
  if (!web && !existsSync(join(dir, 'tw.tsx'))) await init({ ...opts, platform: 'native', overwrite: false }, { quiet: true });
  else if (!(web ? checkWebSetup(opts.cwd) : checkSetup(opts.cwd))) console.log('');
  const from = importPath(opts.cwd, dir);
  const findFree = (name) => all.find((x) => x.name === name || x.file === name);
  const requested = [];
  const pickFree = (item) => {
    if (requested.includes(item)) return;
    if (web && !hasWeb(item)) console.log(c.yellow('skipped ') + `${item.name} is React Native only for now. Run npx ${CLI} list`);
    else requested.push(item);
  };
  const notFree = [];
  for (const name of names) {
    const item = findFree(name);
    if (item) pickFree(item);
    else notFree.push(name);
  }
  // Everything is resolved before writing, so a login or a payment never leaves a half install.
  const pro = notFree.length ? await resolvePro(notFree, opts, config.platform, (n) => !!findFree(n)) : { items: [], free: [], checkout: [] };
  if (!pro) return;
  for (const name of pro.free) pickFree(findFree(name));

  /** file -> content of every file this run handled, for the package scan below. */
  const done = new Map();
  const put = (file, content, note) => {
    if (done.has(file)) return null;
    done.set(file, content);
    const out = join(dir, file);
    const existed = existsSync(out);
    const wrote = writeFile(out, content, opts.overwrite);
    console.log((wrote ? c.green(existed ? 'replaced ' : 'added   ') : c.yellow('skipped ')) + relative(opts.cwd, out) + (note ? c.dim(`  (${note})`) : '') + (wrote ? '' : c.dim('  (exists, use --overwrite)')));
    return wrote;
  };
  const copy = (file, note) => (done.has(file) ? null : put(file, readFileSync(join(base, file), 'utf8'), note));
  const hint = (file, exp) => console.log(c.dim(`        import { ${exp} } from '${from}/${file.replace(/\.tsx?$/, '')}';`));
  for (const item of requested) {
    const file = web ? `${item.name}.tsx` : item.file;
    if (copy(file)) hint(file, item.export ?? pascal(item.name));
    for (const dep of localDeps(base, file)) copy(dep, `used by ${item.name}`);
  }
  const external = new Set();
  for (const item of pro.items) {
    let first = true;
    for (const f of item.files ?? []) {
      const file = proFilePath(f);
      if (!file || typeof f.content !== 'string') {
        console.log(c.yellow('skipped ') + `${f?.target || f?.path} from ${item.name}` + c.dim('  (unsafe path)'));
        continue;
      }
      if (put(file, f.content, first ? null : `used by ${item.name}`) && first) hint(file, pascal(item.name));
      first = false;
      // Free files the pro file imports as './x', in case registryDependencies left one out.
      for (const dep of localImports(base, f.content)) copy(dep, `used by ${item.name}`);
    }
    for (const d of item.dependencies ?? []) external.add(String(d).replace(/(.)@[^/]*$/, '$1'));
  }
  // Packages the copied files import that the project does not have yet (e.g. expo-glass-effect).
  const have = deps(opts.cwd);
  for (const text of done.values()) for (const m of text.matchAll(/from\s+['"]([^'".][^'"]*)['"]/g)) {
    const spec = m[1];
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    external.add(pkg);
  }
  const missing = [...external].filter((p) => !['react', 'react-native', 'react-dom'].includes(p) && !have[p]);
  if (missing.length) {
    console.log(c.yellow('\nThese components need packages your app does not have yet:'));
    console.log(`  ${web ? 'npm install' : 'npx expo install'} ${missing.join(' ')}`);
  }
  if (!web && [...done.values()].some((text) => /from\s+['"]dissolve-ui['"]/.test(text))) {
    console.log(c.dim(`\nThese use the dissolve engine: wrap your root layout once, inside GestureHandlerRootView:
        import { DissolveProvider } from 'dissolve-ui';
        <GestureHandlerRootView style={{ flex: 1 }}><DissolveProvider>{children}</DissolveProvider></GestureHandlerRootView>`));
  }
  for (const { name, url } of pro.checkout) {
    console.log(`\n${c.bold(name)} is part of dissolve pro.`);
    console.log(`  Subscribe: ${c.bold(url)}`);
    console.log(c.dim('  Then run the same command again.'));
    process.exitCode = 4;
  }
}

async function list() {
  console.log(c.bold('dissolve components\n'));
  const free = registry();
  for (const item of free) {
    const platforms = hasWeb(item) ? 'native, web' : 'native';
    console.log(`  ${item.name.padEnd(20)} ${platforms.padEnd(12)} ${c.dim(item.description)}`);
  }
  // Offline, or the API is down: the free list is enough.
  const pro = (await proIndex())?.filter((p) => !free.some((f) => f.name === p.name)) ?? [];
  for (const item of pro) {
    const platforms = (Array.isArray(item.platforms) && item.platforms.length ? item.platforms : ['native']).join(', ');
    console.log(`  ${item.name.padEnd(20)} ${platforms.padEnd(12)} ${c.yellow('pro')} ${c.dim(item.description ?? item.title ?? '')}`);
  }
  console.log(c.dim(`\nnpx ${CLI} add <name>`));
}

async function login() {
  const auth = readToken();
  if (auth) {
    const who = await me(auth.token);
    if (who) return console.log(`Already logged in as ${c.bold(who.user.email)}. Run npx ${CLI} logout to switch accounts.`);
    if (auth.source === 'env') {
      console.log(c.red('error   ') + 'DISSOLVE_TOKEN was not accepted. Unset it, or set a valid token.');
      process.exitCode = 1;
      return;
    }
    clearToken();
  }
  if (!(await deviceLogin())) process.exitCode = 1;
}

function logout() {
  const had = clearToken();
  clearPendingLogin();
  console.log(had ? 'Logged out: removed ~/.config/dissolve/auth.json' : 'Not logged in.');
  if (process.env.DISSOLVE_TOKEN) console.log(c.yellow('note    ') + 'DISSOLVE_TOKEN is set in your environment and still applies.');
}

async function whoami() {
  const auth = readToken();
  if (!auth) return console.log(`Not logged in. Run npx ${CLI} login`);
  const who = await me(auth.token);
  if (!who) {
    console.log(c.red('error   ') + (auth.source === 'env' ? 'DISSOLVE_TOKEN' : 'The saved token') + ` is not valid anymore. Run npx ${CLI} login`);
    process.exitCode = 1;
    return;
  }
  const plan = who.pro ? c.green(`dissolve pro${who.plan ? ` (${who.plan})` : ''}`) : c.dim('no dissolve pro');
  console.log(`${c.bold(who.user.email)}  ${plan}${auth.source === 'env' ? c.dim('  (token from DISSOLVE_TOKEN)') : ''}`);
}

function help() {
  console.log(`${c.bold('dissolve')}  components you own, for React Native and React on the web

  npx ${CLI} init                pick the platform, set up the theme tokens (and tw primitives on native)
  npx ${CLI} add <name...>       copy components into your project (free and pro)
  npx ${CLI} list                list components and their platforms
  npx ${CLI} login               connect your dissolve pro account (also done by add when needed)
  npx ${CLI} logout              forget the saved token
  npx ${CLI} whoami              the connected account and its plan

  --native, --web  platform, without the question (saved in ${CONFIG})
  --yes            take the detected platform
  --path <dir>     target folder (default components/dissolve, src/components/dissolve with a src/ layout)
  --overwrite      replace existing files`);
}

const opts = parseArgs(process.argv.slice(2));
const cmd = opts._[0] ?? 'help';
try {
  if (cmd === 'init') await init(opts);
  else if (cmd === 'add') await add(opts);
  else if (cmd === 'list' || cmd === 'ls') await list();
  else if (cmd === 'login') await login();
  else if (cmd === 'logout') logout();
  else if (cmd === 'whoami') await whoami();
  else help();
} catch (e) {
  if (!(e instanceof OfflineError)) throw e;
  console.log(c.red('error   ') + e.message + ' Check your connection and try again.');
  process.exitCode = 1;
}
