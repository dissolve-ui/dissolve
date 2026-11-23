/**
 * PagerTabs, from dissolve (dissolve-ui). This file is yours: change the indicator, the
 * sizes, the timing, anything. Colors come from the dissolve theme tokens (global.css), so it
 * follows light and dark mode out of the box.
 *
 * Tabs above swipeable pages. Swipe the pages and a soft pill slides behind the tabs with your
 * finger the whole way, stretching between two tabs of different widths; the label on it turns
 * from muted to full ink as it arrives. No underline, no rule under the row. Tap a tab and the pages glide to it. With more tabs than fit, the row
 * scrolls on its own to keep the active tab in view (and you can scroll it by hand). A selection
 * tick when the page changes.
 * Reduced motion: a tap jumps straight to its page.
 *
 * <PagerTabs
 *   tabs={['For you', 'Following', 'Design']}
 *   renderPage={(tab, i) => <Feed topic={tab} />}
 *   onIndexChange={setTopic}
 * />
 *
 * Give it a height (flex: 1): the pages fill it under the tabs. Each page is as wide as the
 * component; give a long page its own ScrollView. Change the page from code with a ref:
 * ref.current?.select(2).
 */
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import Reanimated, {
  interpolateColor,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, View, cn, useToken } from './tw';

export type PagerTabsHandle = {
  /** Goes to page i, as a tap on its tab. */
  select: (index: number, animated?: boolean) => void;
};

export type PagerTabsProps = {
  ref?: Ref<PagerTabsHandle>;
  /** The tab labels, one page each. */
  tabs: readonly string[];
  /** The page of tab i. It fills the page: give a long one its own ScrollView. */
  renderPage: (tab: string, index: number) => ReactNode;
  /** The page shown first. Default 0. */
  initialIndex?: number;
  /** Called when the page settles on a new tab. */
  onIndexChange?: (index: number) => void;
  /** The tab row scrolls when the tabs do not fit (else they share the width). Default true. */
  scrollable?: boolean;
  /** A selection tick when the page changes. Default true. */
  haptics?: boolean;
  /** Outer classes. Give it a height. */
  className?: string;
};

const ROW = 44;
const PAD = 16;
const GAP = 4;
/** The pill behind the active tab. */
const PILL = 34;
const INSET = 14;

type Box = { x: number; w: number };

/** Where the pill is at a fractional page p, between the two tabs around it. */
function at(boxes: Box[], p: number): Box {
  'worklet';
  const n = boxes.length;
  if (!n) return { x: 0, w: 0 };
  const i = Math.max(0, Math.min(n - 1, Math.floor(p)));
  const j = Math.min(n - 1, i + 1);
  const t = Math.max(0, Math.min(1, p - i));
  const a = boxes[i], b = boxes[j];
  if (!a || !b) return { x: 0, w: 0 };
  return { x: a.x + (b.x - a.x) * t, w: a.w + (b.w - a.w) * t };
}

function Tab({ label, index, progress, onPress, onBox, selected, ink, muted }: {
  label: string;
  index: number;
  progress: SharedValue<number>;
  onPress: () => void;
  onBox: (b: Box) => void;
  selected: boolean;
  ink: string;
  muted: string;
}) {
  const textStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(progress.value - index));
    return { color: interpolateColor(d, [0, 1], [ink, muted]) };
  });
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={(e: LayoutChangeEvent) => onBox({ x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })}
      style={st.tab}
    >
      <Animated.Text className="font-semibold" style={[st.label, textStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export function PagerTabs({ ref, tabs, renderPage, initialIndex = 0, onIndexChange, scrollable = true, haptics = true, className }: PagerTabsProps) {
  const reduced = useReducedMotion();
  const ink = useToken('foreground');
  const muted = useToken('muted');
  const pages = useAnimatedRef<Reanimated.ScrollView>();
  const row = useAnimatedRef<Reanimated.ScrollView>();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(initialIndex);
  const pageW = useSharedValue(0);
  const progress = useSharedValue(initialIndex);
  const boxes = useSharedValue<Box[]>([]);
  const rowW = useSharedValue(0);
  const contentW = useSharedValue(0);

  const select = (i: number, animated = !reduced) => {
    const to = Math.max(0, Math.min(tabs.length - 1, i));
    scheduleOnUI(() => {
      'worklet';
      scrollTo(pages, to * pageW.value, 0, animated);
    });
  };
  useImperativeHandle(ref, () => ({ select }), [select]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      if (pageW.value > 0) progress.value = e.contentOffset.x / pageW.value;
    },
  });

  // The page settles: the new index, a tick.
  const settled = (i: number) => {
    setIndex(i);
    if (haptics) Haptics.selectionAsync();
    onIndexChange?.(i);
  };
  useAnimatedReaction(
    () => Math.round(progress.value),
    (now, before) => {
      if (before !== null && now !== before && now >= 0 && now < tabs.length) scheduleOnRN(settled, now);
    },
  );
  // The row follows the pill, keeping it centered when the tabs overflow.
  useAnimatedReaction(
    () => at(boxes.value, progress.value),
    (b) => {
      const max = contentW.value - rowW.value;
      if (max <= 0) return;
      scrollTo(row, Math.max(0, Math.min(max, b.x + b.w / 2 - rowW.value / 2)), 0, false);
    },
  );

  const indicator = useAnimatedStyle(() => {
    const b = at(boxes.value, progress.value);
    return { width: b.w, transform: [{ translateX: b.x }] };
  });

  // Tab boxes, kept on the JS side and sent to the UI thread whole.
  const measured = useRef<Box[]>([]);
  const setBox = (i: number, b: Box) => {
    measured.current[i] = b;
    measured.current.length = tabs.length;
    if (measured.current.filter(Boolean).length === tabs.length) boxes.value = measured.current.slice();
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w === width) return;
    setWidth(w);
    pageW.value = w;
    rowW.value = w;
    // Keep the current page in place after a resize.
    const i = Math.round(progress.value);
    requestAnimationFrame(() => scheduleOnUI(() => {
      'worklet';
      scrollTo(pages, i * w, 0, false);
    }));
  };

  const tabEls = tabs.map((t, i) => (
    <Tab
      key={t + i}
      label={t}
      index={i}
      progress={progress}
      selected={i === index}
      onPress={() => select(i)}
      onBox={(b) => setBox(i, b)}
      ink={ink}
      muted={muted}
    />
  ));

  return (
    <View className={cn('bg-dissolve-background', className)} style={{ flex: 1 }} onLayout={onLayout}>
      <View style={{ paddingTop: 7, paddingBottom: 8 }}>
        <Reanimated.ScrollView
          ref={row}
          horizontal
          scrollEnabled={scrollable}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[st.row, { minWidth: width }]}
          onContentSizeChange={(w) => (contentW.value = w)}
          accessibilityRole="tablist"
        >
          <Animated.View pointerEvents="none" className="bg-dissolve-surface" style={[st.pill, indicator]} />
          {tabEls}
        </Reanimated.ScrollView>
      </View>
      <Reanimated.ScrollView
        ref={pages}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: initialIndex * width, y: 0 }}
        style={{ flex: 1 }}
      >
        {width > 0
          ? tabs.map((t, i) => (
              <View key={t + i} style={{ width }} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
                {renderPage(t, i)}
              </View>
            ))
          : null}
      </Reanimated.ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  row: { paddingHorizontal: PAD - 4, height: ROW, gap: GAP, alignItems: 'stretch' },
  tab: { flexGrow: 1, height: ROW, paddingHorizontal: INSET, alignItems: 'center', justifyContent: 'center', minWidth: 44 },
  label: { fontSize: 15, letterSpacing: -0.24 },
  pill: { position: 'absolute', left: 0, top: (ROW - PILL) / 2, height: PILL, borderRadius: PILL / 2, borderCurve: 'continuous' },
});
