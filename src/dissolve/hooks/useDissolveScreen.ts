import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import { capGrain, capture, frames } from '../core';
import { useDissolveContext } from '../context';
import { getVariant } from '../variants/registry';
import { runDissolve } from './useDissolve';
import type { DissolveOptions } from '../types';

/**
 * GROUP D. Full screen disintegration (docs/VARIANTS.md section 7, screen mode).
 *
 *   const { ref, dissolveScreen } = useDissolveScreen();
 *   <View ref={ref} collapsable={false} style={{ flex: 1, backgroundColor: C.bg }}>...</View>
 *   dissolveScreen({ preset: 'sand', then: () => router.back() });
 *
 * 1. Snapshot the screen root (the view holding `ref`).
 * 2. Add the burst with the cascade field and a grain raised for the area.
 * 3. Wait two frames so the overlay has painted the identical first frame over the screen.
 * 4. Call `then` (router.back()): the previous screen is mounted under the grains.
 *
 * The provider sits above the Stack (app/_layout.tsx) so the overlay survives the pop.
 * Give the screen `animation: 'none'` (or `animation: 'fade'`) in its Stack options:
 * a slide pop would move the real previous screen in while grains are still flying.
 *
 * Without `then` the hook dissolves in place: `dissolving` flips to true two frames after
 * the burst is painted, hide the root with it (opacity 0) and call `reset` to bring it back.
 */
export type ScreenOptions = DissolveOptions & {
  /** Navigation step, run once the overlay covers the screen (e.g. router.back()). */
  then?: () => void;
  /** Called when the last grain is gone. */
  onFinish?: () => void;
  /**
   * Grain budget for the whole screen. The grain is raised until the grid holds at most
   * this many grains (default 5000, never above the engine cap of 6000).
   */
  maxGrains?: number;
};

/** Grain cap for a full screen: a bit below the engine cap, a screen is mostly flat color. */
const SCREEN_GRAINS = 5000;

/**
 * Grain for a large area. Spec rule max(default, ceil(sqrt(w*h / 10000))), then the grain
 * budget (capGrain rounds up to half points). 390 x 844 with dust gives 7.5 pt, about 5900
 * grains at 6000, or 8.5 pt and about 4600 grains at the default 5000.
 */
export function screenGrain(w: number, h: number, base: number, max = SCREEN_GRAINS) {
  const spec = Math.max(base, Math.ceil(Math.sqrt((w * h) / 10000)));
  return capGrain(w, h, spec, Math.min(Math.max(1, max), 6000));
}

export function useDissolveScreen() {
  const ctx = useDissolveContext();
  const ref = useRef<View>(null);
  const [dissolving, setDissolving] = useState(false);
  const busy = useRef(false);

  const dissolveScreen = useCallback(
    async (opts: ScreenOptions = {}) => {
      const { then, onFinish, maxGrains, ...rest } = opts;
      if (busy.current) return;
      if (ctx.reduced || !ref.current) {
        if (!then) setDissolving(true);
        then?.();
        onFinish?.();
        return;
      }
      busy.current = true;
      try {
        const shot = await capture(ref);
        if (!shot) {
          // Nothing to snapshot: still navigate, the user asked to leave.
          if (!then) setDissolving(true);
          then?.();
          onFinish?.();
          return;
        }
        const preset = rest.preset ?? 'dust';
        const base = rest.grain ?? getVariant(preset).defaultGrain;
        const grain = screenGrain(shot.box.width, shot.box.height, base, maxGrains);
        const res = await runDissolve(
          ctx,
          ref,
          {
            duration: 1600,
            ...rest,
            preset,
            grain,
            field: rest.field ?? 'cascade',
          },
          { image: shot.image, box: shot.box, onFinish },
        );
        // Let the overlay paint the identical first frame before the real screen goes away.
        await frames(2);
        if (!res) {
          if (!then) setDissolving(true);
          then?.();
          onFinish?.();
          return;
        }
        if (then) then();
        else setDissolving(true);
      } finally {
        busy.current = false;
      }
    },
    [ctx],
  );

  const reset = useCallback(() => setDissolving(false), []);
  return { ref, dissolving, dissolveScreen, reset };
}
