// AvatarStack demo. The stack is the React web component's core (registry/web/avatar-stack.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a team with an
// Add and a Remove button, and the autoplay, which adds and removes people.
import { createAvatarStack } from '../lib/avatar-stack.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const PEOPLE = [
  { id: 'ava', name: 'Ava Chen', src: '/assets/paintings/temple.jpg' },
  { id: 'ben', name: 'Ben Ortiz' },
  { id: 'chloe', name: 'Chloe Martin', src: '/assets/paintings/cypress.jpg' },
  { id: 'dev', name: 'Dev Patel' },
  { id: 'elena', name: 'Elena Rossi', src: '/assets/paintings/lake.jpg' },
  { id: 'farid', name: 'Farid Haddad' },
  { id: 'grace', name: 'Grace Kim', src: '/assets/paintings/villa.jpg' },
  { id: 'hugo', name: 'Hugo Laurent' },
];

function mountAvatars(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 300 : mode === 'stage' ? 360 : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'av-demo');
  root.style.width = W + 'px';
  const stage = el('div', 'av-stage');
  const host = el('div');
  stage.append(host);
  const bar = el('div', 'av-buttons');
  const less = el('button', 'av-btn', 'Remove');
  const more = el('button', 'av-btn av-add', 'Add');
  less.type = more.type = 'button';
  bar.append(less, more);
  root.append(stage);
  if (!tile) root.append(bar);
  body.append(tile ? fitTile(body, root, W, 110) : root);

  let n = 5;
  const s = createAvatarStack(host, { avatars: PEOPLE.slice(0, n), size: mode === 'stage' ? 'lg' : 'md' });
  sc.onDispose(() => s.destroy());
  const set = (k) => {
    n = Math.max(1, Math.min(PEOPLE.length, k));
    s.update({ avatars: PEOPLE.slice(0, n) });
    less.disabled = n <= 1;
    more.disabled = n >= PEOPLE.length;
  };
  set(n);
  less.addEventListener('click', () => set(n - 1));
  more.addEventListener('click', () => set(n + 1));

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      for (const k of [3, 4, 6, 7, 5]) {
        await sc.wait(800);
        if (!sc.alive || user) return;
        set(k);
      }
    },
  };
}

export const ENTRIES = {
  'avatar-stack': {
    title: 'AvatarStack',
    note: 'Overlapping avatars: hover or hold to spread them and read the names.',
    desc: 'Overlapping avatars with a +N chip for the rest, each ringed in the background color so the overlap reads cleanly; a person without an image shows their initials. Hover the stack and it spreads apart on a spring, with a tooltip that slides from avatar to avatar naming the one under the pointer, which lifts a little. On touch, press and hold then slide your finger across, or tap: the tap names the avatar under the finger and the stack closes up again on its own. With the keyboard, focus spreads it and the arrow keys move the name. Add or remove a person and the stack makes room or closes the gap, the newcomer popping in from a smaller size, the leaver shrinking away, the chip counting the rest. A selection tick as the name changes. Reduced motion: no springs, plain fades.',
    hint: 'Hover the stack, or press Add and Remove',
    tileHint: 'Hover the stack',
    mount: mountAvatars,
    code: add('avatar-stack', 'AvatarStack', `<AvatarStack
  avatars={[
    { id: 'ava', name: 'Ava Chen', src: 'https://example.com/ava.jpg' },
    { id: 'ben', name: 'Ben Ortiz' },
    { id: 'chloe', name: 'Chloe Martin', src: chloe },
  ]}
/>

// Three faces then the chip, smaller and tighter.
<AvatarStack avatars={team} max={3} size="sm" overlap={0.4} />`),
    props: [
      prop('avatars', '{ id, name, src? }[]', '', 'The people. src is an image URL (or a require() on React Native); without it the initials show.'),
      prop('max', 'number', '4', 'Avatars shown before the +N chip.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Avatar diameter: 28, 36 or 44 pt.'),
      prop('overlap', 'number', '0.3', 'How much each avatar slides under the previous one, as a share of its size.'),
      prop('spreadGap', 'number', '6', 'Space between avatars once spread, in pt.'),
      prop('haptics', 'boolean', 'true', 'Selection tick as the named avatar changes.'),
      prop('className', 'string', '', 'Outer classes (margins...).'),
    ],
  },
};
