// dissolve pro in the CLI and the MCP server, against a local mock of the API (test/mock-api.mjs).
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cliSandbox, existsSync, offlineEnv, read, REGISTRY_DIR, ROOT, writeTree } from './helpers.mjs';
import { CHECKOUT_URL, mockApi, NOPAY, PAYWALL, runNode, USER_CODE, VALID } from './mock-api.mjs';

const NATIVE_APP = {
  'package.json': {
    dependencies: Object.fromEntries(
      ['dissolve-ui', '@shopify/react-native-skia', 'react-native-reanimated', 'react-native-worklets', 'react-native-gesture-handler', 'expo-haptics', 'nativewind', 'react-native-css', 'tailwindcss', '@tailwindcss/postcss', 'tailwind-merge'].map((d) => [d, '*']),
    ),
    overrides: { lightningcss: '1.30.1' },
  },
  'metro.config.js': "const { withNativewind } = require('nativewind/metro');\nmodule.exports = withNativewind({});\n",
  'postcss.config.mjs': "export default { plugins: { '@tailwindcss/postcss': {} } };\n",
  'global.css': '@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css";\n',
};

let sandbox;
let api;
let n = 0;
before(async () => {
  sandbox = cliSandbox();
  api = await mockApi();
});
after(async () => {
  await api?.close();
  sandbox?.cleanup();
});
beforeEach(() => api.reset({ confirmAfter: 2 }));

/** A fresh app and a fresh HOME (no token). */
function fixture() {
  const id = ++n;
  const cwd = join(sandbox.dir, `app-${id}`);
  const home = join(sandbox.dir, `home-${id}`);
  mkdirSync(cwd, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeTree(cwd, NATIVE_APP);
  return { cwd, home, authFile: join(home, '.config', 'dissolve', 'auth.json') };
}

const env = (home, extra = {}) => offlineEnv(home, { DISSOLVE_API_URL: api.url, ...extra });
const cli = (f, args, extra) => runNode([sandbox.bin, ...args, '--native'], { cwd: f.cwd, env: env(f.home, extra) });
const proRequests = () => api.state.requests.filter((r) => r.path.startsWith('/api/pro/') && r.path !== '/api/pro/index.json');

describe('CLI', () => {
  test('a free add stays offline: the API is never called', async () => {
    const f = fixture();
    const { code, out } = await cli(f, ['add', 'slide-to-confirm']);
    assert.equal(code, 0, out);
    assert.equal(read(join(f.cwd, 'components/dissolve/slide-to-confirm.tsx')), read(join(REGISTRY_DIR, 'slide-to-confirm.tsx')));
    assert.deepEqual(api.state.requests, []);
  });

  test('pro add without a token: 401, device login, token saved, then the install', async () => {
    const f = fixture();
    const { code, out } = await cli(f, ['add', 'paywall']);
    assert.equal(code, 0, out);
    assert.match(out, new RegExp(`${api.url}/activate\\?code=${USER_CODE}`));
    assert.match(out, new RegExp(USER_CODE));
    assert.match(out, /logged in/);
    assert.deepEqual(JSON.parse(read(f.authFile)), { token: VALID });
    assert.equal(statSync(f.authFile).mode & 0o777, 0o600);

    const dir = join(f.cwd, 'components/dissolve');
    assert.equal(read(join(dir, 'paywall.tsx')), PAYWALL.files[0].content);
    // A pro dependency and a free registryDependency, through the regular add path.
    assert.ok(existsSync(join(dir, 'paywall-badge.tsx')));
    assert.equal(read(join(dir, 'slide-to-confirm.tsx')), read(join(REGISTRY_DIR, 'slide-to-confirm.tsx')));
    assert.ok(existsSync(join(dir, 'tw.tsx')));
    assert.match(out, /import \{ Paywall \} from '\.\/components\/dissolve\/paywall'/);
    assert.match(out, /npx expo install expo-blur/);

    const pro = proRequests();
    assert.equal(pro[0].auth, '');
    assert.ok(pro.slice(1).every((r) => r.auth === VALID));
    assert.match(pro[0].query, /platform=native/);
    assert.equal(api.state.started, 1);
    assert.match(api.state.clientNames[0], /^dissolve-ui CLI on /);

    // Second run: the saved token is used, no new login.
    api.reset();
    const again = await cli(f, ['add', 'paywall', '--overwrite']);
    assert.equal(again.code, 0, again.out);
    assert.equal(api.state.started, 0);
    assert.doesNotMatch(again.out, /Connect your dissolve account/);
  });

  test('402: the checkout link is printed, nothing pro is written, free names still install', async () => {
    const f = fixture();
    const { code, out } = await cli(f, ['add', 'paywall', 'slide-to-confirm'], { DISSOLVE_TOKEN: NOPAY });
    assert.equal(code, 4, out);
    assert.match(out, /paywall is part of dissolve pro\./);
    assert.ok(out.includes(`Subscribe: ${CHECKOUT_URL}`), out);
    assert.ok(!existsSync(join(f.cwd, 'components/dissolve/paywall.tsx')));
    assert.ok(existsSync(join(f.cwd, 'components/dissolve/slide-to-confirm.tsx')));
    assert.equal(api.state.started, 0);
  });

  test('DISSOLVE_TOKEN overrides the saved token', async () => {
    const f = fixture();
    mkdirSync(join(f.home, '.config', 'dissolve'), { recursive: true });
    writeFileSync(f.authFile, JSON.stringify({ token: 'dsv_REVOKED' }));
    const { code, out } = await cli(f, ['add', 'paywall'], { DISSOLVE_TOKEN: VALID });
    assert.equal(code, 0, out);
    assert.ok(proRequests().every((r) => r.auth === VALID));
    assert.equal(api.state.started, 0);
    assert.deepEqual(JSON.parse(read(f.authFile)), { token: 'dsv_REVOKED' }, 'the saved token is left alone');
  });

  test('a rejected DISSOLVE_TOKEN is reported, no login starts', async () => {
    const f = fixture();
    const { code, out } = await cli(f, ['add', 'paywall'], { DISSOLVE_TOKEN: 'dsv_BAD' });
    assert.equal(code, 1);
    assert.match(out, /DISSOLVE_TOKEN was not accepted/);
    assert.equal(api.state.started, 0);
  });

  test('--no-login exits with code 3 and writes nothing', async () => {
    const f = fixture();
    const { code, out } = await cli(f, ['add', 'slide-to-confirm', 'paywall', '--no-login']);
    assert.equal(code, 3, out);
    assert.match(out, /login required/);
    assert.ok(!existsSync(join(f.cwd, 'components/dissolve/slide-to-confirm.tsx')));
    assert.equal(api.state.started, 0);
  });

  test('pro files cannot escape the components folder', async () => {
    const f = fixture();
    const { out } = await cli(f, ['add', 'evil'], { DISSOLVE_TOKEN: VALID });
    assert.match(out, /skipped\s+\.\.\/\.\.\/escaped\.tsx from evil/);
    assert.ok(!existsSync(join(sandbox.dir, 'escaped.tsx')));
    assert.ok(!existsSync(join(f.cwd, 'escaped.tsx')));
    assert.ok(!existsSync(join(f.cwd, 'components/dissolve/escaped.tsx')));
  });

  test('a typo is a 404 without login: not found, try list', async () => {
    const f = fixture();
    const { out } = await cli(f, ['add', 'nope-nope']);
    assert.match(out, /unknown\s+nope-nope: not found\. Run npx dissolve-ui list/);
    assert.equal(api.state.started, 0);
  });

  test('a revoked saved token is cleared and the device login runs once', async () => {
    const f = fixture();
    mkdirSync(join(f.home, '.config', 'dissolve'), { recursive: true });
    writeFileSync(f.authFile, JSON.stringify({ token: 'dsv_REVOKED' }));
    const { code, out } = await cli(f, ['add', 'paywall']);
    assert.equal(code, 0, out);
    assert.equal(api.state.started, 1);
    assert.deepEqual(JSON.parse(read(f.authFile)), { token: VALID });
  });

  test('list shows the pro items after the free ones, marked pro; offline, only the free ones', async () => {
    const f = fixture();
    const { code, out } = await cli(f, ['list']);
    assert.equal(code, 0);
    const lines = out.split('\n');
    const paywall = lines.findIndex((l) => l.trim().startsWith('paywall '));
    assert.ok(paywall > lines.findIndex((l) => l.trim().startsWith('slide-to-confirm ')));
    assert.match(lines[paywall], /native\s+pro\s+A paywall screen\./);
    assert.match(out, /paywall-badge\s+native, web\s+pro/);

    const offline = await runNode([sandbox.bin, 'list'], { cwd: f.cwd, env: offlineEnv(f.home) });
    assert.equal(offline.code, 0);
    assert.ok(offline.out.includes('slide-to-confirm'));
    assert.ok(!offline.out.includes('paywall'));
  });

  test('login, whoami, logout', async () => {
    const f = fixture();
    assert.match((await cli(f, ['whoami'])).out, /Not logged in/);
    const login = await cli(f, ['login']);
    assert.equal(login.code, 0, login.out);
    assert.match(login.out, new RegExp(USER_CODE));
    assert.match((await cli(f, ['whoami'])).out, /vibe@example\.com\s+dissolve pro \(month\)/);
    assert.match((await cli(f, ['login'])).out, /Already logged in as vibe@example\.com/);
    assert.match((await cli(f, ['logout'])).out, /Logged out/);
    assert.ok(!existsSync(f.authFile));
    assert.match((await cli(f, ['whoami'], { DISSOLVE_TOKEN: NOPAY })).out, /free@example\.com\s+no dissolve pro subscription\s+\(token from DISSOLVE_TOKEN\)/);
  });
});

/* ---------- MCP ---------- */

/** The MCP server over stdio, with a call(name, args) helper. */
function mcp(f, extra = {}) {
  const child = spawn(process.execPath, [join(ROOT, 'mcp', 'server.mjs')], {
    cwd: f.cwd,
    env: env(f.home, { DISSOLVE_CLI: sandbox.bin, ...extra }),
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const waiting = new Map();
  let buf = '';
  let id = 0;
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      waiting.get(msg.id)?.(msg);
    }
  });
  const rpc = (method, params) =>
    new Promise((resolve) => {
      waiting.set(++id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  return {
    rpc,
    call: async (name, args = {}) => {
      const msg = await rpc('tools/call', { name, arguments: args });
      return { text: msg.result.content[0].text, isError: !!msg.result.isError };
    },
    close: () => new Promise((r) => (child.on('close', r), child.stdin.end())),
  };
}

describe('MCP', () => {
  test('lists the pro tools', async () => {
    const f = fixture();
    const s = mcp(f);
    const { result } = await s.rpc('tools/list');
    const names = result.tools.map((t) => t.name);
    for (const t of ['list_components', 'add_component', 'dissolve_login', 'dissolve_login_status']) assert.ok(names.includes(t), t);
    await s.close();
  });

  test('list_components includes the pro items, marked pro', async () => {
    const f = fixture();
    const s = mcp(f);
    const { text, isError } = await s.call('list_components');
    assert.equal(isError, false, text);
    assert.match(text, /slide-to-confirm/);
    assert.match(text, /paywall\s+native\s+pro/);
    await s.close();
  });

  test('add_component free: installs through the CLI, no API call', async () => {
    const f = fixture();
    const s = mcp(f);
    const { text, isError } = await s.call('add_component', { name: 'slide-to-confirm', cwd: f.cwd, platform: 'native' });
    assert.equal(isError, false, text);
    assert.match(text, /added\s+components\/dissolve\/slide-to-confirm\.tsx/);
    assert.deepEqual(api.state.requests, []);
    await s.close();
  });

  test('add_component pro: login message, then status, then the install', async () => {
    const f = fixture();
    api.reset({ confirmAfter: 1000 });
    const s = mcp(f);
    const first = await s.call('add_component', { name: 'paywall', cwd: f.cwd, platform: 'native' });
    assert.equal(
      first.text,
      `Open ${api.url}/activate?code=${USER_CODE} to connect your dissolve account (code ${USER_CODE}), then ask me again.`,
    );
    assert.ok(!existsSync(join(f.cwd, 'components/dissolve/paywall.tsx')));
    assert.match((await s.call('dissolve_login_status')).text, /Waiting for the user/);
    // A second call before the user confirmed reuses the same code.
    assert.equal((await s.call('add_component', { name: 'paywall', cwd: f.cwd })).text, first.text);
    assert.equal(api.state.started, 1);
    assert.match(api.state.clientNames[0], /^dissolve MCP on /);

    // The user confirms: the next poll (background or on the next call) saves the token.
    api.reset({ confirmAfter: 1 });
    const status = await s.call('dissolve_login_status');
    assert.match(status.text, /Connected as vibe@example\.com\. dissolve pro: active \(month\)/);
    assert.deepEqual(JSON.parse(read(f.authFile)), { token: VALID });

    const done = await s.call('add_component', { name: 'paywall', cwd: f.cwd });
    assert.equal(done.isError, false, done.text);
    assert.match(done.text, /added\s+components\/dissolve\/paywall\.tsx/);
    assert.equal(read(join(f.cwd, 'components/dissolve/paywall.tsx')), PAYWALL.files[0].content);
    await s.close();
  });

  test('add_component pro picks up a confirmed login on the next call by itself', async () => {
    const f = fixture();
    api.reset({ confirmAfter: 1000 });
    const s = mcp(f);
    await s.call('add_component', { name: 'paywall', cwd: f.cwd, platform: 'native' });
    api.reset({ confirmAfter: 1 });
    const done = await s.call('add_component', { name: 'paywall', cwd: f.cwd });
    assert.match(done.text, /added\s+components\/dissolve\/paywall\.tsx/);
    await s.close();
  });

  test('add_component 402: the checkout link in one sentence', async () => {
    const f = fixture();
    const s = mcp(f, { DISSOLVE_TOKEN: NOPAY });
    const { text } = await s.call('add_component', { name: 'paywall', cwd: f.cwd, platform: 'native' });
    assert.equal(text, `paywall is part of dissolve pro: subscribe at ${CHECKOUT_URL}, then ask me again.`);
    await s.close();
  });

  test('dissolve_login when connected says who', async () => {
    const f = fixture();
    const s = mcp(f, { DISSOLVE_TOKEN: VALID });
    assert.match((await s.call('dissolve_login')).text, /Connected as vibe@example\.com/);
    await s.close();
  });

  test('add_component without a package.json asks for cwd', async () => {
    const f = fixture();
    const s = mcp(f);
    const { text, isError } = await s.call('add_component', { name: 'paywall', cwd: sandbox.dir });
    assert.equal(isError, true);
    assert.match(text, /No package\.json/);
    await s.close();
  });
});
