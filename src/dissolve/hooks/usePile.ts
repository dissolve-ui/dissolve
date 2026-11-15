import { useCallback } from 'react';
import type { View } from 'react-native';
import { frames } from '../core';
import { useDissolveContext } from '../context';
import { clearHeaps, frozenHeaps, pileStore } from '../variants/pile.store';
import type { DissolveOptions } from '../types';
import { runDissolve } from './useDissolve';

const NO_VIEW = { current: null as View | null };

/**
 * Controls the persistent sand heap left by the 'pile' variant (provider layer 'pile').
 *
 * const { sweepPile, clearPile } = usePile();
 * await sweepPile({ preset: 'dust', origin: 'left' }); // the heap blows away
 * clearPile(); // drops it instantly
 */
export function usePile() {
  const ctx = useDissolveContext();

  const clearPile = useCallback(() => clearHeaps(pileStore(ctx)), [ctx]);

  /**
   * Dissolves every frozen heap image with any atlas preset (default 'dust'), then
   * drops the heap. Resolves when the sweep is done.
   */
  const sweepPile = useCallback(
    async (opts: DissolveOptions = {}) => {
      const store = pileStore(ctx);
      const heaps = frozenHeaps(store);
      if (!heaps.length || ctx.reduced) {
        clearHeaps(store);
        return;
      }
      const preset = !opts.preset || opts.preset === 'pile' || opts.preset === 'morph' ? 'dust' : opts.preset;
      let longest = 0;
      for (const h of heaps) {
        const res = await runDissolve(ctx, NO_VIEW, { ...opts, preset }, { image: h.image, box: h.box });
        if (res) longest = Math.max(longest, res.duration);
      }
      // The sweep paints the exact heap on its first frame, then the frozen copy goes.
      await frames(2);
      clearHeaps(store);
      await new Promise((r) => setTimeout(r, longest));
    },
    [ctx],
  );

  return { sweepPile, clearPile };
}
