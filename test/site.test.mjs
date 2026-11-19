// Component pages of the site: a short subtitle (the long description lives under How it works) and
// an install command that follows the React Native / React switch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { read, registryIndex, REGISTRY_DIR, ROOT, existsSync } from './helpers.mjs';

const CP_DIR = join(ROOT, 'web', 'cp');
const APP = read(join(ROOT, 'web', 'app.js'));
const NOTE_MAX = 90;

/** The `'<name>': { ... }` (or `<name>: { ... }`) entry of a web/cp file, brace balanced. */
function entry(name) {
  for (const f of readdirSync(CP_DIR).filter((x) => x.endsWith('.js'))) {
    const src = read(join(CP_DIR, f));
    const at = src.search(new RegExp(`\\n\\s*'?${name}'?:\\s*\\{`));
    if (at === -1) continue;
    const open = src.indexOf('{', at);
    for (let i = open, depth = 0; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/** A string field of an entry ('...' or `...`, single line). */
const field = (src, key) => src.match(new RegExp(`\\n\\s*${key}:\\s*(['\`])((?:\\\\.|(?!\\1).)*)\\1`))?.[2];

describe('component pages', () => {
  for (const { name } of registryIndex()) {
    test(`${name}: short subtitle and a description`, () => {
      const src = entry(name);
      assert.ok(src, `${name} has a site entry in web/cp`);
      const note = field(src, 'note');
      assert.ok(note, `${name} has a note (the page subtitle)`);
      assert.ok(note.length <= NOTE_MAX, `${name} note is ${note.length} chars, keep it under ${NOTE_MAX}`);
      assert.doesNotMatch(note, /\u2014/, 'no em dash');
      assert.ok((field(src, 'desc') ?? '').length > note.length, `${name} desc holds the details`);
    });
  }

  test('the page subtitle is the note, the description sits under How it works', () => {
    assert.match(APP, /pageHead\(id, c\.title, c\.note,/);
    assert.match(APP, /How it works<\/h2>\s*<p class="dc-text">\$\{c\.desc\}<\/p>/);
  });

  test('the add command carries the platform flag of the switch', () => {
    assert.match(APP, /const addFor = \(p\) => cmd\(`\$\{snip\.add\} --\$\{p\}`\)/);
    for (const p of ['native', 'web']) assert.match(APP, new RegExp(`addFor\\('${p}'\\)`), `${p} command rendered`);
  });

  test('every component with a web wrapper shows the React switch', () => {
    for (const { name } of registryIndex()) {
      if (!existsSync(join(REGISTRY_DIR, 'web', `${name}.tsx`))) continue;
      assert.match(read(join(ROOT, 'web', 'lib', 'available.js')), new RegExp(`['"]${name}['"]`), `${name} listed as web ready`);
    }
  });
});
