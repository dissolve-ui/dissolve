// PasswordStrength demo. The field is the React web component's core
// (registry/web/password-strength.core.ts, built into web/lib), the same code a React app installs.
// This file keeps the demo: a new password step with a Save button (the GlossyButton) that wakes up
// once every rule is met, and the autoplay, which types a password letter by letter, then clears it.
import { createPasswordStrength } from '../lib/password-strength.js';
import { createGlossyButton } from '../lib/glossy-button.js';
import { el, fitTile, availW, prop, add, isLight, onTheme } from './kit.js';

const SUB = 'Use it only for this account.';
const TYPED = 'Lantern-harbor-7';
const ink = () => (isLight() ? { color: '#12151A', labelColor: '#FFFFFF' } : { color: '#FBFBFB', labelColor: '#121212' });

function mountPassword(body, { sc, mode }) {
  const tile = mode === 'tile';
  const stage = mode === 'stage';
  const W = tile ? 320 : stage ? Math.round(Math.min(380, (availW(body) || 380) - 4)) : Math.round(Math.min(340, (availW(body) || 340) - 4));
  const root = el('div', 'pw-demo');
  root.style.width = W + 'px';
  const sub = el('div', 'pw-sub', SUB);
  sub.setAttribute('aria-live', 'polite');
  if (stage) root.append(el('div', 'pw-title', 'New password'), sub);
  const host = el('div');
  root.append(host);
  body.append(tile ? fitTile(body, root, W, 250) : root);

  let button = null;
  const field = createPasswordStrength(host, {
    haptics: false,
    onChange: (_, s) => { sub.textContent = SUB; button?.update({ disabled: !s.passed }); },
    onSubmit: (_, s) => { if (s.passed) sub.textContent = 'Your password is saved.'; },
  });
  sc.onDispose(() => field.destroy());
  if (stage) {
    const cta = el('div', 'pw-cta');
    const b = el('button');
    cta.append(b);
    root.append(cta);
    button = createGlossyButton(b, { label: 'Save password', size: 'lg', fullWidth: true, disabled: true, ...ink(), onPress: () => { sub.textContent = 'Your password is saved.'; } });
    sc.onDispose(() => button.destroy());
    onTheme(sc, () => button.update(ink()));
  }

  // A real pointer or key on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  root.addEventListener('keydown', (e) => { if (e.isTrusted) user = true; });

  const input = host.querySelector('input');
  const type = (v) => {
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return {
    async run() {
      await sc.wait(300);
      for (let i = 1; i <= TYPED.length; i++) {
        if (!sc.alive || user) return;
        type(TYPED.slice(0, i));
        await sc.wait(110);
      }
      await sc.wait(1600);
      if (!sc.alive || user) return;
      type('');
    },
  };
}

export const ENTRIES = {
  'password-strength': {
    title: 'PasswordStrength',
    note: 'A password field with a dotted strength meter and the rules ticking live.',
    desc: 'A password field with Show and Hide, a quiet strength meter and the rules ticking live. The meter is four short segments of dots, not a bar: they fill from the left, dot by dot, as the password gets stronger, and the word beside them (Weak, Fair, Good, Strong) rolls to the next one. Each rule\'s circle turns into a check as soon as it is met. The score weighs length and variety; common passwords and long runs of one character score as weak whatever they contain. onChange hands you the password and its strength on every keystroke, with passed true once every rule is met and the score reaches minScore, so a Save button can wake up. Bring your own rules, or keep the default four (12 characters, upper and lower case, a number, a symbol). A selection tick when the strength changes. Reduced motion: dots and words change in place.',
    hint: 'Type a password',
    tileHint: 'Type a password',
    mount: mountPassword,
    code: add('password-strength', 'PasswordStrength', `const [ok, setOk] = useState(false);

<PasswordStrength onChange={(password, strength) => setOk(strength.passed)} />
<GlossyButton disabled={!ok} onPress={save}>Save password</GlossyButton>

// Your own rules, a lower bar.
<PasswordStrength
  rules={[{ label: 'At least 8 characters', test: (p) => p.length >= 8 }]}
  minScore={2}
/>`),
    props: [
      prop('value', 'string', '', 'The password, controlled.'),
      prop('defaultValue', 'string', `''`, 'The password when uncontrolled.'),
      prop('onChange', '(password: string, strength: Strength) =&gt; void', '', 'Called on every keystroke. strength is { score: 0 to 4, label, rules: { label, met }[], passed }.'),
      prop('onSubmit', '(password: string, strength: Strength) =&gt; void', '', 'Return in the field.'),
      prop('rules', '{ label, test(password) }[]', 'DEFAULT_RULES', 'The checklist. Default: 12 characters, upper and lower case, a number, a symbol.'),
      prop('minScore', 'number', '3', 'The score passed needs: 1 Weak, 2 Fair, 3 Good, 4 Strong.'),
      prop('placeholder', 'string', `'Password'`, 'Placeholder of the field.'),
      prop('haptics', 'boolean', 'true', 'A selection tick when the strength changes.'),
      prop('disabled', 'boolean', 'false', 'Dims the field and ignores input.'),
      prop('surfaceClassName', 'string', `'bg-dissolve-surface'`, 'Classes of the field surface.'),
      prop('className', 'string', '', 'Outer classes (margins, width...).'),
    ],
    nativeOnly: ['surfaceClassName'],
  },
};
