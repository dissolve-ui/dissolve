import { useEffect } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group, Oval, RoundedRect } from '@shopify/react-native-skia';
import { Easing, interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { gooLayer } from './goo';

const SOFT = Easing.inOut(Easing.cubic);
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
    head.value = withTiming(to, { duration: 400, easing: SOFT });
    tail.value = withTiming(to, { duration: 1000, easing: SOFT });
  }, [value, head, tail]);

  const cy = PAD + height / 2;
  const hx = useDerivedValue(() => x0 + (x1 - x0) * head.value);
  const tx = useDerivedValue(() => x0 + (x1 - x0) * tail.value);
  const mx = useDerivedValue(() => (hx.value + tx.value) / 2);
  const q1 = useDerivedValue(() => hx.value + (tx.value - hx.value) * 0.25);
  const q3 = useDerivedValue(() => hx.value + (tx.value - hx.value) * 0.75);
  // The further apart head and tail are, the thinner the neck between them.
  const stretch = useDerivedValue(() => Math.min(1, Math.abs(head.value - tail.value) * 2));
  const tr = useDerivedValue(() => r * (1 - 0.3 * stretch.value));
  const nr = useDerivedValue(() => r * (1 - 0.62 * stretch.value));
  const qr = useDerivedValue(() => r * (1 - 0.42 * stretch.value));
  // Squash and stretch: the leading drop flattens and widens while the liquid is pulled.
  const hw = useDerivedValue(() => r * (1 + 0.28 * stretch.value));
  const hh = useDerivedValue(() => r * (1 - 0.2 * stretch.value));
  const ox = useDerivedValue(() => hx.value - hw.value);
  const oy = useDerivedValue(() => cy - hh.value);
  const ow = useDerivedValue(() => hw.value * 2);
  const oh = useDerivedValue(() => hh.value * 2);
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
        <Group layer={gooLayer(4)}>
          <Circle cx={tx} cy={cy} r={tr} color={knobColor} />
          <Circle cx={q3} cy={cy} r={qr} color={knobColor} />
          <Circle cx={mx} cy={cy} r={nr} color={knobColor} />
          <Circle cx={q1} cy={cy} r={qr} color={knobColor} />
          <Oval x={ox} y={oy} width={ow} height={oh} color={knobColor} />
        </Group>
      </Canvas>
    </Pressable>
  );
}
