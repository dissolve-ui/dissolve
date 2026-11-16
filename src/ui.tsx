import { Children, Fragment, useState, type ReactNode } from 'react';
import { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { DynamicColorIOS, Platform, StyleSheet, type ColorValue, type ViewStyle } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, Text, View, useToken } from '@registry/tw';

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

/* ---------- iOS inset grouped list ---------- */

/** Inset grouped section: small caps header, rounded surface, hairline separators between rows. */
export function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={s.group}>
      {title ? (
        <Text className="text-dissolve-muted" style={s.groupTitle}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View className="bg-dissolve-surface" style={s.groupBody}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View className="bg-dissolve-border" style={s.separator} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text className="text-dissolve-muted" style={s.groupFooter}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** One row: SF Symbol tile, title, optional detail, chevron (or an external arrow). */
export function Row({
  icon,
  title,
  detail,
  onPress,
  external,
}: {
  icon: SFSymbol;
  title: string;
  detail?: string;
  onPress: () => void;
  external?: boolean;
}) {
  const onPrimary = useToken('primary-foreground');
  const muted = useToken('muted');
  return (
    <Pressable onPress={onPress} className="active:bg-dissolve-surface-2" style={s.row} accessibilityRole={external ? 'link' : 'button'}>
      <View className="bg-dissolve-primary" style={s.rowIcon}>
        <SymbolView name={icon} size={15} tintColor={onPrimary} weight="medium" />
      </View>
      <Text className="text-dissolve-foreground" style={s.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      {detail ? (
        <Text className="text-dissolve-muted" style={s.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      <SymbolView name={external ? 'arrow.up.right' : 'chevron.right'} size={12} tintColor={muted} weight="semibold" />
    </Pressable>
  );
}

/** `npx react-native-dissolve add <slug>` in a small mono row, tap to copy. */
export function InstallCommand({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const muted = useToken('muted');
  const success = useToken('success');
  const cmd = `npx react-native-dissolve add ${slug}`;
  return (
    <Pressable
      onPress={async () => {
        await Clipboard.setStringAsync(cmd);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="border-dissolve-border bg-dissolve-surface active:opacity-70"
      style={s.install}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${cmd}`}
    >
      <Text className="text-dissolve-muted" style={s.installPrompt}>
        $
      </Text>
      <Text className="text-dissolve-foreground" style={s.installText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {cmd}
      </Text>
      <Animated.View key={copied ? 'done' : 'copy'} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
        <SymbolView name={copied ? 'checkmark' : 'doc.on.doc'} size={14} tintColor={copied ? success : muted} weight="medium" />
      </Animated.View>
    </Pressable>
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

  group: { marginTop: 22 },
  groupTitle: { fontSize: 13, letterSpacing: 0.2, paddingHorizontal: 16, paddingBottom: 7 },
  groupBody: { borderRadius: 14, overflow: 'hidden' },
  groupFooter: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, paddingTop: 7 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingLeft: 14, paddingRight: 16 },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontSize: 17, letterSpacing: -0.2 },
  rowDetail: { fontSize: 15, maxWidth: 170 },

  install: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  installPrompt: { fontFamily: mono, fontSize: 12 },
  installText: { flex: 1, fontFamily: mono, fontSize: 12 },
});

export const layout = LinearTransition.duration(420).easing(Easing.bezier(0.32, 0.72, 0, 1));
