// TypingIndicator demo. The indicator is the React web component's core (registry/web/typing-indicator.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: the end of a group
// thread, the indicator under it and the people of the group as toggles, and the autoplay, which makes
// people start and stop typing.
import { createTypingIndicator, initials } from '../lib/typing-indicator.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const THREAD = [
  ['Ana', 'Landed! Grabbing my bag now.'],
  ['Ben', 'Table for four at 8 still works?'],
  ['Chloe', 'Running ten minutes late, order without me'],
];
const PEOPLE = ['Ana', 'Ben', 'Chloe', 'Dev', 'Eli'].map((name) => ({ id: name.toLowerCase(), name }));

function mountTyping(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? Math.round(Math.min(360, (availW(body) || 360) - 4)) : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'ti-demo');
  root.style.width = W + 'px';
  const thread = el('div', 'ti-thread');
  for (const [name, text] of THREAD) {
    const row = el('div', 'ti-msg');
    const who = el('div', 'ti-who');
    who.textContent = name;
    const disc = el('i', '', initials(name));
    disc.setAttribute('aria-hidden', 'true');
    const bubble = el('div', 'ti-bubble');
    bubble.textContent = text;
    row.append(who, disc, bubble);
    thread.append(row);
  }
  const host = el('div', 'ti-host');
  root.append(thread, host);
  const chips = el('div', 'ti-people');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Who is typing');
  if (!tile) root.append(chips);
  body.append(tile ? fitTile(body, root, W, 3 * 58 + 80) : root);

  let typing = [PEOPLE[0]];
  const ti = createTypingIndicator(host, { typers: typing });
  sc.onDispose(() => ti.destroy());
  const buttons = PEOPLE.map((p) => {
    const b = el('button', 'ti-chip', `<i aria-hidden="true">${initials(p.name)}</i>${p.name}`);
    b.type = 'button';
    b.addEventListener('click', () => toggle(p));
    chips.append(b);
    return b;
  });
  const set = (next) => {
    typing = next;
    ti.update({ typers: typing });
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(typing.some((t) => t.id === PEOPLE[i].id))));
  };
  // Newcomers join the end of the stack.
  const toggle = (p) => set(typing.some((t) => t.id === p.id) ? typing.filter((t) => t.id !== p.id) : [...typing, p]);
  set(typing);

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      // Ben and Chloe join, Dev makes it a +2, then they drop off one by one, back to Ana.
      for (const id of ['ben', 'chloe', 'dev', 'ana', 'chloe', 'dev', 'ben', 'ana']) {
        await sc.wait(750);
        if (!sc.alive || user) return;
        toggle(PEOPLE.find((p) => p.id === id));
      }
    },
  };
}

export const ENTRIES = {
  'typing-indicator': {
    title: 'TypingIndicator',
    note: 'Who is typing: avatars pop into a stack beside three waving dots.',
    desc: 'The chat typing indicator: the avatars of who is typing, overlapping in a stack, a bubble of three dots in a wave, and "Ana and Ben are typing" under them, in the column of the message text (past the first avatar). Pass the people typing right now and the indicator works out the rest. A newcomer pops into the stack on a spring and the stack makes room; someone who stops shrinks away and the others slide over to close the gap. Past maxAvatars, a +N disc stands for the rest. The line changes with a short crossfade. With nobody typing everything fades out, and the indicator keeps its height so a chat does not jump. Monochrome: avatars without a picture show their initials on the second surface, the bubble is the surface color, the dots and the line muted. Announced politely to screen readers. Reduced motion: plain fades, the dots pulse in place.',
    hint: 'Tap people to make them type',
    tileHint: 'People start and stop typing',
    mount: mountTyping,
    code: add('typing-indicator', 'TypingIndicator', `<TypingIndicator
  typers={typing.map((u) => ({ id: u.id, name: u.firstName, avatar: u.photo }))}
/>

// Two faces before the +N, smaller, your own line.
<TypingIndicator
  typers={typers}
  maxAvatars={2}
  size={24}
  formatLabel={(names) => \`\${names.length} people are typing\`}
/>`),
    props: [
      prop('typers', '{ id, name, avatar? }[]', '', 'Who is typing right now, in stack order (first on top). ids keep each avatar stable; avatar is a picture URL (or a require() on React Native), else the initials.'),
      prop('maxAvatars', 'number', '3', 'Avatars shown; past it the last slot becomes a +N disc.'),
      prop('size', 'number', '28', 'Avatar diameter, pt. The dot bubble scales with it.'),
      prop('showLabel', 'boolean', 'true', 'The "Ana and Ben are typing" line under the avatars. Screen readers hear it either way.'),
      prop('formatLabel', '(names: string[]) =&gt; string', '', 'Your own line from the names. Default: "Ana, Ben and 2 others are typing".'),
      prop('className', 'string', '', 'Outer classes (margins...).'),
    ],
  },
};
