/**
 * Tooltip, from dissolve (dissolve-ui). This file is yours: change the delay, the offset, the
 * bubble, anything. Colors come from the dissolve theme tokens (global.css), so it follows light and
 * dark mode out of the box.
 *
 * A small label with an arrow for the view it wraps. Press and hold the view and, after the delay,
 * the tooltip grows in from it with a soft scale and fade; it goes away a moment after the finger
 * lifts. It sits on the side you ask for (top, bottom, left or right), flips to the other side when
 * the screen edge is too close, and slides along that edge to stay on screen, the arrow still
 * pointing at the view. The label is added to the view's accessibility hint, so VoiceOver reads it.
 * Selection tick as it shows. Reduced motion: a plain fade.
 *
 * It renders next to the view, not in a portal: it raises itself over its siblings, but a parent
 * with overflow hidden clips it. A Pressable trigger still fires onPress after a long press unless
 * it has an onLongPress of its own.
 *
 * <Tooltip content="Share">
 *   <IconButton icon="share" onPress={share} />
 * </Tooltip>
 *
 * <Tooltip content="Archived items are kept 30 days" placement="bottom" delay={250}>
 *   <InfoIcon />
 * </Tooltip>
 */
import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Platform, StyleSheet, View as RNView, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';
import { CALM } from './motion';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export type TooltipProps = {
  /** The label. A string, or any node. */
  content: ReactNode;
  /** The view it describes. */
  children: ReactElement;
  /** Preferred side. It flips to the other side when the screen edge is too close. Default 'top'. */
  placement?: TooltipPlacement;
  /** How long to hold before it shows, in ms. Default 400. */
  delay?: number;
  /** Gap between the view and the arrow tip, in pt. Default 8. */
  offset?: number;
  /** Shown or hidden (controlled). */
  open?: boolean;
  /** Called when it wants to show or hide. */
  onOpenChange?: (open: boolean) => void;
  /** Never shows. */
  disabled?: boolean;
  /** Selection tick as it shows. Default true. */
  haptics?: boolean;
  /** Classes of the wrapper around the view (margins, self alignment...). */
  className?: string;
};

const IN = 150;
const OUT = 100;
/** How long it stays after the finger lifts. */
const LINGER = 1200;
/** Keep this far from the screen edges; more at the top on iOS for the status bar. */
const EDGE = 8;
const TOP_EDGE = Platform.OS === 'ios' ? 50 : 28;
const ARROW = 8;
const MAX = 240;
/** Distance it travels toward its place as it shows. */
const RISE = 4;

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

type Box = { x: number; y: number; w: number; h: number };

/**
 * Where the bubble goes, relative to the trigger's top left: the side (flipped if it does not fit),
 * the bubble's offset, and the arrow's position along the bubble edge.
 */
export function placeTooltip(t: Box, b: { w: number; h: number }, want: TooltipPlacement, gap: number, win: { w: number; h: number; top: number; edge: number }) {
  const room = { top: t.y - win.top, bottom: win.h - win.edge - (t.y + t.h), left: t.x - win.edge, right: win.w - win.edge - (t.x + t.w) };
  const need = (s: TooltipPlacement) => (s === 'top' || s === 'bottom' ? b.h : b.w) + gap;
  const side = room[want] >= need(want) || room[OPPOSITE[want]] < need(OPPOSITE[want]) ? want : OPPOSITE[want];
  const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let x: number;
  let y: number;
  let arrow: number;
  if (side === 'top' || side === 'bottom') {
    x = clampTo(t.w / 2 - b.w / 2, win.edge - t.x, win.w - win.edge - t.x - b.w);
    y = side === 'top' ? -gap - b.h : t.h + gap;
    arrow = clampTo(t.w / 2 - x, 10, b.w - 10);
  } else {
    y = clampTo(t.h / 2 - b.h / 2, win.top - t.y, win.h - win.edge - t.y - b.h);
    x = side === 'left' ? -gap - b.w : t.w + gap;
    arrow = clampTo(t.h / 2 - y, 10, b.h - 10);
  }
  return { side, x, y, arrow };
}

export function Tooltip({ content, children, placement = 'top', delay = 400, offset = 8, open, onOpenChange, disabled = false, haptics = true, className }: TooltipProps) {
  const reduced = useReducedMotion();
  const fg = useToken('foreground');
  const bg = useToken('background');
  const win = useWindowDimensions();
  const trigger = useRef<RNView>(null);
  const [inner, setInner] = useState(false);
  const shown = !disabled && (open ?? inner);
  const [bubble, setBubble] = useState<{ w: number; h: number } | null>(null);
  const [spot, setSpot] = useState<ReturnType<typeof placeTooltip> | null>(null);
  const linger = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const a = useSharedValue(0);

  const set = (next: boolean) => {
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };

  // Measure the trigger in the window each time it shows, then place the bubble.
  useEffect(() => {
    if (!shown || !bubble) return;
    trigger.current?.measureInWindow((x, y, w, h) => {
      setSpot(placeTooltip({ x, y, w, h }, bubble, placement, offset + ARROW / 2, { w: win.width, h: win.height, top: TOP_EDGE, edge: EDGE }));
    });
  }, [shown, bubble, placement, offset, win.width, win.height]);

  useEffect(() => {
    if (shown && !spot) return;
    a.value = withTiming(shown ? 1 : 0, { duration: shown ? IN : OUT, easing: CALM });
  }, [shown, spot, a]);
  useEffect(() => () => clearTimeout(linger.current), []);

  const onHold = () => {
    clearTimeout(linger.current);
    if (haptics) Haptics.selectionAsync();
    set(true);
  };
  const onRelease = () => {
    clearTimeout(linger.current);
    linger.current = setTimeout(() => set(false), LINGER);
  };
  const hold = Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(delay)
    .maxDistance(24)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      scheduleOnRN(onHold);
    })
    .onFinalize((_e, ok) => {
      if (ok) scheduleOnRN(onRelease);
    });

  const side = spot?.side ?? placement;
  const style = useAnimatedStyle(() => {
    const k = 1 - a.value;
    const d = reduced ? 0 : k * RISE;
    const tx = side === 'left' ? d : side === 'right' ? -d : 0;
    const ty = side === 'top' ? d : side === 'bottom' ? -d : 0;
    return { opacity: a.value, transform: [{ translateX: tx }, { translateY: ty }, { scale: reduced ? 1 : 0.96 + 0.04 * a.value }] };
  });

  const label = typeof content === 'string' ? content : undefined;
  const child =
    label && isValidElement<{ accessibilityHint?: string }>(children)
      ? cloneElement(children, { accessibilityHint: [children.props.accessibilityHint, label].filter(Boolean).join('. ') })
      : children;

  const onBubble = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!bubble || Math.abs(bubble.w - width) > 0.5 || Math.abs(bubble.h - height) > 0.5) setBubble({ w: width, h: height });
  };

  const vertical = side === 'top' || side === 'bottom';
  const arrowStyle = vertical
    ? { left: (spot?.arrow ?? 0) - ARROW / 2, [side === 'top' ? 'bottom' : 'top']: -ARROW / 2 + 1 }
    : { top: (spot?.arrow ?? 0) - ARROW / 2, [side === 'left' ? 'right' : 'left']: -ARROW / 2 + 1 };

  return (
    <View className={cn(className)} style={{ zIndex: shown ? 1000 : undefined }}>
      <GestureDetector gesture={hold}>
        <RNView ref={trigger} collapsable={false}>
          {child}
        </RNView>
      </GestureDetector>
      {/* Always there, invisible when hidden: it measures itself, then fades in and out in place. A wide
          box holds it, so the text wraps at the bubble's max width and not at the trigger's width. */}
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[st.box, { left: spot?.x ?? 0, top: spot?.y ?? 0, opacity: 0 }, spot ? style : null]}
      >
        <RNView onLayout={onBubble} style={[st.bubble, { backgroundColor: fg }]}>
          {typeof content === 'string' ? <Text style={[st.text, { color: bg }]}>{content}</Text> : content}
          <RNView style={[st.arrow, { backgroundColor: fg }, arrowStyle]} />
        </RNView>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  box: { position: 'absolute', width: MAX, alignItems: 'flex-start' },
  bubble: { maxWidth: MAX, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderCurve: 'continuous' },
  text: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  arrow: { position: 'absolute', width: ARROW, height: ARROW, borderRadius: 1.5, transform: [{ rotate: '45deg' }] },
});
