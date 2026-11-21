// ProgressSteps demo. The steps are the React web component's core (registry/web/progress-steps.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: a checkout
// flow with Back and Next, a smaller numbered row on the component page, and the autoplay.
import { createProgressSteps } from '../lib/progress-steps.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const STEPS = ['Account', 'Profile', 'Payment', 'Done'];

function mountSteps(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? 380 : Math.round(Math.min(360, (availW(body) || 360) - 4));
  const root = el('div', 'ps-demo');
  root.style.width = W + 'px';
  const host = el('div');
  root.append(host);
  const bar = el('div', 'ps-buttons');
  const back = el('button', 'ps-btn', 'Back');
  const next = el('button', 'ps-btn ps-next', 'Next');
  back.type = next.type = 'button';
  bar.append(back, next);
  if (!tile) root.append(bar);
  body.append(tile ? fitTile(body, root, W, 64) : root);

  let step = 1;
  const steps = createProgressSteps(host, { steps: STEPS, current: step, onStepPress: (i) => { if (i < step) go(i); } });
  sc.onDispose(() => steps.destroy());
  const go = (i) => {
    step = Math.max(0, Math.min(STEPS.length, i));
    steps.update({ current: step });
    next.textContent = step >= STEPS.length - 1 ? 'Finish' : 'Next';
    back.disabled = step === 0;
    next.disabled = step === STEPS.length;
  };
  go(step);
  back.addEventListener('click', () => go(step - 1));
  next.addEventListener('click', () => go(step + 1));

  if (mode === 'stage') {
    let small = 2;
    const host2 = el('div', 'ps-small');
    root.append(host2);
    const s2 = createProgressSteps(host2, { steps: 6, current: small, size: 'sm', onStepPress: (i) => { small = i; s2.update({ current: i }); } });
    sc.onDispose(() => s2.destroy());
  }

  // A real pointer on the demo stops the script.
  let user = false;
  root.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });

  return {
    async run() {
      for (const i of [2, 3, 4, 1, 3, 1]) {
        if (!sc.alive || user) return;
        go(i);
        await sc.wait(i === 4 ? 900 : 750);
      }
    },
  };
}

export const ENTRIES = {
  'progress-steps': {
    title: 'ProgressSteps',
    note: 'Next and Back: the disc streams along the line in grains and gathers on the new step.',
    desc: 'A row of numbered steps joined by a line, for onboarding, checkout or any multi step form. Done steps are filled with a check, the current one is filled with a soft ring around it, the next ones are hollow. Move forward and the current disc sheds a copy of itself in grains: the cloud flattens onto the line and streams along it, filling the line behind its front, then gathers back into a disc on the new step, in about 450 ms and a little longer when it skips steps. Move back and the disc breaks up and streams home the other way, emptying the line. A selection tick on every change. On iOS the discs, line fills and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the line fills and the discs cross fade.',
    hint: 'Click Next and Back, or a done step',
    tileHint: 'Click a done step',
    mount: mountSteps,
    code: add('progress-steps', 'ProgressSteps', `const [step, setStep] = useState(0);
<ProgressSteps steps={['Account', 'Profile', 'Payment', 'Done']} current={step} />

// Numbers only, smaller, done steps can be pressed to go back.
<ProgressSteps steps={5} current={step} size="sm" onStepPress={(i) => i < step && setStep(i)} />`),
    props: [
      prop('steps', 'string[] | number', 'required', 'The steps: their labels, or how many there are (no labels then). Two or more.'),
      prop('current', 'number', 'required', 'The current step, from 0. steps.length marks them all done.'),
      prop('onStepPress', '(index: number) =&gt; void', '', 'Called with the index of a pressed step. Steps are not pressable without it.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Disc, line and type size: 20, 26 or 32 pt discs.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on every change of current.'),
      prop('activeColor', 'string', 'primary token', 'Fill of the done and current discs, the line and the grains.'),
      prop('trackColor', 'string', 'foreground at low alpha', 'Hollow discs and the empty line.'),
      prop('className / labelClassName', 'string', '', 'Outer classes (width, margins...) and label classes. It stretches to its parent by default.'),
    ],
  },
};
