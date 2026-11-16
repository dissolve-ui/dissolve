/**
 * SwipeToDelete, from dissolve (react-native-dissolve). This file is yours: restyle it with
 * classNames, change the timings, the icon, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * A row you swipe left to delete, like Mail or WhatsApp. Past the threshold (or with a quick
 * flick) the row dissolves, the list closes up behind it, then onDelete runs.
 *
 * <SwipeToDelete onDelete={() => remove(item.id)} rowClassName="rounded-2xl">
 *   <Row item={item} />
 * </SwipeToDelete>
 */
import { useRef, type ReactNode } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useDissolve, type VariantName } from 'react-native-dissolve';
import { Animated, View, cn } from './tw';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);

export type SwipeToDeleteProps = {
  children: ReactNode;
  /** Called once the row has dissolved and collapsed: remove the item from your data here. */
  onDelete: () => void;
  /** Exit used when the row goes. Default 'dust'. */
  preset?: VariantName;
  /** Fraction of the row width to drag before release deletes. Default 0.4. */
  threshold?: number;
  disabled?: boolean;
  /** Outer wrapper classes (margins, layout). This is the part that collapses. */
  className?: string;
  /** Clipping row classes: corner radius goes here (rounded-2xl...), the action follows it. */
  rowClassName?: string;
  /** Delete action revealed behind the row. Default bg-dissolve-danger. */
  actionClassName?: string;
};

function TrashIcon() {
  return (
    <View className="items-center">
      <View className="h-[2.5px] w-[7px] rounded-t-[2px] bg-white" />
      <View className="mt-px h-[2.5px] w-5 rounded-[1.5px] bg-white" />
      <View className="mt-0.5 h-4 w-[15px] flex-row justify-evenly rounded-b border-2 border-t-0 border-white pt-[3px]">
        <View className="h-2 w-[1.6px] rounded-[1px] bg-white" />
        <View className="h-2 w-[1.6px] rounded-[1px] bg-white" />
      </View>
    </View>
  );
}

export function SwipeToDelete({ children, onDelete, preset = 'dust', threshold = 0.4, disabled, className, rowClassName, actionClassName }: SwipeToDeleteProps) {
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
    <Animated.View className={className} style={wrapStyle}>
      <GestureDetector gesture={pan}>
        {/* Plain RN view: it holds the capture ref. */}
        <RNView ref={ref} collapsable={false} onLayout={onLayout} style={{ opacity: dissolving ? 0 : 1 }}>
          <View className={cn('overflow-hidden', rowClassName)}>
            <View className={cn('items-end justify-center bg-dissolve-danger pr-[26px]', actionClassName)} style={StyleSheet.absoluteFill}>
              <Animated.View style={iconStyle}>
                <TrashIcon />
              </Animated.View>
            </View>
            <Animated.View style={rowStyle}>{children}</Animated.View>
          </View>
        </RNView>
      </GestureDetector>
    </Animated.View>
  );
}
