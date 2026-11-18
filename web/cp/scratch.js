// ScratchCard (registry/scratch-card.tsx), ported to canvas 2D. The foil texture (metal gradient,
// grain, brushed streaks, bevel, embossed label) is painted once; every frame adds the light that
// moves with the tilt (bands, holographic tint, specular), then cuts the scratched mask out of it.
// Same grid coverage, grains, tilt springs and threshold as the native source.
import { value, el, clamp, play, DPR, FONT, CALM, rectOf, fitTile, availW, loop, prop, add } from './kit.js';
const RM = matchMedia('(prefers-reduced-motion: reduce)');

/** As in scratch-card.tsx. */
const SC = { COLS: 24, N: 160, PAD: 40, FALL: 160, GRAVITY: 1100, TILT: 9, BRUSH: 38, THRESHOLD: 0.55 };
const FOLLOW = { stiffness: 220, damping: 20, eps: 0.002 };
const BACK = { stiffness: 150, damping: 11, eps: 0.002 };
const DIR = (() => { const l = Math.hypot(1, 0.55); return [1 / l, 0.55 / l]; })();
const scHash = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

const TAU = Math.PI * 2;

/** One scratch stamp, as chip() in scratch-card.tsx: a chipped polygon seeded by id. */
function chip(x, cx, cy, r, id, verts) {
  const a0 = scHash(id, 11) * TAU;
  const deep = scHash(id, 12) < 0.18 ? Math.floor(scHash(id, 13) * verts) : -1;
  x.beginPath();
  for (let v = 0; v < verts; v++) {
    const k = v === deep ? 0.55 : 0.8 + 0.2 * scHash(id, 20 + v);
    const a = a0 + (v / verts) * TAU;
    const px = cx + Math.cos(a) * r * k, py = cy + Math.sin(a) * r * k;
    if (v === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  x.fill();
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const shade = ([r, g, b], k, a = 1) => `rgba(${Math.round(clamp(r * k, 0, 255))}, ${Math.round(clamp(g * k, 0, 255))}, ${Math.round(clamp(b * k, 0, 255))}, ${a})`;

/** The static foil: metal gradient, grain, brushed streaks, bevel and the embossed label. */
function foilTexture(W, H, R, base, label) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * DPR);
  c.height = Math.round(H * DPR);
  const x = c.getContext('2d');
  x.scale(DPR, DPR);
  x.beginPath();
  x.roundRect(0, 0, W, H, R);
  x.clip();
  const g = x.createLinearGradient(0, 0, W, H);
  [[0, 0.86], [0.22, 1.06], [0.42, 0.84], [0.63, 1.02], [0.82, 0.9], [1, 0.8]].forEach(([s, k]) => g.addColorStop(s, shade(base, k)));
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  // A touch darker toward the bottom, like a lit surface.
  const v = x.createLinearGradient(0, H * 0.45, 0, H);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);
  // Grain and brushed streaks, in device pixels.
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data, cw = c.width;
  const streak = new Float32Array(c.height * 8);
  for (let i = 0; i < streak.length; i++) streak[i] = Math.random() - 0.5;
  const seg = Math.max(1, Math.round(36 * DPR));
  for (let p = 0, i = 0; p < d.length; p += 4, i++) {
    const py = (i / cw) | 0, px = i - py * cw;
    const n = (Math.random() - 0.5) * 18 + streak[(py * 8 + ((px / seg) | 0)) % streak.length] * 9;
    d[p] += n; d[p + 1] += n; d[p + 2] += n;
  }
  x.putImageData(img, 0, 0);
  // Bevel: lit top left rim, shaded bottom right rim.
  const b = x.createLinearGradient(0, 0, W * 0.4, H);
  b.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  b.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
  b.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
  x.lineWidth = 3;
  x.strokeStyle = b;
  x.beginPath();
  x.roundRect(1.5, 1.5, W - 3, H - 3, R - 1.5);
  x.stroke();
  if (label) {
    x.font = `600 15px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255, 255, 255, 0.55)';
    x.fillText(label, W / 2, H / 2 + 1);
    x.fillStyle = `rgba(${Math.round(base[0] * 0.42)}, ${Math.round(base[1] * 0.42)}, ${Math.round(base[2] * 0.45)}, 0.78)`;
    x.fillText(label, W / 2, H / 2);
  }
  return c;
}

function mountScratch(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 300 : mode === 'stage' ? 340 : Math.round(Math.min(320, (availW(body) || 320) - 8));
  const H = Math.round(W * 0.62), R = 24;
  const base = rgbOf('#C3C8D0');
  const label = 'Scratch to reveal';
  const brush = SC.BRUSH, rows = Math.max(4, Math.round((SC.COLS * H) / W));

  const root = el('div', 'sc');
  const wrap = el('div', 'sc-wrap');
  wrap.style.width = W + 'px';
  wrap.style.height = H + 'px';
  const card = el('div', 'sc-card');
  card.style.borderRadius = R + 'px';
  card.setAttribute('role', 'img');
  card.setAttribute('aria-label', label);
  const content = el('div', 'sc-content', `<span class="sc-kicker">YOU WON</span><span class="sc-amount">$25</span><span class="sc-code">CODE SPRING25</span>`);
  const fv = el('canvas', 'sc-foil');
  fv.width = Math.round(W * DPR);
  fv.height = Math.round(H * DPR);
  const sheen = el('div', 'sc-sheen');
  const rim = el('div', 'sc-rim');
  card.append(content, fv, sheen, rim);
  const dust = el('canvas', 'sc-dust');
  const DW = W + SC.PAD * 2, DH = H + SC.PAD + SC.FALL;
  dust.width = Math.round(DW * DPR);
  dust.height = Math.round(DH * DPR);
  dust.style.cssText = `left:${-SC.PAD}px;top:${-SC.PAD}px;width:${DW}px;height:${DH}px`;
  wrap.append(card, dust);
  root.append(wrap);
  const again = el('button', 'sc-again', 'Again');
  again.type = 'button';
  if (!tile) root.append(again);
  body.append(tile ? fitTile(body, root, W, H + 8) : root);

  const tex = foilTexture(W, H, R, base, label);
  const mask = document.createElement('canvas');
  mask.width = fv.width;
  mask.height = fv.height;
  const mx = mask.getContext('2d');
  mx.scale(DPR, DPR);
  mx.fillStyle = '#000';
  const fx = fv.getContext('2d');
  const dx = dust.getContext('2d');

  let cells = new Uint8Array(SC.COLS * rows), covered = 0, done = false, gone = false, dirty = true;
  const G = new Float32Array(SC.N * 8);
  let head = 0, seq = 0, liveGrains = 0, fresh = 0;
  const tilt = RM.matches ? 0 : SC.TILT;

  const tx = value(sc, 0, () => { dirty = true; kick(); });
  const ty = value(sc, 0, () => { dirty = true; kick(); });
  const press = value(sc, 0, () => { dirty = true; kick(); });

  function drawFoil() {
    const a = tx.v, b = ty.v;
    fx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fx.globalCompositeOperation = 'source-over';
    fx.clearRect(0, 0, W, H);
    fx.drawImage(tex, 0, 0, W, H);
    const S = W * DIR[0] + H * DIR[1];
    const lin = () => fx.createLinearGradient(W / 2 - (DIR[0] * S) / 2, H / 2 - (DIR[1] * S) / 2, W / 2 + (DIR[0] * S) / 2, H / 2 + (DIR[1] * S) / 2);
    // Soft metal bands that slide with the tilt.
    const bands = lin(), off = (a * 0.22 + b * 0.14) % 0.25;
    for (let i = -1; i <= 5; i++) {
      const s = i * 0.25 + off;
      if (s >= 0 && s <= 1) bands.addColorStop(s, 'rgba(255, 255, 255, 0.10)');
      if (s + 0.125 >= 0 && s + 0.125 <= 1) bands.addColorStop(s + 0.125, 'rgba(0, 0, 0, 0.06)');
    }
    fx.globalCompositeOperation = 'source-atop';
    fx.fillStyle = bands;
    fx.fillRect(0, 0, W, H);
    // Holographic hint: a pastel spectrum that drifts as the card turns.
    const holo = lin(), h0 = (a * 0.3 - b * 0.2) * 360;
    for (let i = 0; i <= 6; i++) holo.addColorStop(i / 6, `hsla(${(h0 + i * 60 + 360) % 360}, 80%, 62%, 0.08)`);
    fx.globalCompositeOperation = 'overlay';
    fx.fillStyle = holo;
    fx.fillRect(0, 0, W, H);
    // Specular band, lit from where the card leans.
    const u = 0.5 + (-0.18 - a * 0.42 - b * 0.24);
    const spec = lin();
    const st = (s, al) => { if (s >= 0 && s <= 1) spec.addColorStop(s, `rgba(255, 255, 255, ${al})`); };
    st(0, 0); st(clamp(u - 0.32), 0); st(clamp(u - 0.1), 0.08); st(clamp(u - 0.04), 0.16); st(clamp(u), 0.42); st(clamp(u + 0.04), 0.16); st(clamp(u + 0.1), 0.08); st(clamp(u + 0.32), 0); st(1, 0);
    fx.globalCompositeOperation = 'source-atop';
    fx.fillStyle = spec;
    fx.fillRect(0, 0, W, H);
    // Cut the scratched foil out.
    fx.globalCompositeOperation = 'destination-out';
    fx.drawImage(mask, 0, 0, W, H);
    fx.globalCompositeOperation = 'source-over';
  }

  function applyCard() {
    const k = clamp(press.v, -0.2, 1.2);
    card.style.transform = `perspective(900px) rotateX(${(-ty.v * tilt).toFixed(3)}deg) rotateY(${(tx.v * tilt).toFixed(3)}deg) scale(${(1 - k * 0.012).toFixed(4)})`;
    card.style.setProperty('--sc-sx', `${(-tx.v * W * 0.28).toFixed(1)}px`);
    card.style.setProperty('--sc-sy', `${(-ty.v * H * 0.2).toFixed(1)}px`);
  }

  function drawDust(dt, now) {
    dx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dx.clearRect(0, 0, DW, DH);
    let alive = 0;
    for (let i = 0; i < SC.N; i++) {
      const k = i * 8;
      if (G[k + 5] <= 0) continue;
      if (G[k + 4] < 0) G[k + 4] = now;
      const age = (now - G[k + 4]) / G[k + 5];
      if (age >= 1) { G[k + 5] = 0; continue; }
      alive++;
      G[k + 2] *= 1 - 1.2 * dt;
      G[k + 3] += SC.GRAVITY * dt;
      G[k] += G[k + 2] * dt;
      G[k + 1] += G[k + 3] * dt;
      const fade = age < 0.55 ? 1 : 1 - (age - 0.55) / 0.45;
      dx.fillStyle = shade(base, G[k + 7], fade * fade);
      dx.beginPath();
      dx.arc(G[k] + SC.PAD, G[k + 1] + SC.PAD, (G[k + 6] * (1 - 0.4 * age)) / 2, 0, Math.PI * 2);
      dx.fill();
    }
    liveGrains = alive;
  }

  let last = 0;
  const { kick } = loop(sc, wrap, (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    applyCard();
    if (dirty && !gone) { drawFoil(); dirty = false; }
    drawDust(dt, now);
  }, () => {
    const busy = liveGrains > 0 || dirty;
    if (!busy) last = 0;
    return busy;
  });

  /** Marks the grid cells the segment uncovers. Returns how many were new. */
  function mark(x0, y0, x1, y1) {
    const r = brush / 2, cw = W / SC.COLS, ch = H / rows;
    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - r) / cw)), c1 = Math.min(SC.COLS - 1, Math.floor((Math.max(x0, x1) + r) / cw));
    const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - r) / ch)), r1 = Math.min(rows - 1, Math.floor((Math.max(y0, y1) + r) / ch));
    const ddx = x1 - x0, ddy = y1 - y0, len2 = ddx * ddx + ddy * ddy;
    let added = 0;
    for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) {
      const k = j * SC.COLS + i;
      if (cells[k]) continue;
      const cx = (i + 0.5) * cw, cy = (j + 0.5) * ch;
      const t = len2 > 0 ? clamp(((cx - x0) * ddx + (cy - y0) * ddy) / len2) : 0;
      const ex = x0 + ddx * t - cx, ey = y0 + ddy * t - cy;
      if (ex * ex + ey * ey <= r * r) { cells[k] = 1; added++; }
    }
    covered += added;
    return added;
  }

  /** Sheds n foil grains around (x, y), flicked against the stroke direction. */
  function shed(x, y, ux, uy, n) {
    if (RM.matches) return;
    const r = brush / 2;
    for (let q = 0; q < n; q++) {
      const s = seq++, k = head * 8;
      head = (head + 1) % SC.N;
      const a = scHash(s, 1) * Math.PI * 2, d = r * (0.35 + 0.6 * scHash(s, 2));
      G[k] = x + Math.cos(a) * d;
      G[k + 1] = y + Math.sin(a) * d;
      const flick = 60 + scHash(s, 3) * 140;
      G[k + 2] = -ux * flick * 0.6 + (scHash(s, 4) - 0.5) * 160;
      G[k + 3] = -uy * flick * 0.4 - 90 - scHash(s, 5) * 120;
      G[k + 4] = -1;
      G[k + 5] = 520 + scHash(s, 6) * 420;
      G[k + 6] = 1.6 + scHash(s, 7) * 2.2;
      G[k + 7] = 0.7 + scHash(s, 8) * 0.5;
    }
    liveGrains = Math.max(liveGrains, 1);
  }

  let lx = NaN, ly = NaN, lt = 0;
  /** Live stroke, as in scratch-card.tsx: distance to the next stamp, stamps laid, width, stamp id, direction. */
  let carry = 0, laid = 0, nib = 1, sid = 0, ldx = 0, ldy = 0;

  /** Lays the stroke from the last point to (x, y): chipped stamps, width following the speed. */
  function lay(x, y, speed) {
    const px = lx === lx ? lx : x, py = ly === ly ? ly : y;
    const ddx = x - px, ddy = y - py, d = Math.hypot(ddx, ddy);
    if (d > 0.5) { ldx = ddx / d; ldy = ddy / d; }
    const target = 1.08 - Math.min(0.4, speed / 2600);
    let t = carry;
    while (t <= d) {
      const k = d > 0 ? t / d : 0;
      nib += (target - nib) * 0.2;
      const id = sid++, n = laid++;
      const taper = n < 3 ? 0.55 + n * 0.15 : 1;
      const r = (brush / 2) * nib * (0.86 + 0.18 * scHash(id, 31)) * taper;
      const cx = px + ddx * k, cy = py + ddy * k;
      chip(mx, cx, cy, r, id, 11);
      if (scHash(id, 32) < 0.4) {
        const side = scHash(id, 33) < 0.5 ? -1 : 1, off = r * (0.82 + 0.2 * scHash(id, 34));
        chip(mx, cx - ldy * side * off, cy + ldx * side * off, r * (0.12 + 0.14 * scHash(id, 35)), id + 7919, 6);
      }
      t += Math.max(2, r * 0.38);
      if (d === 0) break;
    }
    carry = t - d;
  }

  /** Rough end of a stroke: a couple of small chips just past the last point. */
  function lift() {
    if (lx !== lx || done) return;
    const id = sid++, r = (brush / 2) * nib;
    chip(mx, lx + ldx * r * 0.45, ly + ldy * r * 0.45, r * (0.3 + 0.15 * scHash(id, 36)), id, 8);
    chip(mx, lx + ldx * r * 0.7 - ldy * r * 0.25, ly + ldy * r * 0.7 + ldx * r * 0.25, r * 0.14, id + 7919, 6);
    dirty = true;
    kick();
  }
  function tiltTo(x, y) {
    if (!tilt) return;
    tx.spring(clamp((x / W) * 2 - 1, -1, 1), FOLLOW);
    ty.spring(clamp((y / H) * 2 - 1, -1, 1), FOLLOW);
  }
  function down(x, y) {
    tiltTo(x, y);
    if (tilt) press.spring(1, FOLLOW);
    if (done) return;
    lx = ly = NaN;
    carry = 0; laid = 0; nib = 1;
    lay(x, y, 0);
    lx = x; ly = y; lt = performance.now();
    const added = mark(x, y, x, y);
    if (added) shed(x, y, 0, 0, Math.min(6, 2 + added));
    dirty = true;
    kick();
  }
  function moveTo(x, y) {
    tiltTo(x, y);
    if (done || lx !== lx) return;
    const ddx = x - lx, ddy = y - ly, d = Math.hypot(ddx, ddy);
    if (d < 2.5) return;
    const now = performance.now(), dt = Math.max(4, now - lt);
    lt = now;
    lay(x, y, (d / dt) * 1000);
    const added = mark(lx, ly, x, y);
    const ux = ddx / (d || 1), uy = ddy / (d || 1);
    if (added) {
      shed(x, y, ux, uy, Math.min(7, 1 + Math.ceil(added * 0.8) + Math.floor(d / 14)));
      fresh += d;
      if (fresh >= 22) { fresh = 0; navigator.vibrate?.(4); }
    } else if (scHash(seq++, 9) < 0.25) shed(x, y, ux, uy, 1);
    lx = x; ly = y;
    dirty = true;
    kick();
    if (covered >= SC.THRESHOLD * SC.COLS * rows) finish(x, y);
  }
  function up() {
    lift();
    lx = ly = NaN;
    tx.spring(0, BACK);
    ty.spring(0, BACK);
    press.spring(0, BACK);
  }

  let revealing = null;
  function finish(ox, oy) {
    if (done) return revealing;
    done = true;
    revealing = (async () => {
      await Promise.all([tx.to(0, 160, CALM), ty.to(0, 160, CALM), press.to(0, 160, CALM)]);
      if (!sc.alive) return;
      applyCard();
      drawFoil();
      if (RM.matches) {
        fv.style.transition = 'opacity .22s';
        fv.style.opacity = '0';
      } else {
        const h = sc.track(play({ source: fv, ...rectOf(fv), preset: 'dust', origin: { x: ox, y: oy }, duration: 1100 }));
        fv.style.opacity = '0';
        gone = true;
        navigator.vibrate?.([10, 40, 18]);
        await h.done;
      }
      gone = true;
    })();
    return revealing;
  }

  function reset() {
    cells = new Uint8Array(SC.COLS * rows);
    covered = 0;
    done = false;
    gone = false;
    revealing = null;
    lx = ly = NaN;
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.clearRect(0, 0, mask.width, mask.height);
    mx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dirty = true;
    drawFoil();
    fv.style.transition = 'none';
    fv.style.opacity = '0';
    void fv.offsetWidth;
    fv.style.transition = 'opacity .32s cubic-bezier(0.32, 0.72, 0, 1)';
    fv.style.opacity = '1';
    kick();
  }
  again.addEventListener('click', reset);

  // Pointer: coordinates on the flat wrapper (the card itself is tilted), in layout units.
  let ptr = null;
  const local = (e) => {
    const r = wrap.getBoundingClientRect(), s = r.width / wrap.offsetWidth || 1;
    return [(e.clientX - r.left) / s, (e.clientY - r.top) / s];
  };
  card.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || auto) return;
    ptr = e.pointerId;
    try { card.setPointerCapture(e.pointerId); } catch {}
    card.classList.add('on');
    down(...local(e));
  });
  card.addEventListener('pointermove', (e) => {
    if (ptr !== e.pointerId) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) moveTo(...local(ev));
  });
  const end = (e) => { if (ptr !== e.pointerId) return; ptr = null; card.classList.remove('on'); up(); };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);

  applyCard();
  drawFoil();

  // Scripted scratch for the autoplay: a quick zigzag with a little wobble, like a thumb.
  let auto = false;
  const stroke = (pts, speed) => new Promise((res) => {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
    const t0 = performance.now();
    const step = (now) => {
      if (!sc.alive || ptr !== null) return res();
      let dist = Math.min(total, ((now - t0) / 1000) * speed), i = 0;
      while (i < segs.length - 1 && dist > segs[i]) { dist -= segs[i]; i++; }
      const k = segs[i] ? Math.min(1, dist / segs[i]) : 1;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
      moveTo(x + Math.sin(now / 60) * 1.5, y + Math.cos(now / 75) * 1.5);
      if (done || ((now - t0) / 1000) * speed >= total) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  return {
    async run() {
      if (ptr !== null) return;
      if (done || covered) { reset(); await sc.wait(500); }
      auto = true;
      const m = brush * 0.55, ys = [];
      for (let y = m; y <= H - m + 1; y += brush * 0.82) ys.push(y);
      const pts = [];
      ys.forEach((y, i) => { const l = m * 0.8, r = W - m * 0.8; pts.push(i % 2 ? [r, y] : [l, y], i % 2 ? [l, y + brush * 0.41] : [r, y + brush * 0.41]); });
      down(pts[0][0], pts[0][1]);
      await stroke(pts, 820);
      if (!done) up();
      auto = false;
      if (revealing) await revealing;
      await sc.wait(1400);
      if (sc.alive && ptr === null) reset();
      await sc.wait(400);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'scratch-card': {
    title: 'ScratchCard',
    note: 'Scratch the glossy foil, past half the rest turns to dust.',
    desc: 'A lottery style card with a metal foil over any content: a reward, a promo code. The foil is one shader, a brushed silver gradient with a fine grain, a faint holographic tint, a bevel lit along the edge and a specular band. The whole card tilts in 3D under the finger, up to 9 degrees with perspective, and the light moves with it, then it springs back flat on release. Scratching erases the foil along a ragged stroke, like a coin or a nail (chipped stamps, a width that follows the speed, rough ends), and sheds it as grains that flick off and fall, with light selection ticks. A coarse grid tracks the scratched share: past the threshold, the rest of the foil dissolves from the last touch, Success haptic, onReveal. Reduced motion keeps the card flat and fades the foil instead.',
    hint: 'Scratch the foil with the mouse or a finger',
    tileHint: 'Scratch the foil',
    mount: mountScratch,
    code: add('scratch-card', 'ScratchCard', `<ScratchCard onReveal={claim}>
  <Text className="text-[40px] font-bold text-dissolve-foreground">$25</Text>
</ScratchCard>

// Gold foil, a bigger brush, reset from a ref.
const card = useRef<ScratchCardHandle>(null);
<ScratchCard ref={card} color="#D9B26F" label="Scratch for your code" brush={44} threshold={0.6}>
  <PromoCode code="SPRING25" />
</ScratchCard>
card.current?.reset();`),
    props: [
      prop('children', 'ReactNode', '', 'What the foil hides, centered on the card.'),
      prop('width / height', 'number', '320 / 200', 'Card size in points.'),
      prop('radius', 'number', '24', 'Corner radius.'),
      prop('color', 'string', `'#C3C8D0'`, 'Foil base color. A warm tone like #D9B26F gives gold.'),
      prop('label', 'string', `'Scratch to reveal'`, 'Text printed on the foil, erased with it. Empty hides it.'),
      prop('brush', 'number', '38', 'Scratch stroke width in points.'),
      prop('threshold', 'number', '0.55', 'Share of the foil to scratch before the rest dissolves.'),
      prop('tilt', 'number', '9', 'Max tilt in degrees under the finger. 0 keeps the card flat. Off under reduced motion.'),
      prop('haptics', 'boolean', 'true', 'Selection ticks while scratching, Success on reveal.'),
      prop('disabled', 'boolean', 'false', 'No scratching, the card still shows.'),
      prop('onReveal', '() =&gt; void', '', 'Called once the foil is gone.'),
      prop('onScratchStart', '() =&gt; void', '', 'Called on the first stroke after mount or reset.'),
      prop('className / contentClassName', 'string', '', 'Card classes (background, border...) and the classes of the box that centers the children.'),
      prop('ref', 'ScratchCardHandle', '', 'reset() puts the foil back, reveal() dissolves it now, progress() gives the scratched share.'),
    ],
  },
};
