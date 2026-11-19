// Message component demos: ReactionPicker, VoiceNote, SignaturePad. Each component is the React web
// component's core (registry/web/<name>.core.ts, built into web/lib), the same code a React app
// installs. This file keeps the demos: the bubble and its text, the sizes per mode, the site colors
// (messages.css) and the autoplay scripts, which drive the components with real pointer events.
import { createReactionPicker } from '../lib/reaction-picker.js';
import { createVoiceNote } from '../lib/voice-note.js';
import { createSignaturePad } from '../lib/signature-pad.js';
import { QUAD, el, rectOf, frame, isLight, AUTO, PKG, DIR, prop } from './kit.js';

const send = (node, type, x, y) => node.dispatchEvent(new PointerEvent(type, { pointerId: AUTO, isPrimary: true, bubbles: true, clientX: x, clientY: y }));

/** Moves the scripted finger over node for ms, at(k) giving the window point for k in 0..1. */
async function slide(sc, node, ms, at) {
  const t0 = performance.now();
  while (sc.alive) {
    const k = Math.min(1, (performance.now() - t0) / ms);
    send(node, 'pointermove', ...at(k));
    if (k >= 1) break;
    await frame();
  }
}

/** A tap of the scripted finger at (x, y). */
async function tap(sc, node, x, y) {
  send(node, 'pointerdown', x, y);
  await sc.wait(90);
  send(node, 'pointerup', x, y);
}

/* ======================================================================================
   ReactionPicker
   ====================================================================================== */

const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const MESSAGE = 'Maya finished the three screens, they look great';
const HOLD = 320, SLOT = 44, PAD = 6;

function mountReaction(body, { sc }) {
  const wrap = el('div', 'cp-rx');
  const host = el('div', 'cp-rx-holder');
  wrap.append(host);
  body.append(wrap);

  let selected = null;
  const picker = createReactionPicker(host, {
    reactions: REACTIONS,
    insets: { top: 8, bottom: 8 },
    pillClassName: 'cp-rx-pill',
    badgeClassName: 'cp-rx-disc',
    onReact: (emoji) => {
      selected = selected === emoji ? null : emoji;
      picker.update({ selected });
    },
  });
  const bubble = el('div', 'cp-rx-bubble');
  bubble.textContent = MESSAGE;
  picker.slot.append(bubble);
  sc.onDispose(() => picker.destroy());

  const pillOf = () => [...document.querySelectorAll('.cp-rx-pill')].at(-1);
  let turn = 0;
  return {
    async run() {
      if (pillOf()) return;
      // Hold, then slide across the pill and let go on an emoji (a different one each time).
      const target = [0, 5, 1, 4][turn++ % 4];
      const same = selected === REACTIONS[target];
      const r = rectOf(picker.slot);
      const start = { x: r.x + r.w * 0.3, y: r.y + r.h / 2 };
      send(picker.slot, 'pointerdown', start.x, start.y);
      await sc.wait(HOLD + 380);
      const pill = pillOf();
      if (!pill) return send(picker.slot, 'pointerup', start.x, start.y);
      // The pill may still be settling: its center is reliable, and its layout width is not scaled.
      const b = pill.getBoundingClientRect();
      const left = b.left + b.width / 2 - pill.offsetWidth / 2, y = b.top + b.height / 2 + 6;
      const x0 = left + PAD + SLOT / 2, x1 = left + PAD + target * SLOT + SLOT / 2;
      await slide(sc, picker.slot, 420 + Math.abs(x1 - x0) * 1.6, (k) => [x0 + (x1 - x0) * QUAD(k), start.y + (y - start.y) * Math.min(1, k * 2.5)]);
      await sc.wait(220);
      send(picker.slot, 'pointerup', x1, y);
      await sc.wait(same ? 1000 : 1400);
    },
  };
}

/* ======================================================================================
   VoiceNote
   ====================================================================================== */

const DURATION = 9, BTN = 34;

function mountVoice(body, { sc }) {
  const W = Math.round(Math.min(248, body.clientWidth || 248));
  // Geometry of the bubble, for the script: button on the left, then the waveform, then the label.
  const waveX = 8 + BTN + 10, waveW = W - waveX - 10 - 30 - 14;
  const wrap = el('div', 'cp-vn');
  const host = el('div');
  wrap.append(host);
  body.append(wrap);

  // Where playback is, as far as the callbacks tell: enough to start a scrub under the playhead.
  let playing = false, at = 0, since = 0, gone = false, back = null;
  const progress = () => Math.min(1, at + (playing ? (performance.now() - since) / (DURATION * 1000) : 0));
  const note = createVoiceNote(host, {
    mine: true,
    duration: DURATION,
    seed: 'rayan-reply',
    width: W,
    className: 'cp-vn-bubble',
    buttonClassName: 'cp-vn-btn',
    labelClassName: 'cp-vn-label',
    onPlay: () => { playing = true; since = performance.now(); },
    onPause: () => { at = progress(); playing = false; },
    onEnd: () => { playing = false; at = 0; },
    // On the web the note comes back, fresh, so the demo can be played again.
    onUnsend: () => {
      gone = true;
      playing = false;
      at = 0;
      back = sc.wait(450).then(() => note.reset()).then(() => { gone = false; back = null; });
    },
  });
  sc.onDispose(() => note.destroy());
  const bubble = host.querySelector('.cp-vn-bubble');

  /** Window point of (x, y) in bubble units. */
  const point = (x, y) => {
    const r = bubble.getBoundingClientRect(), s = r.width / bubble.offsetWidth || 1;
    return [r.left + x * s, r.top + y * s];
  };
  const mid = bubble.offsetHeight / 2;

  return {
    async run() {
      if (gone) return;
      // Play, scrub ahead along the waveform, let it play on, pause, then hold to unsend.
      if (!playing) await tap(sc, bubble, ...point(8 + BTN / 2, mid));
      await sc.wait(1200);
      if (gone) return;
      const from = progress();
      send(bubble, 'pointerdown', ...point(waveX + from * waveW, mid));
      await slide(sc, bubble, 520, (k) => point(waveX + (from + (0.68 - from) * QUAD(k)) * waveW, mid));
      send(bubble, 'pointerup', ...point(waveX + 0.68 * waveW, mid));
      await sc.wait(1000);
      if (gone) return;
      if (playing) await tap(sc, bubble, ...point(8 + BTN / 2, mid));
      await sc.wait(350);
      const hold = point(W - 22, mid);
      send(bubble, 'pointerdown', ...hold);
      await sc.wait(520);
      send(bubble, 'pointerup', ...hold);
      for (let i = 0; i < 60 && sc.alive && !gone; i++) await sc.wait(50);
      await back;
    },
  };
}

/* ======================================================================================
   SignaturePad
   ====================================================================================== */

// A scripted signature in a 300 x 100 box (baseline near 75): one flowing line, then a flourish.
const SIGNATURE = [
  [[20, 70], [30, 20], [60, 10], [55, 45], [50, 80], [20, 90], [40, 75], [60, 60], [80, 40], [95, 55], [105, 65], [100, 80], [115, 70], [130, 60], [135, 45], [150, 55], [160, 62], [158, 78], [172, 70], [190, 60], [200, 40], [215, 50], [228, 58], [220, 78], [240, 72], [260, 66], [270, 55], [290, 50]],
  [[60, 88], [120, 82], [200, 84], [270, 78]],
];
/** Points of the sampled signature written per second, about 520 px/s. */
const PEN_RATE = 120;

function sampleCubics(pts, steps = 18) {
  const out = [];
  for (let s = 0; s + 3 < pts.length; s += 3) {
    const [p0, p1, p2, p3] = [pts[s], pts[s + 1], pts[s + 2], pts[s + 3]];
    for (let j = s === 0 ? 0 : 1; j <= steps; j++) {
      const t = j / steps, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
  }
  return out;
}

function mountSignature(body, { sc, mode }) {
  const H = mode === 'tile' ? 160 : mode === 'panel' ? 180 : 200;
  const host = el('div', 'cp-sig');
  body.append(host);
  const pad = createSignaturePad(host, {
    height: H,
    strokeColor: isLight() ? '#1C1C1E' : '#F2F2F7',
    guideClassName: 'cp-sig-line',
    placeholderClassName: 'cp-sig-guide',
    controlClassName: 'cp-sig-tool',
  });
  sc.onDispose(() => pad.destroy());
  const ink = host.querySelector('canvas');

  // A real pointer on the pad stops the script.
  let user = false;
  const lift = (e) => { if (e.isTrusted) user = false; };
  host.addEventListener('pointerdown', (e) => { if (e.isTrusted) user = true; });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  sc.onDispose(() => { removeEventListener('pointerup', lift); removeEventListener('pointercancel', lift); });

  /** Window point of (x, y) in pad units. */
  const point = (x, y) => {
    const r = ink.getBoundingClientRect(), s = r.width / ink.offsetWidth || 1;
    return [r.left + x * s, r.top + y * s];
  };

  return {
    async run() {
      if (user) return;
      if (!pad.isEmpty()) { await pad.clear(); await sc.wait(1300); }
      // Write the scripted signature at a hand's pace, then clear it into dust.
      const W = ink.offsetWidth;
      const s = Math.min((W - 60) / 300, (H * 0.6) / 100);
      const ox = (W - 300 * s) / 2, oy = H * 0.7 - 75 * s;
      for (const stroke of SIGNATURE) {
        const pts = sampleCubics(stroke).map(([x, y]) => point(ox + x * s, oy + y * s));
        send(ink, 'pointerdown', ...pts[0]);
        const t0 = performance.now();
        let i = 0;
        while (i < pts.length - 1 && sc.alive && !user) {
          await frame();
          i = Math.min(pts.length - 1, Math.floor(((performance.now() - t0) / 1000) * PEN_RATE));
          send(ink, 'pointermove', ...pts[i]);
        }
        send(ink, 'pointerup', ...pts[i]);
        if (user) return;
        await sc.wait(160);
      }
      await sc.wait(900);
      if (user) return;
      await pad.clear();
      await sc.wait(800);
    },
  };
}

/* ======================================================================================
   Content
   ====================================================================================== */

export const ENTRIES = {
  'reaction-picker': {
    title: 'ReactionPicker',
    note: 'Long press, slide to an emoji, it flies to the corner.',
    desc: 'iMessage style reactions. Long press a bubble: it lifts, a pill of emojis grows out of the press point. Slide across and the emoji under the finger magnifies like the Dock. Release on one to pick it, it flies to the bubble corner. Pick the same one again and the badge snaps into grains.',
    hint: 'Long press, slide to an emoji',
    tileHint: 'Hold it',
    mount: mountReaction,
    remountOnTheme: true,
    code: `// npx ${PKG} add reaction-picker
import { useState } from 'react';
import { ReactionPicker } from '${DIR}/reaction-picker';

export function Message({ text }) {
  const [reaction, setReaction] = useState(null);

  return (
    <ReactionPicker
      selected={reaction}
      onReact={(e) => setReaction(e === reaction ? null : e)}
    >
      <Bubble text={text} />
    </ReactionPicker>
  );
}`,
    props: [
      prop('children', 'ReactNode', 'required', 'The bubble. It lifts while the picker is open.'),
      prop('onReact', '(emoji: string) =&gt; void', 'required', 'Called with the chosen emoji. Picking the current one again is your cue to remove it.'),
      prop('reactions', 'string[]', `['❤️', '😂', '😮', '😢', '👍', '🔥']`, 'Emojis offered in the pill.'),
      prop('selected', 'string | null', '', 'Current reaction, shown as a badge on the bubble corner.'),
      prop('corner', `'top-left' | 'top-right'`, `'top-right'`, 'Corner the badge sits on. Use top-left for your own bubbles.'),
      prop('insets', '{ top?, bottom? }', '{ top: 60, bottom: 34 }', 'Space kept free at the top and bottom of the window (safe area).'),
      prop('disabled', 'boolean', 'false', 'Turns the long press off.'),
      prop('haptics', 'boolean', 'true', 'Medium impact on open, a tick per emoji crossed, light impact on pick.'),
      prop('className', 'string', '', 'Wrapper: margins, alignment.'),
      prop('pillClassName', 'string', '', 'Emoji pill: background, border, shadow.'),
      prop('badgeClassName', 'string', '', 'Badge disc, also used by the emoji flying to the bubble.'),
      prop('backdropClassName', 'string', 'transparent', 'Layer over the screen while the picker is open, e.g. <code>bg-black/20</code> to dim.'),
    ],
  },
  'voice-note': {
    title: 'VoiceNote',
    note: 'Scrub the waveform, long press to unsend into dust.',
    desc: 'A voice message bubble. Play and pause, the played part of the waveform takes the ink, drag along it to seek. Long press to unsend: the bubble blows away as dust. No audio dependency, playback is a timer you hook to your player.',
    hint: 'Play, scrub, hold to unsend',
    tileHint: 'Play or hold',
    mount: mountVoice,
    remountOnTheme: true,
    code: `// npx ${PKG} add voice-note
import { VoiceNote } from '${DIR}/voice-note';

<VoiceNote
  mine
  duration={9}
  seed="msg-42"
  onPlay={() => player.play()}
  onPause={() => player.pause()}
  onUnsend={() => remove(id)}
/>`,
    props: [
      prop('duration', 'number', 'required', 'Length of the note in seconds. Playback is simulated with a timer.'),
      prop('levels', 'number[]', '', 'Loudness per sample, 0 to 1. Resampled to the number of bars that fit.'),
      prop('seed', 'number | string', '1', 'Generates a deterministic, speech like waveform when levels is not given.'),
      prop('mine', 'boolean', 'false', 'Your own message: accent bubble with white content. Otherwise a surface bubble.'),
      prop('width', 'number', '248', 'Bubble width.'),
      prop('onPlay / onPause / onEnd', '() =&gt; void', '', 'Hook your audio player here.'),
      prop('onUnsend', '() =&gt; void', '', 'Called once the bubble has dissolved: remove it from your data here.'),
      prop('unsent', 'boolean', 'false', 'Flip to true to unsend from outside (a menu, a swipe).'),
      prop('unsendOnLongPress', 'boolean', 'true with onUnsend', 'Long press the bubble (480 ms) to unsend.'),
      prop('preset', 'VariantName', `'dust'`, 'Exit used when the note is unsent.'),
      prop('haptics', 'boolean', 'true', 'Light impact on play, a tick per bar while seeking.'),
      prop('className', 'string', '', 'Bubble: background, radius, padding.'),
      prop('buttonClassName', 'string', '', 'Play and pause button.'),
      prop('labelClassName', 'string', '', 'Time label.'),
    ],
  },
  'signature-pad': {
    title: 'SignaturePad',
    note: 'Sign with your finger, clear it to dust.',
    desc: 'Sign with your finger or a mouse. Ink is drawn as variable width strokes, thick when slow and thin when fast, with tapered ends, on a signing line whose placeholder fades as you start. Undo removes the last stroke, Clear turns the signature into dust and leaves the paper.',
    hint: 'Sign in the pad, then Clear',
    tileHint: 'Sign it',
    mount: mountSignature,
    remountOnTheme: true,
    code: `// npx ${PKG} add signature-pad
import { useRef } from 'react';
import { SignaturePad, type SignaturePadHandle } from '${DIR}/signature-pad';

export function Sign() {
  const pad = useRef<SignaturePadHandle>(null);

  return (
    <SignaturePad
      ref={pad}
      placeholder="Sign here"
      onChange={setSigned}
      onSave={({ base64 }) => upload(base64)}
    />
  );
}

// pad.current?.save(), pad.current?.clear() dissolves the ink`,
    props: [
      prop('strokeColor', 'string', 'foreground token', 'Ink color, also used for the exported PNG.'),
      prop('strokeWidth', 'number', '3.2', 'Base nib width. Slow strokes get thicker, fast ones thinner.'),
      prop('onChange', '(hasSignature: boolean) =&gt; void', '', 'Called when the pad goes from empty to signed and back.'),
      prop('onSave', '(signature: SignatureExport) =&gt; void', '', 'Receives the image, a base64 PNG and its size, from save().'),
      prop('placeholder', 'string', `'Sign here'`, 'Shown above the line, fades once you start.'),
      prop('height', 'number', '200', 'Pad height.'),
      prop('exportBackground', 'string', 'transparent', 'Background of the exported PNG.'),
      prop('controls', 'boolean', 'true', 'Built in Undo and Clear pills.'),
      prop('haptics', 'boolean', 'true', 'Selection tick on undo, dust haptics on clear.'),
      prop('className', 'string', `'rounded-[20px] bg-dissolve-surface'`, 'Pad: background, radius, border.'),
      prop('guideClassName', 'string', `'bg-dissolve-border'`, 'Signing line.'),
      prop('placeholderClassName', 'string', `'text-dissolve-muted'`, 'Placeholder and x mark.'),
      prop('controlClassName', 'string', `'rounded-full bg-dissolve-surface-2'`, 'Undo and Clear pills.'),
      prop('ref', 'Ref&lt;SignaturePadHandle&gt;', '', '<code>undo()</code>, <code>clear()</code>, <code>isEmpty()</code>, <code>toImage()</code>, <code>save()</code>.'),
    ],
  },
};
