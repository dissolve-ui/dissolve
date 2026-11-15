import type { ReactNode } from 'react';
import { Easing, LinearTransition } from 'react-native-reanimated';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export const C = {
  bg: '#FFFFFF',
  ink: '#242529',
  text: '#525252',
  muted: '#A3A3A3',
  line: '#EDEDED',
  surface: '#F5F5F5',
  dark: '#1C1C1C',
};

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function Stage({ children, style, dark }: { children: ReactNode; style?: ViewStyle; dark?: boolean }) {
  return <View style={[s.stage, dark && { backgroundColor: '#121212', borderColor: '#222' }, style]}>{children}</View>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text style={s.caption}>{children}</Text>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chip, active && s.chipActive, pressed && { opacity: 0.7 }]}>
      <Text style={[s.chipText, active && { color: 'white' }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.button, pressed && { opacity: 0.75 }]}>
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Code({ title, children }: { title?: string; children: string }) {
  return (
    <View style={s.code}>
      {title ? <Text style={s.codeTitle}>{title}</Text> : null}
      <Text style={s.codeText}>{children}</Text>
    </View>
  );
}

export function Section({ title, children, note }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.h2}>{title}</Text>
      {note ? <Text style={s.p}>{note}</Text> : null}
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  stage: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 14,
    overflow: 'visible',
  },
  caption: { fontFamily: mono, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10, letterSpacing: 0.2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  chipActive: { backgroundColor: C.dark, borderColor: C.dark },
  chipText: { fontSize: 13, color: C.ink, fontWeight: '500' },
  button: { backgroundColor: C.dark, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, alignSelf: 'center' },
  buttonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  code: { backgroundColor: C.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, overflow: 'hidden' },
  codeTitle: {
    fontFamily: mono,
    fontSize: 11,
    color: C.muted,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  codeText: { fontFamily: mono, fontSize: 12, lineHeight: 19, color: C.ink, padding: 14 },
  section: { paddingTop: 26, gap: 10 },
  h2: { fontSize: 17, fontWeight: '600', color: C.ink },
  p: { fontSize: 15, lineHeight: 22, color: C.text },
});

export const layout = LinearTransition.duration(420).easing(Easing.bezier(0.32, 0.72, 0, 1));
