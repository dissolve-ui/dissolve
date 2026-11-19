// Skeleton demo. The placeholders and the handoff are the React web component's core
// (registry/web/skeleton.core.ts, built into web/lib), the same code a React app installs. This file
// keeps the demo: the profile and its posts, the Reload button and the gallery loop.
import { createSkeleton } from '../lib/skeleton.js';
import { el, fitTile, availW, prop, add, webAdd } from './kit.js';

/** Demo pacing: the fake network, and how long the content stays in the gallery loop. */
const LOAD = 1600;
const HOLD = 1900;
const FADE = 240;

const PROFILE = { name: 'Maya Chen', handle: '@mayapaints', img: 'pines' };
const POSTS = [
  { title: 'Cypress alley', sub: 'Golden hour, Tuscany', img: 'cypress' },
  { title: 'Quiet lake', sub: 'Morning mist, 7:40', img: 'lake' },
];

function mountSkeleton(body, { sc, mode }) {
  const tile = mode === 'tile';
  const CW = tile ? 300 : Math.round(Math.min(340, availW(body) || 320));

  const root = el('div', 'sk');
  root.style.width = CW + 'px';
  const img = (name, cls) => {
    const i = el('img', cls);
    i.src = `assets/paintings/${name}.jpg`;
    i.alt = '';
    i.draggable = false;
    return i;
  };
  const txt = (cls, s) => el('span', cls, s);

  /** Blocks are laid out first, then handed to the skeleton once it is in the document. */
  const pending = [];
  const block = (parent, props, content) => {
    const b = el('div');
    parent.append(b);
    pending.push({ b, props: { ...props, className: 'sk-bar' }, content });
  };

  const prof = el('div', 'sk-profile');
  block(prof, { shape: 'circle', size: 64 }, img(PROFILE.img, 'sk-avatar'));
  const names = el('div', 'sk-names');
  prof.append(names);
  block(names, { width: 148, height: 25 }, txt('sk-name', PROFILE.name));
  block(names, { width: 92, height: 20 }, txt('sk-handle', PROFILE.handle));
  root.append(prof);
  POSTS.forEach((p) => {
    const row = el('div', 'sk-row');
    block(row, { shape: 'rect', width: 52, height: 52, radius: 12 }, img(p.img, 'sk-thumb'));
    const col = el('div', 'sk-names');
    row.append(col);
    block(col, { width: 128, height: 22 }, txt('sk-title', p.title));
    block(col, { width: 168, height: 20 }, txt('sk-sub', p.sub));
    root.append(row);
  });
  const reload = el('button', 'sk-reload', 'Loading');
  reload.type = 'button';
  root.append(reload);
  body.append(tile ? fitTile(body, root, CW, 330) : root);

  let loading = true, revealed = null;
  const sk = createSkeleton(root, { loading, onReveal: () => revealed?.() });
  const blocks = pending.map(({ b, props, content }) => {
    const k = sk.block(b, props);
    k.slot.append(content);
    return k;
  });
  sc.onDispose(() => { blocks.forEach((k) => k.destroy()); sk.destroy(); });

  const setLabel = () => {
    reload.textContent = loading ? 'Loading' : 'Reload';
    reload.classList.toggle('busy', loading);
  };
  /** Placeholders back: resolves once they have faded in. Content: once every block shows it. */
  const load = (on) => {
    loading = on;
    if (on) { setLabel(); sk.update({ loading }); return sc.wait(FADE); }
    const shown = new Promise((res) => { revealed = res; });
    sk.update({ loading });
    return shown.then(setLabel);
  };

  let busy = null;
  async function cycle(hold) {
    if (!loading) await load(true);
    await sc.wait(LOAD);
    if (!sc.alive) return;
    await load(false);
    if (hold && sc.alive) {
      await sc.wait(HOLD);
      if (sc.alive) await load(true);
    }
  }
  const go = (hold) => { busy ??= cycle(hold).finally(() => { busy = null; }); return busy; };
  reload.addEventListener('click', () => { if (!loading && !busy) go(false); });
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
    webCode: webAdd('skeleton', 'Skeleton, SkeletonBlock', `<Skeleton loading={!user}>
  <div className="flex items-center gap-4">
    <SkeletonBlock shape="circle" size={64}>
      <img src={user?.avatar} alt="" width={64} height={64} className="rounded-full" />
    </SkeletonBlock>
    <div className="flex flex-1 flex-col gap-1">
      <SkeletonBlock width={160} height={25}>
        <span className="text-[20px] font-semibold">{user?.name}</span>
      </SkeletonBlock>
      <SkeletonBlock width={96}>
        <span className="text-[15px] text-dissolve-muted">{user?.handle}</span>
      </SkeletonBlock>
    </div>
  </div>
</Skeleton>

// The dotted form, a cover and a paragraph.
<Skeleton loading={loading} stagger={80} onReveal={() => track('feed_shown')}>
  <Skeleton.Block shape="rect" height={180} radius={20}>
    <Cover post={post} />
  </Skeleton.Block>
  <Skeleton.Block lines={3} height={22} className="mt-3">
    <p>{post?.body}</p>
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
