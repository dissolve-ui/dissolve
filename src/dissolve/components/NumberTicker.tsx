import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const MINUS = '\u2212';
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
  /** Static text after the number, e.g. '\u00A0€' (no break space). */
  suffix?: string;
  fontSize?: number;
  color?: string;
  /** Extra text style (fontWeight, fontFamily, letterSpacing...). */
  textStyle?: StyleProp<TextStyle>;
  /** Style of the prefix and suffix, defaults to the number style. */
  affixStyle?: StyleProp<TextStyle>;
  /** Roll duration in ms. Default 700. */
  duration?: number;
  /** Delay between two columns, right to left, in ms. Default 28. */
  stagger?: number;
  /** Tabular figures, so digits never change width. Default true. */
  tabular?: boolean;
  style?: StyleProp<ViewStyle>;
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

function Column({ item, width, lineHeight, text, delay, duration }: { item: Item; width: number; lineHeight: number; text: StyleProp<TextStyle>; delay: number; duration: number }) {
  const digit = item.kind === 'digit' ? Number(item.char) : 0;
  // New columns open from nothing and roll up from zero, leaving ones roll back to zero.
  const shown = item.present ? digit : 0;
  const y = useSharedValue(item.fresh ? 0 : -shown * lineHeight);
  const w = useSharedValue(item.fresh ? 0 : width);
  const o = useSharedValue(item.fresh ? 0 : 1);

  useEffect(() => {
    const cfg = { duration, easing: CALM };
    y.value = withDelay(delay, withTiming(-shown * lineHeight, cfg));
    w.value = withDelay(item.present ? 0 : delay, withTiming(item.present ? width : 0, cfg));
    o.value = withDelay(item.present ? delay : 0, withTiming(item.present ? 1 : 0, { duration: duration * 0.6, easing: CALM }));
  }, [shown, item.present, width, lineHeight, delay, duration, y, w, o]);

  const box = useAnimatedStyle(() => ({ width: w.value, opacity: o.value }));
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (item.kind === 'sym') {
    return (
      <Animated.View style={[s.clip, { height: lineHeight }, box]}>
        <Text numberOfLines={1} style={[text, s.cell, { width: width + SLACK, marginLeft: -SLACK / 2, lineHeight, height: lineHeight }]}>
          {item.char}
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[s.clip, { height: lineHeight }, box]}>
      <Animated.View style={roll}>
        {DIGITS.map((d) => (
          <Text key={d} numberOfLines={1} style={[text, s.cell, { width: width + SLACK, marginLeft: -SLACK / 2, lineHeight, height: lineHeight }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/** Measures one glyph with the exact text style, off screen. */
function Probe({ char, text, onWidth }: { char: string; text: StyleProp<TextStyle>; onWidth: (c: string, w: number) => void }) {
  return (
    <Text style={[text, s.probe]} onLayout={(e: LayoutChangeEvent) => onWidth(char, e.nativeEvent.layout.width)}>
      {char}
    </Text>
  );
}

/**
 * Animated number for prices, balances and counters. Every digit is a clipped 0 to 9 column
 * that rolls to its new value on a calm iOS curve, right to left with a slight stagger.
 * Added digits open in, removed ones fold out, so the layout never jumps.
 *
 * <NumberTicker value={1240.5} decimals={2} locale="fr-FR" suffix={'\u00A0€'} fontSize={44} />
 * <NumberTicker value={balance} decimals={2} prefix="$" />
 */
export function NumberTicker({
  value,
  decimals = 0,
  locale,
  separator,
  decimalSeparator,
  prefix,
  suffix,
  fontSize = 34,
  color = '#1C1C1E',
  textStyle,
  affixStyle,
  duration = 700,
  stagger = 28,
  tabular = true,
  style,
}: NumberTickerProps) {
  const seps = useMemo(() => separatorsFor(locale), [locale]);
  const group = separator ?? seps.group;
  const decimal = decimalSeparator ?? seps.decimal;
  const lineHeight = Math.round(fontSize * 1.22);
  const text = useMemo<StyleProp<TextStyle>>(
    () => [{ fontSize, color, fontWeight: '600', letterSpacing: -fontSize * 0.01 }, textStyle, { fontVariant: tabular ? ['tabular-nums'] : undefined, includeFontPadding: false }],
    [fontSize, color, textStyle, tabular],
  );
  // Width of every glyph we may draw, measured with the real text style. Re-measured when
  // the style changes (the signature resets the probes).
  const signature = JSON.stringify(StyleSheet.flatten(text));
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

  return (
    <View style={[s.row, style]} accessible accessibilityRole="text" accessibilityLabel={label}>
      {glyphs.map((g) => (
        <Probe key={`${signature}${g}`} char={g} text={text} onWidth={onWidth} />
      ))}
      {prefix ? <Text style={[text, { lineHeight }, affixStyle]}>{prefix}</Text> : null}
      {ready ? (
        items.map((it) => (
          <Column
            key={it.key}
            item={it}
            width={it.kind === 'digit' ? digitW : (map[it.char] ?? 0)}
            lineHeight={lineHeight}
            text={text}
            delay={delays[it.key] ?? 0}
            duration={duration}
          />
        ))
      ) : (
        // First frame, before the probes report: plain text, same metrics, no flash.
        <Text style={[text, { lineHeight }]}>{digits}</Text>
      )}
      {suffix ? <Text style={[text, { lineHeight }, affixStyle]}>{suffix}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  clip: { overflow: 'hidden' },
  cell: { textAlign: 'center' },
  probe: { position: 'absolute', opacity: 0, left: 0, top: 0 },
});
