import { useCallback, useMemo, useRef, useState } from 'react';
import type { View, ViewStyle } from 'react-native';
import { capGrain, capture, frames } from '../core';
import { useDissolveContext } from '../context';
import { getVariant } from '../variants/registry';
import type { DissolveOptions } from '../types';
import { runDissolve } from './useDissolve';

/**
 * morph: view A rearranges its grains into view B (docs/VARIANTS.md section 10).
 *
 * const { refA, refB, styleA, styleB, morph, phase } = useDissolveMorph();
 * <View style={[abs, styleA]}><View ref={refA} collapsable={false}>{follow}</View></View>
 * <View style={[abs, styleB]}><View ref={refB} collapsable={false}>{following}</View></View>
 * await morph();                // A becomes B
 * await morph({ reverse: true }); // and back
 *
 * Both views must be mounted and laid out. Put styleA / styleB on a WRAPPER of the ref'd
 * view: the hidden one stays at 0.01 opacity (opacity 0 can capture empty on iOS) and the
 * snapshot of the inner view is unaffected by its parent's opacity.
 */
export type MorphOptions = Omit<DissolveOptions, 'preset' | 'direction'> & {
  /** Morph B back into A. */
  reverse?: boolean;
};

export type MorphPhase = 'a' | 'morphing' | 'b';

/** Two atlases per morph: keep the particle count at half the usual cap. */
const MORPH_MAX_GRAINS = 3500;
const HIDDEN = 0.01;

export function useDissolveMorph() {
  const ctx = useDissolveContext();
  const refA = useRef<View>(null);
  const refB = useRef<View>(null);
  const [phase, setPhase] = useState<MorphPhase>('a');
  const busy = useRef(false);

  const morph = useCallback(
    async (opts: MorphOptions = {}) => {
      if (busy.current) return;
      const { reverse, ...rest } = opts;
      const done: MorphPhase = reverse ? 'a' : 'b';
      if (ctx.reduced) {
        setPhase(done);
        return;
      }
      busy.current = true;
      try {
        const [from, to] = await Promise.all([capture(reverse ? refB : refA), capture(reverse ? refA : refB)]);
        if (!from || !to) {
          setPhase(done);
          return;
        }
        // Cap on the bigger of the two grids.
        let grain = rest.grain ?? getVariant('morph').defaultGrain;
        grain = capGrain(from.box.width, from.box.height, grain, MORPH_MAX_GRAINS);
        grain = capGrain(to.box.width, to.box.height, grain, MORPH_MAX_GRAINS);
        let finished = false;
        await new Promise<void>((resolve) => {
          runDissolve(
            ctx,
            reverse ? refB : refA,
            { ...rest, grain, preset: 'morph' },
            {
              image: from.image,
              box: from.box,
              data: { imageB: to.image, boxB: to.box },
              // The real target shows under the last frame (identical), then the overlay goes.
              onFinish: () => {
                finished = true;
                setPhase(done);
                resolve();
              },
            },
          ).then((res) => {
            if (!res) {
              setPhase(done);
              resolve();
              return;
            }
            // The overlay paints the exact source first, then the real source hides.
            frames(2).then(() => {
              if (!finished) setPhase('morphing');
            });
          });
        });
      } finally {
        busy.current = false;
      }
    },
    [ctx],
  );

  const reset = useCallback(() => setPhase('a'), []);

  const styleA = useMemo<ViewStyle>(() => ({ opacity: phase === 'a' ? 1 : HIDDEN }), [phase]);
  const styleB = useMemo<ViewStyle>(() => ({ opacity: phase === 'b' ? 1 : HIDDEN }), [phase]);

  return { refA, refB, phase, morphing: phase === 'morphing', styleA, styleB, morph, reset };
}
