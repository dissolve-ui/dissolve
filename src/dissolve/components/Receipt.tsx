import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, DashPathEffect, Line, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useDissolve } from '../hooks/useDissolve';
import type { VariantName } from '../types';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
/** Fixed header height so the hinges land on whole points (no seam between panels). */
const HEADER = 76;
/** Height of the torn zigzag edge at the bottom of the last panel. */
const TEAR = 9;
const TOOTH = 9;
/** Folded paper peeking under the header when closed. */
const STACK = 8;
const PERSP = 900;
const CHEVRON = Skia.Path.MakeFromSVGString('M6 9l6 6 6-6')!;

export type ReceiptItem = { label: string; qty?: number; price: number; note?: string };
export type ReceiptTax = { label: string; amount: number };

export type ReceiptHandle = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Folds the receipt, turns it into dust, then calls onDismiss. */
  dismiss: () => Promise<void>;
  /** Shows a dismissed receipt again, folded. */
  restore: () => void;
};

export type ReceiptProps = {
  merchant: string;
  /** Second line under the merchant (address, table, order number). Defaults to the date. */
  subtitle?: string;
  items: ReceiptItem[];
  taxes?: ReceiptTax[];
  /** Defaults to the sum of items and taxes. */
  total?: number;
  /** ISO 4217 code used by Intl. Default 'EUR'. */
  currency?: string;
  locale?: string;
  /** Overrides the currency formatting entirely. */
  format?: (amount: number) => string;
  date?: Date | string;
  /** Payment line, e.g. 'Apple Pay · Visa 4242'. */
  payment?: string;
  /** Code printed under the barcode. Defaults to a code derived from the receipt. */
  reference?: string;
  footer?: string;
  /** Controlled open state. Pair it with onOpenChange. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDismiss?: () => void;
  /** Preset used by dismiss(). Default 'dust'. */
  dismissPreset?: VariantName;
  paper?: string;
  ink?: string;
  muted?: string;
  radius?: number;
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ReceiptHandle>;
};

function makeMoney(currency: string, locale?: string) {
  try {
    const f = new Intl.NumberFormat(locale, { style: 'currency', currency });
    return (n: number) => f.format(n);
  } catch {
    return (n: number) => `${n.toFixed(2)} ${currency}`;
  }
}

function formatDate(d: Date | string | undefined, locale?: string) {
  const date = d ? new Date(d) : new Date();
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/** Small deterministic hash, so the barcode is stable for a given receipt. */
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function barcodePath(seed: number, width: number, height: number) {
  const p = Skia.Path.Make();
  let s = seed || 1;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  // Guard bars on both ends, like a real EAN.
  let x = 0;
  const bar = (w: number) => {
    p.addRect(Skia.XYWHRect(x, 0, w, height));
    x += w;
  };
  bar(1.5);
  x += 1.5;
  bar(1.5);
  x += 2;
  while (x < width - 8) {
    bar(1 + Math.floor(rnd() * 3) * 0.9);
    x += 1 + Math.floor(rnd() * 3) * 0.8;
  }
  x = width - 5;
  bar(1.5);
  x += 1.5;
  bar(1.5);
  return p;
}

/** Paper of the last panel: a rectangle whose bottom edge is torn into teeth. */
function tornPath(width: number, height: number) {
  const p = Skia.Path.Make();
  const base = height - TEAR;
  p.moveTo(0, 0);
  p.lineTo(width, 0);
  p.lineTo(width, base);
  const n = Math.max(2, Math.round(width / TOOTH));
  const step = width / n;
  for (let i = n - 1; i >= 0; i--) {
    p.lineTo(i * step + step / 2, height);
    p.lineTo(i * step, base);
  }
  p.close();
  return p;
}

function Dashed({ width, color }: { width: number; color: string }) {
  return (
    <Canvas style={{ width, height: 1 }} pointerEvents="none">
      <Line p1={vec(0, 0.5)} p2={vec(width, 0.5)} color={color} strokeWidth={1}>
        <DashPathEffect intervals={[3, 4]} />
      </Line>
    </Canvas>
  );
}

/**
 * A payment receipt that unfolds like paper. Folded, it is a compact header (merchant and
 * total) with the folded sheets peeking under it. Tap it: two panels unfold in a real
 * accordion (each panel rotates around its hinge in perspective, the creases darken with the
 * angle), down to a torn edge with a barcode. dismiss() folds it back and turns it into dust.
 *
 * <Receipt merchant="Atelier Café" items={[{ label: 'Flat white', price: 4.8 }]} defaultOpen />
 */
export function Receipt({
  merchant,
  subtitle,
  items,
  taxes = [],
  total,
  currency = 'EUR',
  locale,
  format,
  date,
  payment,
  reference,
  footer = 'Thank you',
  open,
  defaultOpen = false,
  onOpenChange,
  onDismiss,
  dismissPreset = 'dust',
  paper = '#FFFFFF',
  ink = '#1C1C1E',
  muted = '#8E8E93',
  radius = 18,
  haptics = true,
  style,
  ref,
}: ReceiptProps) {
  const reduced = useReducedMotion();
  const { ref: dustRef, dissolving, dissolve, reset } = useDissolve();
  const [inner, setInner] = useState(defaultOpen);
  const [forcedClosed, setForcedClosed] = useState(false);
  const controlled = open !== undefined;
  const isOpen = !forcedClosed && (controlled ? open : inner);

  const [W, setW] = useState(0);
  const [c2, setC2] = useState(0);
  const [c3, setC3] = useState(0);
  // Both panels share one height: with the same angle their seam then meets exactly.
  const H = Math.ceil(Math.max(c2, c3 + TEAR));

  const money = useMemo(() => format ?? makeMoney(currency, locale), [format, currency, locale]);
  const subtotal = useMemo(() => items.reduce((a, it) => a + it.price * (it.qty ?? 1), 0), [items]);
  const sum = total ?? subtotal + taxes.reduce((a, t) => a + t.amount, 0);
  const when = useMemo(() => formatDate(date, locale), [date, locale]);
  const code = useMemo(() => reference ?? String(hash(`${merchant}${sum}${when}`)).padStart(10, '0').slice(0, 12), [reference, merchant, sum, when]);

  const inset = 18;
  const contentW = Math.max(0, W - inset * 2);
  const bars = useMemo(() => (contentW ? barcodePath(hash(code), contentW, 34) : null), [code, contentW]);
  const torn = useMemo(() => (W && H ? tornPath(W, H) : null), [W, H]);

  const t = useSharedValue(isOpen ? 1 : 0);
  const press = useSharedValue(0);
  const settleRef = useRef<(() => void) | null>(null);

  const settled = useCallback(
    (opened: boolean) => {
      if (opened && haptics) Haptics.selectionAsync();
      settleRef.current?.();
      settleRef.current = null;
    },
    [haptics],
  );

  const prevOpen = useRef(isOpen);
  useEffect(() => {
    if (prevOpen.current === isOpen) return;
    prevOpen.current = isOpen;
    const to = isOpen ? 1 : 0;
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    t.value = withTiming(to, { duration: reduced ? 1 : isOpen ? 860 : 620, easing: CALM }, (done) => {
      if (done) scheduleOnRN(settled, to === 1);
    });
  }, [isOpen, reduced, haptics, t, settled]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInner(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const busy = useRef(false);
  const dismiss = useCallback(async () => {
    if (busy.current || dissolving) return;
    busy.current = true;
    if (t.value > 0.001) {
      await new Promise<void>((done) => {
        settleRef.current = done;
        setForcedClosed(true);
        // Safety net when the fold is already running toward closed (no new animation).
        setTimeout(done, 900);
      });
    }
    await dissolve({ preset: dismissPreset, duration: 1300, haptics });
    busy.current = false;
    onDismiss?.();
  }, [dissolving, dissolve, dismissPreset, haptics, onDismiss, t]);

  const restore = useCallback(() => {
    setForcedClosed(false);
    if (!controlled) {
      setInner(false);
      t.value = 0;
    }
    reset();
  }, [controlled, reset, t]);

  useImperativeHandle(
    ref,
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!isOpen),
      dismiss,
      restore,
    }),
    [setOpen, isOpen, dismiss, restore],
  );

  // One derived pass: angle, its sine, and how far the accordion reaches down.
  const geo = useDerivedValue(() => {
    const th = (1 - t.value) * (Math.PI / 2);
    const sn = Math.sin(th);
    // Perspective is centered on each hinge: the far edge shrinks by PERSP / (PERSP + depth).
    const drop = 2 * H * Math.cos(th) * (PERSP / (PERSP + H * sn));
    return { th, sn, drop };
  });

  const box = useAnimatedStyle(() => ({
    height: HEADER + geo.value.drop + (1 - t.value) * STACK,
    transform: [{ scale: 1 - press.value * 0.015 }],
  }));
  const plate = useAnimatedStyle(() => ({ height: Math.max(HEADER - 12, HEADER + geo.value.drop - 16) }));
  const head = useAnimatedStyle(() => {
    const r = radius * (1 - t.value);
    return { borderBottomLeftRadius: r, borderBottomRightRadius: r };
  });
  const sheets = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ translateY: -t.value * STACK }] }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 180}deg` }] }));
  const p2 = useAnimatedStyle(() => ({
    opacity: t.value < 0.002 ? 0 : 1,
    transform: [{ perspective: PERSP }, { rotateX: `${-geo.value.th}rad` }],
  }));
  const p3 = useAnimatedStyle(() => ({
    opacity: t.value < 0.002 ? 0 : 1,
    top: HEADER + geo.value.drop - H,
    transform: [{ perspective: PERSP }, { rotateX: `${geo.value.th}rad` }],
  }));
  // Panel 2 faces the light while it tilts, panel 3 faces away: it gets the deeper shade.
  const shade2 = useAnimatedStyle(() => ({ opacity: geo.value.sn * 0.55 }));
  const shade3 = useAnimatedStyle(() => ({ opacity: Math.min(1, geo.value.sn * 1.15) }));

  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const ready = W > 0 && H > 0;

  return (
    <View ref={dustRef} collapsable={false} onLayout={onLayout} style={[{ opacity: dissolving ? 0 : 1 }, style]}>
      <Animated.View style={box}>
        {/* Shadow plate: an opaque view gets a cheap shadow path, the paper never repaints it. */}
        <Animated.View style={[s.plate, { borderRadius: radius, backgroundColor: paper }, plate]} />

        <Animated.View style={[s.sheet, { top: HEADER - 14, left: 12, right: 12, height: 14 + STACK, borderRadius: radius * 0.7, backgroundColor: '#ECECEE' }, sheets]} />
        <Animated.View style={[s.sheet, { top: HEADER - 14, left: 6, right: 6, height: 14 + STACK / 2, borderRadius: radius * 0.8, backgroundColor: '#F6F6F7' }, sheets]} />

        <Pressable
          onPress={() => setOpen(!isOpen)}
          onPressIn={() => (press.value = withTiming(1, { duration: 140, easing: CALM }))}
          onPressOut={() => (press.value = withTiming(0, { duration: 260, easing: CALM }))}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={`Receipt from ${merchant}, ${money(sum)}`}
        >
          <Animated.View style={[s.header, { height: HEADER, backgroundColor: paper, borderTopLeftRadius: radius, borderTopRightRadius: radius }, head]}>
            <View style={[s.logo, { backgroundColor: ink }]}>
              <Text style={[s.logoText, { color: paper }]}>{merchant.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.merchant, { color: ink }]} numberOfLines={1}>
                {merchant}
              </Text>
              <Text style={[s.meta, { color: muted }]} numberOfLines={1}>
                {subtitle ?? when}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.total, { color: ink }]}>{money(sum)}</Text>
              <Text style={[s.meta, { color: muted }]}>
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <Animated.View style={[s.chevron, chevron]}>
              <Canvas style={{ width: 16, height: 16 }}>
                <Path path={CHEVRON} color={muted} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" transform={[{ scale: 16 / 24 }]} />
              </Canvas>
            </Animated.View>
          </Animated.View>
        </Pressable>

        {/* Panel 2: hinged on the header, its lower edge tilts away from you. */}
        <Animated.View pointerEvents="none" style={[s.panel, { top: HEADER, height: H || undefined, backgroundColor: paper, transformOrigin: 'top' }, p2]}>
          <View onLayout={(e) => setC2(e.nativeEvent.layout.height)} style={{ paddingHorizontal: inset, paddingTop: 4, paddingBottom: 14 }}>
            {contentW ? <Dashed width={contentW} color="#D1D1D6" /> : null}
            <Text style={[s.label, { color: muted, marginTop: 14, marginBottom: 8 }]}>ITEMS</Text>
            {items.map((it, i) => (
              <View key={i} style={s.row}>
                <Text style={[s.qty, { color: muted }]}>{it.qty ?? 1}×</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.item, { color: ink }]} numberOfLines={1}>
                    {it.label}
                  </Text>
                  {it.note ? <Text style={[s.note, { color: muted }]}>{it.note}</Text> : null}
                </View>
                <Text style={[s.price, { color: ink }]}>{money(it.price * (it.qty ?? 1))}</Text>
              </View>
            ))}
          </View>
          {ready ? (
            <Animated.View style={[StyleSheet.absoluteFill, shade2]}>
              <Canvas style={StyleSheet.absoluteFill}>
                <Rect x={0} y={0} width={W} height={H}>
                  <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.32)']} positions={[0, 0.6, 1]} />
                </Rect>
              </Canvas>
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* Panel 3: hinged on its bottom edge, folds back toward panel 2 like an accordion. */}
        <Animated.View pointerEvents="none" style={[s.panel, { height: H || undefined, transformOrigin: 'bottom' }, p3]}>
          {torn ? (
            <Canvas style={StyleSheet.absoluteFill}>
              <Path path={torn} color={paper} />
            </Canvas>
          ) : null}
          <View onLayout={(e) => setC3(e.nativeEvent.layout.height)} style={{ paddingHorizontal: inset, paddingTop: 2, paddingBottom: 14 }}>
            <View style={s.row}>
              <Text style={[s.sub, { color: muted }]}>Subtotal</Text>
              <Text style={[s.sub, s.num, { color: muted }]}>{money(subtotal)}</Text>
            </View>
            {taxes.map((tx, i) => (
              <View key={i} style={s.row}>
                <Text style={[s.sub, { color: muted }]}>{tx.label}</Text>
                <Text style={[s.sub, s.num, { color: muted }]}>{money(tx.amount)}</Text>
              </View>
            ))}
            <View style={{ marginVertical: 10 }}>{contentW ? <Dashed width={contentW} color="#D1D1D6" /> : null}</View>
            <View style={[s.row, { alignItems: 'flex-end' }]}>
              <Text style={[s.label, { color: ink, marginBottom: 3 }]}>TOTAL</Text>
              <Text style={[s.grand, { color: ink }]}>{money(sum)}</Text>
            </View>
            {payment ? <Text style={[s.label, { color: muted, marginTop: 4 }]}>{payment.toUpperCase()}</Text> : null}
            {bars ? (
              <Canvas style={{ width: contentW, height: 34, marginTop: 18 }}>
                <Path path={bars} color={ink} />
              </Canvas>
            ) : null}
            <Text style={[s.code, { color: muted }]}>{code.replace(/(.{4})/g, '$1 ').trim()}</Text>
            {footer ? <Text style={[s.footer, { color: muted }]}>{footer}</Text> : null}
          </View>
          {torn ? (
            <Animated.View style={[StyleSheet.absoluteFill, shade3]}>
              <Canvas style={StyleSheet.absoluteFill}>
                <Path path={torn}>
                  <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.12)']} positions={[0, 0.45, 1]} />
                </Path>
              </Canvas>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  plate: {
    position: 'absolute',
    top: 8,
    left: 6,
    right: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sheet: { position: 'absolute' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14 },
  logo: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 17, fontWeight: '700' },
  merchant: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  meta: { fontFamily: MONO, fontSize: 11, marginTop: 3, letterSpacing: 0.2 },
  total: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  chevron: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  panel: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  label: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingVertical: 4 },
  qty: { fontFamily: MONO, fontSize: 12, width: 24, paddingTop: 2 },
  item: { fontSize: 15, letterSpacing: -0.1 },
  note: { fontSize: 12, marginTop: 1 },
  price: { fontSize: 15, fontVariant: ['tabular-nums'] },
  sub: { fontSize: 14 },
  num: { fontVariant: ['tabular-nums'] },
  grand: { fontSize: 26, fontWeight: '600', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  code: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.6, textAlign: 'center', marginTop: 6 },
  footer: { fontSize: 13, textAlign: 'center', marginTop: 12 },
});
