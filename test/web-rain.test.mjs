// The web grain engine (registry/web/engine.ts), loaded with Node's type stripping.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

register('./ts-loader.mjs', import.meta.url);
const { play } = await import('../registry/web/engine.ts');

// Record source rectangles at DPR 1 with the public scrub handle driving the frame loop.
test('rain batches settled neighbours in paint order and can scrub back out of a batch', () => {
  let frame;
  const crops = [];
  const ctx = {
    setTransform() {}, clearRect() {},
    drawImage(_source, sx, sy, w, h) { crops.push([sx, sy, w, h]); },
  };
  const element = () => ({ style: {}, setAttribute() {}, getContext: () => ctx });
  Object.assign(globalThis, {
    document: { createElement: element, createElementNS: element, body: { appendChild() {} } },
    window: {}, innerWidth: 100, innerHeight: 100, scrollX: 0, scrollY: 0,
    addEventListener() {}, requestAnimationFrame(fn) { frame = fn; },
  });

  const h = play({ preset: 'rain', source: element(), x: 0, y: 0, w: 9, h: 6, hold: true });
  function render(p) {
    crops.length = 0;
    h.set(p);
    frame(100);
    return crops;
  }
  assert.deepEqual(render(1.18), [[0, 0, 9, 3], [0, 3, 9, 3]]);
  assert.deepEqual(render(0), []);
  // At this progress all three bottom cells have landed and all three top cells are moving.
  assert.deepEqual(render(0.83), [[0, 0, 3, 3], [3, 0, 3, 3], [6, 0, 3, 3], [0, 3, 9, 3]]);
  globalThis.scrollX = 0.5;
  assert.equal(render(1.18).length, 6);
  h.cancel();
  frame(100);
});
