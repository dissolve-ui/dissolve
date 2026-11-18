import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { frames, HIDDEN_OPACITY, measure } from '../core';
import { useDissolveContext } from '../context';
import { runDissolve } from './useDissolve';
import type { DissolveOptions, VariantName, ViewRef } from '../types';

/**
 * Entrances: the view materialises from grains (docs/VARIANTS.md section 4).
 *
 * The snapshot problem: we must capture a view the user cannot see yet. Opacity 0 can
 * capture empty on iOS, and Android multiplies the captured view's own alpha into the
 * snapshot. So the view is split in two:
 *   - an outer WRAPPER at opacity 0.01 (hidden to the eye, still rendered),
 *   - the inner CAPTURED view at opacity 1 (ref), which is what makeImageFromView reads.
 * Flow: mount hidden, wait until the captured view has a size, one more frame so it is
 * painted, capture, add a burst with direction 'in', reveal the wrapper in the burst
 * onFinish (last overlay frame is the exact rest pose), the engine drops the overlay two
 * frames later. No flash, no gap.
 */

export type AppearOptions = Omit<DissolveOptions, 'preset'> & {
  preset?: Extract<VariantName, 'gather' | 'rain' | 'print' | 'stream'> | VariantName;
  /** Source view for stream entrances (grains pour out of it). Same as `to`. */
  from?: RefObject<ViewRef | null>;
  /** Delay before starting, in ms (list stagger). */
  delay?: number;
};

const DEFAULT_DURATION = 1200;

/** Wait until the view is laid out with a non empty size (max ~30 frames). */
async function waitLayout(ref: RefObject<ViewRef | null>) {
  for (let i = 0; i < 30; i++) {
    if (ref.current) {
      const b = await measure(ref);
      if (b && b.width > 0 && b.height > 0) return true;
    }
    await frames(1);
  }
  return false;
}

/**
 * const a = useAppear();
 * useEffect(() => { a.appear({ preset: 'gather' }); }, []);
 * <View style={a.wrapStyle}>
 *   <View ref={a.ref} collapsable={false} style={styles.card}>...</View>
 * </View>
 *
 * appear() resolves when the real view is visible again (or right away on reduced motion).
 */
export function useAppear() {
  const ctx = useDissolveContext();
  const ref = useRef<ViewRef>(null);
  const [visible, setVisible] = useState(false);
  const running = useRef(false);

  const appear = useCallback(
    async (opts: AppearOptions = {}) => {
      if (running.current) return;
      running.current = true;
      try {
        if (ctx.reduced) {
          setVisible(true);
          return;
        }
        setVisible(false);
        const { from, delay, ...rest } = opts;
        if (delay) await new Promise((r) => setTimeout(r, delay));
        const laidOut = await waitLayout(ref);
        if (!laidOut) {
          setVisible(true);
          return;
        }
        await frames(1);
        await new Promise<void>((done) => {
          const reveal = () => {
            setVisible(true);
            done();
          };
          runDissolve(
            ctx,
            ref,
            {
              ...rest,
              preset: rest.preset ?? 'gather',
              direction: 'in',
              duration: rest.duration ?? DEFAULT_DURATION,
              // Entrances are quiet by default (lists can stagger many of them).
              haptics: rest.haptics ?? false,
              to: from ?? rest.to,
            },
            { onFinish: reveal },
          )
            .then((res) => {
              if (!res) reveal();
            })
            .catch(reveal);
        });
      } finally {
        running.current = false;
      }
    },
    [ctx],
  );

  /** Make the view visible again without an effect (or hide it before a new appear). */
  const reset = useCallback((show = false) => setVisible(show), []);

  const wrapStyle: ViewStyle = { opacity: visible ? 1 : HIDDEN_OPACITY };
  return { ref, visible, appear, reset, wrapStyle };
}

export type DissolveInProps = AppearOptions & {
  children: ReactNode;
  /** Style of the captured view (background, padding, radius are part of the snapshot). */
  style?: StyleProp<ViewStyle>;
  /** Play the entrance on mount. Default true. Flip from false to true to play it later. */
  play?: boolean;
  /** Called once the real view is visible. */
  onAppear?: () => void;
};

/** Layout keys that must live on the wrapper so the pair sizes like a single view. */
const OUTER_KEYS = new Set<string>([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'start',
  'end',
  'zIndex',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'marginHorizontal',
  'marginVertical',
  'marginBlock',
  'marginBlockStart',
  'marginBlockEnd',
  'marginInline',
  'marginInlineStart',
  'marginInlineEnd',
  'inset',
  'insetBlock',
  'insetInline',
]);

const FILL_KEYS = ['flex', 'flexGrow', 'flexBasis', 'height', 'minHeight'] as const;

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) {
    if (OUTER_KEYS.has(key)) outer[key] = flat[key];
    else inner[key] = flat[key];
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/**
 * <DissolveIn preset="rain" delay={index * 40} style={styles.row}>{row}</DissolveIn>
 * <DissolveIn preset="stream" from={sendButtonRef}>{bubble}</DissolveIn>
 */
export function DissolveIn({ children, style, play = true, onAppear, ...opts }: DissolveInProps) {
  const { ref, appear, wrapStyle } = useAppear();
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const onAppearRef = useRef(onAppear);
  onAppearRef.current = onAppear;

  // Play once per false -> true edge of `play` (a context change does not replay it).
  const played = useRef(false);
  useEffect(() => {
    if (!play) {
      played.current = false;
      return;
    }
    if (played.current) return;
    played.current = true;
    appear(optsRef.current).then(() => onAppearRef.current?.());
  }, [play, appear]);

  const { outer, inner } = splitStyle(style);
  // Only stretch the captured view when the wrapper has a size of its own to fill.
  // A content sized wrapper (chat bubble in a flex-end stage) must stay content sized.
  const sized = FILL_KEYS.some((k) => outer[k] != null);
  return (
    <View style={[outer, wrapStyle]}>
      <View ref={ref} collapsable={false} style={[sized && styles.fill, inner]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1 },
});
