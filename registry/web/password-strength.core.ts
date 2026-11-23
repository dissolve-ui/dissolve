/**
 * PasswordStrength for the web, framework free, from dissolve (dissolve-ui). This file is
 * yours. The React component (password-strength.tsx) wraps it; it also runs on its own:
 *
 *   const ps = createPasswordStrength(el, { onChange: (pw, s) => setOk(s.passed) });
 *
 * A password field with Show and Hide, a quiet strength meter and the rules ticking live. The meter
 * is four short segments of dots, not a bar: they fill from the left, dot by dot, as the password
 * gets stronger, and the word beside them (Weak, Fair, Good, Strong) rolls to the next one. Each
 * rule's circle turns into a check as soon as it is met. Common passwords and long runs of one
 * character score as weak whatever they contain. Reduced motion: dots and words change in place.
 * Colors follow --dissolve-surface (field), --dissolve-surface-2 (empty dots), --dissolve-foreground,
 * --dissolve-muted, --dissolve-success, --dissolve-danger.
 */
import { el, injectStyle, plainButton, propsOf, reducedMotion, scope, vibrate } from './kit';

export type PasswordRule = { label: string; test: (password: string) => boolean };

export type Strength = {
  /** 0 (empty) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  /** '', 'Weak', 'Fair', 'Good' or 'Strong'. */
  label: string;
  rules: { label: string; met: boolean }[];
  /** Every rule met and a score of at least minScore. */
  passed: boolean;
};

export type PasswordStrengthProps = {
  /** The password, controlled. */
  value?: string;
  defaultValue?: string;
  /** Called on every keystroke with the password and its strength. */
  onChange?: (password: string, strength: Strength) => void;
  /** Return in the field. */
  onSubmit?: (password: string, strength: Strength) => void;
  /** The checklist. Default: 12 characters, upper and lower case, a number, a symbol. */
  rules?: PasswordRule[];
  /** The score `passed` needs. Default 3 (Good). */
  minScore?: number;
  /** Placeholder. Default 'Password'. */
  placeholder?: string;
  /** A short vibration when the strength changes, where the browser has one. Default true. */
  haptics?: boolean;
  disabled?: boolean;
};

export type PasswordStrengthInstance = {
  get: () => { password: string; strength: Strength };
  focus: () => void;
  update: (props: Partial<PasswordStrengthProps>) => void;
  destroy: () => void;
};

export const DEFAULT_RULES: PasswordRule[] = [
  { label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { label: 'Upper and lower case letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: 'A number', test: (p) => /\d/.test(p) },
  { label: 'A symbol', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

const COMMON = ['password', '123456', '12345678', '123456789', 'qwerty', 'azerty', 'letmein', 'welcome', 'iloveyou', 'admin', 'abc123', 'monkey', 'dragon', 'football', 'sunshine', 'princess', 'passw0rd', 'trustno1'];
const WORDS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

/** The score of a password, 0 to 4: length and variety, common passwords and repeats knocked down. */
export function scorePassword(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  const lower = p.toLowerCase();
  if (COMMON.some((c) => lower.includes(c)) && p.length < 16) return 1;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (p.length >= 16) s++;
  s += [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length - 1;
  if (/(.)\1{2,}/.test(p)) s--;
  if (/^(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/i.test(p)) s--;
  return s <= 1 ? 1 : s <= 3 ? 2 : s <= 5 ? 3 : 4;
}

export function strengthOf(p: string, rules: PasswordRule[], minScore: number): Strength {
  const score = scorePassword(p);
  const r = rules.map((x) => ({ label: x.label, met: x.test(p) }));
  return { score, label: WORDS[score], rules: r, passed: score >= minScore && r.every((x) => x.met) };
}

const DEFAULTS = { defaultValue: '', rules: DEFAULT_RULES, minScore: 3, placeholder: 'Password', haptics: true, disabled: false };
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SPRINGY = 'cubic-bezier(0.25, 1, 0.5, 1)';
const SEGMENTS = 4;
const DOTS = 6;
const CHECK = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="var(--dissolve-success, rgb(52 199 89))"/><path d="M5.3 9.3l2.4 2.4 5-5.3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CSS = `
:where([data-dissolve="password-strength"]) { display: block; width: 100%; }
:where([data-dissolve="password-strength"][data-disabled]) { opacity: 0.5; pointer-events: none; }
:where(.dissolve-pw-field) { display: flex; align-items: center; height: 52px; padding: 0 4px; box-sizing: border-box; border-radius: 16px; background: var(--dissolve-surface, rgb(242 242 247)); transition: box-shadow 200ms ${EASE}; }
:where(.dissolve-pw-field[data-focus]) { box-shadow: 0 0 0 3px color-mix(in srgb, var(--dissolve-foreground, rgb(28 28 30)) 6%, transparent); }
:where(.dissolve-pw-toggle) { flex: none; height: 44px; min-width: 56px; padding: 0 12px !important; border-radius: 12px; font-size: 15px !important; font-weight: 600 !important; color: var(--dissolve-muted, rgb(142 142 147)) !important; outline: none; transition: opacity 120ms ${EASE}; }
:where(.dissolve-pw-toggle:active) { opacity: 0.5; }
:where(.dissolve-pw-toggle:focus-visible) { box-shadow: 0 0 0 3px color-mix(in srgb, var(--dissolve-foreground, rgb(28 28 30)) 20%, transparent); }
:where(.dissolve-pw-meter) { display: flex; align-items: center; gap: 12px; height: 20px; padding: 14px 16px 0; }
:where(.dissolve-pw-dots) { flex: 0 1 254px; min-width: 0; display: flex; justify-content: space-between; gap: 6px; }
:where(.dissolve-pw-seg) { flex: 0 1 56px; min-width: 0; display: flex; justify-content: space-between; }
:where(.dissolve-pw-dot) { position: relative; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dissolve-surface-2, rgb(229 229 234)); }
:where(.dissolve-pw-dot)::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--dissolve-foreground, rgb(28 28 30)); opacity: 0; transform: scale(0.4); transition: opacity 180ms ${EASE} var(--d, 0ms), transform 260ms ${SPRINGY} var(--d, 0ms); }
:where(.dissolve-pw-dot[data-on])::after { opacity: 1; transform: none; }
:where(.dissolve-pw-word) { position: relative; flex: none; margin-left: auto; width: 72px; height: 20px; overflow: hidden; }
:where(.dissolve-pw-word > span) { position: absolute; right: 0; top: 0; font-size: 15px; line-height: 20px; font-weight: 600; color: var(--dissolve-muted, rgb(142 142 147)); white-space: nowrap; }
:where(.dissolve-pw-word > span[data-score="1"]) { color: var(--dissolve-danger, rgb(255 59 48)); }
:where(.dissolve-pw-word > span[data-score="4"]) { color: var(--dissolve-success, rgb(52 199 89)); }
:where(.dissolve-pw-rules) { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 14px 16px 0; list-style: none; }
:where(.dissolve-pw-rule) { display: flex; align-items: center; gap: 10px; font-size: 15px; line-height: 20px; color: var(--dissolve-muted, rgb(142 142 147)); transition: color 160ms ${EASE}; }
:where(.dissolve-pw-rule[data-met]) { color: var(--dissolve-foreground, rgb(28 28 30)); }
:where(.dissolve-pw-mark) { position: relative; flex: none; width: 18px; height: 18px; }
:where(.dissolve-pw-mark)::before { content: ''; position: absolute; inset: 0; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--dissolve-muted, rgb(142 142 147)); opacity: 0.5; }
:where(.dissolve-pw-mark > svg) { position: absolute; inset: 0; opacity: 0; transform: scale(0.5); transition: opacity 140ms ${EASE}, transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1); }
:where(.dissolve-pw-rule[data-met] .dissolve-pw-mark > svg) { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { :where(.dissolve-pw-dot)::after, :where(.dissolve-pw-mark > svg) { transition: none; } }
`;

const INPUT: Partial<CSSStyleDeclaration> = {
  flex: '1', minWidth: '0', height: '100%', border: '0', outline: 'none', background: 'transparent', padding: '0 0 0 12px', margin: '0',
  color: 'var(--dissolve-foreground, rgb(28 28 30))', font: 'inherit', fontSize: '17px',
};

let uid = 0;

export function createPasswordStrength(host: HTMLElement, initial: PasswordStrengthProps = {}): PasswordStrengthInstance {
  injectStyle('dissolve-password-strength', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const ac = new AbortController();
  const on = { signal: ac.signal };
  const id = `dissolve-pw-${++uid}`;
  host.dataset.dissolve = 'password-strength';

  let pw = p().value ?? p().defaultValue;
  let shown = false;
  let lastScore = 0;

  const field = el('div', 'dissolve-pw-field');
  const input = el('input');
  Object.assign(input.style, INPUT);
  Object.assign(input, { type: 'password', autocomplete: 'new-password', spellcheck: false, autocapitalize: 'off' });
  input.setAttribute('aria-label', 'Password');
  input.setAttribute('aria-describedby', `${id}-meter ${id}-rules`);
  const toggle = plainButton('dissolve-pw-toggle');
  toggle.setAttribute('aria-controls', id + '-input');
  input.id = id + '-input';
  field.append(input, toggle);

  const meter = el('div', 'dissolve-pw-meter');
  meter.id = id + '-meter';
  meter.setAttribute('aria-live', 'polite');
  const dotsBox = el('div', 'dissolve-pw-dots');
  dotsBox.setAttribute('aria-hidden', 'true');
  const dots: HTMLElement[] = [];
  for (let g = 0; g < SEGMENTS; g++) {
    const seg = el('div', 'dissolve-pw-seg');
    for (let k = 0; k < DOTS; k++) { const d = el('span', 'dissolve-pw-dot'); dots.push(d); seg.append(d); }
    dotsBox.append(seg);
  }
  const word = el('div', 'dissolve-pw-word');
  let wordSpan = el('span');
  word.append(wordSpan);
  const sr = el('span');
  Object.assign(sr.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' });
  meter.append(dotsBox, word, sr);

  const list = el('ul', 'dissolve-pw-rules');
  list.id = id + '-rules';
  list.setAttribute('aria-label', 'Password rules');
  host.append(field, meter, list);

  const strength = () => strengthOf(pw, p().rules, p().minScore);

  function renderRules() {
    list.replaceChildren(...p().rules.map((r) => {
      const li = el('li', 'dissolve-pw-rule', `<span class="dissolve-pw-mark">${CHECK}</span><span></span>`);
      (li.lastChild as HTMLElement).textContent = r.label;
      return li;
    }));
  }

  function paint(first = false) {
    const s = strength();
    const rm = reducedMotion() || first;
    // Dots: new ones fill left to right, dot by dot; leaving ones empty at once.
    dots.forEach((d, i) => {
      const g = Math.floor(i / DOTS);
      const on = g < s.score;
      const was = d.hasAttribute('data-on');
      if (on !== was) {
        const rank = i - lastScore * DOTS;
        d.style.setProperty('--d', on && !rm ? `${Math.max(0, rank) * 18}ms` : '0ms');
        d.toggleAttribute('data-on', on);
      }
    });
    if (wordSpan.textContent !== s.label) {
      const next = el('span');
      next.textContent = s.label;
      next.dataset.score = String(s.score);
      word.append(next);
      const old = wordSpan;
      wordSpan = next;
      if (!rm) {
        const up = s.score >= lastScore ? 1 : -1;
        next.animate([{ opacity: 0, transform: `translateY(${10 * up}px)` }, { opacity: 1, transform: 'none' }], { duration: 320, easing: SPRINGY });
        old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${-10 * up}px)` }], { duration: 200, easing: EASE, fill: 'forwards' }).finished.then(() => old.remove(), () => old.remove());
      } else old.remove();
    }
    sr.textContent = s.score ? `Strength ${s.label}` : '';
    s.rules.forEach((r, i) => {
      const li = list.children[i] as HTMLElement | undefined;
      if (!li) return;
      li.toggleAttribute('data-met', r.met);
      li.setAttribute('aria-label', `${r.label}, ${r.met ? 'done' : 'not yet'}`);
    });
    if (!first && s.score !== lastScore && s.score > 0 && p().haptics) vibrate(4);
    lastScore = s.score;
    toggle.textContent = shown ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(shown));
    input.type = shown ? 'text' : 'password';
    input.placeholder = p().placeholder;
    input.disabled = p().disabled;
  }

  input.addEventListener('input', () => {
    pw = input.value;
    paint();
    p().onChange?.(pw, strength());
  }, on);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') p().onSubmit?.(pw, strength()); }, on);
  input.addEventListener('focus', () => field.setAttribute('data-focus', ''), on);
  input.addEventListener('blur', () => field.removeAttribute('data-focus'), on);
  toggle.addEventListener('pointerdown', (e) => e.preventDefault(), on);
  toggle.addEventListener('click', () => {
    shown = !shown;
    const a = input.selectionStart, b = input.selectionEnd;
    paint();
    if (document.activeElement === input && a !== null && b !== null) input.setSelectionRange(a, b);
  }, on);

  input.value = pw;
  host.toggleAttribute('data-disabled', p().disabled);
  renderRules();
  paint(true);

  return {
    get: () => ({ password: pw, strength: strength() }),
    focus: () => input.focus(),
    update(next) {
      const changed = props.update(next);
      host.toggleAttribute('data-disabled', p().disabled);
      if (changed.has('rules')) renderRules();
      if (changed.has('value') && p().value !== undefined && p().value !== pw) { pw = p().value!; input.value = pw; }
      paint();
    },
    destroy() {
      ac.abort();
      sc.dispose();
      field.remove(); meter.remove(); list.remove();
      host.removeAttribute('data-dissolve');
      host.removeAttribute('data-disabled');
    },
  };
}
