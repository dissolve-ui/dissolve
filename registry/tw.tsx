/**
 * className-enabled primitives for the dissolve components (NativeWind v5 / react-native-css).
 * Installed once by `npx dissolve-ui init`, shared by every dissolve component.
 */
import type { ComponentProps, ComponentType } from 'react';
import { Platform, Pressable as RNPressable, Text as RNText, TextInput as RNTextInput, View as RNView } from 'react-native';
import RNAnimated from 'react-native-reanimated';
import { useCssElement, useNativeVariable } from 'react-native-css';
import { twMerge } from 'tailwind-merge';

export type ClassName = { className?: string };

// Every primitive goes in as ComponentType<any>: on RN 0.88 types, inferring useCssElement through
// View or Text is TS2590 (union type too complex). The public props stay typed by the signature.
export const View = (props: ComponentProps<typeof RNView> & ClassName) =>
  useCssElement(RNView as ComponentType<any>, props, { className: 'style' });
View.displayName = 'CSS(View)';

export const Text = (props: ComponentProps<typeof RNText> & ClassName) =>
  useCssElement(RNText as ComponentType<any>, props, { className: 'style' });
Text.displayName = 'CSS(Text)';

export const Pressable = (props: ComponentProps<typeof RNPressable> & ClassName) =>
  useCssElement(RNPressable as ComponentType<any>, props, { className: 'style' });
Pressable.displayName = 'CSS(Pressable)';

export const TextInput = (props: ComponentProps<typeof RNTextInput> & ClassName) =>
  useCssElement(RNTextInput as ComponentType<any>, props, { className: 'style' });
TextInput.displayName = 'CSS(TextInput)';

export const Animated = {
  ...RNAnimated,
  View: RNAnimated.createAnimatedComponent(View),
  Text: RNAnimated.createAnimatedComponent(Text),
};

/**
 * Reads a theme token as a color string (light or dark, live), for places that need a value
 * instead of a class: Skia paints, Reanimated color interpolation.
 *   const ink = useToken('foreground'); // var(--dissolve-foreground)
 */
// Typed as the native signature: TypeScript resolves react-native-css's web types otherwise.
const readNative = useNativeVariable as unknown as (name: string) => unknown;

export function useToken(name: string): string {
  if (Platform.OS === 'web') {
    return getComputedStyle(document.documentElement).getPropertyValue(`--dissolve-${name}`).trim();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return String(readNative(`--dissolve-${name}`));
}

/**
 * Joins class names and resolves conflicts like shadcn: the last class wins, so
 * cn('text-dissolve-foreground', 'text-red-500') gives 'text-red-500'.
 */
export function cn(...parts: (string | false | null | undefined)[]) {
  return twMerge(parts.filter(Boolean).join(' '));
}
