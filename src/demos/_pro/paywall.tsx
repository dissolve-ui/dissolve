/**
 * Paywall, from dissolve pro (dissolve-ui). This file is yours: change the copy, the layout, the
 * timings, anything. Colors come from the dissolve theme tokens (global.css), so it follows light
 * and dark mode out of the box. The accent (CTA, selected plan, badges) is one explicit color.
 *
 * A full screen subscription paywall, driven by props. On open, each section gathers out of grains,
 * top to bottom: the header, the features, the plans, then the button. A Monthly / Yearly segmented
 * control switches the period: every price rolls to its new value, and a badge tells how much the
 * year saves. Tap a plan card to pick it (selection tick). The glossy button calls onSubscribe and
 * shows a spinner while it runs: success buzz when it resolves, error buzz when it throws.
 * Safe areas handled, the bottom bar stays put while the content scrolls on small screens.
 *
 * Store agnostic: it only calls your callbacks. It brings its own DissolveProvider, so the grains
 * show even when it is presented as a modal. Uses glossy-button, segmented-control and
 * number-ticker from dissolve.
 *
 * <Paywall
 *   title="Unlock everything"
 *   subtitle="One subscription, every feature."
 *   features={['Unlimited projects', 'Sync across devices', 'Priority support']}
 *   plans={[
 *     { id: 'pro', title: 'Pro', price: { month: 9.99, year: 59.99 }, badge: 'Most popular' },
 *     { id: 'team', title: 'Team', description: 'Up to 5 people', price: { month: 19.99, year: 149.99 } },
 *   ]}
 *   format={{ prefix: '$' }}
 *   onSubscribe={({ plan, period }) => buy(plan.id, period)}
 *   onRestore={restore}
 *   onClose={() => router.back()}
 * />
 *
 * With RevenueCat (react-native-purchases), map the packages of the current offering to plans:
 *
 *   const offering = (await Purchases.getOfferings()).current;
 *   const pkg = { month: offering?.monthly, year: offering?.annual };
 *   <Paywall
 *     title="Go Pro"
 *     features={features}
 *     plans={[{ id: 'pro', title: 'Pro', price: { month: pkg.month!.product.price, year: pkg.year!.product.price } }]}
 *     format={{ prefix: '$' }}
 *     onSubscribe={async ({ period }) => {
 *       try {
 *         const { customerInfo } = await Purchases.purchasePackage(pkg[period]!);
 *         if (customerInfo.entitlements.active.pro) router.back();
 *         else return false;
 *       } catch (e: any) {
 *         if (e.userCancelled) return false; // no buzz, the person changed their mind
 *         throw e;
 *       }
 *     }}
 *     onRestore={async () => {
 *       const info = await Purchases.restorePurchases();
 *       if (info.entitlements.active.pro) router.back();
 *     }}
 *     onClose={() => router.back()}
 *   />
 *
 * Present it as a full screen modal (expo-router: presentation: 'fullScreenModal'). Inside a
 * React Native <Modal>, wrap it in a GestureHandlerRootView.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { DissolveIn, DissolveProvider } from 'dissolve-ui';
import { Animated, Pressable, Text, View, cn, useToken } from '@registry/tw';
import { CALM } from '@registry/motion';
import { toRGBA } from '@registry/dots';
import { GlossyButton } from '@registry/glossy-button';
import { NumberTicker } from '@registry/number-ticker';
import { SegmentedControl } from '@registry/segmented-control';

export type PaywallPeriod = 'month' | 'year';

export type PaywallPlan = {
  /** Your id, handed back to onSubscribe. */
  id: string;
  /** Plan name, e.g. 'Pro'. */
  title: string;
  /** One short line under the name. */
  description?: string;
  /** Price of one period, as a number so it can roll. */
  price: { month: number; year: number };
  /** Small pill on the card, e.g. 'Most popular'. */
  badge?: string;
};

export type PaywallFeature = string | { title: string; icon?: ReactNode };

export type PriceFormat = {
  /** Before the number, e.g. '$'. */
  prefix?: string;
  /** After the number, e.g. ' €' (no break space). */
  suffix?: string;
  /** Picks the separators, e.g. 'fr-FR' gives 9,99. */
  locale?: string;
  /** Digits after the decimal separator. Default 2. */
  decimals?: number;
};

export type PaywallSelection = { plan: PaywallPlan; period: PaywallPeriod };

export type PaywallProps = {
  title: string;
  subtitle?: string;
  /** Hero above the title (app icon, illustration). Default: a PRO tile in the accent color. */
  icon?: ReactNode;
  /** What the subscription unlocks, one line each. */
  features: PaywallFeature[];
  /** One or more plans. With several, the cards are pickable. */
  plans: PaywallPlan[];
  /** Plan selected at first. Default: the first plan with a badge, else the first one. */
  defaultPlan?: string;
  /** Period selected at first. Default 'year'. */
  defaultPeriod?: PaywallPeriod;
  /** Periods offered. One period hides the switch. Default ['month', 'year']. */
  periods?: PaywallPeriod[];
  /** Labels of the switch. Default { month: 'Monthly', year: 'Yearly' }. */
  periodLabels?: Record<PaywallPeriod, string>;
  /** Short unit after the price. Default { month: '/mo', year: '/yr' }. */
  unitLabels?: Record<PaywallPeriod, string>;
  /** Badge on the yearly segment. Default: 'Save N%' from the selected plan, false hides it. */
  yearBadge?: string | false;
  /** How prices are written. */
  format?: PriceFormat;
  /** Button label. Default 'Continue'. */
  ctaLabel?: string;
  /** Line under the button, e.g. 'Cancel anytime'. */
  note?: string;
  /**
   * Called with the selected plan and period. May return a promise: the button spins until it
   * settles. Resolve false for a cancelled purchase (no buzz), throw for an error (error buzz).
   */
  onSubscribe: (selection: PaywallSelection) => void | boolean | Promise<void | boolean>;
  /** Shows a Restore purchases link when set. May return a promise. */
  onRestore?: () => void | Promise<void>;
  /** Shows a close button when set. */
  onClose?: () => void;
  /** Small links at the bottom, e.g. Terms and Privacy. */
  links?: { label: string; onPress: () => void }[];
  /** CTA, selected plan and badges. Default: the accent token (iOS blue). */
  accentColor?: string;
  /** Sections gather out of grains on open. Default true. Reduced motion turns it off. */
  entrance?: boolean;
  /** Haptics on select, success and error. Default true. */
  haptics?: boolean;
  /** Root classes (background...). Default bg-dissolve-background. */
  className?: string;
};

/** Delay between two sections gathering, and how long each takes, in ms. */
const STAGGER = 140;
const GATHER = 900;
const SPRING = { damping: 22, stiffness: 260, mass: 1 };

export function Paywall(props: PaywallProps) {
  // Own provider: the grains draw inside the paywall, so they show inside a modal too.
  return (
    <DissolveProvider>
      <PaywallScreen {...props} />
    </DissolveProvider>
  );
}

function PaywallScreen({
  title,
  subtitle,
  icon,
  features,
  plans,
  defaultPlan,
  defaultPeriod = 'year',
  periods = ['month', 'year'],
  periodLabels = { month: 'Monthly', year: 'Yearly' },
  unitLabels = { month: '/mo', year: '/yr' },
  yearBadge,
  format,
  ctaLabel = 'Continue',
  note,
  onSubscribe,
  onRestore,
  onClose,
  links,
  accentColor,
  entrance = true,
  haptics = true,
  className,
}: PaywallProps) {
  const insets = useSafeAreaInsets();
  const accentToken = useToken('accent');
  const accent = rgba(accentColor ?? accentToken);

  const [period, setPeriod] = useState<PaywallPeriod>(periods.includes(defaultPeriod) ? defaultPeriod : periods[0]);
  const [planId, setPlanId] = useState(defaultPlan ?? (plans.find((p) => p.badge) ?? plans[0])?.id);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const plan = plans.find((p) => p.id === planId) ?? plans[0];

  const badge = useMemo(() => {
    if (yearBadge === false || !periods.includes('year') || !periods.includes('month')) return null;
    if (yearBadge) return yearBadge;
    const save = plan ? Math.round((1 - plan.price.year / (plan.price.month * 12)) * 100) : 0;
    return save > 0 ? `Save ${save}%` : null;
  }, [yearBadge, periods, plan]);

  const tick = (kind: 'select' | 'ok' | 'error') => {
    if (!haptics) return;
    if (kind === 'select') Haptics.selectionAsync();
    else Haptics.notificationAsync(kind === 'ok' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  };

  const subscribe = async () => {
    if (busy || !plan) return;
    setBusy('buy');
    try {
      const res = await onSubscribe({ plan, period });
      if (res !== false) tick('ok');
    } catch {
      tick('error');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (busy || !onRestore) return;
    setBusy('restore');
    try {
      await onRestore();
    } catch {
      tick('error');
    } finally {
      setBusy(null);
    }
  };

  // One wrapper per section, each gathering a beat after the previous one.
  const section = (i: number, children: ReactNode, style?: object) =>
    entrance ? (
      <DissolveIn preset="gather" delay={i * STAGGER} duration={GATHER} style={style}>
        {children}
      </DissolveIn>
    ) : (
      <View style={style}>{children}</View>
    );

  return (
    <View className={cn('flex-1 bg-dissolve-background', className)}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: 24, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {section(
          0,
          <View style={st.header}>
            {icon ?? <ProTile color={accent} />}
            <Text className="text-dissolve-foreground" style={st.title}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-dissolve-muted" style={st.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>,
        )}

        {section(
          1,
          <View style={st.features}>
            {features.map((f, i) => {
              const item = typeof f === 'string' ? { title: f } : f;
              return (
                <View key={i} style={st.feature}>
                  {item.icon ?? <Check color={accent} />}
                  <Text className="text-dissolve-foreground" style={st.featureText}>
                    {item.title}
                  </Text>
                </View>
              );
            })}
          </View>,
        )}

        {section(
          2,
          <View style={st.plans}>
            {periods.length > 1 ? (
              <View style={st.switch}>
                <SegmentedControl
                  segments={periods.map((p) => ({ value: p, label: periodLabels[p] }))}
                  value={period}
                  onChange={(v) => setPeriod(v as PaywallPeriod)}
                  haptics={haptics}
                />
                {badge ? (
                  <View pointerEvents="none" style={[st.saveBadge, { backgroundColor: accent, right: periods.indexOf('year') === 0 ? undefined : 10, left: periods.indexOf('year') === 0 ? 10 : undefined }]}>
                    <Text style={st.saveText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                period={period}
                selected={p.id === plan?.id}
                pickable={plans.length > 1}
                accent={accent}
                format={format}
                unit={unitLabels[period]}
                monthUnit={unitLabels.month}
                onPress={() => {
                  if (p.id === plan?.id) return;
                  tick('select');
                  setPlanId(p.id);
                }}
              />
            ))}
          </View>,
        )}
      </ScrollView>

      {section(
        3,
        <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* While buying, a spinner replaces the label (children win over label). */}
          <GlossyButton label={ctaLabel} color={accent} size="lg" fullWidth onPress={subscribe} disabled={busy === 'restore'} haptics={haptics}>
            {busy === 'buy' ? <ActivityIndicator color="#FFFFFF" /> : undefined}
          </GlossyButton>
          {note ? (
            <Text className="text-dissolve-muted" style={st.note}>
              {note}
            </Text>
          ) : null}
          {onRestore || links?.length ? (
            <View style={st.links}>
              {onRestore ? (
                <Pressable onPress={restore} hitSlop={8} accessibilityRole="button" disabled={!!busy}>
                  <Text className="text-dissolve-muted" style={st.link}>
                    {busy === 'restore' ? 'Restoring...' : 'Restore purchases'}
                  </Text>
                </Pressable>
              ) : null}
              {links?.map((l) => (
                <Pressable key={l.label} onPress={l.onPress} hitSlop={8} accessibilityRole="link">
                  <Text className="text-dissolve-muted" style={st.link}>
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>,
      )}

      {onClose ? (
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="bg-dissolve-surface"
          style={[st.close, { top: insets.top + 8 }]}
        >
          <Cross />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Any token or hex color as rgba(), the form Reanimated interpolates. Optional alpha override. */
function rgba(c: string, alpha?: number) {
  const [r, g, b, a] = toRGBA(c);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha ?? a})`;
}

/** A price as text, for the small lines (the big one is a NumberTicker). */
function formatPrice(n: number, f: PriceFormat = {}) {
  const decimals = f.decimals ?? 2;
  let s: string;
  try {
    s = new Intl.NumberFormat(f.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  } catch {
    s = n.toFixed(decimals);
  }
  return `${f.prefix ?? ''}${s}${f.suffix ?? ''}`;
}

type PlanCardProps = {
  plan: PaywallPlan;
  period: PaywallPeriod;
  selected: boolean;
  pickable: boolean;
  accent: string;
  format?: PriceFormat;
  unit: string;
  monthUnit: string;
  onPress: () => void;
};

function PlanCard({ plan, period, selected, pickable, accent, format, unit, monthUnit, onPress }: PlanCardProps) {
  const reduced = useReducedMotion();
  const border = rgba(useToken('border'));
  const on = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 260, easing: CALM });
  }, [selected, on]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [border, accent]),
    transform: [{ scale: reduced ? 1 : 1 - 0.015 * pressed.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scale: 0.4 + 0.6 * on.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(on.value, [0, 1], [border, accent]) }));

  const price = plan.price[period];
  const sub = period === 'year' ? `${formatPrice(plan.price.year / 12, format)}${monthUnit}, billed yearly` : 'Billed monthly';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (pressed.value = withSpring(1, SPRING))}
      onPressOut={() => (pressed.value = withSpring(0, SPRING))}
      disabled={!pickable}
      accessibilityRole={pickable ? 'radio' : undefined}
      accessibilityState={pickable ? { selected } : undefined}
      accessibilityLabel={`${plan.title}, ${formatPrice(price, format)}${unit}`}
    >
      <Animated.View className="bg-dissolve-surface" style={[st.card, cardStyle]}>
        {pickable ? (
          <Animated.View style={[st.radio, ringStyle]}>
            <Animated.View style={[st.radioDot, { backgroundColor: accent }, dotStyle]} />
          </Animated.View>
        ) : null}
        <View style={st.cardText}>
          <Text className="text-dissolve-foreground" style={st.planTitle} numberOfLines={1}>
            {plan.title}
          </Text>
          <Text className="text-dissolve-muted" style={st.planSub} numberOfLines={1}>
            {plan.description ?? sub}
          </Text>
          {plan.description ? (
            <Text className="text-dissolve-muted" style={st.planSub} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
        <View style={st.price}>
          <NumberTicker
            value={price}
            decimals={format?.decimals ?? 2}
            locale={format?.locale}
            prefix={format?.prefix}
            suffix={format?.suffix}
            fontSize={22}
            textClassName="font-bold"
          />
          <Text className="text-dissolve-muted" style={st.unit}>
            {unit}
          </Text>
        </View>
        {plan.badge ? (
          <View style={[st.planBadge, { backgroundColor: accent }]}>
            <Text style={st.planBadgeText}>{plan.badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/** Default hero: a rounded tile in the accent color with PRO on it, lit like the glossy button. */
function ProTile({ color }: { color: string }) {
  return (
    <View
      style={[
        st.tile,
        {
          backgroundColor: color,
          boxShadow: [
            { offsetX: 0, offsetY: 10, blurRadius: 24, color: 'rgba(0, 0, 0, 0.18)' },
            { offsetX: 0, offsetY: 0, blurRadius: 10, spreadDistance: 2, color: 'rgba(255, 255, 255, 0.28)', inset: true },
          ],
        },
      ]}
    >
      <Text style={st.tileText}>PRO</Text>
    </View>
  );
}

/** Feature bullet: a check in a soft accent disc. */
function Check({ color }: { color: string }) {
  return (
    <View style={[st.check, { backgroundColor: rgba(color, 0.14) }]}>
      <View style={[st.checkMark, { borderColor: color }]} />
    </View>
  );
}

/** Close glyph: two crossed bars. */
function Cross() {
  return (
    <View style={st.cross}>
      <View className="bg-dissolve-foreground" style={[st.crossBar, { transform: [{ rotate: '45deg' }] }]} />
      <View className="bg-dissolve-foreground" style={[st.crossBar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

const st = StyleSheet.create({
  header: { alignItems: 'center', gap: 12, paddingBottom: 28 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 16, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  features: { gap: 14, paddingBottom: 28, paddingHorizontal: 4 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: 16, lineHeight: 22, flex: 1 },
  plans: { gap: 12 },
  switch: { marginBottom: 6, paddingTop: 10 },
  saveBadge: { position: 'absolute', top: 0, paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: 'center', zIndex: 2 },
  saveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 18, borderCurve: 'continuous', borderWidth: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  cardText: { flex: 1, gap: 2 },
  planTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  planSub: { fontSize: 13, lineHeight: 18 },
  price: { alignItems: 'flex-end' },
  unit: { fontSize: 12, marginTop: -2 },
  planBadge: { position: 'absolute', top: -10, right: 16, paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: 'center' },
  planBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  bottom: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  note: { fontSize: 13, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 20, rowGap: 6, paddingTop: 2 },
  link: { fontSize: 13, fontWeight: '500' },
  close: { position: 'absolute', left: 16, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cross: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  crossBar: { position: 'absolute', width: 14, height: 2, borderRadius: 1 },
  tile: { width: 76, height: 76, borderRadius: 22, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  tileText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkMark: { width: 6, height: 11, borderRightWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }], marginTop: -3 },
});
