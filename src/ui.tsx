import type { ReactNode } from 'react';
import { Easing, LinearTransition } from 'react-native-reanimated';
import { DynamicColorIOS, Platform, StyleSheet, type ColorValue, type ViewStyle } from 'react-native';
import { Pressable, Text, View } from '@registry/tw';

/** iOS color that follows light and dark on its own (works inside StyleSheet.create). */
const dyn = (light: string, dark: string): ColorValue => (Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : light);

/**
 * Static palette for the older example screens, mirroring registry/theme.css so they follow the
 * system appearance. New code should use the dissolve classes (bg-dissolve-surface, text-dissolve-foreground...).
 */
export const C = {
  bg: dyn('rgb(255,255,255)', 'rgb(0,0,0)'), // background
  ink: dyn('rgb(28,28,30)', 'rgb(242,242,247)'), // foreground
  text: dyn('#525252', 'rgb(174,174,178)'),
  muted: dyn('rgb(142,142,147)', 'rgb(152,152,157)'), // muted
  line: dyn('rgba(60,60,67,0.12)', 'rgba(84,84,88,0.5)'), // border
  surface: dyn('rgb(242,242,247)', 'rgb(28,28,30)'), // surface
  dark: dyn('rgb(28,28,30)', 'rgb(242,242,247)'), // primary
  onDark: dyn('rgb(255,255,255)', 'rgb(28,28,30)'), // primary-foreground
};

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function Stage({ children, style, dark }: { children: ReactNode; style?: ViewStyle; dark?: boolean }) {
  return (
    <View className="border-dissolve-border bg-dissolve-surface" style={[s.stage, dark && { backgroundColor: '#121212', borderColor: '#222' }, style]}>
      {children}
    </View>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return (
    <Text className="text-dissolve-muted" style={s.caption}>
      {children}
    </Text>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={active ? 'border-dissolve-primary bg-dissolve-primary active:opacity-70' : 'border-dissolve-border bg-dissolve-surface active:opacity-70'}
      style={s.chip}
    >
      <Text className={active ? 'text-dissolve-primary-foreground' : 'text-dissolve-foreground'} style={s.chipText}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="bg-dissolve-primary active:opacity-75" style={s.button}>
      <Text className="text-dissolve-primary-foreground" style={s.buttonText}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Code({ title, children }: { title?: string; children: string }) {
  return (
    <View className="border-dissolve-border bg-dissolve-surface" style={s.code}>
      {title ? (
        <Text className="border-dissolve-border text-dissolve-muted" style={s.codeTitle}>
          {title}
        </Text>
      ) : null}
      <Text className="text-dissolve-foreground" style={s.codeText}>
        {children}
      </Text>
    </View>
  );
}

export function Section({ title, children, note }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <View style={s.section}>
      <Text className="text-dissolve-foreground" style={s.h2}>
        {title}
      </Text>
      {note ? (
        <Text className="text-dissolve-muted" style={s.p}>
          {note}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Layout and type only: colors come from the dissolve classes above. */
export const s = StyleSheet.create({
  stage: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14, overflow: 'visible' },
  caption: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 10, letterSpacing: 0.2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 13, fontWeight: '500' },
  button: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, alignSelf: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' },
  code: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  codeTitle: { fontFamily: mono, fontSize: 11, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  codeText: { fontFamily: mono, fontSize: 12, lineHeight: 19, padding: 14 },
  section: { paddingTop: 26, gap: 10 },
  h2: { fontSize: 17, fontWeight: '600' },
  p: { fontSize: 15, lineHeight: 22 },
});

export const layout = LinearTransition.duration(420).easing(Easing.bezier(0.32, 0.72, 0, 1));
