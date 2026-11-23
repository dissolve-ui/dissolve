/**
 * NumberTicker, from dissolve (dissolve-ui). This file is yours: restyle it with
 * classNames, change the timings, anything. Colors come from the dissolve theme tokens
 * (global.css), so it follows light and dark mode out of the box.
 *
 * Animated number for prices, balances and counters. Every digit is a clipped column that rolls
 * to its new value on a calm iOS curve, right to left with a slight stagger. Columns roll like an
 * odometer, in the direction the number moves: 9 to 10 turns the units one step forward instead
 * of spinning back through 8..1, and a new value arriving mid roll carries on from where the
 * column is, so fast changes (a held stepper) never flash stale digits.
 * Added digits open in, removed ones fold out, so the layout never jumps.
 *
 * <NumberTicker value={1240.5} decimals={2} locale="fr-FR" suffix={' €'} fontSize={44} />
 * <NumberTicker value={balance} decimals={2} prefix="$" textClassName="text-dissolve-success" />
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, TextStyle } from 'react-native';
import { useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { Animated, Text, View, cn } from './tw';
import { CALM } from './motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** Two turns of the wheel plus a closing 0, so a column can roll either way from any digit. */
const WHEEL = Array.from({ length: 21 }, (_, i) => DIGITS[i % 10]);
const MINUS = '−';
/** Extra room given to each glyph inside its clipped column, so fractional advances never clip. */
const SLACK = 6;

export type NumberTickerProps = {
  value: number;
  /** Digits after the decimal separator. Default 0. */
  decimals?: number;
  /** Locale used to pick the separators, e.g. 'fr-FR' gives "1 240,50", 'en-US' "1,240.50". */
  locale?: string;
  /** Overrides the locale thousands separator. Pass '' to turn grouping off. */
  separator?: string;
  /** Overrides the locale decimal separator. */
  decimalSeparator?: string;
  /** Static text before the number, e.g. '$'. */
  prefix?: string;
  /** Static text after the number, e.g. ' €' (no break space). */
  suffix?: string;
  /** Font size in points (drives the row height). Default 34. */
  fontSize?: number;
  /** Roll duration in ms. Default 700. */
  duration?: number;
  /** Delay between two columns, right to left, in ms. Default 28. */
  stagger?: number;
  /** Tabular figures, so digits never change width. Default true. */
  tabular?: boolean;
  /** Root classes (margins, alignment...). */
  className?: string;
  /** Number classes (color, weight, family...). Default text-dissolve-foreground font-semibold. */
  textClassName?: string;
  /** Prefix and suffix classes, added on top of the number classes. */
  affixClassName?: string;
};

type Kind = 'digit' | 'sym';
type Cell = { key: string; char: string; kind: Kind; order: number };
type Item = Cell & { present: boolean; leftAt: number; fresh: boolean };

/** Thousands and decimal separators for a locale, read from Intl with a safe fallback. */
function separatorsFor(locale?: string) {
  try {
    const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: true }).format(12345.6);
    const marks = s.replace(/[0-9]/g, '');
    if (marks.length >= 2) return { group: marks[0], decimal: marks[marks.length - 1] };
    if (marks.length === 1) return { group: '', decimal: marks[0] };
  } catch {}
  return { group: ',', decimal: '.' };
}

/**
 * Cells keyed by their place, not their index: the units column stays the units column when
 * the number grows, so only the new leading digits enter and the rest roll in place.
 */
function toCells(value: number, decimals: number, group: string, decimal: string): Cell[] {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [int, frac = ''] = fixed.split('.');
  const negative = safe < 0 && Number(fixed) !== 0;
  const cells: Cell[] = [];
  if (negative) cells.push({ key: 'sign', char: MINUS, kind: 'sym', order: -1e6 });
  for (let i = 0; i < int.length; i++) {
    const place = int.length - 1 - i;
    if (group && place < int.length - 1 && (place + 1) % 3 === 0) {
      cells.push({ key: `g${place + 1}`, char: group, kind: 'sym', order: -(place + 1) * 2 + 1 });
    }
    cells.push({ key: `i${place}`, char: int[i], kind: 'digit', order: -place * 2 });
  }
  if (decimals > 0) {
    cells.push({ key: 'dec', char: decimal, kind: 'sym', order: 1 });
    for (let i = 0; i < frac.length; i++) cells.push({ key: `f${i}`, char: frac[i], kind: 'digit', order: 2 + i });
  }
  return cells.sort((a, b) => a.order - b.order);
}

type Look = { className: string; style: TextStyle };

function Column({ item, width, lineHeight, look, delay, duration, dir }: { item: Item; width: number; lineHeight: number; look: Look; delay: number; duration: number; dir: number }) {
  const digit = item.kind === 'digit' ? Number(item.char) : 0;
  // New columns open from nothing and roll up from zero, leaving ones roll back to zero.
  const shown = item.present ? digit : 0;
  // Wheel position in digits (0..20). The row at index i shows i % 10.
  const pos = useSharedValue(item.fresh ? 0 : shown);
  const w = useSharedValue(item.fresh ? 0 : width);
  const o = useSharedValue(item.fresh ? 0 : 1);

  useEffect(() => {
    const cfg = { duration, easing: CALM };
    const up = dir >= 0;
    scheduleOnUI(() => {
      'worklet';
      // Re-base the wheel on the turn that leaves room in the direction of travel (same digit on
      // screen, no visual change), then roll the short way that way. Picks up mid roll.
      let c = pos.value % 10;
      if (!up) c += 10;
      pos.value = c;
      const to = up ? (shown >= c - 0.5 ? shown : shown + 10) : shown + 10 <= c + 0.5 ? shown + 10 : shown;
      pos.value = withDelay(delay, withTiming(to, cfg));
    });
    w.value = withDelay(item.present ? 0 : delay, withTiming(item.present ? width : 0, cfg));
    o.value = withDelay(item.present ? delay : 0, withTiming(item.present ? 1 : 0, { duration: duration * 0.6, easing: CALM }));
  }, [shown, dir, item.present, width, delay, duration, pos, w, o]);

  const box = useAnimatedStyle(() => ({ width: w.value, opacity: o.value }));
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: -pos.value * lineHeight }] }));
  const cell = { width: width + SLACK, marginLeft: -SLACK / 2, lineHeight, height: lineHeight };
  const cls = cn(look.className, 'text-center');

  // The wheel is decoration: the root's accessibilityLabel carries the value.
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
  if (item.kind === 'sym') {
    return (
      <Animated.View {...hidden} className="overflow-hidden" style={[{ height: lineHeight }, box]}>
        <Text numberOfLines={1} className={cls} style={[look.style, cell]}>
          {item.char}
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View {...hidden} className="overflow-hidden" style={[{ height: lineHeight }, box]}>
      <Animated.View style={[{ height: lineHeight * WHEEL.length }, roll]}>
        {/* One text per digit at an exact offset: a single multi line text drifts on device,
            because iOS rounds every line box and the error adds up down the wheel. */}
        {WHEEL.map((d, i) => (
          <WheelCell key={i} index={i} pos={pos} className={cls} style={[look.style, cell, { position: 'absolute', top: i * lineHeight, left: 0 }]}>
            {d}
          </WheelCell>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * One digit of the wheel. Only the cells within one step of the window are drawn; the rest of the
 * wheel is transparent, so it is not picked up as content. Follows the roll on the UI thread.
 */
function WheelCell({ index, pos, className, style, children }: { index: number; pos: SharedValue<number>; className: string; style: StyleProp<TextStyle>; children: string }) {
  const near = useAnimatedStyle(() => ({ opacity: index >= Math.floor(pos.value) - 1 && index <= Math.ceil(pos.value) + 1 ? 1 : 0 }));
  return (
    <Animated.Text numberOfLines={1} className={className} style={[style, near]}>
      {children}
    </Animated.Text>
  );
}

/** Measures one glyph with the exact text style, off screen. */
function Probe({ char, look, onWidth }: { char: string; look: Look; onWidth: (c: string, w: number) => void }) {
  return (
    <Text className={cn(look.className, 'absolute left-0 top-0 opacity-0')} style={look.style} onLayout={(e: LayoutChangeEvent) => onWidth(char, e.nativeEvent.layout.width)}>
      {char}
    </Text>
  );
}

export function NumberTicker({
  value,
  decimals = 0,
  locale,
  separator,
  decimalSeparator,
  prefix,
  suffix,
  fontSize = 34,
  duration = 700,
  stagger = 28,
  tabular = true,
  className,
  textClassName,
  affixClassName,
}: NumberTickerProps) {
  const seps = useMemo(() => separatorsFor(locale), [locale]);
  const group = separator ?? seps.group;
  const decimal = decimalSeparator ?? seps.decimal;
  const lineHeight = Math.round(fontSize * 1.22);
  const look = useMemo<Look>(
    () => ({
      className: cn('font-semibold text-dissolve-foreground', textClassName),
      style: { fontSize, letterSpacing: -fontSize * 0.01, fontVariant: tabular ? ['tabular-nums'] : undefined, includeFontPadding: false },
    }),
    [fontSize, textClassName, tabular],
  );
  // Width of every glyph we may draw, measured with the real text style. Re-measured when
  // the style or the classes change (the signature resets the probes).
  const signature = `${look.className}|${JSON.stringify(look.style)}`;
  const glyphs = useMemo(() => [...DIGITS, group, decimal, MINUS].filter(Boolean), [group, decimal]);
  const [widths, setWidths] = useState<{ sig: string; map: Record<string, number> }>({ sig: '', map: {} });
  const onWidth = (c: string, w: number) =>
    setWidths((prev) => {
      const base = prev.sig === signature ? prev.map : {};
      if (base[c] === w) return prev;
      return { sig: signature, map: { ...base, [c]: w } };
    });
  const map = widths.sig === signature ? widths.map : {};
  const ready = glyphs.every((g) => map[g] != null);
  const digitW = Math.max(0, ...DIGITS.map((d) => map[d] ?? 0));

  // Direction of the last change (in magnitude, the columns show digits), so every column rolls
  // the way the number moves.
  const last = useRef(value);
  const dirRef = useRef(1);
  if (value !== last.current) {
    if (Number.isFinite(value) && Number.isFinite(last.current)) dirRef.current = Math.abs(value) >= Math.abs(last.current) ? 1 : -1;
    last.current = value;
  }
  const dir = dirRef.current;

  // Union of the current cells and the ones still folding out.
  const prev = useRef<Item[]>([]);
  const mounted = useRef(false);
  const [tick, setTick] = useState(0);
  const items = useMemo(() => {
    const now = Date.now();
    const cells = toCells(value, decimals, group, decimal);
    const keys = new Set(cells.map((c) => c.key));
    const old = new Map(prev.current.map((p) => [p.key, p]));
    const next: Item[] = cells.map((c) => ({ ...c, present: true, leftAt: 0, fresh: mounted.current && !old.get(c.key)?.present }));
    for (const p of prev.current) {
      if (keys.has(p.key)) continue;
      const leftAt = p.present ? now : p.leftAt;
      if (now - leftAt < duration + 400) next.push({ ...p, present: false, leftAt, fresh: false });
    }
    return next.sort((a, b) => a.order - b.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, group, decimal, tick, duration]);

  useEffect(() => {
    prev.current = items;
    // Columns on screen at the first measured render are the rest pose, they do not open.
    if (ready) mounted.current = true;
    if (items.some((i) => !i.present)) {
      const t = setTimeout(() => setTick((n) => n + 1), duration + 450);
      return () => clearTimeout(t);
    }
  }, [items, duration, ready]);

  // Right to left stagger over the digit columns that are on screen.
  const delays = useMemo(() => {
    const out: Record<string, number> = {};
    let rank = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      out[items[i].key] = Math.min(rank, 8) * stagger;
      if (items[i].kind === 'digit') rank++;
    }
    return out;
  }, [items, stagger]);

  const digits = items
    .filter((i) => i.present)
    .map((i) => i.char)
    .join('');
  const label = `${prefix ?? ''}${digits}${suffix ?? ''}`;
  const affix = cn(look.className, affixClassName);

  return (
    <View className={cn('flex-row items-center self-start', className)} accessible accessibilityRole="text" accessibilityLabel={label}>
      {glyphs.map((g) => (
        <Probe key={`${signature}${g}`} char={g} look={look} onWidth={onWidth} />
      ))}
      {prefix ? (
        <Text className={affix} style={[look.style, { lineHeight }]}>
          {prefix}
        </Text>
      ) : null}
      {ready ? (
        items.map((it) => (
          <Column
            key={it.key}
            item={it}
            width={it.kind === 'digit' ? digitW : (map[it.char] ?? 0)}
            lineHeight={lineHeight}
            look={look}
            delay={delays[it.key] ?? 0}
            duration={duration}
            dir={dir}
          />
        ))
      ) : (
        // First frame, before the probes report: plain text, same metrics, no flash.
        <Text className={look.className} style={[look.style, { lineHeight }]}>
          {digits}
        </Text>
      )}
      {suffix ? (
        <Text className={affix} style={[look.style, { lineHeight }]}>
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}
