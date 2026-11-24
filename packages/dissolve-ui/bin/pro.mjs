/**
 * dissolve pro client, shared by the CLI (dissolve-ui) and the MCP server (dissolve-ui-mcp).
 * No dependencies: Node 18+ fetch.
 *
 * API base: https://dissolve.rselmi.com, or env DISSOLVE_API_URL.
 * Token: env DISSOLVE_TOKEN, else ~/.config/dissolve/auth.json { "token": "dsv_..." } (mode 600).
 * A device login in progress is kept in ~/.config/dissolve/device.json, so a second run (or the
 * MCP server after a restart) picks up the same code instead of starting a new one.
 */
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_API_URL = 'https://dissolve.rselmi.com';

export const apiUrl = () => (process.env.DISSOLVE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
export const configDir = () => join(homedir(), '.config', 'dissolve');
export const authFile = () => join(configDir(), 'auth.json');
const deviceFile = () => join(configDir(), 'device.json');

/** Item names are plain slugs, so a name can never escape /api/pro/. */
export const isItemName = (name) => typeof name === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(name);

/** Thrown when the API cannot be reached (offline, DNS, timeout). */
export class OfflineError extends Error {}

/* ---------- Token storage ---------- */

function readJSON(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writePrivate(file, data) {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  // writeFileSync keeps the mode of an existing file: force it.
  chmodSync(file, 0o600);
}

/** { token, source: 'env' | 'file' } or null. */
export function readToken() {
  const env = process.env.DISSOLVE_TOKEN?.trim();
  if (env) return { token: env, source: 'env' };
  const token = readJSON(authFile())?.token;
  return typeof token === 'string' && token ? { token, source: 'file' } : null;
}

export const saveToken = (token) => writePrivate(authFile(), { token });

/** Removes the saved token. Returns true when there was one. */
export function clearToken() {
  const had = existsSync(authFile());
  rmSync(authFile(), { force: true });
  return had;
}

/* ---------- HTTP ---------- */

/** fetch with a timeout. Resolves { status, body } (body is parsed JSON or null). */
export async function request(path, { token, method = 'GET', body, timeout = 15000 } = {}) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(apiUrl() + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    throw new OfflineError(`Could not reach ${apiUrl()} (${e?.cause?.code ?? e?.name ?? 'network error'}).`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

/** The pro catalog (no code), or null when the API cannot be reached. */
export async function proIndex({ timeout = 4000 } = {}) {
  try {
    const { status, body } = await request('/api/pro/index.json', { timeout });
    if (status !== 200) return null;
    const list = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : null;
    return list?.filter((x) => x && isItemName(x.name)) ?? null;
  } catch (e) {
    if (e instanceof OfflineError) return null;
    throw e;
  }
}

/**
 * One pro item. Resolves one of:
 *   { status: 'ok', item }   { status: 'login' } (401)   { status: 'pay', checkout_url } (402)
 *   { status: 'missing' } (404)   { status: 'error', code }
 * Throws OfflineError when the API cannot be reached.
 * platform ('native' | 'web') is sent as a hint for items that ship both versions.
 */
export async function proItem(name, { token, platform } = {}) {
  if (!isItemName(name)) return { status: 'missing' };
  const query = platform ? `?platform=${encodeURIComponent(platform)}` : '';
  const { status, body } = await request(`/api/pro/${encodeURIComponent(name)}.json${query}`, { token });
  if (status === 200 && body && Array.isArray(body.files)) return { status: 'ok', item: body };
  if (status === 401) return { status: 'login' };
  if (status === 402) return { status: 'pay', checkout_url: body?.checkout_url ?? `${apiUrl()}/pro` };
  if (status === 404) return { status: 'missing' };
  return { status: 'error', code: status };
}

/** GET /api/me with the token: { user, pro, plan }, or null when the token is not accepted. */
export async function me(token) {
  const { status, body } = await request('/api/me', { token });
  if (status !== 200 || !body?.user) return null;
  return body;
}

/* ---------- Device login ---------- */

/** The device login in progress, or null when there is none or it expired. */
export function pendingLogin() {
  const p = readJSON(deviceFile());
  if (!p?.device_code || !p.user_code || !p.verify_url || !(p.expires_at > Date.now())) return null;
  return p;
}

export const clearPendingLogin = () => rmSync(deviceFile(), { force: true });

/**
 * POST /api/device/start, saved so a later run can keep polling the same code.
 * client_name becomes the token's name in the account (e.g. "dissolve-ui CLI on my-mac").
 */
export async function startLogin(clientName) {
  const { status, body } = await request('/api/device/start', { method: 'POST', body: clientName ? { client_name: clientName } : {} });
  if (status !== 200 || !body?.device_code || !body.user_code || !body.verify_url) {
    throw new Error(`Could not start the dissolve login (HTTP ${status}). Try again in a moment.`);
  }
  const pending = {
    device_code: body.device_code,
    user_code: body.user_code,
    verify_url: body.verify_url,
    interval: Number(body.interval) >= 0 ? Number(body.interval) : 5,
    expires_at: Date.now() + (Number(body.expires_in) > 0 ? Number(body.expires_in) : 900) * 1000,
  };
  writePrivate(deviceFile(), pending);
  return pending;
}

/** The login in progress, or a new one. */
export const ensureLogin = async (clientName) => pendingLogin() ?? startLogin(clientName);

/**
 * One poll. Resolves 'pending', 'expired', or the token (already saved).
 * 202 pending, 200 { token }, 410 expired or already delivered, 404 unknown code, 400 no code.
 */
export async function pollLogin(pending) {
  if (!(pending.expires_at > Date.now())) {
    clearPendingLogin();
    return 'expired';
  }
  const { status, body } = await request(`/api/device/poll?device_code=${encodeURIComponent(pending.device_code)}`);
  if (status === 200 && typeof body?.token === 'string') {
    saveToken(body.token);
    clearPendingLogin();
    return { token: body.token };
  }
  if (status === 410 || status === 404 || status === 400) {
    clearPendingLogin();
    return 'expired';
  }
  return 'pending';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Polls until the user confirms, the code expires, or maxWait ms pass.
 * Resolves { token } | 'expired' | 'timeout'. Network hiccups are retried.
 */
export async function waitForLogin(pending, { maxWait = Infinity } = {}) {
  const until = Math.min(pending.expires_at, Date.now() + maxWait);
  const every = Math.max(pending.interval, 0.05) * 1000;
  while (Date.now() < until) {
    await sleep(every);
    try {
      const r = await pollLogin(pending);
      if (r !== 'pending') return r;
    } catch (e) {
      if (!(e instanceof OfflineError)) throw e;
    }
  }
  return pending.expires_at > Date.now() ? 'timeout' : 'expired';
}

/* ---------- Browser ---------- */

/** Best effort: opens url in the default browser. Off with DISSOLVE_NO_BROWSER=1 or in CI. */
export function openBrowser(url) {
  if (process.env.DISSOLVE_NO_BROWSER || process.env.CI || !/^https?:\/\//.test(url)) return false;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
