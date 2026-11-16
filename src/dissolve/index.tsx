import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { DissolveContext } from './context';
import { frames } from './core';
import { BurstHost, makeBurst } from './Host';
import type { Burst, BurstInput, DissolveCtx } from './types';

/**
 * Public entry point. Owned by the master agent: every builder export is wired below,
 * builders never edit this file. See docs/CONTRACT.md.
 */

// Types and engine
export * from './types';
export * from './presets';
export { capture, measure, capGrain, frames, defaultHaptics, MAX_GRAINS, DEFAULT_END, ss, eo, backOut, clamp01 } from './core';
export { useDissolveContext } from './context';
export { Particles } from './Particles';
export { REGISTRY, FIELDS, VARIANTS, VARIANT_INFO, VARIANT_GRAIN, getVariant } from './variants/registry';
export { useDissolve, runDissolve } from './hooks/useDissolve';

// Group B: entrances
export { useAppear, DissolveIn, type AppearOptions, type DissolveInProps } from './hooks/useAppear';
// Group C: gestures
export { useDissolveScrub, type ScrubOptions } from './hooks/useDissolveScrub';
export { useDissolveHold, type HoldOptions } from './hooks/useDissolveHold';
export { useDissolvePeel, type PeelOptions } from './hooks/useDissolvePeel';
// Group D: full screen
export { useDissolveScreen, type ScreenOptions } from './hooks/useDissolveScreen';
// Group F: morph
export { useDissolveMorph, type MorphOptions, type MorphPhase } from './hooks/useDissolveMorph';

export function DissolveProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const reduced = useReducedMotion();

  const remove = useCallback((key: string) => {
    setBursts((all) => all.filter((o) => o.key !== key));
  }, []);

  const add = useCallback(
    (input: BurstInput) => {
      const b = makeBurst(input);
      setBursts((all) => [...all, b]);
      return { key: b.key, remove: () => remove(b.key) };
    },
    [remove],
  );

  // Internally driven bursts end here: notify the owner first (an entrance reveals the
  // real view), then drop the overlay two frames later so there is never a flash.
  const finish = useCallback(
    (b: Burst) => {
      b.onFinish?.();
      frames(2).then(() => remove(b.key));
    },
    [remove],
  );

  const value = useMemo<DissolveCtx>(() => ({ add, remove, reduced }), [add, remove, reduced]);

  return (
    <DissolveContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {bursts.map((b) => (
            <BurstHost key={b.key} burst={b} onDone={() => finish(b)} />
          ))}
        </View>
      </View>
    </DissolveContext.Provider>
  );
}
