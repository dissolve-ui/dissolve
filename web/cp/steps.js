// ProgressSteps demo. The steps are the React web component's core (registry/web/progress-steps.core.ts,
// built into web/lib), the same code a React app installs. This file keeps the demo: story bars over a
// numbered checkout flow, both driven by Back and Next, and the autoplay.
import { createProgressSteps } from '../lib/progress-steps.js';
import { el, fitTile, availW, prop, add } from './kit.js';

const STEPS = ['Account', 'Profile', 'Payment', 'Done'];

function mountSteps(body, { sc, mode }) {
  const tile = mode === 'tile';
  const W = tile ? 320 : mode === 'stage' ? 380 : Math.round(Math.min(360, (availW(body) || 360) - 4));
  const root = el('div', 'ps-demo');
  root.style.width = W + 'px';
  const barsHost = el('div', 'ps-bars');
  const host = el('div');
  root.append(barsHost, host);
  const bar = el('div', 'ps-buttons');
  const back = el('button', 'ps-btn', 'Back');
  const next = el('button', 'ps-btn ps-next', 'Next');
  back.type = next.type = 'button';
  bar.append(back, next);
  if (!tile) root.append(bar);
  body.append(tile ? fitTile(body, root, W, 120) : root);

  let step = 1;
  const steps = createProgressSteps(host, { steps: STEPS, current: step, onStepPress: (i) => { if (i < step) go(i); } });
  const bars = createProgressSteps(barsHost, { variant: 'bars', steps: STEPS, current: step, onStepPress: (i) => go(i) });
  sc.onDispose(() => { steps.destroy(); bars.destroy(); });
  const go = (i) => {
    step = Math.max(0, Math.min(STEPS.length, i));
    steps.update({ current: step });
    bars.update({ current: step });
    next.textContent = step >= STEPS.length - 1 ? 'Finish' : 'Next';
    back.disabled = step === 0;
    next.disabled = step === STEPS.length;
  };
  go(step);
  back.addEventListener('click', () => go(step - 1));
  next.addEventListener('click', () => go(step + 1));

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
    note: 'Numbered steps or story bars: the progress streams on in grains.',
    desc: 'Steps for onboarding, checkout or any multi step form, in two looks. variant="numbers" draws small numbered discs on a hairline: done steps are filled with a check, the current one has a thin ring around it, the next ones are soft and muted. Move forward and the current disc sheds a copy of itself in grains: the cloud flattens onto the line and streams along it, filling the line behind its front, then gathers back into a disc on the new step, in about 450 ms and a little longer when it skips steps. Move back and the disc breaks up and streams home the other way, emptying the line. variant="bars" is story style: one thin segment per step and no numbers. The fill runs on into the next segment, its head gathering out of grains that drift in and settle, and recedes shedding them as dust when you go back. A selection tick on every change. On iOS the discs, fills and every grain are Animated views moved by transform and opacity only, so it keeps animating inside a scroll view that is being dragged. Reduced motion: the fills slide and the discs cross fade.',
    hint: 'Click Next and Back, or a done step',
    tileHint: 'Click a done step',
    mount: mountSteps,
    code: add('progress-steps', 'ProgressSteps', `const [step, setStep] = useState(0);
<ProgressSteps steps={['Account', 'Profile', 'Payment', 'Done']} current={step} />

// Numbers only, smaller, done steps can be pressed to go back.
<ProgressSteps steps={5} current={step} size="sm" onStepPress={(i) => i < step && setStep(i)} />

// Story bars, no numbers.
<ProgressSteps variant="bars" steps={4} current={story} />`),
    props: [
      prop('variant', `'numbers' | 'bars'`, `'numbers'`, 'Numbered discs on a line, or story style segments with no numbers.'),
      prop('steps', 'string[] | number', 'required', 'The steps: their labels, or how many there are (no labels then). Two or more.'),
      prop('current', 'number', 'required', 'The current step, from 0. steps.length marks them all done.'),
      prop('onStepPress', '(index: number) =&gt; void', '', 'Called with the index of a pressed step. Steps are not pressable without it.'),
      prop('size', `'sm' | 'md' | 'lg'`, `'md'`, 'Disc, line and type size (18, 22 or 28 pt discs), or bar thickness (3, 4 or 6 pt).'),
      prop('haptics', 'boolean', 'true', 'Selection tick on every change of current.'),
      prop('activeColor', 'string', 'primary token', 'Fill of the done and current discs, the line and the grains.'),
      prop('trackColor', 'string', 'foreground at low alpha', "The next steps' discs, the empty line and the empty bars."),
      prop('className / labelClassName', 'string', '', 'Outer classes (width, margins...) and label classes. It stretches to its parent by default.'),
    ],
  },
};
