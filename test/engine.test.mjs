// Pure engine logic (no native modules): grain math, params, easing, variant timing budgets,
// rest poses and the wiring of the variant names. The engine's .ts files are loaded with
// Node's type stripping, ts-loader.mjs resolves their extensionless imports and stubs the
// native packages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { read, ROOT } from './helpers.mjs';

register('./ts-loader.mjs', import.meta.url);

const ENGINE = join(ROOT, 'src', 'dissolve');
const load = (rel) => import(pathToFileURL(join(ENGINE, rel)).href);

const math = await load('math.ts');
const { MAX_GRAINS, DEFAULT_END, capGrain, clampDelay, buildParams, burstGeometry, originField, ss, eo, backOut, clamp01 } = math;

// Atlas variants that live in plain .ts files (melt's atlas sits in melt.tsx, JSX cannot be stripped).
const classic = await load('variants/classic.ts');
const { snap } = await load('variants/snap.ts');
const { fling } = await load('variants/fling.ts');
const { stream } = await load('variants/stream.ts');
const { gather, rain, print } = await load('variants/assemble.ts');
const { charge } = await load('variants/charge.ts');
const { peel } = await load('variants/peel.ts');
const { cascadeField } = await load('variants/cascade.ts');

const ATLAS = [classic.dust, classic.sand, classic.ember, classic.pixel, classic.vortex, snap, fling, stream, gather, rain, print, charge, peel];
const BASE_STRIDE = 8;
const EPS = 1e-9;

/** Variant names of the VariantName union in types.ts. */
function variantNames() {
  const types = read(join(ENGINE, 'types.ts'));
  const union = types.match(/export type VariantName\s*=([\s\S]*?);/)[1];
  return [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
}

/** Deterministic pseudo random numbers (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOXES = [
  { x: 0, y: 0, width: 40, height: 40 },
  { x: 16, y: 120, width: 358, height: 72 },
  { x: 0, y: 0, width: 390, height: 844 },
  { x: 200, y: 300, width: 12, height: 260 },
];

/** Inputs a variant may receive: plain, with origins, with a velocity, with a target, both directions. */
function inputs(v) {
  const out = [];
  for (const box of BOXES) {
    const base = { ...box, duration: 1200 };
    out.push(base);
    for (const origin of ['left', 'right', 'top', 'bottom', 'center', { x: box.width * 0.2, y: box.height * 0.9 }]) out.push({ ...base, origin });
    for (const velocity of [{ x: 0, y: 0 }, { x: 300, y: -40 }, { x: -6000, y: 2500 }]) out.push({ ...base, velocity });
    out.push({ ...base, target: { x: 180, y: 780, width: 30, height: 30 } });
    out.push({ ...base, n: [2, 0, 0, 0] });
    if (v.natural === 'both') {
      out.push({ ...base, direction: 'in', target: { x: 10, y: 10, width: 24, height: 24 } });
      out.push({ ...base, direction: 'out', target: { x: 10, y: 10, width: 24, height: 24 } });
    }
  }
  return out;
}

/** Grain seeds sampled over the grid, random draws plus the extremes 0 and almost 1. */
function seeds(P, rand) {
  const out = [];
  const extremes = [0, 0.999999];
  const step = Math.max(1, Math.floor((P.cols * P.rows) / 400));
  for (let i = 0; i < P.cols * P.rows; i += step) {
    const col = i % P.cols;
    const row = Math.floor(i / P.cols);
    const lx = (col + 0.5) * P.grain;
    const ly = (row + 0.5) * P.grain;
    // Centers outside the view (rounded up last column or row) are clamped by the engine.
    if (lx > P.w || ly > P.h) continue;
    out.push({ i, col, row, lx, ly, r1: rand(), r2: rand(), r3: rand(), r4: rand() });
    for (const e of extremes) out.push({ i, col, row, lx, ly, r1: e, r2: e, r3: e, r4: e });
  }
  return out;
}

/** Same delay rule as Particles: field, else the generic origin field, else the variant's own. */
function delayOf(v, g, P, b, tm, end, field) {
  if (field) return field(g, P, b, tm.life, end);
  if (P.hasOrigin === 1 && !v.ownsOrigin) return originField(b.origin, g.lx, g.ly, P) * (v.spread ?? 0.55) + g.r1 * (v.jitter ?? 0.08);
  return tm.delay;
}

test('capGrain keeps the grid under the cap and only ever raises the grain', () => {
  const rand = rng(1);
  for (let i = 0; i < 2000; i++) {
    const w = 1 + rand() * 1200;
    const h = 1 + rand() * 1200;
    const grain = 0.5 + rand() * 12;
    const max = rand() < 0.5 ? MAX_GRAINS : 100 + Math.floor(rand() * 8000);
    const g = capGrain(w, h, grain, max);
    assert.ok(g >= grain, 'never lowers the grain');
    assert.ok((w * h) / (g * g) <= max + 1e-6, `area / grain^2 <= ${max} (${w}x${h} -> ${g})`);
    if (g !== grain) assert.equal(g * 2, Math.round(g * 2), 'raised grains snap to half points');
  }
  assert.equal(capGrain(100, 100, 3), 3, 'small views keep their grain');
  assert.equal(capGrain(390, 844, 1), 7.5);
  assert.equal(MAX_GRAINS, 6000);
});

test('buildParams: grid, origins, slots and target center', () => {
  const b = { x: 10, y: 20, width: 100, height: 50, duration: 1500, n: [1, 2] };
  const P = buildParams(b, 3, 3);
  assert.equal(P.cols, 34);
  assert.equal(P.rows, 17);
  assert.equal(P.sec, 1.5);
  assert.equal(P.dir, 0);
  assert.equal(P.hasOrigin, 0);
  assert.deepEqual([P.ox, P.oy], [50, 25], 'origin defaults to the center');
  assert.ok(Math.abs(P.maxD - Math.hypot(50, 25)) < EPS);
  assert.ok(Math.abs(P.maxR - Math.hypot(50, 25)) < EPS);
  assert.deepEqual([P.n0, P.n1, P.n2, P.n3], [1, 2, 0, 0]);
  assert.deepEqual([P.tx, P.ty, P.tw, P.th, P.vx, P.vy], [0, 0, 0, 0, 0, 0]);

  const L = buildParams({ ...b, origin: 'left', direction: 'in', target: { x: 0, y: 0, width: 20, height: 10 }, velocity: { x: 5, y: 6 } }, 3, 3);
  assert.deepEqual([L.ox, L.oy, L.hasOrigin, L.dir], [0, 25, 1, 1]);
  assert.ok(Math.abs(L.maxD - Math.hypot(100, 25)) < EPS);
  assert.deepEqual([L.tx, L.ty, L.tw, L.th, L.vx, L.vy], [10, 5, 20, 10, 5, 6]);

  const pt = buildParams({ ...b, origin: { x: 0, y: 0 } }, 3, 3);
  assert.ok(Math.abs(pt.maxD - Math.hypot(100, 50)) < EPS, 'a corner origin reaches the opposite corner');
});

test('originField stays in 0..1 and is 0 at the origin', () => {
  const b = { x: 0, y: 0, width: 120, height: 80, duration: 1000 };
  for (const origin of ['left', 'right', 'top', 'bottom', 'center', { x: 30, y: 70 }]) {
    const P = buildParams({ ...b, origin }, 3, 3);
    for (let lx = 0; lx <= 120; lx += 6) {
      for (let ly = 0; ly <= 80; ly += 4) {
        const f = originField(origin, lx, ly, P);
        assert.ok(f >= -EPS && f <= 1 + EPS, `${JSON.stringify(origin)} at ${lx},${ly}: ${f}`);
      }
    }
    if (typeof origin === 'object') assert.equal(originField(origin, 30, 70, P), 0);
  }
  assert.equal(originField('left', 0, 10, buildParams(b, 3, 3)), 0);
  assert.equal(originField('right', 120, 10, buildParams(b, 3, 3)), 0);
});

test('burstGeometry: default direction, grain cap, pixel ratio and overrides', () => {
  const b = { x: 0, y: 0, width: 390, height: 844, duration: 1000 };
  const out = burstGeometry(b, { defaultGrain: 3 }, 1170);
  assert.equal(out.direction, 'out');
  assert.equal(out.grain, capGrain(390, 844, 3));
  assert.equal(out.params.pr, 3);
  assert.equal(burstGeometry(b, { defaultGrain: 3, natural: 'in' }, 390).direction, 'in');
  assert.equal(burstGeometry(b, { defaultGrain: 3, natural: 'both' }, 390).direction, 'out');
  assert.equal(burstGeometry({ ...b, direction: 'out' }, { defaultGrain: 3, natural: 'in' }, 390).params.dir, 0);
  const o = burstGeometry({ ...b, width: 50, height: 50, grain: 5, paramsOverride: { vx: 99 } }, { defaultGrain: 3 }, 100);
  assert.equal(o.grain, 5);
  assert.equal(o.params.vx, 99);
});

test('easing helpers hit their end points', () => {
  for (const f of [ss, eo, backOut]) {
    assert.ok(Math.abs(f(0)) < EPS, `${f.name}(0)`);
    assert.ok(Math.abs(f(1) - 1) < EPS, `${f.name}(1)`);
  }
  assert.equal(ss(0.5), 0.5);
  assert.ok(eo(0.5) > 0.5, 'ease out is ahead at half time');
  assert.ok(backOut(0.8) > 1, 'backOut overshoots');
  assert.deepEqual([clamp01(-1), clamp01(0.3), clamp01(2)], [0, 0.3, 1]);
});

test('every grain of every atlas variant starts at or after 0 and ends by the timeline end', () => {
  const rand = rng(7);
  for (const v of ATLAS) {
    const end = v.end ?? DEFAULT_END;
    for (const input of inputs(v)) {
      const { params: P } = burstGeometry(input, v, input.width * 3);
      const burst = { ...input, variant: v.name };
      for (const field of [undefined, cascadeField]) {
        for (const rows of field ? [undefined, Array.from({ length: 30 }, (_, i) => i * 24)] : [undefined]) {
          const b = { ...burst, rowBounds: rows };
          for (const g of seeds(P, rand)) {
            const tm = v.timing(g, P);
            const delay = delayOf(v, g, P, b, tm, end, field);
            const where = `${v.name} ${input.width}x${input.height} ${JSON.stringify(input.origin ?? input.velocity ?? input.direction ?? '')} field=${!!field} grain ${g.i}`;
            assert.ok(tm.life > 0, `${where}: life > 0`);
            assert.ok(delay >= -EPS, `${where}: delay ${delay} >= 0`);
            assert.ok(delay + tm.life <= end + EPS, `${where}: delay ${delay} + life ${tm.life} <= end ${end}`);
          }
        }
      }
    }
  }
});

test('clampDelay keeps edge grains inside the timeline', () => {
  assert.equal(clampDelay(-0.01, 0.4, 1.2), 0);
  assert.equal(clampDelay(0.3, 0.4, 1.2), 0.3);
  assert.ok(Math.abs(clampDelay(0.85, 0.4, 1.2) - 0.8) < EPS);
  assert.equal(clampDelay(0.2, 1.2, 1.2), 0, 'a life as long as the timeline means no delay');
  // The grain grid is rounded up: the last column's center can sit outside the view.
  const v = classic.vortex;
  const { params: P } = burstGeometry({ x: 0, y: 0, width: 40, height: 40, duration: 1000 }, v, 120);
  const g = { i: 0, col: P.cols - 1, row: P.rows - 1, lx: (P.cols - 0.5) * P.grain, ly: (P.rows - 0.5) * P.grain, r1: 0, r2: 0, r3: 0, r4: 0 };
  const tm = v.timing(g, P);
  assert.ok(tm.delay < 0, 'raw timing goes negative outside the view');
  assert.equal(clampDelay(tm.delay, tm.life, v.end ?? DEFAULT_END), 0);
});

test('each atlas variant leaves the grain at rest at its rest time (t = 0 out, t = 1 in)', () => {
  const rand = rng(11);
  for (const v of ATLAS) {
    const natural = v.natural ?? 'out';
    const tint = v.colorMode === 'tint';
    const stride = BASE_STRIDE + (v.extra ?? 0);
    for (const input of inputs(v)) {
      const iw = input.width * 3;
      const { params: P, direction } = burstGeometry(input, v, iw);
      const burst = { ...input, variant: v.name, direction, params: P, image: { width: () => iw, height: () => input.height * 3 } };
      const count = P.cols * P.rows;
      const d = new Float64Array(count * stride);
      for (let i = 0; i < count; i++) {
        const k = i * stride;
        const g = { i, col: i % P.cols, row: Math.floor(i / P.cols), lx: ((i % P.cols) + 0.5) * P.grain, ly: (Math.floor(i / P.cols) + 0.5) * P.grain, r1: rand(), r2: rand(), r3: rand(), r4: rand() };
        const tm = v.timing(g, P);
        d.set([g.lx, g.ly, g.r1, g.r2, g.r3, g.r4, tm.delay, tm.life], k);
      }
      v.prepare?.(d, stride, count, P, burst);
      const assembles = natural === 'in' || (natural === 'both' && P.dir === 1);
      const t = assembles ? 1 : 0;
      const step = Math.max(1, Math.floor(count / 300));
      for (let i = 0; i < count; i += step) {
        const k = i * stride;
        const cx = P.x + d[k];
        const cy = P.y + d[k + 1];
        const o = { cx, cy, s: 1, rot: 0, r: 1, g: 1, b: 1, a: 1 - ss(t) };
        // Hand driven peel: the pulled point sits on the anchor at rest.
        const a0 = v.name === 'peel' && P.n0 === 1 ? P.n1 : 0;
        const a1 = v.name === 'peel' && P.n0 === 1 ? P.n2 : 0;
        v.step(t, d, k, P, a0, a1, o);
        const where = `${v.name} ${input.width}x${input.height} ${JSON.stringify(input.origin ?? input.velocity ?? input.direction ?? '')} t=${t} grain ${i}`;
        assert.ok(Math.abs(o.cx - cx) < 1e-6 && Math.abs(o.cy - cy) < 1e-6, `${where}: position ${o.cx},${o.cy} vs ${cx},${cy}`);
        assert.ok(Math.abs(o.s - 1) < EPS, `${where}: scale ${o.s}`);
        assert.ok(Math.abs(o.rot) < EPS, `${where}: rotation ${o.rot}`);
        if (tint) {
          assert.ok(o.a <= EPS, `${where}: no tint at rest (a = ${o.a})`);
        } else {
          assert.ok(Math.abs(o.a - 1) < EPS, `${where}: opaque at rest (a = ${o.a})`);
          assert.deepEqual([o.r, o.g, o.b], [1, 1, 1], `${where}: colors untouched`);
        }
      }
    }
  }
});

test('every VariantName is registered and exported', () => {
  const names = variantNames();
  assert.ok(names.length >= 16);
  const registry = read(join(ENGINE, 'variants', 'registry.ts'));
  const body = registry.match(/export const REGISTRY[^=]*=\s*\{([\s\S]*?)\};/)[1];
  const keys = [...body.matchAll(/^\s*([a-zA-Z]+)\s*(?::|,)/gm)].map((m) => m[1]);
  assert.deepEqual([...keys].sort(), [...names].sort(), 'REGISTRY keys match VariantName');
  for (const v of ATLAS) assert.ok(names.includes(v.name), `${v.name} is a VariantName`);
});

test('the MCP server lists every engine variant', () => {
  const server = read(join(ROOT, 'mcp', 'server.mjs'));
  const block = server.match(/const VARIANTS = \[([\s\S]*?)\n\];/)[1];
  const listed = [...block.matchAll(/^\s*name: '([a-z-]+)',/gm)].map((m) => m[1]);
  // Entries that document a hook mode or a delay field rather than a variant.
  const extras = ['scrub', 'cascade', 'screen'];
  const names = variantNames();
  assert.equal(new Set(listed).size, listed.length, 'no duplicate entries');
  for (const n of names) assert.ok(listed.includes(n), `mcp/server.mjs VARIANTS is missing '${n}'`);
  for (const n of listed) assert.ok(names.includes(n) || extras.includes(n), `mcp/server.mjs lists unknown variant '${n}'`);
});
