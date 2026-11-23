// CopyButton demo. The button is the React web component's core (registry/web/copy-button.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: an install
// command with its copy button, the sizes on the component page, and the autoplay, which plays the
// copied feedback without touching the visitor's clipboard.
import { createCopyButton } from '../lib/copy-button.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const CMD = 'npx dissolve-ui add copy-button';

function mountCopy(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? 380 : Math.round(Math.min(360, (availW(body) || 360) - 4));
  const root = el('div', 'cb-demo');
  root.style.width = W + 'px';
  const field = el('div', 'cb-field');
  const code = el('code', 'cb-code');
  code.innerHTML = '<span class="cb-dollar">$</span> ' + CMD;
  const host = el('button');
  host.type = 'button';
  field.append(code, host);
  root.append(field);
  body.append(tile ? fitTile(body, root, W, 56) : root);

  const main = createCopyButton(host, { text: CMD, accessibilityLabel: 'Copy the install command' });
  sc.onDispose(() => main.destroy());

  if (mode === 'stage') {
    const sizes = el('div', 'cb-sizes');
    root.append(sizes);
    for (const size of ['sm', 'md', 'lg']) {
      const b = el('button');
      b.type = 'button';
      sizes.append(b);
      const c = createCopyButton(b, { size, text: CMD, accessibilityLabel: `Copy, size ${size}` });
      sc.onDispose(() => c.destroy());
    }
  }

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      await sc.wait(500);
      if (!sc.alive || user) return;
      main.showCopied();
      await sc.wait(2400);
    },
  };
}

export const ENTRIES = {
  'copy-button': {
    title: 'CopyButton',
    note: 'Copy text: the icon breaks into grains that reform as a check.',
    desc: 'An icon button that copies text. Press it and the text goes to the clipboard with a success haptic on iOS. The copy icon breaks into a few grains that flow over on a slight arc, shrinking mid flight, and reform as a check with a tiny pop, while a Copied tooltip rises above the button and screen readers announce it. After 1.5 s it settles back to the copy icon; pressing again while the check shows only restarts the countdown. The grains are the one dissolve moment: effects="none" swaps the icons with a plain crossfade. Reduced motion: a crossfade, no pop. React Native copies with expo-clipboard; the web uses the Clipboard API, with the selection fallback on insecure pages.',
    hint: 'Click the copy button',
    tileHint: 'Click to copy',
    mount: mountCopy,
    code: add('copy-button', 'CopyButton', `<CopyButton text="npx dissolve-ui add copy-button" />

// The text at press time, smaller, a plain crossfade.
<CopyButton text={() => editor.getValue()} size="sm" effects="none" onCopy={(t) => track('copied', t.length)} />`),
    props: [
      prop('text', 'string | () =&gt; string', '', 'The text to copy, or a function that returns it at press time.'),
      prop('onCopy', '(text: string) =&gt; void', '', 'Called with the copied text.'),
      prop('timeout', 'number', '1500', 'How long the check and the tooltip stay, in ms.'),
      prop('copiedLabel', 'string', `'Copied'`, 'Tooltip text, also announced to screen readers.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Button and icon size: 32, 36 or 44 pt.'),
      prop('effects', `'accent' | 'none'`, `'accent'`, 'Accent: the copy icon breaks into grains that reform as the check. None: a plain crossfade.'),
      prop('haptics', 'boolean', 'true', 'Success haptic on copy.'),
      prop('disabled', 'boolean', 'false', 'No copy, the button shows at 40% opacity.'),
      prop('accessibilityLabel', 'string', `'Copy'`, 'Read by screen readers.'),
      prop('className', 'string', '', 'Outer classes (margins, background...). The size comes from the size prop.'),
    ],
  },
};
