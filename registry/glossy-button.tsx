/**
 * GlossyButton, from dissolve (react-native-dissolve). This file is yours: change the recipe, the
 * spring, the sizes, anything. The fill is an explicit brand color (the color prop), not a theme
 * token, so the button looks the same in light and dark mode, like a printed key.
 *
 * A tactile pill, slightly 3D and lit from the inside. The recipe, layer by layer:
 *   - fill: color, label: labelColor, fully rounded by default
 *   - stroke: 1 pt inside, a linear white gradient (strokeOpacity at the top, 0 at the bottom)
 *   - drop shadow: black at shadowOpacity, y shadowY, blur shadowBlur
 *   - inner shadow: white at innerOpacity, blur innerBlur, spread innerSpread
 *   - ring: an outer shadow in the fill color, spread ringSpread, no blur
 * Pressed, it scales to 0.97 on a crisp spring and the inner light dims. Light haptic on press in.
 *
 * Built on the new architecture style props: boxShadow (several shadows, inset) and
 * experimental_backgroundImage (the gradient stroke). Both need React Native 0.76 or later.
 *
 * <GlossyButton onPress={start}>Get started</GlossyButton>
 *
 * <GlossyButton icon={({ color, size }) => <PlusIcon color={color} size={size} />} onPress={create}>
 *   New project
 * </GlossyButton>
 *
 * <GlossyButton color="#E5484D" radius={14} size="lg" onPress={remove}>Delete</GlossyButton>
 * <GlossyButton fullWidth onPress={next}>Continue</GlossyButton>
 */
import type { ReactNode } from 'react';
import type { BoxShadowValue } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, Text, View, cn } from './tw';

/** Crisp and small: settles fast with a hint of bounce. */
const SPRING = { damping: 22, stiffness: 260, mass: 1 };
const PRESSED_SCALE = 0.97;
/** How much of the inner light is left while pressed. */
const PRESSED_LIGHT = 0.55;

const SIZES = {
  sm: { height: 36, padding: 14, font: 14, icon: 14, gap: 6 },
  md: { height: 44, padding: 18, font: 15, icon: 16, gap: 7 },
  lg: { height: 52, padding: 22, font: 17, icon: 18, gap: 8 },
} as const;

export type GlossyButtonSize = keyof typeof SIZES;

export type GlossyButtonProps = {
  /** The label. A string, or any node (it is then rendered as is). */
  children?: ReactNode;
  /** Label as a prop, used when there are no children. */
  label?: string;
  /** Leading icon. A node, or a function that gets the label color and the icon size. */
  icon?: ReactNode | ((p: { color: string; size: number }) => ReactNode);
  onPress?: () => void;
  /** Fill, also the color of the outer ring. Default '#296FF0'. */
  color?: string;
  /** Label and icon color. Default '#FFFFFF'. */
  labelColor?: string;
  /** Corner radius. Default 999 (a pill). */
  radius?: number;
  /** Height, padding and type size: 36, 44 or 52 pt. Default 'md'. */
  size?: GlossyButtonSize;
  /** Stretch to the full width of the parent. Default false (hugs its label). */
  fullWidth?: boolean;
  /** Top opacity of the 1 pt white gradient stroke. Default 0.4. */
  strokeOpacity?: number;
  /** Inner white shadow: opacity, blur and spread. Defaults 0.24, 6, 2. */
  innerOpacity?: number;
  innerBlur?: number;
  innerSpread?: number;
  /** Black drop shadow: opacity, y offset and blur. Defaults 0.2, 3, 6. */
  shadowOpacity?: number;
  shadowY?: number;
  shadowBlur?: number;
  /** Outer ring in the fill color, no blur. 0 removes it. Default 1. */
  ringSpread?: number;
  disabled?: boolean;
  /** Light impact on press in. Default true. */
  haptics?: boolean;
  /** Outer classes (margins, self alignment, width...). */
  className?: string;
  /** Label classes (weight, tracking...). The color comes from labelColor. */
  labelClassName?: string;
};

export function GlossyButton({
  children,
  label,
  icon,
  onPress,
  color = '#296FF0',
  labelColor = '#FFFFFF',
  radius = 999,
  size = 'md',
  fullWidth = false,
  strokeOpacity = 0.4,
  innerOpacity = 0.24,
  innerBlur = 6,
  innerSpread = 2,
  shadowOpacity = 0.2,
  shadowY = 3,
  shadowBlur = 6,
  ringSpread = 1,
  disabled = false,
  haptics = true,
  className,
  labelClassName,
}: GlossyButtonProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const s = SIZES[size];
  const r = Math.min(radius, s.height / 2);
  const content = children ?? label;

  const press = (to: number) => {
    pressed.value = withSpring(to, SPRING);
  };

  // Reduced motion: no scale, only the inner light dims.
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - (1 - PRESSED_SCALE) * pressed.value }],
  }));
  const lightStyle = useAnimatedStyle(() => ({
    opacity: 1 - (1 - PRESSED_LIGHT) * Math.min(1, Math.max(0, pressed.value)),
  }));

  const outer: BoxShadowValue[] = [{ offsetX: 0, offsetY: shadowY, blurRadius: shadowBlur, color: `rgba(0, 0, 0, ${shadowOpacity})` }];
  if (ringSpread > 0) outer.push({ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: ringSpread, color });
  const inner: BoxShadowValue[] = [
    { offsetX: 0, offsetY: 0, blurRadius: innerBlur, spreadDistance: innerSpread, color: `rgba(255, 255, 255, ${innerOpacity})`, inset: true },
  ];

  const glyph = typeof icon === 'function' ? icon({ color: labelColor, size: s.icon }) : icon;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        press(1);
      }}
      onPressOut={() => press(0)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={typeof content === 'string' ? content : undefined}
      accessibilityState={{ disabled }}
      className={cn(fullWidth ? 'self-stretch' : 'self-center', className)}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          {
            height: s.height,
            paddingHorizontal: s.padding,
            borderRadius: r,
            backgroundColor: color,
            boxShadow: outer,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s.gap,
          },
          pillStyle,
        ]}
      >
        {/* The stroke: a top lit gradient, covered by the face 1 pt inside it. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: r,
            experimental_backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, ${strokeOpacity}), rgba(255, 255, 255, 0))`,
          }}
        />
        <View pointerEvents="none" style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: Math.max(0, r - 1), backgroundColor: color }} />
        {/* The inner light, dimmed while pressed. */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: r, boxShadow: inner }, lightStyle]} />
        {glyph}
        {typeof content === 'string' || typeof content === 'number' ? (
          <Text className={cn('font-semibold', labelClassName)} style={{ color: labelColor, fontSize: s.font, letterSpacing: -0.2 }} numberOfLines={1}>
            {content}
          </Text>
        ) : (
          content
        )}
      </Animated.View>
    </Pressable>
  );
}
