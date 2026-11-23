// TextScramble demo. The text is the React web component's core (registry/web/text-scramble.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a flight status,
// the status as a large title and the gate line in monospace, with a Refresh button, and the autoplay,
// which steps through the updates.
import { createTextScramble } from '../lib/text-scramble.js';
import { createGlossyButton } from '../lib/glossy-button.js';
import { el, fitTile, availW, prop, add, webAdd, isLight, onTheme } from './kit.js';

const FLIGHT = 'AF 1148, Paris to Oslo';
const UPDATES = [
  ['On time', 'GATE B32 / BOARDS 14:05'],
  ['Gate change', 'GATE C14 / BOARDS 14:05'],
  ['Boarding', 'GATE C14 / ZONE 2 NOW'],
  ['Delayed 20 min', 'GATE C14 / BOARDS 14:25'],
];

/** The button in the text color, its label in the page color. */
const ink = () => (isLight() ? { color: '#12151A', labelColor: '#FFFFFF' } : { color: '#FBFBFB', labelColor: '#121212' });

function mountScramble(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? Math.round(Math.min(420, (availW(body) || 420) - 4)) : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'ts-demo');
  root.style.width = W + 'px';
  const board = el('div', 'ts-board');
  const eyebrow = el('div', 'ts-eyebrow');
  eyebrow.textContent = FLIGHT;
  const h = el('h3', 'ts-h');
  const l = el('div', 'ts-l');
  board.append(eyebrow, h, l);
  const btnEl = el('button');
  root.append(board, btnEl);
  body.append(tile ? fitTile(body, root, W, 200) : root);

  let i = 0;
  const heading = createTextScramble(h, { text: UPDATES[0][0], duration: 800 });
  const label = createTextScramble(l, { text: UPDATES[0][1], monospace: true, duration: 1000 });
  const next = () => {
    i = (i + 1) % UPDATES.length;
    heading.update({ text: UPDATES[i][0] });
    label.update({ text: UPDATES[i][1] });
  };
  const btn = createGlossyButton(btnEl, { label: 'Refresh', size: mode === 'stage' ? 'lg' : 'md', ...ink(), onPress: next });
  onTheme(sc, () => btn.update(ink()));
  const replay = () => { heading.scramble(); label.scramble(); };
  h.addEventListener('click', replay);
  sc.onDispose(() => { heading.destroy(); label.destroy(); btn.destroy(); });

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      for (let k = 0; k < 3; k++) {
        await sc.wait(k ? 1700 : 600);
        if (!sc.alive || user) return;
        next();
      }
      await sc.wait(1200);
    },
  };
}

export const ENTRIES = {
  'text-scramble': {
    title: 'TextScramble',
    note: 'Text that decodes into place: random glyphs resolve letter by letter.',
    desc: 'Text that decodes into place: every letter turns into random glyphs that keep changing, then the letters resolve one by one, left to right with a little randomness, into the final text. It plays when the text changes, when trigger changes, on ref.current.scramble(), and on mount with playOnMount. Letters keep the width of their final character while they scramble, so the line never shifts and wraps where the final text wraps; by default each glyph is of the same kind and about the same width as its letter, so a proportional line keeps its rhythm, and monospace sets a monospace font. Glyphs show in the muted token (glyphColor), landed letters in your text color. The text stays real text: on the web it is selectable and copyable, and screen readers read the final text once. Reduced motion: no glyphs, the new text fades in.',
    hint: 'Press Refresh, or click the status',
    tileHint: 'Press Refresh',
    mount: mountScramble,
    code: add('text-scramble', 'TextScramble, type TextScrambleHandle', `<TextScramble
  text={status}
  className="text-dissolve-foreground"
  style={{ fontSize: 34, fontWeight: '600' }}
/>

// Monospace, replayed on every refresh.
<TextScramble text="GATE C14 / BOARDS 14:05" monospace trigger={refreshCount} />

// On demand.
const ref = useRef<TextScrambleHandle>(null);
<TextScramble ref={ref} text="Built to dissolve" />
ref.current?.scramble();`),
    webCode: webAdd('text-scramble', 'TextScramble, type TextScrambleHandle', `<TextScramble as="h1" text={status} className="text-4xl font-semibold" />

// Monospace, replayed on every refresh.
<TextScramble text="GATE C14 / BOARDS 14:05" monospace trigger={refreshCount} />

// On demand.
const ref = useRef<TextScrambleHandle>(null);
<TextScramble ref={ref} text="Built to dissolve" />
ref.current?.scramble();`),
    props: [
      prop('text', 'string', '', 'The text it decodes into. A change plays the scramble.'),
      prop('trigger', 'unknown', '', 'Any value: each change replays the scramble on the same text.'),
      prop('duration', 'number', '900', 'Time until the last letter lands, in ms.'),
      prop('rate', 'number', '45', 'How often a scrambling letter changes glyph, in ms.'),
      prop('glyphs', 'string', '', 'Characters drawn while scrambling. Default: glyphs of the same kind and width as each letter; with monospace, A-Z, 0-9 and signs.'),
      prop('monospace', 'boolean', 'false', 'A monospace font (Menlo on iOS, ui-monospace on the web).'),
      prop('playOnMount', 'boolean', 'false', 'Plays once on mount. Off: the text shows as is.'),
      prop('glyphColor', 'string', 'muted token', 'Color of the glyphs.'),
      prop('onDone', '() =&gt; void', '', 'Called when the last letter lands.'),
      prop('ref.scramble', '() =&gt; void', '', 'Plays the scramble on the current text.'),
      prop('as', 'ElementType', `'span'`, 'The element on the web: h1, p, span...'),
      prop('numberOfLines', 'number', '', 'Line limit, as on a Text (React Native).'),
      prop('style', 'TextStyle', '', 'Your text style: size, weight, color...'),
      prop('className', 'string', '', 'Text classes.'),
    ],
    nativeOnly: ['numberOfLines'],
  },
};
