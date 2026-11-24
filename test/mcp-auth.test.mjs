// The MCP server needs a free dissolve account: the gate, the cache, usage events and the pro
// pairing hint, against a local mock of the API (test/mock-api.mjs).
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cliSandbox, existsSync, offlineEnv, read, writeTree } from './helpers.mjs';
import { mcpServer, mockApi, NOPAY, USER_CODE, VALID } from './mock-api.mjs';

const DAY = 24 * 60 * 60 * 1000;
const VERSION = JSON.parse(read(new URL('../packages/dissolve-ui-mcp/package.json', import.meta.url))).version;

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
beforeEach(() => api.reset({ confirmAfter: 1000 }));

function fixture() {
  const id = ++n;
  const cwd = join(sandbox.dir, `app-${id}`);
  const home = join(sandbox.dir, `home-${id}`);
  mkdirSync(cwd, { recursive: true });
  mkdirSync(home, { recursive: true });
  writeTree(cwd, { 'package.json': { dependencies: { 'dissolve-ui': '*' } } });
  const config = join(home, '.config', 'dissolve');
  return { cwd, home, config, authFile: join(config, 'auth.json'), accountFile: join(config, 'mcp-account.json') };
}

/** A saved token, and optionally its last successful check `age` ms ago. */
function seed(f, token, { age, pro = false } = {}) {
  mkdirSync(f.config, { recursive: true });
  writeFileSync(f.authFile, JSON.stringify({ token }));
  if (age !== undefined) {
    const id = createHash('sha256').update(token).digest('hex').slice(0, 16);
    writeFileSync(f.accountFile, JSON.stringify({ token: id, checked_at: Date.now() - age, pro }));
  }
}

const start = (f, extra = {}) =>
  mcpServer({ cwd: f.cwd, env: offlineEnv(f.home, { DISSOLVE_API_URL: api.url, DISSOLVE_CLI: sandbox.bin, DISSOLVE_TELEMETRY: undefined, DO_NOT_TRACK: undefined, ...extra }) });

const signIn = (url) =>
  `dissolve needs a free account to work in your agent (it takes 10 seconds). Open ${url}/activate?code=${USER_CODE} and sign in with Google or GitHub, then ask me again. You can also run \`npx dissolve-ui login\` in a terminal.`;

const meCalls = () => api.state.requests.filter((r) => r.path === '/api/me').length;

describe('MCP account gate', () => {
  test('initialize and tools/list answer without a token', async () => {
    const f = fixture();
    const s = start(f);
    const init = await s.rpc('initialize', {});
    assert.equal(init.result.serverInfo.version, VERSION);
    const { result } = await s.rpc('tools/list');
    assert.ok(result.tools.length >= 7);
    await s.close();
    assert.deepEqual(api.state.requests, []);
  });

  test('no token: the sign-in text (not an error) and one device login', async () => {
    const f = fixture();
    const s = start(f);
    const first = await s.call('get_variant', { name: 'dust' });
    assert.equal(first.isError, false);
    assert.equal(first.text, signIn(api.url));
    // Asked again before the user signed in: same code, no new login.
    assert.equal((await s.call('list_variants')).text, signIn(api.url));
    await s.close();
    assert.equal(api.state.started, 1);
    assert.match(api.state.clientNames[0], /^dissolve MCP on /);
    assert.deepEqual(api.state.events, []);
  });

  test('the background poll saves the token, so the next call just works', async () => {
    const f = fixture();
    api.reset({ confirmAfter: 2 });
    const s = start(f);
    assert.equal((await s.call('get_setup')).text, signIn(api.url));
    for (let i = 0; i < 100 && !existsSync(f.authFile); i++) await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(JSON.parse(read(f.authFile)), { token: VALID });
    const next = await s.call('get_variant', { name: 'dust' });
    assert.match(next.text, /^# dust/);
    await s.close();
  });

  test('login tools are not gated', async () => {
    const f = fixture();
    const s = start(f);
    assert.match((await s.call('dissolve_login_status')).text, /Not connected\. The dissolve tools need a free account/);
    await s.close();
    assert.equal(api.state.started, 0);
  });

  test('valid token: the tool runs, the check is cached for 24 h, one usage event per call', async () => {
    const f = fixture();
    seed(f, NOPAY);
    const s = start(f);
    assert.match((await s.call('get_variant', { name: 'dust' })).text, /^# dust/);
    assert.match((await s.call('list_variants')).text, /- dust \(exit/);
    await s.close();
    assert.equal(meCalls(), 1);
    assert.equal(JSON.parse(read(f.accountFile)).pro, false);
    // Fire and forget: they may land in any order.
    const byTool = (a, b) => a.tool.localeCompare(b.tool);
    assert.deepEqual(api.state.events.sort(byTool), [
      { auth: NOPAY, tool: 'get_variant', item: 'dust', client: 'mcp', version: VERSION },
      { auth: NOPAY, tool: 'list_variants', client: 'mcp', version: VERSION },
    ]);
  });

  test('a check older than 24 h is made again', async () => {
    const f = fixture();
    seed(f, VALID, { age: 2 * DAY, pro: true });
    const s = start(f);
    assert.match((await s.call('get_setup')).text, /dissolve-ui setup/);
    await s.close();
    assert.equal(meCalls(), 1);
    assert.ok(Date.now() - JSON.parse(read(f.accountFile)).checked_at < 60000);
  });

  test('a revoked saved token is deleted and the sign-in text comes back', async () => {
    const f = fixture();
    seed(f, 'dsv_REVOKED', { age: 2 * DAY });
    const s = start(f);
    assert.equal((await s.call('get_setup')).text, signIn(api.url));
    await s.close();
    assert.ok(!existsSync(f.authFile));
    assert.ok(!existsSync(f.accountFile));
    assert.equal(api.state.started, 1);
  });

  test('a rejected DISSOLVE_TOKEN is reported, no login starts', async () => {
    const f = fixture();
    const s = start(f, { DISSOLVE_TOKEN: 'dsv_BAD' });
    assert.match((await s.call('get_setup')).text, /DISSOLVE_TOKEN is set but dissolve did not accept it/);
    await s.close();
    assert.equal(api.state.started, 0);
  });

  test('offline with a check under 7 days old: the tool runs', async () => {
    const f = fixture();
    seed(f, VALID, { age: 3 * DAY, pro: true });
    const s = start(f, { DISSOLVE_API_URL: 'http://127.0.0.1:9' });
    const { text, isError } = await s.call('get_variant', { name: 'dust' });
    assert.equal(isError, false);
    assert.match(text, /^# dust/);
    await s.close();
  });

  test('API down with a stale check: the sign-in text', async () => {
    const f = fixture();
    seed(f, VALID, { age: 8 * DAY, pro: true });
    api.state.meDown = true;
    const s = start(f);
    assert.equal((await s.call('get_variant', { name: 'dust' })).text, signIn(api.url));
    await s.close();
    assert.equal(api.state.started, 1);
  });

  test('offline with a stale check: the sign-in text, saying the site could not be reached', async () => {
    const f = fixture();
    seed(f, VALID, { age: 8 * DAY, pro: true });
    const s = start(f, { DISSOLVE_API_URL: 'http://127.0.0.1:9' });
    const { text, isError } = await s.call('get_variant', { name: 'dust' });
    assert.equal(isError, false);
    assert.equal(
      text,
      'dissolve needs a free account to work in your agent, and 127.0.0.1:9 could not be reached right now. Check the connection and ask me again, or run `npx dissolve-ui login` in a terminal.',
    );
    await s.close();
  });

  for (const [k, v] of [['DISSOLVE_TELEMETRY', '0'], ['DO_NOT_TRACK', '1']]) {
    test(`${k}=${v}: no usage event`, async () => {
      const f = fixture();
      seed(f, VALID);
      const s = start(f, { [k]: v });
      assert.match((await s.call('get_variant', { name: 'dust' })).text, /^# dust/);
      await s.close();
      assert.equal(meCalls(), 1);
      assert.deepEqual(api.state.events, []);
    });
  }
});

describe('MCP pro pairing hint', () => {
  test('a free user installing toggle gets one line about settings-group', async () => {
    const f = fixture();
    seed(f, NOPAY);
    const s = start(f);
    const { text } = await s.call('add_component', { name: 'toggle', cwd: f.cwd, platform: 'native' });
    assert.match(text, /added\s+components\/dissolve\/toggle\.tsx/);
    assert.ok(text.endsWith(`\n\nPairs well with settings-group, a ready-made settings screen in dissolve pro: ${api.url}/pro`), text);
    await s.close();
    assert.deepEqual(api.state.events.map((e) => [e.tool, e.item]), [['add_component', 'toggle']]);
  });

  test('a pro user gets no hint', async () => {
    const f = fixture();
    seed(f, VALID);
    const s = start(f);
    const { text } = await s.call('add_component', { name: 'toggle', cwd: f.cwd, platform: 'native' });
    assert.match(text, /added\s+components\/dissolve\/toggle\.tsx/);
    assert.doesNotMatch(text, /Pairs well/);
    await s.close();
  });

  test('no hint for a component without a pro pair', async () => {
    const f = fixture();
    seed(f, NOPAY);
    const s = start(f);
    const { text } = await s.call('add_component', { name: 'marquee', cwd: f.cwd, platform: 'native' });
    assert.doesNotMatch(text, /Pairs well/);
    await s.close();
  });
});
