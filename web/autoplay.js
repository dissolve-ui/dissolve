// Autoplay of the demos: the gallery conductor (one demo at a time, in reading order) and the
// "Every variant" sequence of the effects page.
import { scope } from './cp/kit.js';

/**
 * Autoplay, one demo at a time. Every mounted demo registers here; a single conductor walks the
 * visible ones in page order, plays one, waits a beat, then moves to the next. A touch, click or
 * key inside a demo hands it to the visitor until it has been idle a few seconds. Reduced motion
 * turns it off. With nothing visible the conductor sleeps; a demo scrolling into view wakes it.
 */
const AUTO = { list: [], last: -1, timer: 0, playing: false, BEAT: 900, IDLE: 7000, CAP: 9000 };

function conduct() {
  clearTimeout(AUTO.timer);
  if (AUTO.playing) return;
  const now = performance.now();
  const ready = AUTO.list
    .filter((d) => d.visible && now - d.touched > AUTO.IDLE)
    .sort((a, b) => a.rank - b.rank);
  if (!ready.length) {
    // Only demos the visitor is using are in view: come back when the first one is free again.
    const busy = AUTO.list.filter((d) => d.visible);
    if (busy.length) AUTO.timer = setTimeout(conduct, Math.max(250, Math.min(...busy.map((d) => d.touched)) + AUTO.IDLE - now + 50));
    return;
  }
  const next = ready.find((d) => d.rank > AUTO.last) ?? ready[0];
  AUTO.last = next.rank;
  AUTO.playing = true;
  // Cap a run so one long story (or a demo disposed mid run) never holds the queue.
  Promise.race([Promise.resolve(next.demo.run()), new Promise((r) => setTimeout(r, AUTO.CAP))]).catch(() => {}).finally(() => {
    AUTO.playing = false;
    if (AUTO.list.some((d) => d.visible)) AUTO.timer = setTimeout(conduct, AUTO.BEAT);
  });
}

let ORDER_SEQ = 0;
/** Registers a demo ({ run }) shown in `el` with the conductor. Returns a dispose function. */
export function autoplay(el, demo, { threshold = 0.6, rank } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  // rank: reading order (the masonry columns put DOM order column by column).
  const d = { el, demo, visible: false, touched: -1e9, rank: rank ?? 1000 + ++ORDER_SEQ };
  AUTO.list.push(d);
  const io = new IntersectionObserver(([en]) => {
    d.visible = en.isIntersecting && en.intersectionRatio >= threshold;
    if (d.visible && !AUTO.playing) { clearTimeout(AUTO.timer); AUTO.timer = setTimeout(conduct, 500); }
  }, { threshold: [0, threshold, 1] });
  io.observe(el);
  const hand = () => { d.touched = performance.now(); };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) el.addEventListener(ev, hand, { passive: true });
  return () => {
    io.disconnect();
    AUTO.list = AUTO.list.filter((x) => x !== d);
    if (!AUTO.list.length) { AUTO.playing = false; clearTimeout(AUTO.timer); }
  };
}


/**
 * Plays the "Every variant" tiles one after another instead of all at once, so each
 * variant's timing reads on its own. Only tiles that are shown (filters) and on screen
 * take part. The cycle loops while the grid is visible. Returns a dispose function.
 */
export function sequence(grid, demos, { gap = 700, rest = 1600 } = {}) {
  const sc = scope();
  let visible = false, running = false;
  const onScreen = (el) => {
    if (el.closest('[hidden]') || el.offsetParent === null) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 60 && r.top < innerHeight - 40;
  };
  async function loop() {
    if (running) return;
    running = true;
    while (visible && sc.alive) {
      let played = 0;
      for (const d of demos) {
        if (!visible || !sc.alive) break;
        if (!d.api?.run || d.el.dataset.demo === 'peel' || !onScreen(d.el)) continue;
        const r = d.api.run();
        played += 1;
        // A component demo is a short story (press, wait, settle): let it finish before the next tile.
        if (d.component) await Promise.race([r, sc.wait(7000)]);
        await sc.wait(gap);
      }
      await sc.wait(played ? rest : 400);
    }
    running = false;
  }
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) loop();
  }, { threshold: 0.15 });
  io.observe(grid);
  sc.onDispose(() => io.disconnect());
  return sc.dispose;
}
