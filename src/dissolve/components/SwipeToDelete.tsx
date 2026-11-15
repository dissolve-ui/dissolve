import { useRef, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDissolve } from '../hooks/useDissolve';
import type { VariantName } from '../types';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

export type SwipeToDeleteProps = {
  children: ReactNode;
  /** Called once the row has dissolved and collapsed: remove the item from your data here. */
  onDelete: () => void;
  /** Exit used when the row goes. Default 'dust'. */
  preset?: VariantName;
  /** Fraction of the row width to drag before release deletes. Default 0.4. */
  threshold?: number;
  /** Color of the delete action revealed behind the row. Default iOS red. */
  actionColor?: string;
  /** Corner radius of the row, applied to the action too. Default 0. */
  radius?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

function TrashIcon() {
  return (
    <View style={s.icon}>
      <View style={s.lidHandle} />
      <View style={s.lid} />
      <View style={s.can}>
        <View style={s.line} />
        <View style={s.line} />
      </View>
    </View>
  );
}

/**
 * A row you swipe left to delete, like Mail or WhatsApp. Past the threshold (or with a quick
 * flick) the row dissolves, the list closes up behind it, then onDelete runs.
 *
 * <SwipeToDelete onDelete={() => remove(item.id)}>
 *   <Row item={item} />
 * </SwipeToDelete>
 */
export function SwipeToDelete({ children, onDelete, preset = 'dust', threshold = 0.4, actionColor = '#FF3B30', radius = 0, disabled, style }: SwipeToDeleteProps) {
  const { ref, dissolving, dissolve } = useDissolve();
  const tx = useSharedValue(0);
  const w = useSharedValue(1);
  const h = useSharedValue(-1);
  const measured = useRef(0);

  const commit = async () => {
    await dissolve({ preset });
    h.value = measured.current;
    h.value = withTiming(0, { duration: 280, easing: CALM }, (done) => {
      if (done) scheduleOnRN(onDelete);
    });
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onChange((e) => {
      const next = tx.value + e.changeX;
      // Free to the left, a little rubber band to the right.
      tx.value = next > 0 ? next * 0.25 : next;
    })
    .onEnd((e) => {
      if (-tx.value > w.value * threshold || e.velocityX < -900) {
        tx.value = withTiming(-w.value * 0.45, { duration: 160, easing: CALM }, (done) => {
          if (done) scheduleOnRN(commit);
        });
      } else {
        tx.value = withTiming(0, { duration: 300, easing: CALM });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const iconStyle = useAnimatedStyle(() => {
    const p = Math.min(1, -tx.value / (w.value * threshold));
    return { opacity: interpolate(p, [0, 0.4, 1], [0, 0.6, 1]), transform: [{ scale: interpolate(p, [0, 1], [0.6, 1.08]) }] };
  });
  const wrapStyle = useAnimatedStyle(() => (h.value < 0 ? {} : { height: h.value, overflow: 'hidden' }));

  const onLayout = (e: LayoutChangeEvent) => {
    w.value = e.nativeEvent.layout.width;
    if (h.value < 0) measured.current = e.nativeEvent.layout.height;
  };

  return (
    <Animated.View style={[wrapStyle, style]}>
      <GestureDetector gesture={pan}>
        <View ref={ref} collapsable={false} onLayout={onLayout} style={{ borderRadius: radius, overflow: 'hidden', opacity: dissolving ? 0 : 1 }}>
          <View style={[StyleSheet.absoluteFill, s.action, { backgroundColor: actionColor }]}>
            <Animated.View style={iconStyle}>
              <TrashIcon />
            </Animated.View>
          </View>
          <Animated.View style={rowStyle}>{children}</Animated.View>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  action: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: 26 },
  icon: { alignItems: 'center' },
  lidHandle: { width: 7, height: 2.5, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: 'white' },
  lid: { width: 20, height: 2.5, borderRadius: 1.5, backgroundColor: 'white', marginTop: 1 },
  can: { width: 15, height: 16, marginTop: 2, borderWidth: 2, borderTopWidth: 0, borderColor: 'white', borderBottomLeftRadius: 4, borderBottomRightRadius: 4, flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 3 },
  line: { width: 1.6, height: 8, borderRadius: 1, backgroundColor: 'white' },
});
