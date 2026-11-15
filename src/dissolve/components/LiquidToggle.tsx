import { useEffect } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group, RoundedRect } from '@shopify/react-native-skia';
import { Easing, interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { gooLayer } from './goo';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const PAD = 10;

export type LiquidToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  width?: number;
  height?: number;
  onColor?: string;
  offColor?: string;
  knobColor?: string;
  disabled?: boolean;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A switch whose knob travels like a drop of liquid: the front moves first, the back
 * catches up, and the two stay joined by a stretching neck.
 *
 * <LiquidToggle value={on} onValueChange={setOn} />
 */
export function LiquidToggle({ value, onValueChange, width = 56, height = 34, onColor = '#34C759', offColor = '#E5E5EA', knobColor = '#FFFFFF', disabled, haptics = true, style }: LiquidToggleProps) {
  const r = (height - 6) / 2;
  const x0 = PAD + 3 + r;
  const x1 = PAD + width - 3 - r;
  const head = useSharedValue(value ? 1 : 0);
  const tail = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const to = value ? 1 : 0;
    head.value = withTiming(to, { duration: 260, easing: CALM });
    tail.value = withTiming(to, { duration: 520, easing: CALM });
  }, [value, head, tail]);

  const cy = PAD + height / 2;
  const hx = useDerivedValue(() => x0 + (x1 - x0) * head.value);
  const tx = useDerivedValue(() => x0 + (x1 - x0) * tail.value);
  const mx = useDerivedValue(() => (hx.value + tx.value) / 2);
  const tr = useDerivedValue(() => r * (1 - 0.18 * Math.min(1, Math.abs(head.value - tail.value) * 2.2)));
  const track = useDerivedValue(() => interpolateColor(head.value, [0, 1], [offColor, onColor]));

  return (
    <Pressable
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      onPress={() => {
        if (haptics) Haptics.selectionAsync();
        onValueChange(!value);
      }}
      style={[{ width, height, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Canvas style={{ position: 'absolute', left: -PAD, top: -PAD, width: width + PAD * 2, height: height + PAD * 2 }}>
        <RoundedRect x={PAD} y={PAD} width={width} height={height} r={height / 2} color={track} />
        <Group layer={gooLayer(3.2)}>
          <Circle cx={tx} cy={cy} r={tr} color={knobColor} />
          <Circle cx={mx} cy={cy} r={tr} color={knobColor} />
          <Circle cx={hx} cy={cy} r={r} color={knobColor} />
        </Group>
      </Canvas>
    </Pressable>
  );
}
