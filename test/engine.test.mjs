// Pure engine logic (no native modules): presets and the variant registry wiring.
// presets.ts is loaded with Node's TypeScript type stripping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { read, ROOT } from './helpers.mjs';

const ENGINE = join(ROOT, 'src', 'dissolve');
const { PRESETS, PRESET_ID, DEFAULT_GRAIN, PRESET_INFO, isPreset } = await import(join(ENGINE, 'presets.ts'));

test('presets have unique, dense ids', () => {
  const ids = PRESETS.map((p) => PRESET_ID[p]).sort((a, b) => a - b);
  assert.deepEqual(ids, PRESETS.map((_, i) => i));
});

test('every preset has a default grain and a description', () => {
  for (const p of PRESETS) {
    assert.ok(DEFAULT_GRAIN[p] > 0, `${p} grain`);
    assert.ok(PRESET_INFO[p]?.length > 0, `${p} info`);
  }
  assert.deepEqual(Object.keys(DEFAULT_GRAIN).sort(), [...PRESETS].sort());
  assert.deepEqual(Object.keys(PRESET_INFO).sort(), [...PRESETS].sort());
});

test('isPreset narrows only the classic presets', () => {
  for (const p of PRESETS) assert.equal(isPreset(p), true);
  for (const v of ['snap', 'melt', 'morph', 'nope']) assert.equal(isPreset(v), false);
});

test('every VariantName is registered and exported', () => {
  const types = read(join(ENGINE, 'types.ts'));
  const union = types.match(/export type VariantName\s*=([\s\S]*?);/)[1];
  const names = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= PRESETS.length);
  const registry = read(join(ENGINE, 'variants', 'registry.ts'));
  const body = registry.match(/export const REGISTRY[^=]*=\s*\{([\s\S]*?)\};/)[1];
  const keys = [...body.matchAll(/^\s*([a-zA-Z]+)\s*(?::|,)/gm)].map((m) => m[1]);
  assert.deepEqual([...keys].sort(), [...names].sort(), 'REGISTRY keys match VariantName');
});

