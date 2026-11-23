// A local stand-in for the dissolve pro API (CONTRACT.md), for the CLI and MCP tests.
//   Bearer dsv_VALID  -> pro items, /api/me with an active plan
//   Bearer dsv_NOPAY  -> 402 { checkout_url }
//   anything else     -> 401
// The device login confirms after `confirmAfter` polls and hands out dsv_VALID.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

export const VALID = 'dsv_VALID0000000000000000000000000000';
export const NOPAY = 'dsv_NOPAY0000000000000000000000000000';
export const USER_CODE = 'ABCD-EFGH';
export const CHECKOUT_URL = 'https://dissolve.rselmi.com/pro';

export const PAYWALL = {
  name: 'paywall',
  type: 'registry:block',
  title: 'Paywall',
  description: 'A paywall screen.',
  pro: true,
  dependencies: ['expo-blur@~57.0.3'],
  registryDependencies: ['https://dissolve.rselmi.com/r/native/slide-to-confirm.json', 'https://dissolve.rselmi.com/r/dissolve-theme.json', 'paywall-badge'],
  files: [
    {
      path: 'registry-pro/paywall.tsx',
      type: 'registry:block',
      target: 'components/dissolve/paywall.tsx',
      content: "import { BlurView } from 'expo-blur';\nimport { SlideToConfirm } from './slide-to-confirm';\nimport { PaywallBadge } from './paywall-badge';\n\nexport function Paywall() {\n  return null;\n}\n",
    },
  ],
};

const ITEMS = {
  paywall: PAYWALL,
  'paywall-badge': {
    name: 'paywall-badge',
    type: 'registry:component',
    pro: true,
    files: [{ path: 'registry-pro/paywall-badge.tsx', type: 'registry:component', content: 'export function PaywallBadge() {\n  return null;\n}\n' }],
  },
  evil: {
    name: 'evil',
    type: 'registry:component',
    pro: true,
    files: [{ path: 'evil.tsx', target: '../../escaped.tsx', type: 'registry:component', content: 'nope' }],
  },
};

export const INDEX = [
  { name: 'paywall', title: 'Paywall', description: 'A paywall screen.', kind: 'block', video: '', poster: '', platforms: ['native'] },
  { name: 'paywall-badge', title: 'Paywall badge', description: 'Pro badge.', kind: 'component', video: '', poster: '', platforms: ['native', 'web'] },
];

export async function mockApi({ confirmAfter = 2 } = {}) {
  const state = { requests: [], polls: 0, started: 0, clientNames: [] };
  const body = (req) => new Promise((r) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => r(b)); });
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const auth = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    state.requests.push({ method: req.method, path: url.pathname, query: url.search, auth });
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    const item = url.pathname.match(/^\/api\/pro\/([\w-]+)\.json$/);
    if (url.pathname === '/api/pro/index.json') return json(200, INDEX);
    if (item) {
      // Like the real API: an unknown name is a 404 before the token is checked.
      if (!ITEMS[item[1]]) return json(404, { error: 'not found' });
      if (auth === NOPAY) return json(402, { checkout_url: CHECKOUT_URL });
      if (auth !== VALID) return json(401, { error: 'unauthorized' });
      return json(200, ITEMS[item[1]]);
    }
    if (url.pathname === '/api/me') {
      if (auth === VALID) return json(200, { user: { id: 'u1', email: 'vibe@example.com', name: 'Vibe' }, pro: true, plan: 'month' });
      if (auth === NOPAY) return json(200, { user: { id: 'u2', email: 'free@example.com', name: 'Free' }, pro: false, plan: null });
      return json(200, { user: null, pro: false, plan: null });
    }
    if (url.pathname === '/api/device/start' && req.method === 'POST') {
      state.started++;
      state.clientNames.push(JSON.parse((await body(req)) || '{}').client_name);
      return json(200, { device_code: 'dev_123', user_code: USER_CODE, verify_url: `${base}/activate?code=${USER_CODE}`, interval: 0.05, expires_in: 900 });
    }
    if (url.pathname === '/api/device/poll') {
      const code = url.searchParams.get('device_code');
      if (!code) return json(400, { error: 'missing device_code' });
      if (code !== 'dev_123') return json(404, { error: 'unknown code' });
      if (state.delivered) return json(410, { error: 'expired' });
      if (++state.polls < confirmAfter) return json(202, { pending: true });
      state.delivered = true;
      return json(200, { token: VALID });
    }
    json(404, { error: 'not found' });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    url: base,
    state,
    reset: (opts = {}) => {
      state.requests.length = 0;
      state.polls = 0;
      state.delivered = false;
      state.started = 0;
      state.clientNames.length = 0;
      if (opts.confirmAfter) confirmAfter = opts.confirmAfter;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Async spawn (the mock server lives in this process, so spawnSync would block it). */
export function runNode(args, { cwd, env, timeout = 30000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out: out.replace(/\x1b\[[0-9;]*m/g, '') });
    });
  });
}
