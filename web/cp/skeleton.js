// Skeleton (registry/skeleton.tsx), ported raw. Same wave (clock, span, depth), same handoff: each
// placeholder block is morphed by the engine into its real content, in reading order, with the
// same stagger compression and durations as the native source.
import { CALM, el, clamp, snapshot, snapNode, rr, cover, IMG, fitTile, availW, loop, frame, onTheme, prop, add } from './kit.js';
import { morph } from '../engine/atlas.js';
const RM = matchMedia('(prefers-reduced-motion: reduce)');

/** As in skeleton.tsx. */
const SK = { WAVE_MS: 1800, WAVE_SPAN: 520, DEPTH: 0.42, SETTLE: 180, TOTAL: 900, FADE: 240, STAGGER: 70, DURATION: 600, GRAIN: 3, LOAD: 1600, HOLD: 1900 };

const PROFILE = { name: 'Maya Chen', handle: '@mayapaints', img: 'pines' };
const POSTS = [
  { title: 'Cypress alley', sub: 'Golden hour, Tuscany', img: 'cypress' },
  { title: 'Quiet lake', sub: 'Morning mist, 7:40', img: 'lake' },
];

/**
 * One block, as SkeletonBlock: a placeholder (shape, width, height) over its content.
 * line: a bar 0.6 of the line height, centered. circle: size across. rect: width by height.
 */
function block(shape, { w, h, r }, content) {
  const b = el('div', `sk-b sk-${shape}`);
  const ph = el('div', 'sk-ph');
  const bar = el('i');
  const H = shape === 'line' ? Math.max(6, Math.round(h * 0.6)) : h;
  ph.style.width = w + 'px';
  ph.style.height = h + 'px';
  bar.style.width = w + 'px';
  bar.style.height = H + 'px';
  bar.style.borderRadius = (r ?? (shape === 'line' ? H / 2 : shape === 'circle' ? h / 2 : 12)) + 'px';
  ph.append(bar);
  const c = el('div', 'sk-c');
  c.append(content);
  b.append(c, ph);
  return { b, ph, bar, c, shape, w, h, H, r: shape === 'circle' ? h / 2 : r ?? 12, phase: 0, img: null, vis: 1 };
}

function mountSkeleton(body, { sc, mode }) {
  const tile = mode === 'tile';
  const CW = tile ? 300 : Math.round(Math.min(340, availW(body) || 320));

  const root = el('div', 'sk');
  root.style.width = CW + 'px';
  const blocks = [];
  const img = (name, cls) => {
    const i = el('img', cls);
    i.src = `assets/paintings/${name}.jpg`;
    i.alt = '';
    i.draggable = false;
    return i;
  };
  const txt = (cls, s) => el('span', cls, s);

  // Profile: avatar, name, handle.
  const prof = el('div', 'sk-profile');
  const av = block('circle', { w: 64, h: 64 }, img(PROFILE.img, 'sk-avatar'));
  av.img = PROFILE.img;
  const names = el('div', 'sk-names');
  const nm = block('line', { w: 148, h: 25 }, txt('sk-name', PROFILE.name));
  const hd = block('line', { w: 92, h: 20 }, txt('sk-handle', PROFILE.handle));
  names.append(nm.b, hd.b);
  prof.append(av.b, names);
  root.append(prof);
  blocks.push(av, nm, hd);
  // Posts: a thumbnail, a title, a subtitle.
  POSTS.forEach((p) => {
    const row = el('div', 'sk-row');
    const th = block('rect', { w: 52, h: 52, r: 12 }, img(p.img, 'sk-thumb'));
    th.img = p.img;
    const col = el('div', 'sk-names');
    const t = block('line', { w: 128, h: 22 }, txt('sk-title', p.title));
    const s = block('line', { w: 168, h: 20 }, txt('sk-sub', p.sub));
    col.append(t.b, s.b);
    row.append(th.b, col);
    root.append(row);
    blocks.push(th, t, s);
  });
  const reload = el('button', 'sk-reload', 'Loading');
  reload.type = 'button';
  root.append(reload);
  body.append(tile ? fitTile(body, root, CW, 330) : root);

  // Wave phase per block from its place in the skeleton, top left first.
  const phases = () => {
    const r = root.getBoundingClientRect(), s = r.width / root.offsetWidth || 1;
    blocks.forEach((k) => {
      const b = k.ph.getBoundingClientRect();
      k.phase = ((b.top - r.top) / s + ((b.left - r.left) / s) * 0.5) / SK.WAVE_SPAN;
    });
  };
  requestAnimationFrame(phases);

  // State: 'skeleton' (placeholders, wave), 'handoff', 'content'.
  let state = 'skeleton', wave = 0, waveTo = 1, waveAt = 0, waveFrom = 0, waveMs = 400, run = 0;
  const setWave = (to, ms) => { waveFrom = wave; waveTo = to; waveAt = performance.now(); waveMs = ms; lp.kick(); };
  const lp = loop(sc, root, (now) => {
    const k = waveMs > 0 ? clamp((now - waveAt) / waveMs) : 1;
    wave = waveFrom + (waveTo - waveFrom) * CALM(k);
    const c = (now % SK.WAVE_MS) / SK.WAVE_MS;
    const w = RM.matches ? 0 : wave;
    for (const b of blocks) {
      const dip = w > 0 ? SK.DEPTH * w * (0.5 + 0.5 * Math.cos(2 * Math.PI * (c - b.phase))) : 0;
      b.ph.style.opacity = String(b.vis * (1 - dip));
    }
  }, () => state !== 'content' || wave > 0.001);
  setWave(1, 400);

  const setLabel = () => {
    reload.textContent = state === 'content' ? 'Reload' : 'Loading';
    reload.classList.toggle('busy', state !== 'content');
  };

  /** Canvas of the placeholder as seen (wave settled), and of the content, at on screen size. */
  const snapA = (k) => snapNode(k.ph, [{ node: k.bar, fill: true, radius: Math.min(parseFloat(k.bar.style.borderRadius), k.H / 2) }]);
  const snapB = (k) => {
    if (k.img) {
      return snapNode(k.c, [{ node: k.c.firstChild, draw: (ctx, a) => { ctx.save(); rr(ctx, a.x, a.y, a.w, a.h, k.r); ctx.clip(); cover(ctx, IMG[k.img], a.x, a.y, a.w, a.h); ctx.restore(); } }]);
    }
    return snapNode(k.c, [{ node: k.c.firstChild }]);
  };
  const boxOf = (node, source) => { const r = node.getBoundingClientRect(); return { source, x: r.left, y: r.top, w: r.width, h: r.height }; };

  const showContent = (k, fade) => {
    k.c.style.transition = fade ? `opacity ${SK.FADE}ms cubic-bezier(0.32, 0.72, 0, 1)` : 'none';
    k.c.style.opacity = '1';
  };

  async function handoff() {
    const id = ++run;
    const live = () => sc.alive && run === id;
    state = 'handoff';
    setLabel();
    if (RM.matches) {
      blocks.forEach((k) => { k.vis = 0; showContent(k, true); });
      lp.kick();
      await sc.wait(SK.FADE);
      if (!live()) return;
      state = 'content';
      setLabel();
      return;
    }
    setWave(0, SK.SETTLE);
    await sc.wait(SK.SETTLE);
    await frame();
    if (!live()) return;
    // Reading order: rows top to bottom, then left to right.
    const jobs = blocks.map((k) => ({ k, a: boxOf(k.ph, snapA(k)), b: boxOf(k.c, snapB(k)) }));
    jobs.sort((p, q) => (Math.abs(p.a.y - q.a.y) > 6 ? p.a.y - q.a.y : p.a.x - q.a.x));
    const step = Math.max(0, Math.min(SK.STAGGER, (SK.TOTAL - SK.DURATION) / (jobs.length - 1)));
    await Promise.all(jobs.map(async ({ k, a, b }, i) => {
      if (i) await sc.wait(i * step);
      if (!live()) return;
      const h = sc.track(morph(a, b, { grain: SK.GRAIN, duration: SK.DURATION }));
      // The overlay paints the placeholder first, then the real one hides.
      frame().then(() => frame()).then(() => { if (live()) { k.vis = 0; lp.kick(); } });
      await h.done;
      if (live()) showContent(k, false);
    }));
    if (!live()) return;
    state = 'content';
    setLabel();
  }

  /** Back to the placeholders: they fade in, the content goes, the wave starts again. */
  async function toSkeleton() {
    ++run;
    state = 'skeleton';
    setLabel();
    // Crossfade: the content fades out under the placeholders fading in, no blank frame.
    blocks.forEach((k) => { k.c.style.transition = `opacity ${SK.FADE}ms cubic-bezier(0.32, 0.72, 0, 1)`; k.c.style.opacity = '0'; });
    const t0 = performance.now();
    const from = blocks.map((k) => k.vis);
    await new Promise((done) => {
      const f = (now) => {
        if (!sc.alive) return done();
        const e = CALM(clamp((now - t0) / SK.FADE));
        blocks.forEach((k, i) => { k.vis = from[i] + (1 - from[i]) * e; });
        lp.kick();
        if (e < 1) requestAnimationFrame(f); else done();
      };
      requestAnimationFrame(f);
    });
    setWave(1, 400);
  }

  let busy = null;
  async function cycle(hold) {
    if (state === 'content') await toSkeleton();
    if (!sc.alive) return;
    await sc.wait(SK.LOAD);
    if (!sc.alive) return;
    await handoff();
    if (hold && sc.alive) {
      await sc.wait(SK.HOLD);
      if (sc.alive) await toSkeleton();
    }
  }
  const go = (hold) => { busy ??= cycle(hold).finally(() => { busy = null; }); return busy; };
  reload.addEventListener('click', () => { if (state === 'content' && !busy) go(false); });
  onTheme(sc, () => lp.kick());
  setLabel();
  // Its own page: loads once by itself, then Reload replays it.
  if (mode === 'stage') go(false);

  return {
    // Gallery loop: shimmer, the grains form the content, hold, back to the skeleton.
    run: () => go(true),
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  skeleton: {
    title: 'Skeleton',
    note: 'Loading placeholders that turn into the content, grain by grain.',
    desc: 'Loading placeholders that do not just crossfade. While loading, a calm wave of light rolls across the blocks, top left to bottom right. When loading turns false, every placeholder breaks into grains and those same grains recompose the real content, block by block in reading order (about 70 ms apart, compressed so the whole handoff stays under 900 ms), with one light haptic as the first grains land. The content shows exactly where its grains land. You describe the placeholders and keep your content: wrap each piece in SkeletonBlock with its shape while loading, a line (a rounded bar centered in its line height, lines for a paragraph), a circle (an avatar) or a rect (an image, a card). Children only render once loading is false, so they can read data that is not there yet. Reduced motion: no wave, a short crossfade.',
    hint: 'Press Reload to load the profile again',
    tileHint: 'Press Reload',
    mount: mountSkeleton,
    code: add('skeleton', 'Skeleton, SkeletonBlock', `<Skeleton loading={!user}>
  <View className="flex-row items-center gap-4">
    <SkeletonBlock shape="circle" size={64}>
      <Image source={user?.avatar} style={{ width: 64, height: 64, borderRadius: 32 }} />
    </SkeletonBlock>
    <View className="flex-1 gap-1">
      <SkeletonBlock width={160} height={25}>
        <Text className="text-[20px] font-semibold">{user?.name}</Text>
      </SkeletonBlock>
      <SkeletonBlock width={96}>
        <Text className="text-[15px] text-dissolve-muted">{user?.handle}</Text>
      </SkeletonBlock>
    </View>
  </View>
</Skeleton>

// The dotted form, a cover and a paragraph.
<Skeleton loading={loading} stagger={80} onReveal={() => track('feed_shown')}>
  <Skeleton.Block shape="rect" height={180} radius={20}>
    <Cover post={post} />
  </Skeleton.Block>
  <Skeleton.Block lines={3} height={22} className="mt-3">
    <Text>{post?.body}</Text>
  </Skeleton.Block>
</Skeleton>`),
    props: [
      prop('loading', 'boolean', 'required', 'True shows the placeholders. False hands every block over to its content in grains.'),
      prop('children', 'ReactNode', 'required', 'Any layout, with SkeletonBlocks anywhere inside it.'),
      prop('shimmer', 'boolean', 'true', 'Wave of light across the blocks while loading. Off under reduced motion.'),
      prop('color', `'surface' | 'surface-2' | 'border'`, `'surface'`, 'Placeholder fill as a theme token.'),
      prop('stagger', 'number', '70', 'Delay between two blocks in ms, in reading order. Compressed with many blocks so the handoff stays under about 900 ms.'),
      prop('duration', 'number', '600', 'Duration of one block\'s handoff in ms.'),
      prop('grain', 'number', '3', 'Grain size in points.'),
      prop('haptics', 'boolean', 'true', 'One light impact as the first grains land.'),
      prop('onReveal', '() =&gt; void', '', 'Called once every block shows its content.'),
      prop('className / style', 'string / ViewStyle', '', 'Root classes and style.'),
      prop('SkeletonBlock', '{ shape?, width?, height?, size?, radius?, lines?, className?, style? }', '', `Wraps one piece of content. shape: 'line' (default, a bar 0.6 of height, height default 20), 'circle' (size across, default 40) or 'rect' (width by height, default 100% by 120, radius 12). lines stacks bars for a paragraph. className restyles the placeholder, style goes to the outer box. Also available as Skeleton.Block.`),
    ],
  },
};
