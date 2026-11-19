// ReorderList demo. The drag, the slides and the grains are the React web component's core
// (registry/web/reorder-list.core.ts, built into web/lib), the same code a React app installs.
// This file keeps the demo: the tasks and their rows, the delete and its reset, and the autoplay,
// which holds and drags a row with real pointer events.
import { createReorderList } from '../lib/reorder-list.js';
import { IN_OUT_CUBIC, el, isLight, onTheme, availW, tween, AUTO, prop, add } from './kit.js';

/** As the core: the hold before a row lifts. */
const HOLD = 250;

const stroke = (d) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  brush: 'M18.4 3.6a2 2 0 0 1 2.8 2.8L13 14.6 9.4 11zM9 12.4 12.4 15.8c-.6 2.8-2.6 4.6-6.4 4.6H3.6c1.4-1 1.6-2.4 1.6-3.8 0-2.4 1.6-4.2 3.8-4.2z',
  phone: 'M6.2 3.5h2.9l1.5 4.2-2 1.4a11.5 11.5 0 0 0 6.3 6.3l1.4-2 4.2 1.5v2.9a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.2 5.6a2 2 0 0 1 2-2.1z',
  plane: 'M10.2 20.5 12 14 5 11.5V9.8l7.3 1.5 1.5-7.3h1.7l-.3 7.8 5.8 1.6v1.8l-5.9-.9-1.3 6.2z',
  bubble: 'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8.5L6 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5zM8 9h8M8 12.2h5',
  card: 'M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5zM7 10h4.5M7 14h7.5',
  run: 'M14.5 5.2a1.6 1.6 0 1 0 0-.1M8 20.5l2.6-5.4 3 2.4v3M6 11.5l3.2-3.2h4.2l2.2 3.4h3.2M10.6 15.1l1.6-4.6',
  book: 'M4 5.5c2.8-1 5.4-1 8 .8 2.6-1.8 5.2-1.8 8-.8v13c-2.8-1-5.4-1-8 .8-2.6-1.8-5.2-1.8-8-.8zM12 6.3v13',
};
const TASKS = [
  { id: 'a', title: 'Ship the onboarding', meta: 'Thursday · Design', icon: 'brush', tone: ['#7C5CFF', '#8E72FF'] },
  { id: 'b', title: 'Call the landlord', meta: 'Today · Home', icon: 'phone', tone: ['#0A84FF', '#0A84FF'] },
  { id: 'c', title: 'Book the flights', meta: 'Friday · Team', icon: 'plane', tone: ['#F5B700', '#FFD233'] },
  { id: 'd', title: 'Review the pull request', meta: 'Today · Work', icon: 'bubble', tone: ['#34C759', '#30D158'] },
  { id: 'e', title: 'Renew the passport', meta: 'This month · Admin', icon: 'card', tone: ['#FF3787', '#FF4F98'] },
  { id: 'f', title: 'Plan the long run', meta: 'Sunday · Health', icon: 'run', tone: ['#FF3B30', '#FF453A'] },
  { id: 'g', title: 'Read two chapters', meta: 'Anytime · Me', icon: 'book', tone: ['#8E8E93', '#98989D'] },
];

function mountReorder(body, { sc, mode }) {
  const tile = mode === 'tile';
  const stage = mode === 'stage';
  const W = Math.round(Math.min(tile ? 300 : 400, availW(body) || 340));
  const all = TASKS.slice(0, tile ? 4 : stage ? 7 : 5);
  let data = all.slice();

  const host = el('div', 'cp-ro');
  host.style.width = W + 'px';
  // The stage scrolls, so the edges auto scroll.
  if (stage) host.style.maxHeight = '372px';
  else host.classList.add('cp-ro-static');
  host.setAttribute('aria-label', 'Priorities. Press and hold a row, then drag it. Alt and the arrow keys move the focused row.');
  body.append(host);

  const tone = (t) => t.tone[isLight() ? 0 : 1];
  const fill = (t) => {
    const row = list.row(t.id);
    if (row.firstChild) return row;
    const icon = el('span', 'cp-ro-icon', stroke(ICON[t.icon]));
    icon.style.background = tone(t);
    const text = el('span', 'cp-ro-text');
    const title = el('span', 'cp-ro-title');
    title.textContent = t.title;
    const meta = el('span', 'cp-ro-meta');
    meta.textContent = t.meta;
    text.append(title, meta);
    const grip = el('span', 'cp-ro-grip', '<i></i><i></i><i></i>');
    grip.dataset.reorderHandle = '';
    grip.setAttribute('aria-hidden', 'true');
    row.append(el('span', 'cp-ro-rank'), icon, text, grip);
    return row;
  };
  const ranks = () => data.forEach((t, i) => { list.row(t.id).querySelector('.cp-ro-rank').textContent = String(i + 1); });
  const set = (next) => { data = next; list.update({ data }); ranks(); };

  const list = createReorderList(host, {
    data,
    keyExtractor: (t) => t.id,
    itemClassName: 'cp-ro-row',
    onReorder: set,
    onDelete: (t) => set(data.filter((d) => d !== t)),
  });
  data.forEach(fill);
  list.update({ data: data.slice() });
  ranks();
  sc.onDispose(() => list.destroy());
  onTheme(sc, () => all.forEach((t) => { list.row(t.id).querySelector('.cp-ro-icon').style.background = tone(t); }));

  /** Brings back every deleted row, in the starting order. */
  function reset() {
    const gone = all.filter((t) => !data.includes(t));
    gone.forEach((t) => {
      const row = fill(t);
      row.style.opacity = '0';
      row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 120, easing: 'linear', fill: 'forwards' }).finished.then(() => { row.style.opacity = ''; }).catch(() => {});
    });
    set(all.slice());
  }

  // A real pointer on the list stops the script.
  let user = false, busy = false;
  const lift = (e) => { if (e.isTrusted) user = false; };
  host.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  sc.onDispose(() => { removeEventListener('pointerup', lift); removeEventListener('pointercancel', lift); });
  const send = (row, type, x, y) => row.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: x, clientY: y }));

  /* ---------- Autoplay: hold a row, carry it two slots, drop it; the next run brings it back ---------- */

  let down = true;
  return {
    async run() {
      if (busy || user) return;
      if (data.length < 3) { reset(); await sc.wait(900); return; }
      busy = true;
      const fi = down ? 0 : 2, ti = down ? 2 : 0;
      down = !down;
      const t = data[fi], row = list.row(t.id), to = list.row(data[ti].id);
      const br = row.getBoundingClientRect(), tr = to.getBoundingClientRect();
      const x0 = br.left + br.width * 0.62, y0 = br.top + br.height / 2;
      // Where the row lands: its edge on the far edge of the target slot.
      const dy = ti > fi ? tr.bottom - br.bottom : tr.top - br.top;
      // The hold.
      send(row, 'pointerdown', x0, y0);
      await sc.wait(HOLD + 260);
      if (!sc.alive || user) { busy = false; return; }
      const dur = 1050;
      let x = x0, y = y0;
      await tween(sc, dur, (k) => {
        x = x0 + Math.sin(k * Math.PI) * 26 * (ti > fi ? 1 : -1);
        y = y0 + dy * IN_OUT_CUBIC(k);
        send(row, 'pointermove', x, y);
      }, () => user);
      await sc.wait(220);
      send(row, 'pointerup', x, y);
      await sc.wait(800);
      busy = false;
      await sc.wait(500);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */


export const ENTRIES = {
  'reorder-list': {
    title: 'ReorderList',
    note: 'Hold a row, drag it to a new place.',
    desc: 'A list you reorder by drag, like Reminders or Things. Long press a row (250 ms) or grab its handle: it lifts with a medium tick, grows a shadow and leans a little with the sideways speed of the finger, which it follows 1:1. The other rows slide out of the way on the calm curve, a selection tick lands on every new slot, and the list scrolls by itself near its edges. On release the row settles critically damped, then onReorder runs. A faint trail of grains stays at the slot it left, a small puff marks the one it lands in. With onDelete, drag a row far to the side to turn it to dust. Rows can have different heights, everything runs on the UI thread.',
    hint: 'Press and hold a row, then drag it',
    tileHint: 'Hold and drag',
    mount: mountReorder,
    code: add('reorder-list', 'ReorderList, ReorderHandle', `<ReorderList
  data={tasks}
  keyExtractor={(t) => t.id}
  onReorder={(next) => setTasks(next)}
  onDelete={(t) => remove(t.id)}
  gap={8}
  itemClassName="rounded-[18px] bg-dissolve-surface"
  renderItem={({ item, index }) => (
    <TaskRow task={item} rank={index + 1}>
      <ReorderHandle />
    </TaskRow>
  )}
/>`),
    props: [
      prop('data', 'T[]', 'required', 'The rows, in order.'),
      prop('keyExtractor', '(item: T, index: number) =&gt; string', 'required', 'A stable key per row. Rows are positioned by key.'),
      prop('renderItem', '({ item, index, dragging }) =&gt; ReactNode', 'required', 'A row. dragging is true while it is lifted (one render on lift, one on drop).'),
      prop('onReorder', '(data: T[], from: number, to: number) =&gt; void', 'required', 'Called once the dropped row has settled, with the reordered copy of data.'),
      prop('onDelete', '(item: T, index: number) =&gt; void', '', 'Enables the delete: drag a row past 42 percent of the width to the side and release, it turns to dust and the list closes up.'),
      prop('preset', 'VariantName', `'dust'`, 'Exit used by onDelete.'),
      prop('longPressDelay', 'number', '250', 'Hold before a row lifts, ms. Moving earlier scrolls the list instead.'),
      prop('handle', 'boolean', 'false', 'Drag only from a <code>&lt;ReorderHandle&gt;</code> inside the row, which lifts at once.'),
      prop('gap', 'number', '0', 'Space between rows. Use it instead of vertical margins.'),
      prop('haptics', 'boolean', 'true', 'Medium on lift, a selection tick per slot, light on drop.'),
      prop('grains', 'boolean', 'true', 'Trail and puff of grains. Off with reduced motion, as is the lean.'),
      prop('header / footer', 'ReactNode', '', 'Scroll above and below the rows.'),
      prop('className', 'string', `'flex-1'`, 'Root classes. Give the list a height: it scrolls by itself.'),
      prop('contentContainerStyle', 'StyleProp&lt;ViewStyle&gt;', '', 'Scroll content padding.'),
      prop('itemClassName', 'string', `'bg-dissolve-background'`, 'Row surface classes (background, radius). The lift shadow follows it.'),
    ],
  },
};
