/**
 * ReactionPicker, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the emojis, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * <ReactionPicker selected={reaction} onReact={(e) => setReaction(e === reaction ? null : e)}>
 *   <Bubble />
 * </ReactionPicker>
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Modal, Platform, StyleSheet, View as RNView, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { frames, measure, useDissolve, type Box, type Point, type ViewRef } from 'react-native-dissolve';
import { Animated, Pressable, Text, View, cn } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
/** Critically damped lift, a hair of give so the bubble feels picked up. */
const LIFT = { damping: 26, stiffness: 340, mass: 0.9 };
/** The pill opens almost without overshoot, the emojis inside pop (tiny elements). */
const OPEN = { damping: 26, stiffness: 320, mass: 0.9 };
const POP = { damping: 15, stiffness: 420, mass: 0.7 };

const SLOT = 44;
const PAD = 6;
const PILL_H = 52;
const EMOJI = 30;
const BADGE = 28;
const HOLD = 320;
/** How far above and below the pill the finger still drives the magnifier. */
const BAND_UP = 70;
const BAND_DOWN = 46;
const MAG = 0.72;
const RISE = 16;
const EDGE = 10;

export const DEFAULT_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

export type ReactionPickerProps = {
  children: ReactNode;
  /** Emojis offered in the pill. Default ❤️ 😂 😮 😢 👍 🔥. */
  reactions?: string[];
  /** Called with the chosen emoji. Picking the current one again is your cue to remove it. */
  onReact: (emoji: string) => void;
  /** Current reaction, shown as a badge on the bubble corner. */
  selected?: string | null;
  /** Corner the badge sits on. Default 'top-right' (use 'top-left' for your own bubbles). */
  corner?: 'top-left' | 'top-right';
  /** Space kept free at the top and bottom of the window (safe area). */
  insets?: { top?: number; bottom?: number };
  disabled?: boolean;
  haptics?: boolean;
  /** Wrapper classes (margins, alignment...). */
  className?: string;
  /** Emoji pill classes (background, border, shadow...). */
  pillClassName?: string;
  /** Badge disc classes (also used by the emoji flying to the bubble). */
  badgeClassName?: string;
  /** Layer over the screen while the picker is open. Transparent by default, e.g. 'bg-black/20' to dim. */
  backdropClassName?: string;
  /** Blurs the screen behind the lifted message while the picker is open (iOS). Default true. */
  blur?: boolean;
  /** Blur strength, 1 to 100. Default 24. */
  blurIntensity?: number;
};

type Open = {
  box: Box;
  press: Point;
  pill: { x: number; y: number; w: number };
};

const PILL = 'border-dissolve-border bg-dissolve-background shadow-[0_10px_44px_rgba(0,0,0,0.14)]';
const DISC = 'items-center justify-center rounded-full border-2 border-dissolve-background bg-dissolve-background shadow-[0_2px_12px_rgba(0,0,0,0.12)]';

/** Emoji glyphs sit low with a lineHeight on iOS: let the font size the line, then center it. */
const glyph = (size: number): TextStyle => ({
  fontSize: size,
  textAlign: 'center',
  ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : null),
});
const EMOJI_TEXT = glyph(EMOJI);
const BADGE_TEXT = glyph(EMOJI / 2);

/** Weight of emoji i under a finger at local x (dock curve). */
function weight(i: number, lx: number, hover: number) {
  'worklet';
  const d = (lx - (PAD + i * SLOT + SLOT / 2)) / SLOT;
  return hover * Math.exp(-d * d * 1.25);
}

function badgeOffset(corner: 'top-left' | 'top-right'): ViewStyle {
  return corner === 'top-right' ? { right: -BADGE * 0.35, top: -BADGE * 0.6 } : { left: -BADGE * 0.35, top: -BADGE * 0.6 };
}

function Emoji({ i, emoji, open, lx, hover, chosen, active }: { i: number; emoji: string; open: boolean; lx: SharedValue<number>; hover: SharedValue<number>; chosen: SharedValue<number>; active: boolean }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = open ? withDelay(40 + i * 24, withSpring(1, POP)) : 0;
  }, [open, i, pop]);
  const style = useAnimatedStyle(() => {
    const w = weight(i, lx.value, hover.value);
    return {
      opacity: chosen.value === i ? 0 : Math.min(1, pop.value * 2),
      transform: [{ translateY: -RISE * w + (1 - pop.value) * 8 }, { scale: Math.max(0, pop.value) * (1 + MAG * w) }],
    };
  });
  return (
    <View className="items-center justify-center" style={{ width: SLOT, height: PILL_H }}>
      {active ? <View className="absolute rounded-full bg-dissolve-surface" style={{ width: 38, height: 38 }} /> : null}
      <Animated.View className="items-center justify-center" style={[{ width: SLOT, height: SLOT }, style]}>
        <Text style={EMOJI_TEXT} allowFontScaling={false}>
          {emoji}
        </Text>
      </Animated.View>
    </View>
  );
}

/** The badge on the bubble corner. Pops in, or snaps into dust when the reaction is removed. */
function Badge({ emoji, corner, quiet, hidden, className }: { emoji: string | null | undefined; corner: 'top-left' | 'top-right'; quiet: RefObject<boolean>; hidden: boolean; className?: string }) {
  const { ref, dissolving, dissolve, reset } = useDissolve();
  const [shown, setShown] = useState(emoji ?? null);
  const scale = useSharedValue(emoji ? 1 : 0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (emoji) {
      reset();
      setShown(emoji);
      if (quiet.current) {
        // Landed from the flight: already in place, no pop.
        quiet.current = false;
        scale.value = 1;
      } else {
        scale.value = 0.3;
        scale.value = withSpring(1, POP);
      }
      return;
    }
    if (!shown) return;
    let alive = true;
    dissolve({ preset: 'snap', duration: 700, grain: 1.5, haptics: false }).then(() => {
      if (!alive) return;
      setShown(null);
      scale.value = 0;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emoji]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (!shown) return null;
  return (
    <Animated.View pointerEvents="none" className="absolute" style={[{ width: BADGE, height: BADGE }, badgeOffset(corner), { opacity: hidden ? 0 : 1 }, style]}>
      <RNView ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
        <View className={cn(DISC, className)} style={{ width: BADGE, height: BADGE }}>
          <Text style={BADGE_TEXT} allowFontScaling={false}>
            {shown}
          </Text>
        </View>
      </RNView>
    </Animated.View>
  );
}

/**
 * iMessage style reactions. Long press a bubble: it lifts, a pill of emojis grows out of the
 * press point. Keep the finger down and slide across: the emoji under it magnifies like the
 * Dock, with a tick on each change. Release on one to pick it, it flies to the bubble corner.
 * Release elsewhere to cancel, or release without moving and tap an emoji.
 */
export function ReactionPicker({
  children,
  reactions = DEFAULT_REACTIONS,
  onReact,
  selected,
  corner = 'top-right',
  insets,
  disabled,
  haptics = true,
  className,
  pillClassName,
  badgeClassName,
  backdropClassName,
  blur = true,
  blurIntensity = 24,
}: ReactionPickerProps) {
  const { width: SW, height: SH } = useWindowDimensions();
  const ref = useRef<ViewRef>(null);
  const boxRef = useRef<Box | null>(null);
  const quiet = useRef(false);
  const busy = useRef(false);
  const [open, setOpen] = useState<Open | null>(null);
  // Mirror of `open` for callbacks fired from the UI thread before the next render.
  const openRef = useRef<Open | null>(null);
  const [shown, setShown] = useState(false);
  const [flying, setFlying] = useState<{ emoji: string; from: Point; to: Point; s0: number } | null>(null);

  const n = reactions.length;
  const pillW = n * SLOT + PAD * 2;
  const top = insets?.top ?? 60;
  const bottom = insets?.bottom ?? 34;

  // UI thread state.
  const press = useSharedValue(0); // hold build up on the original
  const lift = useSharedValue(0); // clone lift, 0 rest, 1 lifted
  const menu = useSharedValue(0); // pill reveal
  const back = useSharedValue(0); // backdrop
  const hover = useSharedValue(0); // magnifier strength
  const lx = useSharedValue(0); // finger x in pill coords
  const hot = useSharedValue(-1); // emoji under the finger
  const chosen = useSharedValue(-1);
  const fly = useSharedValue(0);
  const pillX = useSharedValue(0);
  const pillY = useSharedValue(0);
  const ready = useSharedValue(false);
  const active = useSharedValue(false);
  const moved = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // Layout shift of the real bubble while open (room made for a new badge): clone and flight follow.
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);

  const tick = useCallback(() => {
    if (haptics) Haptics.selectionAsync();
  }, [haptics]);

  const prepare = useCallback(async () => {
    boxRef.current = await measure(ref);
  }, []);

  const openAt = useCallback(
    async (px: number, py: number) => {
      if (busy.current) return;
      busy.current = true;
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const box = boxRef.current ?? (await measure(ref));
      if (!box) {
        busy.current = false;
        return;
      }
      // Anchor to the bubble's leading edge, flip below when there is no room, clamp.
      const gap = 10 + BADGE * 0.55;
      const below = box.y - gap - PILL_H < top;
      let y = below ? box.y + box.height + 12 : box.y - gap - PILL_H;
      y = Math.max(top, Math.min(y, SH - bottom - PILL_H));
      let x = box.x + box.width / 2 < SW / 2 ? box.x : box.x + box.width - pillW;
      x = Math.max(EDGE, Math.min(x, SW - EDGE - pillW));
      pillX.value = x;
      pillY.value = y;
      chosen.value = -1;
      fly.value = 0;
      lift.value = 0;
      menu.value = 0;
      back.value = 0;
      shiftX.value = 0;
      shiftY.value = 0;
      ready.value = true;
      openRef.current = { box, press: { x: px, y: py }, pill: { x, y, w: pillW } };
      setOpen(openRef.current);
    },
    [SH, SW, back, bottom, chosen, fly, haptics, lift, menu, pillW, pillX, pillY, ready, top, shiftX, shiftY],
  );

  // Runs once the modal is on screen: hide the original, animate the clone and the pill in.
  const onShow = useCallback(() => {
    setShown(true);
    // The original is hidden now: drop its pressed scale so later measures are exact.
    press.value = 0;
    lift.value = withSpring(1, LIFT);
    back.value = withTiming(1, { duration: 260, easing: CALM });
    menu.value = withSpring(1, OPEN);
  }, [back, lift, menu, press]);

  const finish = useCallback(() => {
    ready.value = false;
    hover.value = 0;
    hot.value = -1;
    press.value = 0;
    setFlying(null);
    setShown(false);
    openRef.current = null;
    setOpen(null);
    busy.current = false;
  }, [hot, hover, press, ready]);

  const close = useCallback(
    (after?: () => void) => {
      ready.value = false;
      hover.value = withTiming(0, { duration: 160 });
      menu.value = withTiming(0, { duration: 220, easing: CALM });
      back.value = withTiming(0, { duration: 260, easing: CALM });
      lift.value = withTiming(0, { duration: 280, easing: CALM }, (done) => {
        if (done) scheduleOnRN(finish);
      });
      if (after) setTimeout(after, 320);
    },
    [back, finish, hover, lift, menu, ready],
  );

  const choose = useCallback(
    (i: number) => {
      const o = openRef.current;
      if (!o || i < 0 || i >= n || chosen.value >= 0) return;
      const emoji = reactions[i];
      if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Same emoji again: no flight, the badge leaves as dust once the overlay is gone.
      if (emoji === selected) {
        close(() => onReact(emoji));
        return;
      }
      const w = weight(i, lx.value, hover.value);
      const from = { x: o.pill.x + PAD + i * SLOT + SLOT / 2, y: o.pill.y + PILL_H / 2 - RISE * w };
      const { box } = o;
      const to = { x: corner === 'top-right' ? box.x + box.width - BADGE * 0.15 : box.x + BADGE * 0.15, y: box.y - BADGE * 0.1 };
      chosen.value = i;
      ready.value = false;
      quiet.current = true;
      setFlying({ emoji, from, to, s0: 1 + MAG * w });
      onReact(emoji);
      // If the host makes room for the badge, glide the clone and retarget the flight.
      frames(2)
        .then(() => measure(ref))
        .then((b) => {
          if (!b) return;
          const t = { duration: 320, easing: CALM };
          shiftX.value = withTiming(b.x - box.x, t);
          shiftY.value = withTiming(b.y - box.y, t);
        });
      hover.value = withTiming(0, { duration: 200 });
      menu.value = withDelay(60, withTiming(0, { duration: 260, easing: CALM }));
      back.value = withTiming(0, { duration: 420, easing: CALM });
      lift.value = withTiming(0, { duration: 440, easing: CALM });
      fly.value = withTiming(1, { duration: 480, easing: CALM }, (done) => {
        if (done) scheduleOnRN(finish);
      });
    },
    [back, chosen, close, corner, finish, fly, haptics, hover, lift, lx, menu, n, onReact, reactions, ready, selected, shiftX, shiftY],
  );

  const cancel = useCallback(() => close(), [close]);

  /** Finger position (window coords) to magnifier state, with a tick per change. UI thread. */
  const track = (x: number, y: number) => {
    'worklet';
    if (!ready.value) return;
    const px = x - pillX.value;
    const py = y - pillY.value;
    const inside = py > -BAND_UP && py < PILL_H + BAND_DOWN && px > -SLOT * 0.4 && px < pillW + SLOT * 0.4;
    lx.value = Math.max(PAD + SLOT / 2, Math.min(px, pillW - PAD - SLOT / 2));
    const next = inside ? Math.max(0, Math.min(n - 1, Math.floor((px - PAD) / SLOT))) : -1;
    if (next !== hot.value) {
      if (next >= 0) scheduleOnRN(tick);
      hover.value = withTiming(next >= 0 ? 1 : 0, { duration: 140 });
      hot.value = next;
    }
  };

  const hold = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(HOLD)
    .onBegin((e) => {
      startX.value = e.absoluteX;
      startY.value = e.absoluteY;
      moved.value = false;
      press.value = withTiming(1, { duration: HOLD, easing: Easing.out(Easing.quad) });
      scheduleOnRN(prepare);
    })
    .onStart((e) => {
      active.value = true;
      scheduleOnRN(openAt, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      const dx = e.absoluteX - startX.value;
      const dy = e.absoluteY - startY.value;
      if (dx * dx + dy * dy > 196) moved.value = true;
      track(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      if (!active.value) {
        press.value = withTiming(0, { duration: 220, easing: CALM });
        return;
      }
      active.value = false;
      const i = hot.value;
      if (i >= 0) scheduleOnRN(choose, i);
      else if (moved.value) scheduleOnRN(cancel);
      // Released without moving: the picker stays open for a tap.
    });

  // After release: touch or slide on the pill again.
  const pick = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => track(e.absoluteX, e.absoluteY))
    .onUpdate((e) => track(e.absoluteX, e.absoluteY))
    .onFinalize(() => {
      const i = hot.value;
      if (i >= 0) scheduleOnRN(choose, i);
    });

  const originalStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.03 * press.value }] }));

  const cloneStyle = useAnimatedStyle(() => ({
    // From the pressed scale (0.97) to lifted (1.02).
    transform: [{ translateX: shiftX.value }, { translateY: shiftY.value }, { scale: 0.97 + 0.05 * lift.value }],
    shadowOpacity: 0.16 * lift.value,
  }));

  const backStyle = useAnimatedStyle(() => ({ opacity: back.value }));

  const ox = open ? open.press.x - (open.pill.x + pillW / 2) : 0;
  const oy = open ? open.press.y - (open.pill.y + PILL_H / 2) : 0;
  const pillStyle = useAnimatedStyle(() => {
    const m = menu.value;
    return {
      opacity: Math.min(1, m * 2.5),
      transform: [{ translateX: ox * (1 - m) }, { translateY: oy * (1 - m) }, { scale: 0.2 + 0.8 * m }],
    };
  });

  const flyStyle = useAnimatedStyle(() => {
    if (!flying) return { opacity: 0 };
    const t = fly.value;
    const tx = flying.to.x + shiftX.value;
    const ty = flying.to.y + shiftY.value;
    const x = flying.from.x + (tx - flying.from.x) * t;
    const y = flying.from.y + (ty - flying.from.y) * t - Math.sin(Math.PI * t) * 36;
    return { opacity: 1, transform: [{ translateX: x - BADGE / 2 }, { translateY: y - BADGE / 2 }] };
  });
  const flyDisc = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, (fly.value - 0.4) / 0.6));
    return { opacity: k, transform: [{ scale: 0.4 + 0.6 * k }] };
  });
  const flyEmoji = useAnimatedStyle(() => {
    const s0 = flying ? flying.s0 : 1;
    return { transform: [{ scale: s0 + (0.5 - s0) * fly.value }] };
  });

  return (
    <View
      className={className}
      accessible
      accessibilityHint="Long press to react"
      accessibilityActions={reactions.map((r) => ({ name: r, label: `React ${r}` }))}
      onAccessibilityAction={(e) => onReact(e.nativeEvent.actionName)}
    >
      <GestureDetector gesture={hold}>
        <Reanimated.View ref={ref} collapsable={false} style={[originalStyle, { opacity: shown ? 0 : 1 }]}>
          {children}
        </Reanimated.View>
      </GestureDetector>
      <Badge emoji={selected} corner={corner} quiet={quiet} hidden={!!open} className={badgeClassName} />

      <Modal visible={!!open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={onShow} onRequestClose={cancel}>
        {open ? (
          <GestureHandlerRootView style={StyleSheet.absoluteFill}>
            <Animated.View className={backdropClassName} style={[StyleSheet.absoluteFill, backStyle]}>
              {blur && Platform.OS === 'ios' ? <BlurView intensity={blurIntensity} tint="default" style={StyleSheet.absoluteFill} /> : null}
              <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Close reactions" />
            </Animated.View>

            <Animated.View pointerEvents="none" style={[s.clone, { left: open.box.x, top: open.box.y, width: open.box.width, height: open.box.height }, cloneStyle]}>
              {children}
              {selected && !flying ? (
                <View className="absolute" style={[{ width: BADGE, height: BADGE }, badgeOffset(corner)]}>
                  <View className={cn(DISC, badgeClassName)} style={{ width: BADGE, height: BADGE }}>
                    <Text style={BADGE_TEXT} allowFontScaling={false}>
                      {selected}
                    </Text>
                  </View>
                </View>
              ) : null}
            </Animated.View>

            <GestureDetector gesture={pick}>
              <Animated.View
                className={cn('absolute flex-row items-center rounded-full', PILL, pillClassName)}
                style={[{ left: open.pill.x, top: open.pill.y, width: pillW, height: PILL_H, paddingHorizontal: PAD, borderWidth: StyleSheet.hairlineWidth }, pillStyle]}
              >
                {reactions.map((r, i) => (
                  <Emoji key={r + i} i={i} emoji={r} open={shown} lx={lx} hover={hover} chosen={chosen} active={r === selected} />
                ))}
              </Animated.View>
            </GestureDetector>

            {flying ? (
              <Animated.View pointerEvents="none" className="absolute left-0 top-0" style={[{ width: BADGE, height: BADGE }, flyStyle]}>
                <Animated.View className={cn(DISC, badgeClassName)} style={[StyleSheet.absoluteFill, flyDisc]} />
                <Animated.View className="absolute items-center justify-center" style={[s.flyEmoji, flyEmoji]}>
                  <Text style={EMOJI_TEXT} allowFontScaling={false}>
                    {flying.emoji}
                  </Text>
                </Animated.View>
              </Animated.View>
            ) : null}
          </GestureHandlerRootView>
        ) : null}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  // Lift shadow animates its opacity, so it stays a plain style.
  clone: {
    position: 'absolute',
    shadowColor: '#000',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  flyEmoji: { left: (BADGE - SLOT) / 2, top: (BADGE - SLOT) / 2, width: SLOT, height: SLOT },
});
