/**
 * TextScramble, from dissolve (dissolve-ui). This file is yours: change the timings, the
 * glyphs, anything. Glyphs follow the muted theme token (global.css), so it follows light and dark
 * mode out of the box.
 *
 * Text that decodes into place: every letter turns into random glyphs that keep changing, then
 * the letters resolve one by one, left to right with a little randomness, into the final text.
 * It plays when text changes, when trigger changes, on ref.current.scramble(), and on mount with
 * playOnMount. The final text lays out underneath (invisible) and the scramble draws over it, so
 * the block keeps its size and wraps where the final text wraps. By default each glyph is of the
 * same kind and about the same width as its letter, so a proportional line keeps its rhythm;
 * monospace sets a monospace font. Screen readers read the final text once. Reduced motion: no
 * glyphs, the new text fades in.
 *
 * <TextScramble text={title} className="text-dissolve-foreground" style={{ fontSize: 34, fontWeight: '700' }} />
 * <TextScramble text="STATUS / READY" monospace trigger={refreshCount} />
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Animated, Text, cn, useToken } from './tw';

export const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/?';
/** Extra width the scramble may use past the final text, pt. */
const SLACK = 32;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export type TextScrambleHandle = {
  /** Plays the scramble on the current text. */
  scramble: () => void;
};

export type TextScrambleProps = {
  ref?: Ref<TextScrambleHandle>;
  /** The text it decodes into. A change plays the scramble. */
  text: string;
  /** Any value: each change replays the scramble on the same text. */
  trigger?: unknown;
  /** Time until the last letter lands, ms. Default 900. */
  duration?: number;
  /** How often a scrambling letter changes glyph, ms. Default 45. */
  rate?: number;
  /**
   * Characters drawn while scrambling. Default: glyphs of the same kind and about the same width as
   * each letter; with monospace, A-Z, 0-9 and signs.
   */
  glyphs?: string;
  /** A monospace font (Menlo on iOS). Default false. */
  monospace?: boolean;
  /** Plays once on mount. Default false: the text shows as is. */
  playOnMount?: boolean;
  /** Color of the glyphs. Default: the muted token. */
  glyphColor?: string;
  /** Called when the last letter lands. */
  onDone?: () => void;
  /** Your text style (size, weight, color...). */
  style?: StyleProp<TextStyle>;
  className?: string;
  numberOfLines?: number;
};

/** Glyphs close in kind and width to ch, so a proportional line keeps its rhythm. Same as web. */
export function glyphPool(ch: string) {
  if (/[ilj|!.,:;'"I1]/.test(ch)) return 'il|!:1';
  if (/[ftr]/.test(ch)) return 'ftrj';
  if (/[MW]/.test(ch)) return 'MW';
  if (/[mw]/.test(ch)) return 'mw';
  if (/[A-Z]/.test(ch)) return 'ABCDEFGHKLNOPRSTUVXYZ';
  if (/[a-z]/.test(ch)) return 'abcdeghknopqsuvxyz';
  if (/[0-9]/.test(ch)) return '023456789';
  return '#%&*+=<>/?';
}

/**
 * When each letter lands, ms from the start: the first after a quarter of the duration, the last
 * at the end, in reading order with a little jitter. Same as web.
 */
function landings(n: number, duration: number) {
  return Array.from({ length: n }, (_, i) => {
    const k = n > 1 ? i / (n - 1) : 1;
    return Math.max(60, Math.min(duration, duration * (0.25 + 0.75 * k) + (Math.random() - 0.5) * 0.16 * duration));
  });
}

export function TextScramble({
  ref,
  text,
  trigger,
  duration = 900,
  rate = 45,
  glyphs,
  monospace = false,
  playOnMount = false,
  glyphColor,
  onDone,
  style,
  className,
  numberOfLines,
}: TextScrambleProps) {
  const muted = useToken('muted');
  const reduced = useReducedMotion();
  /** Per character: the glyph it shows, or null once landed. Null as a whole when at rest. */
  const [shown, setShown] = useState<(string | null)[] | null>(null);
  const raf = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const opacity = useSharedValue(1);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const latest = useRef({ text, duration, rate, glyphs, monospace, onDone, reduced });
  latest.current = { text, duration, rate, glyphs, monospace, onDone, reduced };

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current);
    clearTimeout(fadeTimer.current);
    const { text: t, duration: d, rate: r, glyphs: g, monospace: m, reduced: still } = latest.current;
    if (still) {
      setShown(null);
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: 220 });
      fadeTimer.current = setTimeout(() => latest.current.onDone?.(), 220);
      return;
    }
    const chars = [...t];
    const lands = landings(chars.length, d);
    const pools = chars.map((c) => g ?? (m ? SCRAMBLE_GLYPHS : glyphPool(c)));
    const t0 = performance.now();
    let step = -1;
    // The clock is read here: the timestamp rAF passes is not on the performance.now() clock everywhere.
    const frame = () => {
      const el = performance.now() - t0;
      const s = Math.floor(el / r);
      if (s !== step) {
        step = s;
        let left = 0;
        const next = chars.map((c, i) => {
          if (c === ' ' || el >= lands[i]) return null;
          left++;
          return pools[i][Math.floor(Math.random() * pools[i].length)];
        });
        if (!left) {
          setShown(null);
          latest.current.onDone?.();
          return;
        }
        setShown(next);
      }
      raf.current = requestAnimationFrame(frame);
    };
    frame();
  }, [opacity]);

  useImperativeHandle(ref, () => ({ scramble: play }), [play]);

  // Plays on a text or trigger change, and on mount only with playOnMount.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (playOnMount) play();
      return;
    }
    play();
  }, [text, trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(fadeTimer.current); }, []);

  const font = monospace ? { fontFamily: MONO } : { fontVariant: ['tabular-nums' as const] };
  // Glyphs can run a little wider than the final letters: the scramble gets room on the side(s)
  // the text grows toward, so it never clips or wraps early.
  const align = StyleSheet.flatten(style)?.textAlign;
  const room = align === 'center' ? { left: -SLACK, right: -SLACK } : align === 'right' ? { left: -SLACK, right: 0 } : { left: 0, right: -SLACK };
  const chars = [...text];
  return (
    <Animated.View style={fade} accessible accessibilityRole="text" accessibilityLabel={text}>
      <Text className={cn('text-dissolve-foreground', className)} style={[style, font, shown && { opacity: 0 }]} numberOfLines={numberOfLines}>
        {text}
      </Text>
      {shown ? (
        <Text
          className={cn('text-dissolve-foreground', className)}
          style={[style, font, { position: 'absolute', top: 0 }, room]}
          numberOfLines={numberOfLines}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* Landed runs as plain text, scrambling letters in the glyph color. */}
          {chars.map((c, i) => (shown[i] == null ? c : (
            <Text key={i} style={{ color: glyphColor ?? muted }}>
              {shown[i]}
            </Text>
          )))}
        </Text>
      ) : null}
    </Animated.View>
  );
}
