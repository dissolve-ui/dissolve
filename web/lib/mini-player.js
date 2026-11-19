// Built from registry/web by scripts/build-web.mjs, do not edit.
import {
  CALM,
  claimTouch,
  clamp,
  el,
  injectStyle,
  plainButton,
  propsOf,
  reducedMotion,
  scope,
  value,
  vibrate
} from "./chunks/chunk-BCIF2ROM.js";

// registry/web/mini-player.core.ts
var DEFAULTS = { progress: 0, bottom: 24, topInset: 60, haptics: true, glass: true };
var PILL_H = 64;
var ART_C = 40;
var TITLE = 22;
var TITLE_C = 15;
var SKIP = 24;
var TEXT_X = 64;
var CTRL_W = 8 + 40 + 4 + 40;
var TEXT_GAP = 12;
var TITLE_LH = 28;
var SUB_LH = 17;
var SUB_GAP = 1;
var POP = { stiffness: 420, damping: 15, mass: 0.6, eps: 2e-3 };
var svg = (d) => `<svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
var I_PLAY = svg("M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z");
var I_PAUSE = svg("M6.6 4h3.2a1.1 1.1 0 0 1 1.1 1.1v13.8a1.1 1.1 0 0 1-1.1 1.1H6.6a1.1 1.1 0 0 1-1.1-1.1V5.1A1.1 1.1 0 0 1 6.6 4zm7.6 0h3.2a1.1 1.1 0 0 1 1.1 1.1v13.8a1.1 1.1 0 0 1-1.1 1.1h-3.2a1.1 1.1 0 0 1-1.1-1.1V5.1A1.1 1.1 0 0 1 14.2 4z");
var I_NEXT = svg("M2.5 6.6v10.8a.9.9 0 0 0 1.4.74L11.5 13v4.4a.9.9 0 0 0 1.4.74l8.4-5.4a.9.9 0 0 0 0-1.5l-8.4-5.4a.9.9 0 0 0-1.4.74V11L3.9 5.86a.9.9 0 0 0-1.4.74z");
var I_PREV = I_NEXT.replace("<svg ", '<svg style="transform:scaleX(-1)" ');
var line = (d) => `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
var EXTRAS = [
  [line("M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8.5 9.5v2.2M8.5 9.5h1.6M13.5 9.5v2.2M13.5 9.5h1.6"), "Lyrics"],
  [line("M7 17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M12 15l5 6H7z"), "AirPlay"],
  [line("M8.5 6.5h12M8.5 12h12M8.5 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"), "Up next"]
];
var RING = `<svg class="dissolve-player-ring" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="var(--dissolve-border, rgb(60 60 67 / 0.12))" stroke-width="2"/><circle class="dissolve-player-fill" cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" transform="rotate(-90 20 20)" pathLength="1" stroke-dasharray="1 1"/></svg>`;
var glyph = (size) => `<span class="dissolve-player-glyph" style="width:${size}px;height:${size}px"><span>${I_PLAY}</span><span>${I_PAUSE}</span></span>`;
var ic = (icon, size) => `<span class="dissolve-player-ic" style="width:${size}px;height:${size}px">${icon}</span>`;
var fmt = (s) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
var CSS = `
:where([data-dissolve="mini-player"]) { position: absolute; inset: 0; pointer-events: none; text-align: left; }
:where(.dissolve-player-backdrop) { position: absolute; inset: 0; background: var(--dissolve-background, rgb(255 255 255)); opacity: 0; }
:where(.dissolve-player) {
  position: absolute; left: 0; top: 0; overflow: hidden; touch-action: pan-y; cursor: pointer; pointer-events: auto;
  background: var(--dissolve-surface, rgb(242 242 247));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16), inset 0 0 0 1px var(--dissolve-border, rgb(60 60 67 / 0.12));
  color: var(--dissolve-foreground, rgb(28 28 30));
  user-select: none; -webkit-user-select: none; will-change: transform, width, height; -webkit-tap-highlight-color: transparent;
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  :where(.dissolve-player[data-glass]) {
    background: color-mix(in srgb, var(--dissolve-surface, rgb(242 242 247)) 55%, transparent);
    -webkit-backdrop-filter: blur(22px) saturate(180%); backdrop-filter: blur(22px) saturate(180%);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16), inset 0 1px 0.5px rgba(255, 255, 255, 0.5), inset 0 -1px 1px rgba(255, 255, 255, 0.3),
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.3), inset 0 -10px 24px -14px rgba(0, 0, 0, 0.12);
  }
}
:where([data-dissolve="mini-player"][data-open]) .dissolve-player { cursor: grab; }
:where(.dissolve-player[data-dragging]) { cursor: grabbing; }
:where(.dissolve-player button) { -webkit-tap-highlight-color: transparent; }
:where(.dissolve-player-hit) { position: absolute; inset: 0; border-radius: inherit; }
:where(.dissolve-player-hit[hidden]) { display: none; }
:where(.dissolve-player-hit:focus-visible) { box-shadow: inset 0 0 0 2px var(--dissolve-accent, rgb(10 132 255)); }
:where(.dissolve-player-art) {
  position: absolute; left: 0; top: 0; overflow: hidden; background: var(--dissolve-surface-2, rgb(229 229 234)) center / cover;
  transform-origin: 0 0; pointer-events: none; will-change: transform;
}
:where(.dissolve-player-title) {
  position: absolute; left: 0; top: 0; font-size: 22px; line-height: 28px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transform-origin: 0 0; pointer-events: none; will-change: transform;
}
:where(.dissolve-player-probe) { width: max-content; max-width: none; visibility: hidden; transform: none; }
:where(.dissolve-player-sub) {
  position: absolute; left: 64px; font-size: 13px; line-height: 17px; color: var(--dissolve-muted, rgb(142 142 147));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;
}
:where(.dissolve-player-pill) { position: absolute; right: 8px; top: 12px; height: 40px; display: flex; align-items: center; gap: 4px; }
:where(.dissolve-player-btn) {
  position: relative; flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%;
  transition: transform .09s cubic-bezier(0.32, 0.72, 0, 1);
}
:where(.dissolve-player-btn[data-down]) { transform: scale(0.86); }
:where(.dissolve-player-btn:focus-visible, .dissolve-player-grab:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: -2px; }
:where(.dissolve-player-ic) { display: block; }
:where(.dissolve-player-ic, .dissolve-player-glyph) svg { display: block; }
:where(.dissolve-player-ring) { position: absolute; inset: 0; }
:where(.dissolve-player-fill) { transition: stroke-dashoffset .3s linear; }
:where(.dissolve-player-glyph) { position: relative; display: block; }
:where(.dissolve-player-glyph) > span { position: absolute; inset: 0; display: block; }
:where(.dissolve-player-grab) { position: absolute; left: 50%; top: 0; width: 60px; height: 28px; margin-left: -30px; display: grid; place-items: center; border-radius: 10px; }
:where(.dissolve-player-grab) i { display: block; width: 36px; height: 5px; border-radius: 3px; background: var(--dissolve-muted, rgb(142 142 147)); opacity: .4; }
:where(.dissolve-player-block) { position: absolute; padding: 0 32px; display: flex; flex-direction: column; transform-origin: 50% 0; }
:where(.dissolve-player-bsub) {
  margin: 0; text-align: center; font-size: 17px; line-height: 22px; color: var(--dissolve-muted, rgb(142 142 147));
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
:where(.dissolve-player-bar) { margin-top: 22px; height: 14px; }
:where(.dissolve-player-bar) svg { display: block; }
:where(.dissolve-player-times) {
  margin-top: 6px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 500;
  color: var(--dissolve-muted, rgb(142 142 147)); font-variant-numeric: tabular-nums;
}
:where(.dissolve-player-controls) { margin-top: 18px; display: flex; align-items: center; justify-content: space-evenly; }
:where(.dissolve-player-spacer) { flex: 1; }
:where(.dissolve-player-slot:empty) { display: none; }
:where(.dissolve-player-extras) { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; color: var(--dissolve-muted, rgb(142 142 147)); }
:where(.dissolve-player-extras) .dissolve-player-btn { width: 44px; height: 44px; }
:where(.dissolve-player-slot:not(:empty) + .dissolve-player-extras) { display: none; }
@media (prefers-reduced-motion: reduce) {
  :where(.dissolve-player-fill, .dissolve-player-btn) { transition: none; }
}
`;
function sample(list, e) {
  const now = performance.now();
  list.push([now, e.clientX, e.clientY]);
  while (list.length > 2 && now - list[0][0] > 80) list.shift();
}
function velocity(list) {
  if (list.length < 2) return { vx: 0, vy: 0 };
  const a = list[0], b = list[list.length - 1], dt = (b[0] - a[0]) / 1e3;
  return dt > 0 ? { vx: (b[1] - a[1]) / dt, vy: (b[2] - a[2]) / dt } : { vx: 0, vy: 0 };
}
function createMiniPlayer(host, initial) {
  injectStyle("dissolve-mini-player", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  host.dataset.dissolve = "mini-player";
  const backdrop = el("div", "dissolve-player-backdrop");
  const sheet = el("div");
  const hit = plainButton("dissolve-player-hit");
  const art = el("div", "dissolve-player-art");
  const titleEl = el("span", "dissolve-player-title");
  const probe = el("span", "dissolve-player-title dissolve-player-probe");
  probe.setAttribute("aria-hidden", "true");
  const sub = el("span", "dissolve-player-sub");
  const pill = el("div", "dissolve-player-pill");
  const pPlay = plainButton("dissolve-player-btn", RING + glyph(17));
  const pNext = plainButton("dissolve-player-btn", ic(I_NEXT, 20));
  pNext.setAttribute("aria-label", "Next track");
  pill.append(pPlay, pNext);
  const grab = plainButton("dissolve-player-grab", "<i></i>");
  grab.setAttribute("aria-label", "Close player");
  const block = el("div", "dissolve-player-block");
  const bsub = el("p", "dissolve-player-bsub");
  const bar = el("div", "dissolve-player-bar");
  const times = el("div", "dissolve-player-times", "<span></span><span></span>");
  const controls = el("div", "dissolve-player-controls");
  const fPrev = plainButton("dissolve-player-btn", ic(I_PREV, 30));
  const fPlay = plainButton("dissolve-player-btn", glyph(42));
  const fNext = plainButton("dissolve-player-btn", ic(I_NEXT, 30));
  fPrev.style.width = fPrev.style.height = fNext.style.width = fNext.style.height = "64px";
  fPlay.style.width = fPlay.style.height = "76px";
  fPrev.setAttribute("aria-label", "Previous track");
  fNext.setAttribute("aria-label", "Next track");
  controls.append(fPrev, fPlay, fNext);
  const slot = el("div", "dissolve-player-slot");
  const extras = el("div", "dissolve-player-extras");
  for (const [icon, label] of EXTRAS) {
    const b = plainButton("dissolve-player-btn", ic(icon, 20));
    b.setAttribute("aria-label", label);
    extras.append(b);
  }
  block.append(bsub, bar, times, controls, el("div", "dissolve-player-spacer"), slot, extras);
  sheet.append(hit, probe, art, titleEl, sub, pill, grab, block);
  host.append(backdrop, sheet);
  const ringFill = pPlay.querySelector(".dissolve-player-fill");
  let CW = 0, CH = 0, Wc = 0, Hx = PILL_H, range = 1, A = 120, artX1 = 0, availC = 40, fullMax = 40;
  let titleY0 = 0, titleY1 = 0, natW = 0, barFill = null;
  const artY1 = 48, scC = TITLE_C / TITLE;
  function layout() {
    const { topInset, bottom, subtitle } = p();
    CW = host.clientWidth;
    CH = host.clientHeight;
    Wc = Math.round(CW * 0.92);
    Hx = Math.max(PILL_H, CH - topInset);
    range = Math.max(1, Hx - PILL_H - bottom);
    A = Math.max(120, Math.min(CW - 64, Hx - 48 - 300 - bottom));
    artX1 = (CW - A) / 2;
    availC = Math.max(40, Wc - TEXT_X - CTRL_W - TEXT_GAP);
    fullMax = Math.max(40, CW - 64);
    titleY0 = (PILL_H - (TITLE_LH * scC + (subtitle ? SUB_GAP + SUB_LH : 0))) / 2;
    titleY1 = artY1 + A + 24;
    const blockTop = titleY1 + 34;
    art.style.width = art.style.height = A + "px";
    sub.style.width = availC + "px";
    sub.style.top = (titleY0 + TITLE_LH * scC + SUB_GAP).toFixed(2) + "px";
    block.style.top = blockTop + "px";
    block.style.width = CW + "px";
    block.style.height = Math.max(0, Hx - blockTop - bottom) + "px";
    const barW = Math.max(0, CW - 64), end2 = Math.max(3, barW - 2);
    bar.innerHTML = `<svg width="${barW}" height="14" viewBox="0 0 ${barW} 14" aria-hidden="true"><path d="M2 7H${end2}" stroke="var(--dissolve-border, rgb(60 60 67 / 0.12))" stroke-width="4" stroke-linecap="round"/><path class="dissolve-player-fill" d="M2 7H${end2}" stroke="currentColor" stroke-width="4" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/></svg>`;
    barFill = bar.querySelector(".dissolve-player-fill");
    showProgress();
    render();
  }
  function measure() {
    const s = host.getBoundingClientRect().width / (host.offsetWidth || 1) || 1;
    natW = Math.ceil(probe.getBoundingClientRect().width / s);
  }
  let opened = !!p().expanded, target = opened ? 1 : 0, side = target;
  const render = () => {
    if (!CW) return;
    const v = clamp(o.v), sw = swipe.v;
    const w = Wc + (CW - Wc) * v;
    sheet.style.width = w.toFixed(2) + "px";
    sheet.style.height = (PILL_H + (Hx - PILL_H) * v).toFixed(2) + "px";
    sheet.style.transform = `translate3d(${((CW - w) / 2).toFixed(2)}px,${(CH - p().bottom * (1 - v) - (PILL_H + (Hx - PILL_H) * v)).toFixed(2)}px,0)`;
    sheet.style.borderRadius = (PILL_H / 2 + (38 - PILL_H / 2) * v).toFixed(2) + "px";
    backdrop.style.opacity = (v * 0.8).toFixed(3);
    backdrop.style.pointerEvents = opened ? "auto" : "none";
    const vy = 1 - (1 - v) * (1 - v), size = ART_C + (A - ART_C) * v, k = size / A;
    const fadeSw = 1 - Math.abs(sw) / SKIP * 0.75 * (1 - v);
    art.style.borderRadius = ((8 + 6 * v) / k).toFixed(2) + "px";
    art.style.opacity = fadeSw.toFixed(3);
    art.style.transform = `translate3d(${(12 + (artX1 - 12) * v + sw * (1 - v)).toFixed(2)}px,${(12 + (artY1 - 12) * vy).toFixed(2)}px,0) scale(${k.toFixed(4)})`;
    const w0 = Math.min(natW, availC / scC), w1 = Math.min(natW, fullMax);
    titleEl.style.width = (w0 + (w1 - w0) * v).toFixed(2) + "px";
    titleEl.style.opacity = natW ? fadeSw.toFixed(3) : "0";
    titleEl.style.transform = `translate3d(${(TEXT_X + ((CW - w1) / 2 - TEXT_X) * v + sw * 0.5 * (1 - v)).toFixed(2)}px,${(titleY0 + (titleY1 - titleY0) * vy).toFixed(2)}px,0) scale(${(scC + (1 - scC) * v).toFixed(4)})`;
    const kp = clamp(v / 0.35);
    pill.style.opacity = (1 - kp).toFixed(3);
    pill.style.transform = `scale(${(1 - 0.04 * kp).toFixed(4)})`;
    pill.style.visibility = kp < 1 ? "visible" : "hidden";
    sub.style.opacity = ((1 - kp) * (1 - Math.abs(sw) / SKIP * 0.75)).toFixed(3);
    sub.style.transform = `translate3d(${(sw * 0.5).toFixed(2)}px,0,0)`;
    const kb = clamp((v - 0.5) / 0.5);
    block.style.left = (-(CW - w) / 2).toFixed(2) + "px";
    block.style.opacity = kb.toFixed(3);
    block.style.transform = `scale(${(0.96 + 0.04 * kb).toFixed(4)})`;
    block.style.visibility = kb > 0 ? "visible" : "hidden";
    grab.style.opacity = kb.toFixed(3);
    grab.style.visibility = kb > 0 ? "visible" : "hidden";
  };
  const o = value(sc, target, render), swipe = value(sc, 0, render);
  const glyphs = [...sheet.querySelectorAll(".dissolve-player-glyph")];
  const pg = value(sc, p().playing ? 1 : 0, () => {
    const k = clamp(pg.v, -0.2, 1.2);
    for (const gl of glyphs) {
      const [a, b] = gl.children;
      a.style.opacity = clamp(1 - k).toFixed(3);
      a.style.transform = `scale(${(0.6 + 0.4 * (1 - k)).toFixed(4)})`;
      b.style.opacity = clamp(k).toFixed(3);
      b.style.transform = `scale(${(0.6 + 0.4 * k).toFixed(4)})`;
    }
  });
  pg.set(pg.v);
  function showProgress() {
    const { progress, duration } = p();
    const k = clamp(progress);
    ringFill.style.strokeDashoffset = (1 - k).toFixed(4);
    if (barFill) barFill.style.strokeDashoffset = (1 - k).toFixed(4);
    times.hidden = !duration;
    if (duration) {
      times.firstChild.textContent = fmt(k * duration);
      times.lastChild.textContent = "-" + fmt((1 - k) * duration);
    }
  }
  function showTrack() {
    const { title, subtitle, artwork } = p();
    const src = typeof artwork === "string" ? artwork : artwork?.uri;
    art.style.backgroundImage = src ? `url("${src.replace(/"/g, "%22")}")` : "";
    titleEl.textContent = probe.textContent = title;
    sub.textContent = bsub.textContent = subtitle ?? "";
    sub.hidden = bsub.hidden = !subtitle;
    hit.setAttribute("aria-label", `${subtitle ? `${title}, ${subtitle}` : title}. Opens the player`);
    measure();
    render();
  }
  function showPlay(instant = false) {
    const t = p().playing ? 1 : 0;
    instant || reducedMotion() ? pg.set(t) : pg.spring(t, POP);
    for (const b of [pPlay, fPlay]) b.setAttribute("aria-label", p().playing ? "Pause" : "Play");
  }
  const buzz = (ms) => {
    if (p().haptics) vibrate(ms);
  };
  function animateTo(t, ms = 500) {
    host.toggleAttribute("data-open", opened);
    hit.hidden = opened;
    sheet.setAttribute("aria-expanded", String(opened));
    render();
    return o.to(t, reducedMotion() ? 220 : ms, CALM).then((done) => {
      if (done) buzz(t === 1 ? 12 : 6);
    });
  }
  function request(t, ms) {
    const was = target;
    target = t;
    opened = t === 1;
    if (was !== t) p().onExpandedChange?.(opened);
    return animateTo(t, ms);
  }
  function skip(dir) {
    buzz(4);
    if (dir < 0) p().onNext?.();
    else p().onPrev?.();
  }
  async function swipeOut(dir) {
    const d = reducedMotion() ? 0 : SKIP;
    if (!await swipe.to(dir * d, 110, CALM)) return;
    skip(dir);
    swipe.set(-dir * d);
    await swipe.to(0, reducedMotion() ? 0 : 320, CALM);
  }
  const press = (fn) => () => {
    buzz(6);
    fn?.();
  };
  const offs = [];
  const on = (node, type, fn) => {
    node.addEventListener(type, fn);
    offs.push(() => node.removeEventListener(type, fn));
  };
  for (const b of [pPlay, fPlay]) on(b, "click", press(() => p().onPlayPause()));
  on(pNext, "click", press(() => swipeOut(-1)));
  on(fNext, "click", press(() => skip(-1)));
  on(fPrev, "click", press(() => skip(1)));
  on(grab, "click", () => request(0));
  on(backdrop, "click", () => request(0));
  on(hit, "click", (e) => {
    if (e.detail === 0 && !opened) request(1);
  });
  for (const b of [pPlay, pNext, grab, fPrev, fPlay, fNext, ...extras.children]) {
    on(b, "pointerdown", (e) => {
      e.stopPropagation();
      b.toggleAttribute("data-down", true);
    });
    for (const t of ["pointerup", "pointercancel", "pointerleave"]) on(b, t, () => b.removeAttribute("data-down"));
  }
  let g = null;
  const claimed = claimTouch(sheet, (_dx, dy) => !!g && (opened ? dy > 0 : dy < 0));
  on(sheet, "pointerdown", (e) => {
    if (e.button > 0) return;
    g = { x0: e.clientX, y0: e.clientY, axis: 0, start: o.v, samples: [], t0: performance.now() };
    sample(g.samples, e);
  });
  on(sheet, "pointermove", (e) => {
    if (!g) return;
    sample(g.samples, e);
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.axis) {
      if (!opened && Math.abs(dx) > 12 && Math.abs(dy) <= 10) g.axis = 1;
      else if (Math.abs(dy) > 8 && Math.abs(dx) <= 24) {
        if (e.pointerType === "touch" && !claimed()) {
          g = null;
          return;
        }
        g.axis = 2;
      } else if (Math.abs(dx) > 24) {
        g = null;
        return;
      } else return;
      try {
        sheet.setPointerCapture(e.pointerId);
      } catch {
      }
      sheet.toggleAttribute("data-dragging", true);
      if (g.axis === 2) {
        opened = g.start > 0.5;
        side = opened ? 1 : 0;
      }
    }
    if (g.axis === 1) swipe.set(clamp(dx * 0.5, -SKIP, SKIP));
    else {
      o.set(clamp(g.start - dy / range));
      const s = o.v > 0.5 ? 1 : 0;
      if (s !== side) {
        side = s;
        buzz(4);
      }
    }
  });
  const end = (e) => {
    if (!g) return;
    const st = g;
    g = null;
    sheet.removeAttribute("data-dragging");
    const { vx, vy } = velocity(st.samples);
    if (st.axis === 1) {
      const dx = e.clientX - st.x0;
      if (e.type === "pointerup" && (Math.abs(dx) > 56 || Math.abs(vx) > 500)) swipeOut((dx || vx) < 0 ? -1 : 1);
      else swipe.to(0, reducedMotion() ? 0 : 260, CALM);
      return;
    }
    if (st.axis === 2) {
      request(Math.abs(vy) > 600 ? vy < 0 ? 1 : 0 : o.v > 0.5 ? 1 : 0, 420);
      return;
    }
    if (e.type === "pointerup" && !opened && performance.now() - st.t0 < 500) request(1);
  };
  on(sheet, "pointerup", end);
  on(sheet, "pointercancel", end);
  on(host, "keydown", (e) => {
    if (e.key === "Escape" && opened) {
      e.preventDefault();
      request(0);
      hit.focus({ preventScroll: true });
    }
  });
  const ro = new ResizeObserver(() => {
    if (host.clientWidth === CW && host.clientHeight === CH) return;
    layout();
  });
  ro.observe(host);
  sc.onDispose(() => ro.disconnect());
  document.fonts?.ready.then(() => {
    if (sc.alive) {
      measure();
      render();
    }
  });
  const applySurface = () => {
    sheet.className = "dissolve-player" + (p().className ? " " + p().className : "");
    sheet.toggleAttribute("data-glass", p().glass);
  };
  applySurface();
  host.toggleAttribute("data-open", opened);
  hit.hidden = opened;
  sheet.setAttribute("aria-expanded", String(opened));
  showTrack();
  showPlay(true);
  layout();
  return {
    slot,
    close: () => request(0),
    update(next) {
      const changed = props.update(next);
      if (!changed.size) return;
      const has = (...keys) => keys.some((k) => changed.has(k));
      if (has("className", "glass")) applySurface();
      if (has("title", "subtitle", "artwork")) showTrack();
      if (has("playing")) showPlay();
      if (has("topInset", "bottom", "subtitle")) layout();
      else if (has("progress", "duration")) showProgress();
      const { expanded } = p();
      if (changed.has("expanded") && expanded !== void 0 && (expanded ? 1 : 0) !== target) {
        target = expanded ? 1 : 0;
        opened = expanded;
        animateTo(target);
      }
    },
    destroy() {
      sc.dispose();
      g = null;
      offs.forEach((off) => off());
      backdrop.remove();
      sheet.remove();
      host.removeAttribute("data-open");
      delete host.dataset.dissolve;
    }
  };
}
export {
  createMiniPlayer
};
