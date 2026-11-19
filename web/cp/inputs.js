// Inputs demos: SlideToConfirm, OTPInput, NumberTicker. The components are the React web
// components' cores (registry/web/*.core.ts, built into web/lib), the same code a React app
// installs. This file keeps the demo: the site colors, sizes per mode, the demo payment and code
// check, the buttons, and the autoplay, which drives each component with real events.
import { createSlideToConfirm } from '../lib/slide-to-confirm.js';
import { createOtpInput } from '../lib/otp-input.js';
import { createNumberTicker } from '../lib/number-ticker.js';
import { IN_OUT_CUBIC, el, tween, AUTO, PKG, DIR, prop } from './kit.js';

/** Whether a real pointer is down on node. The scripted events are not trusted, so they never count. */
function userOn(sc, node) {
  let down = false;
  const lift = (e) => { if (e.isTrusted) down = false; };
  node.addEventListener('pointerdown', (e) => { if (e.isTrusted) down = true; });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  sc.onDispose(() => { removeEventListener('pointerup', lift); removeEventListener('pointercancel', lift); });
  return () => down;
}

/* ======================================================================================
   SlideToConfirm
   ====================================================================================== */

const PAY_MS = 1400, RESET_AFTER = 1600, KNOB = 50, PAD = 5;

function mountSlide(body, { sc }) {
  const host = el('div', 'cp-slide');
  body.append(host);
  let busyUntil = 0;
  const slide = createSlideToConfirm(host, {
    label: 'Slide to pay 42 €',
    doneLabel: 'Paid',
    resetAfter: RESET_AFTER,
    // The demo payment: 1.4 s, then the done state, then back to idle.
    onConfirm: () => {
      busyUntil = performance.now() + PAY_MS + RESET_AFTER + 440;
      return sc.wait(PAY_MS);
    },
  });
  sc.onDispose(() => slide.destroy());
  const user = userOn(sc, host);

  /** A pointer event at x (layout px from the track's left edge), where the track sits on screen. */
  const send = (type, x) => {
    const r = host.getBoundingClientRect(), s = r.width / host.offsetWidth || 1;
    host.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, button: 0, clientX: r.left + x * s, clientY: r.top + r.height / 2 }));
  };

  // Scripted slide: a calm drag to near the end, then release, so the track locks, loads and confirms.
  async function run() {
    if (user() || performance.now() < busyUntil) return;
    const from = PAD + KNOB / 2, dist = (host.clientWidth - KNOB - PAD * 2) * 0.94;
    send('pointerdown', from);
    await tween(sc, 820, (k) => send('pointermove', from + dist * IN_OUT_CUBIC(k)), user);
    await sc.wait(60);
    send('pointerup', from + dist);
    // The lock takes 160 ms, then onConfirm sets how long the payment and the done state last.
    await sc.wait(200);
    const left = busyUntil - performance.now();
    if (left > 0) await sc.wait(left);
  }
  return { run };
}

/* ======================================================================================
   OTPInput
   ====================================================================================== */

const CORRECT = '123456';

function mountOTP(body, { sc, mode }) {
  const tile = mode === 'tile';
  const host = el('div', 'cp-otp');
  const again = el('button', 'cp-reset cp-otp-reset', 'Reset');
  again.type = 'button';
  const showAgain = (on) => { again.style.visibility = on ? '' : 'hidden'; again.tabIndex = on ? 0 : -1; };
  showAgain(false);
  body.append(host);
  if (!tile) body.append(again);

  const otp = createOtpInput(host, {
    height: tile ? 50 : 56,
    fontSize: tile ? 23 : 26,
    digitClassName: 'cp-otp-digit',
    // The demo check: a 900 ms round trip, 123456 is the right code.
    onComplete: async (code) => {
      await sc.wait(900);
      const ok = code === CORRECT;
      showAgain(ok);
      return ok;
    },
  });
  sc.onDispose(() => otp.destroy());
  const clear = () => { otp.reset(); showAgain(false); };
  again.addEventListener('click', () => { clear(); otp.focus(); });

  // The autoplay types into the component's own field, as a keyboard would.
  const field = host.querySelector('input');
  const type = async (digits) => {
    for (const ch of digits) {
      field.value += ch;
      field.dispatchEvent(new Event('input'));
      await sc.wait(80);
    }
  };

  return {
    // Scripted: a wrong code shakes and turns to dust, then the right one goes green.
    async run() {
      clear();
      await type('123465');
      while (field.value && sc.alive) await sc.wait(100);
      await sc.wait(250);
      await type(CORRECT);
      await sc.wait(1000 + 900);
      if (tile) clear();
    },
  };
}

/* ======================================================================================
   NumberTicker
   ====================================================================================== */

/** A new random amount: mostly small moves, sometimes a jump that adds or drops a digit. */
function randomAmount(from) {
  const jump = Math.random() < 0.3;
  let v = jump ? (from >= 10000 ? 200 + Math.random() * 1800 : 10000 + Math.random() * 9000) : from * (0.75 + Math.random() * 0.5);
  v = Math.round(Math.max(1, v) * 100) / 100;
  return v === from ? v + 1 : v;
}

const TICK_MS = 700, STAGGER = 28;

function mountTicker(body, { sc, mode }) {
  const host = el('div', 'cp-ticker');
  const btn = el('button', 'cp-reset cp-ticker-btn', 'New value');
  btn.type = 'button';
  body.append(host, btn);

  let current = 1240.5;
  const ticker = createNumberTicker(host, {
    value: current,
    decimals: 2,
    locale: 'fr-FR',
    suffix: ' €',
    fontSize: mode === 'stage' ? 44 : 38,
    duration: TICK_MS,
    stagger: STAGGER,
    tabular: false,
    textClassName: 'cp-ticker-text',
  });
  sc.onDispose(() => ticker.destroy());

  const next = () => { current = randomAmount(current); ticker.update({ value: current }); };
  btn.addEventListener('click', next);
  return {
    async run() { next(); await sc.wait(TICK_MS + 8 * STAGGER + 900); },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'slide-to-confirm': {
    title: 'SlideToConfirm',
    note: 'Slide the knob to the end to pay.',
    desc: 'Slide to pay or confirm, like Apple Pay or power off. A light shimmer runs across the label, the track fills behind the knob, and past the threshold it locks, loads, then confirms.',
    hint: 'Drag the knob to the end',
    tileHint: 'Slide to pay',
    mount: mountSlide,
    code: `// npx ${PKG} add slide-to-confirm
import { SlideToConfirm } from '${DIR}/slide-to-confirm';

<SlideToConfirm
  label="Slide to pay 42 €"
  doneLabel="Paid"
  onConfirm={() => pay(order)} // the knob shows a loader until the promise settles
/>`,
    props: [
      prop('label', 'string', 'required', 'Label on the track, with a shimmer running across it.'),
      prop('onConfirm', '() => Promise | void', 'required', 'Runs once the knob reaches the end. The knob shows a loader until the promise settles; a rejection goes back to idle.'),
      prop('doneLabel', 'string', `'Done'`, 'Label once confirmed.'),
      prop('height', 'number', '60', 'Track height. The knob is 10 points smaller.'),
      prop('threshold', 'number', '0.88', 'Fraction of the track to reach before release confirms. A flick past halfway confirms too.'),
      prop('resetAfter', 'number', '1600', 'Time on the done state before the slider resets, ms. 0 stays done.'),
      prop('haptics', 'boolean', 'true', 'Medium impact on lock, success when done.'),
      prop('className', 'string', `'rounded-full bg-dissolve-surface'`, 'Track: background, radius, margins. Fill, label and done state read the primary, muted and success tokens.'),
      prop('knobClassName', 'string', `'rounded-full shadow-md'`, 'Knob: shadow, extra layout. Its color is animated from the primary token.'),
    ],
  },
  'otp-input': {
    title: 'OTPInput',
    note: 'A wrong code shakes, then turns to dust.',
    desc: 'One time code input. A hidden field (SMS autofill, paste) drives the boxes, the active box blinks a calm caret and each digit lands crisply. A full code is checked: the boxes turn green, or the row shakes and the digits blow away as dust before the input clears and asks again.',
    hint: 'Type a code. 123456 is the right one',
    tileHint: 'Type a code',
    mount: mountOTP,
    code: `// npx ${PKG} add otp-input
import { OTPInput } from '${DIR}/otp-input';

<OTPInput
  autoFocus
  onComplete={async (code) => (await api.verify(code)).ok}
/>`,
    props: [
      prop('length', 'number', '6', 'Number of digits.'),
      prop('value', 'string', '', 'Controlled value. Leave undefined to let the input own its state.'),
      prop('onChange', '(code: string) => void', '', 'Called on every change.'),
      prop('onComplete', '(code: string) => boolean | void | Promise', '', 'Runs once every box is filled. True shows the success state, false rejects: the row shakes, the digits turn to dust and the input clears. Nothing leaves the code in place.'),
      prop('autoFocus', 'boolean', 'false', 'Focus on mount.'),
      prop('height', 'number', '56', 'Box height. Box width follows the available space unless boxWidth is set.'),
      prop('boxWidth', 'number', '', 'Fixed box width.'),
      prop('gap', 'number', '8', 'Space between boxes.'),
      prop('fontSize', 'number', '26', 'Digit size.'),
      prop('radius', 'number', '14', 'Box corner radius.'),
      prop('blurOnSuccess', 'boolean', 'true', 'Close the keyboard once the code is accepted.'),
      prop('haptics', 'boolean', 'true', 'Success and error notifications.'),
      prop('className', 'string', '', 'Root: margins, width.'),
      prop('boxClassName', 'string', '', 'Every box: shadow, extra layout. Box colors are animated from the surface, border, foreground, success and danger tokens.'),
      prop('digitClassName', 'string', `'font-semibold'`, 'Digits: weight, family. Their color is animated from the tokens.'),
    ],
  },
  'number-ticker': {
    title: 'NumberTicker',
    note: 'Every digit rolls to its new value.',
    desc: 'Animated number for prices, balances and counters. Every digit is a clipped 0 to 9 column that rolls to its new value on a calm iOS curve, right to left with a slight stagger. Added digits open in, removed ones fold out, so the layout never jumps.',
    hint: 'Change the value',
    tileHint: 'Digits roll',
    mount: mountTicker,
    code: `// npx ${PKG} add number-ticker
import { NumberTicker } from '${DIR}/number-ticker';

<NumberTicker
  value={balance}
  decimals={2}
  locale="fr-FR"
  suffix={'\\u00A0€'}
  fontSize={44}
/>`,
    props: [
      prop('value', 'number', 'required', 'The number to show. Digits roll whenever it changes.'),
      prop('decimals', 'number', '0', 'Digits after the decimal separator.'),
      prop('locale', 'string', '', `Picks the separators, e.g. 'fr-FR' gives "1 240,50", 'en-US' "1,240.50".`),
      prop('separator', 'string', '', `Overrides the locale thousands separator. '' turns grouping off.`),
      prop('decimalSeparator', 'string', '', 'Overrides the locale decimal separator.'),
      prop('prefix', 'string', '', `Static text before the number, e.g. '$'.`),
      prop('suffix', 'string', '', 'Static text after the number, e.g. a no break space and €.'),
      prop('fontSize', 'number', '34', 'Text size.'),
      prop('duration', 'number', '700', 'Roll duration, ms.'),
      prop('stagger', 'number', '28', 'Delay between two columns, right to left, ms.'),
      prop('tabular', 'boolean', 'true', 'Tabular figures, so digits never change width.'),
      prop('className', 'string', `'flex-row items-center self-start'`, 'Root: margins, alignment.'),
      prop('textClassName', 'string', `'font-semibold text-dissolve-foreground'`, 'Number: color, weight, family.'),
      prop('affixClassName', 'string', '', 'Prefix and suffix, added on top of the number classes.'),
    ],
  },
};
