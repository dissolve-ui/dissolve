import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { makeImageFromView } from '@shopify/react-native-skia';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Particles, type Burst } from './Particles';
import { DEFAULT_GRAIN, type Preset } from './presets';

export * from './presets';

export type DissolveOptions = {
  preset?: Preset;
  /** Grain size in points. Defaults depend on the preset. */
  grain?: number;
  /** Full effect duration in ms. */
  duration?: number;
  /** Soft impact plus a few ticks during the sweep. */
  haptics?: boolean;
};

type Ctx = { add: (b: Burst) => void; reduced: boolean };
const DissolveContext = createContext<Ctx | null>(null);

export function DissolveProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const reduced = useReducedMotion();
  const add = useCallback((b: Burst) => setBursts((all) => [...all, b]), []);

  return (
    <DissolveContext.Provider value={{ add, reduced }}>
      <View style={{ flex: 1 }}>
        {children}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {bursts.map((b) => (
            <Particles key={b.key} burst={b} onDone={() => setBursts((all) => all.filter((o) => o.key !== b.key))} />
          ))}
        </View>
      </View>
    </DissolveContext.Provider>
  );
}

/**
 * const { ref, dissolving, dissolve } = useDissolve();
 * <View ref={ref} style={{ opacity: dissolving ? 0 : 1 }} />
 * await dissolve({ preset: 'sand' }); // resolves when the space can be reclaimed
 */
export function useDissolve() {
  const ctx = useContext(DissolveContext);
  if (!ctx) throw new Error('useDissolve must be used inside <DissolveProvider>');
  const ref = useRef<View>(null);
  const [dissolving, setDissolving] = useState(false);

  const dissolve = useCallback(
    async ({ preset = 'dust', grain, duration = 1500, haptics = true }: DissolveOptions = {}) => {
      const view = ref.current;
      if (!view) return;
      if (ctx.reduced) {
        setDissolving(true);
        return;
      }
      const [image, box] = await Promise.all([
        makeImageFromView(ref as React.RefObject<View>),
        new Promise<{ x: number; y: number; width: number; height: number }>((res) =>
          view.measureInWindow((x, y, width, height) => res({ x, y, width, height })),
        ),
      ]);
      if (!image || box.width === 0) return;

      if (haptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        [0.08, 0.18, 0.28].forEach((f) => setTimeout(() => Haptics.selectionAsync(), duration * f));
      }
      ctx.add({
        key: `${Date.now()}-${Math.random()}`,
        image,
        ...box,
        preset,
        grain: grain ?? DEFAULT_GRAIN[preset],
        duration,
      });
      setDissolving(true);
      await new Promise((r) => setTimeout(r, duration * 0.6));
    },
    [ctx],
  );

  const reset = useCallback(() => setDissolving(false), []);
  return { ref, dissolving, dissolve, reset };
}
