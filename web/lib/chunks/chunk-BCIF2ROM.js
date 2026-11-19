// Built from registry/web by scripts/build-web.mjs, do not edit.

// registry/web/kit.ts
var reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function vibrate(pattern) {
  if (typeof navigator === "undefined" || !navigator.userActivation?.hasBeenActive) return;
  navigator.vibrate?.(pattern);
}
function injectStyle(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}
function token(node, name, fallback) {
  return getComputedStyle(node).getPropertyValue(`--dissolve-${name}`).trim() || fallback;
}
var fontOf = (node) => getComputedStyle(node).fontFamily || "system-ui, sans-serif";
function onThemeChange(sc, fn) {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", fn);
  sc.onDispose(() => {
    mo.disconnect();
    mq.removeEventListener("change", fn);
  });
}
var probe = null;
function rgbOf(color) {
  probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}
function propsOf(defaults, initial) {
  let raw = { ...initial };
  const resolve = () => {
    const out = { ...defaults };
    for (const [k, v] of Object.entries(raw)) if (v !== void 0) out[k] = v;
    return out;
  };
  const box = {
    current: resolve(),
    update(next) {
      raw = { ...raw, ...next };
      const prev = box.current;
      box.current = resolve();
      const cur = box.current;
      return new Set([...Object.keys(prev), ...Object.keys(cur)].filter((k) => prev[k] !== cur[k]));
    }
  };
  return box;
}
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x, d = dX(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-4) {
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        if (X(t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return Y(t);
  };
}
var CALM = bezier(0.32, 0.72, 0, 1);
var SPLIT = bezier(0.45, 0, 0.2, 1);
var QUAD = (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
var IN_OUT_CUBIC = (t) => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
var OUT_CUBIC = (t) => 1 - (1 - t) ** 3;
var clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
var hash = (i, k) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
var hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
var mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};
function scope() {
  const timers = /* @__PURE__ */ new Set(), handles = /* @__PURE__ */ new Set(), fns = [];
  const sc = {
    alive: true,
    wait: (ms) => new Promise((res) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (sc.alive) res();
      }, ms);
      timers.add(t);
    }),
    track(h) {
      handles.add(h);
      h.done.then(() => handles.delete(h));
      return h;
    },
    onDispose(fn) {
      fns.push(fn);
    },
    dispose() {
      if (!sc.alive) return;
      sc.alive = false;
      timers.forEach(clearTimeout);
      handles.forEach((h) => h.cancel());
      fns.forEach((f) => f());
    }
  };
  return sc;
}
function value(sc, v0, onChange) {
  let id = 0;
  const a = {
    v: v0,
    vel: 0,
    set(x) {
      id++;
      a.v = x;
      a.vel = 0;
      onChange();
    },
    to(to, ms, ease = CALM, delay = 0) {
      const my = ++id, from = a.v;
      return new Promise((res) => {
        const t0 = performance.now() + delay;
        let lastT = t0;
        const f = (now) => {
          if (my !== id) return res(false);
          if (!sc.alive) return;
          if (now < t0) return void requestAnimationFrame(f);
          const k = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
          const prev = a.v;
          a.v = from + (to - from) * ease(k);
          const dt = (now - lastT) / 1e3;
          a.vel = dt > 0 ? (a.v - prev) / dt : 0;
          lastT = now;
          onChange();
          if (k < 1) requestAnimationFrame(f);
          else {
            a.vel = 0;
            res(true);
          }
        };
        requestAnimationFrame(f);
      });
    },
    spring(to, { stiffness = 260, damping = 31, mass = 1, eps = 0.02 } = {}) {
      const my = ++id;
      return new Promise((res) => {
        let last = performance.now();
        const f = (now) => {
          if (my !== id) return res(false);
          if (!sc.alive) return;
          let dt = Math.min(0.064, (now - last) / 1e3);
          last = now;
          while (dt > 0) {
            const h = Math.min(1 / 480, dt);
            a.vel += (-stiffness * (a.v - to) - damping * a.vel) / mass * h;
            a.v += a.vel * h;
            dt -= h;
          }
          if (Math.abs(a.v - to) < eps && Math.abs(a.vel) < eps * 10) {
            a.v = to;
            a.vel = 0;
            onChange();
            return res(true);
          }
          onChange();
          requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      });
    }
  };
  return a;
}
function el(tag, cls = "", html = "") {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
function plainButton(cls = "", html = "") {
  const b = el("button", cls, html);
  b.type = "button";
  Object.assign(b.style, { background: "none", border: "0", padding: "0", margin: "0", color: "inherit", font: "inherit", cursor: "pointer" });
  return b;
}
var rectOf = (node) => {
  const r = node.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
var boxOf = (node) => ({ source: node, ...rectOf(node) });
var frame = () => new Promise(requestAnimationFrame);
function onScreen(sc, node, onChange) {
  let waiting = [];
  const st = {
    on: true,
    shown: () => st.on ? Promise.resolve() : new Promise((res) => waiting.push(res))
  };
  const io = new IntersectionObserver(([e]) => {
    st.on = e.isIntersecting;
    if (st.on) {
      waiting.forEach((res) => res());
      waiting = [];
    }
    onChange?.(st.on);
  });
  io.observe(node);
  sc.onDispose(() => io.disconnect());
  return st;
}
function onWidth(sc, node, fn, { min = 40, delay = 250 } = {}) {
  let w = node.clientWidth, t;
  const ro = new ResizeObserver(() => {
    clearTimeout(t);
    t = setTimeout(() => {
      const now = node.clientWidth;
      if (!now || Math.abs(now - w) < min) return;
      w = now;
      fn();
    }, delay);
  });
  ro.observe(node);
  const off = () => {
    ro.disconnect();
    clearTimeout(t);
  };
  sc?.onDispose(off);
  return off;
}
function loop(sc, node, fn, active = () => true) {
  let raf = 0;
  const tick = (now) => {
    raf = 0;
    if (!sc.alive) return;
    fn(now);
    if (seen.on && active()) raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!raf && sc.alive) raf = requestAnimationFrame(tick);
  };
  const seen = onScreen(sc, node, (on) => on && kick());
  kick();
  sc.onDispose(() => cancelAnimationFrame(raf));
  return { kick };
}
function claimTouch(node, want, signal) {
  let t = null;
  node.addEventListener("touchstart", (e) => {
    const { touches } = e;
    t = touches.length === 1 ? { x: touches[0].clientX, y: touches[0].clientY, on: null } : null;
  }, { passive: true, signal });
  node.addEventListener("touchmove", (e) => {
    if (!t) return;
    if (t.on === null) {
      const p = e.touches[0], dx = p.clientX - t.x, dy = p.clientY - t.y;
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      t.on = Math.abs(dy) >= Math.abs(dx) && !!want(dx, dy);
    }
    if (t.on && e.cancelable) e.preventDefault();
  }, { passive: false, signal });
  const off = () => {
    t = null;
  };
  node.addEventListener("touchend", off, { signal });
  node.addEventListener("touchcancel", off, { signal });
  return () => !!t?.on;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function fit(ctx, str, maxW) {
  if (ctx.measureText(str).width <= maxW) return str;
  let out = str;
  while (out.length > 1 && ctx.measureText(out + "\u2026").width > maxW) out = out.slice(0, -1);
  return out.trimEnd() + "\u2026";
}
var radiusOf = (v, w, h, s) => {
  const n = parseFloat(v) || 0;
  return Math.min(v.endsWith("%") ? n / 100 * Math.min(w, h) : n * s, w / 2, h / 2);
};
var painted = (c) => c !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(c);
async function capture(node, dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1)) {
  const r = node.getBoundingClientRect();
  const s = r.width / (node.offsetWidth || r.width) || 1;
  const source = document.createElement("canvas");
  source.width = Math.ceil(r.width * dpr);
  source.height = Math.ceil(r.height * dpr);
  const ctx = source.getContext("2d");
  ctx.scale(dpr, dpr);
  const svgs = /* @__PURE__ */ new Map();
  await Promise.all([...node.querySelectorAll("svg")].map((svg) => {
    const b = svg.getBoundingClientRect();
    if (!b.width || !b.height) return null;
    const copy = svg.cloneNode(true);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", String(b.width));
    copy.setAttribute("height", String(b.height));
    copy.style.color = getComputedStyle(svg).color;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    svgs.set(svg, img);
    return img.decode().catch(() => svgs.delete(svg));
  }));
  const text = (t, cs) => {
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * s}px ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : `${parseFloat(cs.letterSpacing) * s}px`;
    ctx.textBaseline = "alphabetic";
    const range = document.createRange();
    for (const m of t.data.matchAll(/\S+/g)) {
      range.setStart(t, m.index);
      range.setEnd(t, m.index + m[0].length);
      const b = range.getClientRects()[0];
      if (!b) continue;
      const ascent = ctx.measureText(m[0]).fontBoundingBoxAscent;
      ctx.fillText(m[0], b.left - r.left, b.top - r.top + (ascent ?? b.height * 0.78));
    }
  };
  const walk = (e, alpha) => {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const a = e === node ? alpha : alpha * parseFloat(cs.opacity);
    if (a <= 3e-3) return;
    const b = e.getBoundingClientRect();
    const x = b.left - r.left, y = b.top - r.top, w = b.width, h = b.height;
    const rad = radiusOf(cs.borderTopLeftRadius, w, h, s);
    ctx.globalAlpha = a;
    if (painted(cs.backgroundColor)) {
      rr(ctx, x, y, w, h, rad);
      ctx.fillStyle = cs.backgroundColor;
      ctx.fill();
    }
    const bw = parseFloat(cs.borderTopWidth) * s;
    if (bw > 0 && cs.borderTopStyle !== "none" && painted(cs.borderTopColor)) {
      rr(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, rad - bw / 2));
      ctx.strokeStyle = cs.borderTopColor;
      ctx.lineWidth = bw;
      ctx.stroke();
    }
    const img = svgs.get(e) ?? (e instanceof HTMLImageElement && e.complete && e.naturalWidth ? e : e instanceof HTMLCanvasElement ? e : null);
    if (img) {
      ctx.save();
      rr(ctx, x, y, w, h, rad);
      ctx.clip();
      const iw = img instanceof HTMLImageElement ? img.naturalWidth : img.width, ih = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
      const fitMode = img === e && e instanceof HTMLImageElement ? cs.objectFit : "fill";
      if ((fitMode === "cover" || fitMode === "contain") && iw && ih) {
        const k = (fitMode === "cover" ? Math.max : Math.min)(w / iw, h / ih);
        ctx.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k);
      } else ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      return;
    }
    const clip = cs.overflowX !== "visible" || cs.overflowY !== "visible";
    if (clip) {
      ctx.save();
      rr(ctx, x, y, w, h, rad);
      ctx.clip();
    }
    for (const child of e.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) walk(child, a);
      else if (child.nodeType === Node.TEXT_NODE) {
        ctx.globalAlpha = a;
        text(child, cs);
      }
    }
    if (clip) ctx.restore();
  };
  walk(node, 1);
  return { source, x: r.left, y: r.top, w: r.width, h: r.height };
}

export {
  reducedMotion,
  vibrate,
  injectStyle,
  token,
  fontOf,
  onThemeChange,
  rgbOf,
  propsOf,
  bezier,
  CALM,
  SPLIT,
  QUAD,
  IN_OUT_CUBIC,
  OUT_CUBIC,
  clamp,
  hash,
  hex,
  mix,
  scope,
  value,
  el,
  plainButton,
  rectOf,
  boxOf,
  frame,
  onScreen,
  onWidth,
  loop,
  claimTouch,
  rr,
  wrap,
  fit,
  capture
};
