// Theme tokens: every light token has a dark value and a Tailwind color mapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { read, REGISTRY_DIR } from './helpers.mjs';

const css = read(join(REGISTRY_DIR, 'theme.css')).replace(/\/\*[\s\S]*?\*\//g, '');

/** Body of the first `{ ... }` block opened at index `from` (brace balanced). */
function blockAt(text, from) {
  const open = text.indexOf('{', from);
  assert.ok(open !== -1, 'block opening brace');
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  assert.fail('unbalanced braces in theme.css');
}

const decls = (body, prefix) => new Map([...body.matchAll(new RegExp(`(${prefix}[a-z0-9-]+)\\s*:\\s*([^;]+);`, 'g'))].map((m) => [m[1], m[2].trim()]));

const darkAt = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/);
const lightAt = css.search(/(^|\n)\s*:root\s*\{/);
const themeAt = css.search(/@theme\s+inline/);

const light = decls(blockAt(css, lightAt), '--dissolve-');
const dark = decls(blockAt(css, darkAt), '--dissolve-');
const mapped = decls(blockAt(css, themeAt), '--color-dissolve-');

test('theme.css has a light :root, a dark media block and @theme inline', () => {
  assert.ok(lightAt !== -1 && lightAt < darkAt, 'light :root comes first');
  assert.ok(darkAt !== -1, 'prefers-color-scheme: dark block');
  assert.ok(themeAt !== -1, '@theme inline block');
  assert.ok(light.size > 0, 'light tokens');
});

test('every light token has a dark value', () => {
  const missing = [...light.keys()].filter((k) => !dark.has(k));
  assert.deepEqual(missing, [], `tokens without a dark value: ${missing.join(', ')}`);
});

test('dark mode does not introduce tokens missing in light', () => {
  const extra = [...dark.keys()].filter((k) => !light.has(k));
  assert.deepEqual(extra, [], `dark only tokens: ${extra.join(', ')}`);
});

test('every token is mapped to a --color-dissolve-* utility', () => {
  const problems = [];
  for (const token of light.keys()) {
    const color = token.replace('--dissolve-', '--color-dissolve-');
    if (!mapped.has(color)) problems.push(`${color} missing`);
    else if (mapped.get(color) !== `var(${token})`) problems.push(`${color}: ${mapped.get(color)} should be var(${token})`);
  }
  for (const color of mapped.keys()) if (!light.has(color.replace('--color-dissolve-', '--dissolve-'))) problems.push(`${color} maps an unknown token`);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('token values are colors', () => {
  for (const [k, v] of [...light, ...dark]) assert.match(v, /^(rgb|rgba|hsl|hsla|oklch|oklab|color)\(|^#[0-9a-fA-F]{3,8}$/, `${k}: ${v}`);
});
