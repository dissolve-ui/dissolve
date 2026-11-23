// Web cores on a tiny fake DOM, no browser: what layout tools and assistive tech see of the
// NumberTicker wheel, and where the SegmentedControl pill sits before the first painted frame.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers.mjs';

register('./ts-loader.mjs', import.meta.url);

/** Just enough of an element for the cores: tree, attributes, inline style, a fixed size. */
class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.dataset = {};
    this.className = '';
    this.textContent = '';
    this.clientWidth = 0;
    const priority = {};
    this.style = {
      setProperty(k, v, p) { this[k] = v; priority[k] = p ?? ''; },
      getPropertyPriority: (k) => priority[k] ?? '',
      removeProperty(k) { delete this[k]; },
    };
  }
  append(...nodes) { for (const n of nodes) this.insertBefore(n, null); }
  appendChild(n) { this.append(n); return n; }
  insertBefore(n, ref) {
    n.remove();
    n.parent = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at < 0) this.children.push(n); else this.children.splice(at, 0, n);
  }
  replaceChildren(...nodes) { for (const c of [...this.children]) c.remove(); this.append(...nodes); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  toggleAttribute(k, on) { if (on) this.attrs[k] = ''; else delete this.attrs[k]; }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth || 10, height: 20 }; }
  getContext() {
    const noop = () => {};
    return { setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop, arc: noop, fill: noop, getImageData: () => ({ data: [255, 255, 255, 255] }) };
  }
  all(cls) {
    const out = [];
    const walk = (n) => { for (const c of n.children) { if (` ${c.className} `.includes(` ${cls} `)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
}

let frames = [];
let observers = [];
let now = 0;
/** Runs the queued animation frames until none are left, `ms` apart. */
function flush(ms = 16, max = 400) {
  for (let i = 0; i < max && frames.length; i++) {
    now += ms;
    const run = frames;
    frames = [];
    run.forEach((f) => f(now));
  }
}

before(() => {
  const head = new Node('head');
  Object.assign(globalThis, {
    document: { createElement: (t) => new Node(t), getElementById: () => null, head, documentElement: new Node('html') },
    requestAnimationFrame: (f) => frames.push(f),
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    MutationObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() {} },
    devicePixelRatio: 1,
  });
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
});

const load = (name) => import(pathToFileURL(join(ROOT, 'registry', 'web', `${name}.core.ts`)).href);

describe('NumberTicker wheel', () => {
  /** Wheel position of a digit column, from its roll transform. */
  const posOf = (col, lh) => -parseFloat(col.children[0].style.transform.split(',')[1]) / lh;
  const shown = (col) => col.children[0].children.map((c, i) => (c.style.visibility === 'hidden' ? -1 : i)).filter((i) => i >= 0);

  test('the wheel is hidden from assistive tech, the label carries the value', async () => {
    const { createNumberTicker } = await load('number-ticker');
    const host = new Node('div');
    createNumberTicker(host, { value: 1240.5, decimals: 2, locale: 'en-US', prefix: '$' });
    assert.equal(host.getAttribute('aria-label'), '$1,240.50');
    const cols = host.all('dissolve-ticker-col');
    assert.ok(cols.length > 0);
    for (const c of cols) assert.equal(c.getAttribute('aria-hidden'), 'true');
  });

  test('only the cells next to the window are visible, at rest and through a roll both ways', async () => {
    const { createNumberTicker } = await load('number-ticker');
    const host = new Node('div');
    const t = createNumberTicker(host, { value: 1240.5, decimals: 2, locale: 'en-US', fontSize: 30 });
    const lh = Math.round(30 * 1.22);
    const digits = () => host.all('dissolve-ticker-col').filter((c) => c.children[0].children.length > 1);
    const check = () => {
      for (const col of digits()) {
        const pos = posOf(col, lh), vis = shown(col);
        assert.ok(vis.length <= 4, `at most the window and one cell each side, got ${vis.length}`);
        // The cells crossing the clip box are always among the visible ones.
        for (const i of [Math.floor(pos + 1e-6), Math.ceil(pos - 1e-6)]) assert.ok(vis.includes(i), `cell ${i} at pos ${pos}`);
      }
    };
    check();
    t.update({ value: 1987.36 });
    for (let i = 0; i < 80 && frames.length; i++) { flush(16, 1); check(); }
    t.update({ value: 987.1 });
    for (let i = 0; i < 80 && frames.length; i++) { flush(16, 1); check(); }
    assert.equal(host.getAttribute('aria-label'), '987.10');
    // Separators keep their single cell and never roll on a decrease.
    for (const col of host.all('dissolve-ticker-col').filter((c) => c.children[0].children.length === 1)) {
      assert.equal(col.children[0].style.transform, 'translate3d(0,0.00px,0)');
    }
  });
});

describe('SegmentedControl first placement', () => {
  const pillOf = (host) => host.all('dissolve-segmented-pill')[1];

  test('a laid out host gets its pill synchronously, at the selection, never transitioned', async () => {
    const { createSegmentedControl } = await load('segmented-control');
    const host = new Node('div');
    host.clientWidth = 306;
    createSegmentedControl(host, { segments: ['Day', 'Week', 'Month'], defaultValue: 'Week' });
    const pill = pillOf(host);
    // md: inset 3, so each segment is (306 - 6) / 3 = 100 wide and Week starts at 103.
    assert.equal(pill.style.transform, 'translateX(103px)');
    assert.equal(pill.style.width, '100px');
    assert.equal(pill.style.opacity, '1');
    assert.equal(pill.style.visibility, '');
    assert.equal(pill.style.transition, 'none');
    assert.equal(pill.style.getPropertyPriority('transition'), 'important');
  });

  test('a host with no width yet is placed by the resize observer, hidden until then', async () => {
    const { createSegmentedControl } = await load('segmented-control');
    observers = [];
    const host = new Node('div');
    createSegmentedControl(host, { segments: ['A', 'B', 'C', 'D'], defaultValue: 'C' });
    const pill = pillOf(host);
    assert.equal(pill.style.visibility, 'hidden');
    host.clientWidth = 406;
    observers.forEach((o) => o.fn([]));
    assert.equal(pill.style.visibility, '');
    assert.equal(pill.style.transform, 'translateX(203px)');
  });
});
