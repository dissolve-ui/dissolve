// Accordion demo. The sections are the React web component's core (registry/web/accordion.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a short FAQ,
// and the autoplay, which opens the sections one after the other.
import { createAccordion } from '../lib/accordion.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const FAQ = [
  ['own', 'Do I own the code?', 'Yes. The CLI copies the source into your app, so every curve, timing and padding is yours to change.'],
  ['web', 'Does it run on the web?', 'Every component ships a React version on the same core, with the same props, look and timings.'],
  ['theme', 'How does it follow dark mode?', 'Colors come from a handful of theme tokens. Change one and every component follows, light and dark.'],
  ['a11y', 'Is it accessible?', 'Headers are buttons with an expanded state, sections are labelled regions, and the arrow keys move between headers.'],
];

function mountAccordion(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? 380 : Math.round(Math.min(360, (availW(body) || 360) - 4));
  const root = el('div', 'ac-demo');
  root.style.width = W + 'px';
  const host = el('div');
  root.append(host);
  body.append(tile ? fitTile(body, root, W, 4 * 56 + 90) : root);

  let value = ['own'];
  const a = createAccordion(host, {
    items: FAQ.map(([v, title, content]) => ({ value: v, title, content })),
    value,
    onValueChange: (v) => { value = v; a.update({ value: v }); },
  });
  sc.onDispose(() => a.destroy());
  const open = (v) => { value = v; a.update({ value: v }); };

  // A real pointer on a header stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      for (const v of [['web'], ['theme'], ['a11y'], [], ['own']]) {
        await sc.wait(1100);
        if (!sc.alive || user) return;
        open(v);
      }
    },
  };
}

export const ENTRIES = {
  accordion: {
    title: 'Accordion',
    note: 'Expandable sections: the height glides open and the content slides in.',
    desc: 'Expandable sections on hairline dividers. Tap a header and its section opens on a smooth height curve while the chevron turns over, then the content fades in and slides down into place, a beat behind the height. One section open at a time (type single, the default, collapsible unless you say otherwise) or any number (type multiple), controlled or not. On the web each header is a button with aria-expanded and aria-controls, each section a region labelled by its header, and Arrow Up, Arrow Down, Home and End move between headers; on iOS the headers announce their expanded state and closed sections are hidden from VoiceOver. A selection tick on every change. Reduced motion: the section opens at once and the content simply fades.',
    hint: 'Click a header',
    tileHint: 'Click a header',
    mount: mountAccordion,
    code: add('accordion', 'Accordion', `<Accordion
  items={[
    { value: 'shipping', title: 'Shipping', content: 'Orders leave the studio within two days.' },
    { value: 'returns', title: 'Returns', content: <ReturnsPolicy /> },
  ]}
  defaultValue={['shipping']}
/>

// Any number open, controlled.
const [open, setOpen] = useState<string[]>([]);
<Accordion type="multiple" items={faq} value={open} onValueChange={setOpen} />`),
    props: [
      prop('items', '{ value, title, content, disabled? }[]', '', 'The sections. content is any node; a string is set in the muted body style.'),
      prop('type', `'single' | 'multiple'`, `'single'`, 'Single: opening a section closes the other. Multiple: each opens on its own.'),
      prop('collapsible', 'boolean', 'true', 'In single mode, the open section can be closed again.'),
      prop('value', 'string[]', '', 'Open sections (controlled). In single mode, at most one.'),
      prop('defaultValue', 'string[]', '[]', 'Initially open sections when uncontrolled.'),
      prop('onValueChange', '(value: string[]) =&gt; void', '', 'Called with the open sections on every change.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on every change.'),
      prop('className', 'string', '', 'Outer classes (margins, padding, background...).'),
    ],
  },
};
