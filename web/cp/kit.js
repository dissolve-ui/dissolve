// Shared kit for the web ports of the ready-made components and the demo pages. The generic part
// (curves, springs, the disposal scope, DOM and canvas helpers) is registry/web/kit.ts, built into
// web/lib and shared with the React web components; this module adds the site's theme, content
// and tile helpers. Every module of the site builds on it.
import { play, snapshot, DPR } from '../lib/engine.js';
import {
  bezier, CALM, QUAD, IN_OUT_CUBIC, OUT_CUBIC, scope, value, el, clamp, hex, rectOf, boxOf, frame,
  onScreen, onWidth, loop, rr, wrap, fit,
} from '../lib/kit.js';
import { IMG, FONT, cover } from '../images.js';
import { PKG } from '../variants-content.js';

export { play, snapshot, DPR, IMG, FONT, cover, PKG };
export { bezier, CALM, QUAD, IN_OUT_CUBIC, OUT_CUBIC, scope, value, el, clamp, hex, rectOf, boxOf, frame, onScreen, onWidth, loop, rr, wrap, fit };

/* ======================================================================================
   Theme and canvas primitives.
   ====================================================================================== */

export const isLight = () => document.documentElement.dataset.theme === 'light';
export const pal = () => isLight()
  ? { card: '#FFFFFF', ink: '#12151A', text: '#535A64', muted: '#8E959F', line: 'rgba(0,0,0,0.08)', them: '#EEF0F3', me: '#2F63E0', meText: '#FFFFFF' }
  : { card: '#1E2024', ink: '#F2F4F7', text: '#A9AFB8', muted: '#858B94', line: 'rgba(255,255,255,0.07)', them: '#26292E', me: '#3A6FE6', meText: '#FFFFFF' };

/** Calls fn whenever the site theme flips. Stops with the scope (if any) or the returned function. */
export function onTheme(sc, fn) {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const off = () => mo.disconnect();
  sc?.onDispose(off);
  return off;
}

/** Draws fn(ctx) again, in place, into a canvas made by snapshot() (a theme switch). */
export function redraw(c, fn) {
  const x = c.getContext('2d');
  x.reset();
  x.scale(DPR, DPR);
  fn(x);
}

export function text(ctx, str, x, y, { size = 14, weight = 400, color, align = 'left', mono = false } = {}) {
  ctx.font = `${weight} ${size}px ${mono ? "'Geist Mono', monospace" : FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

/* ======================================================================================
   Content helpers: props tables and usage snippets of the component pages.
   ====================================================================================== */

export const DIR = '@/components/dissolve';
export const prop = (name, type, def, desc) => ({ name, type, def, desc });
/** A React web snippet (an entry's webCode): the import, then the usage. */
export const webAdd = (id, name, usage) => `import { ${name} } from '${DIR}/${id}';

${usage}`;
/** A usage snippet: the add command, the import, then the usage. */
export const add = (id, name, usage) => `// npx ${PKG} add ${id}
${webAdd(id, name, usage)}`;

/* ======================================================================================
   Autoplay helpers.
   ====================================================================================== */

/** Pointer id of the scripted finger, so a real pointer can take over at any time. */
export const AUTO = 1e6;

/** Calls fn(k) every frame, k going from 0 to 1 over ms. Resolves at 1, or early once the scope is gone or stop() is true. */
export const tween = (sc, ms, fn, stop = () => false) => new Promise((done) => {
  const t0 = performance.now();
  const step = (now) => {
    if (!sc.alive || stop()) return done();
    const k = clamp((now - t0) / ms);
    fn(k);
    if (k < 1) requestAnimationFrame(step); else done();
  };
  requestAnimationFrame(step);
});

/* ======================================================================================
   Tile and dust helpers.
   ====================================================================================== */

export const hide = (node) => { node.style.transition = 'none'; node.style.opacity = '0'; };
export const show = (node, fade = true) => { node.style.transition = fade ? '' : 'none'; node.style.opacity = '1'; };

/** Width of a tile body inside its padding. */
export function availW(body) {
  const cs = getComputedStyle(body);
  return body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/** Scales a node of natural size (w, h) down to fit the tile body. */
export function fitTile(body, node, w, h) {
  const cs = getComputedStyle(body);
  const ah = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const s = Math.min(1, availW(body) / w, ah / h);
  const box = el('div', 'cp-fit');
  box.style.width = w * s + 'px';
  box.style.height = h * s + 'px';
  node.style.transform = `scale(${s})`;
  node.style.transformOrigin = '0 0';
  box.append(node);
  return box;
}

/**
 * Canvas replica of a node as it looks right now, for the dust. Each part is drawn where it sits,
 * relative to root, in layout units (a tile scaled down by fitTile is drawn at its on screen size):
 *   { node, fill: true, radius }      the node's background color, rounded ('pill' for h / 2)
 *   { node, text, align, fit }        a line in the node's font and color, vertically centered;
 *                                     text defaults to the node's own, fit: true ends it with an ellipsis
 *   { node, draw(ctx, box, node) }    anything else, box = { x, y, w, h }
 * size: { w, h } of the canvas in layout units, the root's own by default. scale: on screen size
 * over layout size, measured on the root by default (pass 1 for a root that is only lifted or tilted).
 */
export function snapNode(root, parts, { size, scale } = {}) {
  const r = root.getBoundingClientRect(), s = scale ?? (r.width / root.offsetWidth || 1);
  const W = size?.w ?? r.width / s, H = size?.h ?? r.height / s;
  return snapshot(W * s, H * s, (ctx) => {
    ctx.scale(s, s);
    for (const p of parts) {
      if (!p?.node) continue;
      const b = p.node.getBoundingClientRect(), cs = getComputedStyle(p.node);
      const box = { x: (b.left - r.left) / s, y: (b.top - r.top) / s, w: b.width / s, h: b.height / s };
      if (p.fill) {
        rr(ctx, box.x, box.y, box.w, box.h, p.radius === 'pill' ? box.h / 2 : p.radius ?? 0);
        ctx.fillStyle = cs.backgroundColor;
        ctx.fill();
      }
      if (p.text !== undefined || (!p.fill && !p.draw)) {
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${FONT}`;
        ctx.fillStyle = cs.color;
        ctx.textAlign = p.align ?? 'left';
        ctx.textBaseline = 'middle';
        const str = p.text ?? p.node.textContent;
        const x = p.align === 'right' ? box.x + box.w : p.align === 'center' ? box.x + box.w / 2 : box.x;
        ctx.fillText(p.fit ? fit(ctx, str, box.w + 1) : str, x, box.y + box.h / 2 + 0.5);
        ctx.textAlign = 'left';
      }
      p.draw?.(ctx, box, p.node);
    }
  });
}

export function label(ctx, str, x, y, size, weight, color, align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

