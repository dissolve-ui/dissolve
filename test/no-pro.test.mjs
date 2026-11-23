// Guard for the public repo: dissolve pro code, local agent state and secrets never land here.
// Pro sources live in the private repository. Checks every file git would commit: tracked files plus
// untracked ones that are not ignored. The patterns are assembled from pieces so this file does not
// match itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { existsSync, ROOT } from './helpers.mjs';

/** Paths that only exist in the private repo or on a maintainer machine. */
const FORBIDDEN_PATHS = [
  ['pro registry', /(^|\/)registry-pro\//],
  ['pro folder (src/demos/_pro/ or any _pro/)', /(^|\/)_pro\//],
  ['local agent state', /(^|\/)\.claude\//],
];

/** Content that marks a pro item or a pro file. */
const PRO_MARKERS = [
  ['a quoted pro key set to true', new RegExp('"pro"\\s*:\\s*' + 'true\\b')],
  ['the pro file header', new RegExp('from dissolve ' + 'pro \\(dissolve-ui\\)', 'i')],
];

/** Secret shapes: Stripe, Google OAuth, Resend. */
const SECRETS = [
  ['a Stripe live secret key', new RegExp('sk' + '_live_')],
  ['a Stripe live restricted key', new RegExp('rk' + '_live_')],
  ['a Stripe test secret key', new RegExp('sk' + '_test_[A-Za-z0-9]{20,}')],
  ['a Stripe webhook secret', new RegExp('wh' + 'sec_')],
  ['a Google OAuth client secret', new RegExp('GOC' + 'SPX-')],
  // Resend keys are re_<id>_<secret>: underscores count, so a real key matches too.
  ['a Resend API key', new RegExp('(?<![A-Za-z0-9_])r' + 'e_[A-Za-z0-9_]{20,}')],
];

function repoFiles() {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ls-files failed: ${r.stderr}`);
  return [...new Set(r.stdout.split('\0').filter(Boolean))];
}

/** True for objects or arrays that hold a { pro: true } item at any depth. */
function hasProItem(value) {
  if (Array.isArray(value)) return value.some(hasProItem);
  if (value && typeof value === 'object') return value.pro === true || Object.values(value).some(hasProItem);
  return false;
}

const files = repoFiles();

test('the file list is not empty', () => {
  assert.ok(files.includes('package.json'), 'git ls-files did not list the repo');
});

test('no pro, agent state or private paths', () => {
  const hits = files.flatMap((f) => FORBIDDEN_PATHS.filter(([, re]) => re.test(f)).map(([what]) => `${f}: ${what}`));
  assert.deepEqual(hits, [], `these paths belong in the private repo, never here:\n  ${hits.join('\n  ')}`);
});

test('no pro items, pro headers or secrets in any file', () => {
  const hits = [];
  for (const f of files) {
    const abs = join(ROOT, f);
    if (!existsSync(abs)) continue; // deleted in the working tree
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8000).includes(0)) continue; // binary
    const text = buf.toString('utf8');
    for (const [what, re] of [...PRO_MARKERS, ...SECRETS]) {
      const m = re.exec(text);
      if (m) hits.push(`${f}:${text.slice(0, m.index).split('\n').length}: ${what}`);
    }
    if (f.endsWith('.json')) {
      let json;
      try { json = JSON.parse(text); } catch { continue; }
      if (hasProItem(json)) hits.push(`${f}: a JSON item with pro set to true`);
    }
  }
  assert.deepEqual([...new Set(hits)], [], `pro code or a secret, remove it (and rotate the secret):\n  ${hits.join('\n  ')}`);
});
