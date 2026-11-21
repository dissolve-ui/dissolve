// The built-in components (src/dissolve/components/*): Toast, SwipeToDelete, LikeButton, MorphButton,
// SplitButton, GooeyMenu, ported to the web on the same engine. Each port follows its native source:
// same timings, curves, thresholds and geometry. Anything that turns into grains is drawn on a canvas,
// so the snapshot handed to the engine is exact.
import { createToast } from '../lib/toast.js';
import { createSwipeToDelete } from '../lib/swipe-to-delete.js';
import { createLikeButton } from '../lib/like-button.js';
import { createMorphButton } from '../lib/morph-button.js';
import { createSplitButton } from '../lib/split-button.js';
import { createGooeyMenu } from '../lib/gooey-menu.js';
import { play, snapshot, FONT, pal, IN_OUT_CUBIC, el, rectOf, fit, label, tween, PKG, DIR, prop } from './kit.js';

/* ======================================================================================
   Toast (Toast.tsx): the React web component's core (registry/web/toast.core.ts, built into
   web/lib), the same code a React app installs. This file keeps the demo: the hosts and the triggers.
   ====================================================================================== */

/**
 * A toast stack on the core. fixed: true pins it to the top of the viewport (the page wide host);
 * otherwise it fills `container` (a positioned element) from the top, used by the gallery tile.
 */
function toastHost(container, { fixed = false, max = 3 } = {}) {
  const host = el('div', 'cp-toasts' + (fixed ? ' cp-toasts-fixed' : ''));
  container.append(host);
  const t = createToast(host, { max, cardClassName: 'cp-toast' });
  return { show: t.show, clear() { t.destroy(); host.remove(); } };
}

let pageToasts = null;
/** The page wide host, at the top of the viewport. */
export function toasts() {
  if (!pageToasts) pageToasts = toastHost(document.body, { fixed: true });
  return pageToasts;
}
/** Drops every page toast (route change). */
export function clearToasts() { pageToasts?.clear(); pageToasts = null; }

const TOAST_DEMOS = (t) => [
  { label: 'Saved', run: () => t.show({ title: 'Changes saved', tone: 'success' }) },
  { label: 'Undo', run: () => t.show({ title: 'Photo deleted', message: 'Lisbon, 3 years ago', action: { label: 'Undo', onPress: () => setTimeout(() => t.show({ title: 'Photo restored', tone: 'success' }), 120) } }) },
  { label: 'Error', run: () => t.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' }) },
];

function mountToastDemo(body, { sc, mode }) {
  // The tile keeps its toasts inside itself; the panel and the page use the viewport host.
  const t = mode === 'tile' ? toastHost(body, { max: 2 }) : toasts();
  if (mode === 'tile') sc.onDispose(() => t.clear());
  const demos = TOAST_DEMOS(t);
  // One trigger, raw: each press shows the next kind (plain, with an action, error).
  const b = el('button', 'cp-btn');
  b.type = 'button';
  b.textContent = 'Show toast';
  let n = 0;
  const next = () => demos[n++ % demos.length].run();
  b.addEventListener('click', next);
  body.append(b);
  return {
    async run() {
      next();
      await sc.wait(1500);
    },
  };
}

/* ======================================================================================
   SwipeToDelete (SwipeToDelete.tsx): the React web component's core
   (registry/web/swipe-to-delete.core.ts). This file keeps the demo: the inbox, Reset, the
   rows coming back, and the autoplay, which swipes with real pointer events.
   ====================================================================================== */

const MAILS = [
  { id: 'a', title: 'Swipe me to the left' },
  { id: 'b', title: 'Past the line, I turn to dust' },
  { id: 'c', title: 'Or flick me away' },
];

const ROW_H = 56;
/** Pointer id of the scripted swipe, so a real pointer can take over at any time. */
const AUTO = 1e6 + 1;

// A plain row: one line of text on the card color, nothing around it.
function drawMailRow(ctx, w, h, m) {
  const c = pal();
  // Same corners as the row's clip (.cp-swipe-clip, 18px): the grains gather into the shape it pops into.
  ctx.fillStyle = c.card;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 18);
  ctx.fill();
  ctx.font = `500 15px ${FONT}`;
  label(ctx, fit(ctx, m.title, w - 36), 18, h / 2 + 5.5, 15, 500, c.ink);
}

function mountSwipe(body, { sc, mode }) {
  const tile = mode === 'tile';
  const data = tile ? MAILS.slice(0, 2) : MAILS;
  const list = el('div', 'cp-inbox');
  const reset = el('button', 'cp-reset');
  reset.textContent = 'Reset';
  body.append(list);
  if (!tile) body.append(reset);
  const rows = new Map();
  sc.onDispose(() => rows.forEach((r) => r.row.destroy()));

  const syncReset = () => { reset.hidden = rows.size >= data.length; };

  // In its place in the list, sorted by id like the native demo.
  function addRow(m) {
    const host = el('div', 'cp-swipe');
    host.dataset.id = m.id;
    host.setAttribute('aria-label', `${m.title}. Swipe left to delete.`);
    list.insertBefore(host, [...list.children].find((x) => x.dataset.id > m.id) ?? null);
    const w = Math.round(list.clientWidth);
    let gone;
    const r = { host, auto: false, gone: new Promise((res) => (gone = res)) };
    r.row = createSwipeToDelete(host, {
      rowClassName: 'cp-swipe-clip',
      onDelete: () => {
        r.row.destroy();
        host.remove();
        rows.delete(m.id);
        syncReset();
        gone();
        if (tile && rows.size === 0) sc.wait(700).then(() => data.forEach((x, i) => sc.wait(i * 120).then(() => restore(x))));
      },
    });
    r.canvas = snapshot(w, ROW_H, (ctx) => drawMailRow(ctx, w, ROW_H, m));
    r.canvas.className = 'cp-swipe-row';
    r.canvas.style.width = w + 'px';
    r.canvas.style.height = ROW_H + 'px';
    r.row.slot.append(r.canvas);
    rows.set(m.id, r);
    syncReset();
    return r;
  }

  async function restore(m, { animate = true } = {}) {
    if (rows.has(m.id) || !sc.alive) return;
    const { host, canvas } = addRow(m);
    if (!animate) return;
    host.style.opacity = '0';
    host.classList.add('gone');
    void host.offsetHeight;
    host.classList.add('grow');
    host.style.height = ROW_H + 'px';
    host.classList.remove('gone');
    await sc.wait(330);
    host.classList.remove('grow');
    host.style.height = '';
    await sc.track(play({ source: canvas, ...rectOf(canvas), preset: 'gather', direction: 'in', duration: 800 })).done;
    if (sc.alive) host.style.opacity = '';
  }

  /** A calm drag past the line on the row's clip, then release. */
  async function swipe(r) {
    r.auto = true;
    const clip = r.host.querySelector('.cp-swipe-clip');
    const b = clip.getBoundingClientRect();
    const x0 = b.left + b.width * 0.7, y = b.top + b.height / 2, dist = b.width * 0.52 + 13;
    const send = (type, x) => clip.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: x, clientY: y }));
    send('pointerdown', x0);
    await tween(sc, 560, (k) => send('pointermove', x0 - dist * IN_OUT_CUBIC(k)));
    await sc.wait(140);
    send('pointerup', x0 - dist);
    await Promise.race([r.gone, sc.wait(4000)]);
  }

  data.forEach((m) => restore(m, { animate: false }));
  reset.addEventListener('click', () => data.forEach((m, i) => sc.wait(i * 90).then(() => restore(m))));

  return {
    async run() {
      const r = [...rows.values()].find((x) => !x.auto);
      if (!r) { data.forEach((m) => restore(m)); return sc.wait(1200); }
      await swipe(r);
      if (!tile && rows.size <= 1) data.forEach((m, i) => sc.wait(600 + i * 90).then(() => restore(m)));
    },
  };
}

/* ======================================================================================
   LikeButton (LikeButton.tsx): the React web component's core (registry/web/like-button.core.ts).
   This file keeps the demo: the size per mode, the counter, the autoplay.
   ====================================================================================== */

/** The site keeps the native gray outline in both themes. */
const IDLE = '#8E8E93';

function mountLike(body, { sc, mode }) {
  // Raw: the heart and its count, a little larger than the 26 pt default so it reads on a stage.
  const btn = el('button', 'cp-like cp-like-lg');
  body.append(btn);
  let liked = false, count = 128;
  const like = createLikeButton(btn, {
    size: mode === 'tile' ? 36 : 40,
    liked,
    count,
    idleColor: IDLE,
    countClassName: 'cp-count',
    onChange: (v) => {
      liked = v;
      count += v ? 1 : -1;
      like.update({ liked, count });
    },
  });
  sc.onDispose(() => like.destroy());
  return {
    async run() {
      // The unlike snap takes 800 ms.
      if (liked) { btn.click(); await sc.wait(1300); }
      btn.click();
      await sc.wait(1300);
      btn.click();
      await sc.wait(800);
    },
  };
}

/* ======================================================================================
   MorphButton (MorphButton.tsx): the React web component's core (registry/web/morph-button.core.ts).
   This file keeps the demo: a 1.4 s payment and the autoplay.
   ====================================================================================== */

function mountMorph(body, { sc, label = 'Pay 42 €', doneLabel = 'Paid' }) {
  const host = el('div', 'cp-morph');
  body.append(host);
  const morph = createMorphButton(host, { label, doneLabel, onPress: () => sc.wait(1400) });
  sc.onDispose(() => morph.destroy());
  return {
    async run() {
      // Loading 1.4 s, done for resetAfter (1.8 s), then back to idle.
      host.click();
      await sc.wait(1400 + 1800 + 500);
    },
  };
}

/* ======================================================================================
   SplitButton (SplitButton.tsx): the React web component's core (registry/web/split-button.core.ts).
   This file keeps the demo: the labels and the autoplay.
   ====================================================================================== */

function mountSplit(body, { sc, label = 'Delete project', cancelLabel = 'Cancel', confirmLabel = 'Delete' }) {
  const DURATION = 620;
  const host = el('div', 'cp-split');
  body.append(host);
  const split = createSplitButton(host, { label, cancelLabel, confirmLabel, duration: DURATION });
  sc.onDispose(() => split.destroy());
  const tap = (sel) => host.querySelector(sel)?.click();
  return {
    async run() {
      if (host.hasAttribute('data-open')) return;
      tap('.dissolve-split-closed');
      await sc.wait(DURATION + 1300);
      tap('.dissolve-split-cancel');
      await sc.wait(DURATION + 200);
    },
  };
}

/* ======================================================================================
   GooeyMenu (GooeyMenu.tsx): the React web component's core (registry/web/gooey-menu.core.ts).
   This file keeps the demo: the three actions, their icons and the autoplay.
   ====================================================================================== */

// Drawn in currentColor (the primary foreground), cut outs in the primary color.
const CUT = 'style="fill: var(--dissolve-primary)"';
const GOO_ICONS = {
  Camera: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.2 4h5.6l1.6 2.2H19a2.5 2.5 0 0 1 2.5 2.5v8.8A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5V8.7A2.5 2.5 0 0 1 5 6.2h2.6z"/><circle cx="12" cy="12.9" r="3.6" ${CUT}/></svg>`,
  Photo: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="3" fill="currentColor"/><path d="M4.5 18l5-5.5 3.5 3.5 2.5-2.5 4 4.5z" ${CUT}/><circle cx="16" cy="8.8" r="1.8" ${CUT}/></svg>`,
  Voice: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12.5" rx="3.5" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
};
const GOO_ITEMS = [['Camera', 'Camera'], ['Photo', 'Photo library'], ['Voice', 'Voice memo']];

function mountGooey(body, { sc, size = 56, distance = 92, startAngle = -90, endAngle = -180 }) {
  const stage = el('div', 'cp-goo-stage');
  const host = el('div', 'cp-goo');
  stage.append(host);
  body.append(stage);
  const menu = createGooeyMenu(host, {
    size, distance, startAngle, endAngle,
    items: GOO_ITEMS.map(([, name]) => ({ label: name, onPress: () => {} })),
  });
  GOO_ITEMS.forEach(([key], i) => { menu.icon(i).innerHTML = GOO_ICONS[key]; });
  sc.onDispose(() => menu.destroy());
  const main = host.querySelector('.dissolve-goo-main');
  return {
    async run() {
      if (host.hasAttribute('data-open')) return;
      main.click();
      await sc.wait(1000 + 1100);
      main.click();
      await sc.wait(820);
    },
  };
}

/* ======================================================================================
   Content: titles, notes, usage code and props, straight from the native source.
   ====================================================================================== */

export const ENTRIES = {
  'swipe-to-delete': {
    title: 'SwipeToDelete',
    note: 'Swipe a row left. Past the line, it turns to dust.',
    desc: 'A row you swipe left to delete, like Mail or WhatsApp. Past 40 percent, or with a quick flick, the row dissolves, the list closes up behind it, then onDelete runs.',
    hint: 'Drag a row to the left',
    tileHint: 'Drag left',
    mount: mountSwipe,
    remountOnTheme: true,
    code: `// npx ${PKG} add swipe-to-delete toast
import { useState } from 'react';
import { SwipeToDelete } from '${DIR}/swipe-to-delete';
import { useToast } from '${DIR}/toast';

export function Inbox() {
  const [mails, setMails] = useState(MAILS);
  const toast = useToast();

  return mails.map((m) => (
    <SwipeToDelete
      key={m.id}
      rowClassName="rounded-[18px]"
      onDelete={() => {
        setMails((l) => l.filter((x) => x.id !== m.id));
        toast.show({
          title: 'Conversation deleted',
          message: m.from,
          action: { label: 'Undo', onPress: () => restore(m) },
        });
      }}
    >
      <MailRow mail={m} />
    </SwipeToDelete>
  ));
}`,
    props: [
      prop('children', 'ReactNode', 'required', 'The row. It slides with your finger over the delete action.'),
      prop('onDelete', '() => void', 'required', 'Called once the row has dissolved and collapsed: remove the item from your data here.'),
      prop('preset', 'VariantName', `'dust'`, 'Exit used when the row goes.'),
      prop('threshold', 'number', '0.4', 'Fraction of the row width to drag before release deletes. A flick faster than 900 pt/s deletes too.'),
      prop('disabled', 'boolean', 'false', 'Turns the pan gesture off.'),
      prop('className', 'string', '', 'Outer wrapper (margins, layout). This is the part that collapses.'),
      prop('rowClassName', 'string', `'overflow-hidden'`, 'Clipping row. Corner radius goes here (<code>rounded-2xl</code>), the action follows it.'),
      prop('actionClassName', 'string', `'bg-dissolve-danger'`, 'Delete action revealed behind the row.'),
    ],
  },
  toast: {
    title: 'Toast',
    note: 'Arrives in grains, leaves as dust. Tap to dismiss.',
    desc: 'Toasts that arrive in grains and leave as dust. A provider holds the stack at the top of the screen, three at most: over the limit the oldest one leaves as dust instead of vanishing.',
    hint: 'Show a toast, tap it to dismiss',
    tileHint: 'Show a toast',
    mount: mountToastDemo,
    code: `// npx ${PKG} add toast
import { ToastProvider, useToast } from '${DIR}/toast';

// app/_layout.tsx, inside <DissolveProvider>
<ToastProvider top={insets.top + 8}>
  <Stack />
</ToastProvider>

// any screen
const toast = useToast();

toast.show({ title: 'Changes saved', tone: 'success' });
toast.show({
  title: 'Photo deleted',
  message: 'Lisbon, 3 years ago',
  action: { label: 'Undo', onPress: restore },
});
toast.show({ title: 'Payment declined', message: 'Try another card', tone: 'error', exit: 'pixel' });`,
    props: [
      prop('title', 'string', 'required', 'First line, one line.'),
      prop('message', 'string', '', 'Second line, up to two lines.'),
      prop('tone', `'default' | 'success' | 'error'`, `'default'`, 'Color of the dot: gray, green or red.'),
      prop('action', '{ label, onPress }', '', 'A single action, typically Undo. The toast leaves after it runs.'),
      prop('duration', 'number', '3200', 'Time on screen before it leaves on its own, ms. 0 keeps it until tapped.'),
      prop('enter', 'VariantName', `'gather'`, 'Entrance.'),
      prop('exit', 'VariantName', `'dust'`, 'Exit.'),
      prop('&lt;ToastProvider top&gt;', 'number', '56', 'Distance from the top of the screen.'),
      prop('&lt;ToastProvider max&gt;', 'number', '3', 'Toasts on screen at once.'),
      prop('&lt;ToastProvider className&gt;', 'string', `'left-3 right-3 gap-2'`, 'Stack: side insets, gap.'),
      prop('&lt;ToastProvider cardClassName&gt;', 'string', `'bg-dissolve-primary rounded-[18px]'`, 'Every card: background, radius, padding.'),
    ],
  },
  'like-button': {
    title: 'LikeButton',
    note: 'Sparks on like, the heart snaps away on unlike.',
    desc: 'Like: the heart pops and ten sparks burst around it. Unlike: the filled heart snaps away into grains from its center and the outline is back.',
    hint: 'Tap the heart, tap again to unlike',
    tileHint: 'Tap the heart',
    mount: mountLike,
    code: `// npx ${PKG} add like-button
import { useState } from 'react';
import { LikeButton } from '${DIR}/like-button';

export function PostActions() {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(128);

  return (
    <LikeButton
      liked={liked}
      count={likes}
      onChange={(v) => {
        setLiked(v);
        setLikes((n) => n + (v ? 1 : -1));
      }}
    />
  );
}`,
    props: [
      prop('liked', 'boolean', 'required', 'Controlled state.'),
      prop('onChange', '(liked: boolean) => void', 'required', 'Called with true right away on like, with false once the heart has snapped away.'),
      prop('size', 'number', '26', 'Heart size in points.'),
      prop('color', 'string', `'#FF2D55'`, 'Filled heart and counter when liked.'),
      prop('idleColor', 'string', 'muted token', 'Outline and counter when not liked.'),
      prop('count', 'number', '', 'Optional counter shown next to the heart.'),
      prop('haptics', 'boolean', 'true', 'Light impact on like, the snap ticks on unlike.'),
      prop('className', 'string', `'flex-row items-center gap-1.5'`, 'Row: gap, padding, margins.'),
      prop('countClassName', 'string', `'text-[15px] font-semibold'`, 'Counter text: size, weight.'),
    ],
  },
  'morph-button': {
    title: 'MorphButton',
    note: 'Folds into a loader, opens back up as done.',
    desc: 'A button that morphs like the Dynamic Island: the pill folds into a round loader, then opens back up as the done state. Crisp shape, a critically damped spring, content that cross-fades and scales.',
    hint: 'Tap to pay',
    tileHint: 'Tap to pay',
    mount: mountMorph,
    remountOnTheme: true,
    code: `// npx ${PKG} add morph-button
import { MorphButton } from '${DIR}/morph-button';

<MorphButton
  label="Pay 42 €"
  doneLabel="Paid"
  onPress={() => pay(order)} // stays loading until the promise settles
/>`,
    props: [
      prop('label', 'string', 'required', 'Idle label.'),
      prop('doneLabel', 'string', `'Done'`, 'Label next to the check once the promise resolves.'),
      prop('onPress', '() => Promise | void', 'required', 'Runs on press. The button stays in its loading state until the promise settles; a rejection goes back to idle.'),
      prop('height', 'number', '52', 'Pill height, also the loader diameter.'),
      prop('resetAfter', 'number', '1800', 'Time spent on the done state before going back, ms. 0 stays done.'),
      prop('haptics', 'boolean', 'true', 'Light impact on press, success when done.'),
      prop('className', 'string', '', 'Outer box (width, margins). The pill is centered inside it.'),
      prop('labelClassName', 'string', `'text-base font-semibold text-dissolve-primary-foreground'`, 'Label and done label: size, weight, color. The pill reads the primary and success tokens.'),
    ],
  },
  'split-button': {
    title: 'SplitButton',
    note: 'Divides in the middle like a drop of liquid metal.',
    desc: 'A button that divides in the middle like a drop of liquid metal: the two halves pull apart, a neck between them thins into a waist, then snaps. Cancel fuses them back. Vector edges, no blur, so it stays crisp.',
    hint: 'Tap to split, Cancel fuses it back',
    tileHint: 'Tap to split',
    mount: mountSplit,
    remountOnTheme: true,
    code: `// npx ${PKG} add split-button
import { SplitButton } from '${DIR}/split-button';
import { useToast } from '${DIR}/toast';

const toast = useToast();

<SplitButton
  label="Delete project"
  confirmLabel="Delete"
  onConfirm={() => toast.show({ title: 'Project deleted', tone: 'error' })}
/>`,
    props: [
      prop('label', 'string', 'required', 'Label of the whole button.'),
      prop('cancelLabel', 'string', `'Cancel'`, 'Left half once split.'),
      prop('confirmLabel', 'string', `'Confirm'`, 'Right half once split.'),
      prop('onConfirm', '() => void', 'required', 'Runs on the right half, then the halves fuse back.'),
      prop('height', 'number', '52', 'Button height.'),
      prop('gap', 'number', '28', 'Space between the two halves once split. The neck snaps at 80 percent of it.'),
      prop('duration', 'number', '620', 'Split duration, ms.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on taps, warning on confirm.'),
      prop('className', 'string', '', 'Root: margins, width. The drop reads the danger tokens, the Cancel half surface-2.'),
      prop('labelClassName', 'string', `'text-base font-semibold'`, 'Every label: size, weight.'),
      prop('cancelLabelClassName', 'string', `'text-dissolve-foreground'`, 'Cancel label, its color.'),
    ],
  },
  'gooey-menu': {
    title: 'GooeyMenu',
    note: 'Actions pour out of the button as drops.',
    desc: 'A floating button whose actions pour out of it as drops along an arc and melt back in when it closes. Place it absolutely: it reserves room for the arc above and to the left of the button.',
    hint: 'Tap the button, then an action',
    tileHint: 'Tap the button',
    mount: mountGooey,
    remountOnTheme: true,
    code: `// npx ${PKG} add gooey-menu
import { GooeyMenu } from '${DIR}/gooey-menu';

<GooeyMenu
  className="absolute bottom-2 right-2"
  items={[
    { icon: <Icon name="camera" />, label: 'Camera', onPress: openCamera },
    { icon: <Icon name="photo" />, label: 'Photo', onPress: openLibrary },
    { icon: <Icon name="mic" />, label: 'Voice', onPress: record },
  ]}
/>`,
    props: [
      prop('items', 'GooeyMenuItem[]', 'required', '<code>{ icon, onPress, label? }</code>. The menu closes after an action runs.'),
      prop('size', 'number', '56', 'Diameter of the main button. Actions are 82 percent of it.'),
      prop('distance', 'number', '92', 'Distance from the main button to the actions.'),
      prop('startAngle', 'number', '-90', 'Arc start in degrees, 0 = right, -90 = up.'),
      prop('endAngle', 'number', '-180', 'Arc end in degrees, -180 = left.'),
      prop('haptics', 'boolean', 'true', 'Light impact on toggle.'),
      prop('className', 'string', '', 'Root: position it here. Button and drops read the primary token.'),
      prop('iconClassName', 'string', `'bg-dissolve-primary-foreground'`, 'The two bars of the plus, their color.'),
    ],
  },
};
