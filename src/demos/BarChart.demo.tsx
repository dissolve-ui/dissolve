import { useMemo, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BarChart, type BarDatum } from '@registry/bar-chart';
import { NumberTicker } from '@registry/number-ticker';
import { Animated, Pressable, Text, View } from '@registry/tw';
import { mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const PERIODS = ['Day', 'Week', 'Month'] as const;
type Period = (typeof PERIODS)[number];
const CATEGORIES = [
  { name: 'Groceries', className: 'bg-dissolve-chart-1' },
  { name: 'Dining', className: 'bg-dissolve-chart-2' },
  { name: 'Other', className: 'bg-dissolve-chart-3' },
];

/** Deterministic pseudo random, so the demo looks the same on every run. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const round = (v: number) => Math.round(v * 100) / 100;

const DATA: Record<Period, BarDatum[]> = {
  Day: Array.from({ length: 24 }, (_, h) => {
    const meal = h === 8 || h === 12 || h === 13 || h === 19 || h === 20;
    const awake = h >= 7 && h <= 22;
    return {
      label: `${h}h`,
      values: awake ? [round(h === 18 ? 46 : rand(h) * 6), round(meal ? 9 + rand(h + 40) * 18 : 0), round(rand(h + 80) * 4)] : [0, 0, 0],
    };
  }),
  Week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
    label,
    values: [round(18 + rand(i + 3) * 40), round(i >= 4 ? 30 + rand(i + 9) * 38 : 8 + rand(i + 9) * 14), round(4 + rand(i + 21) * 20)],
  })),
  Month: Array.from({ length: 30 }, (_, d) => ({
    label: String(d + 1),
    values: [round(rand(d + 100) * 52), round((d % 7 >= 4 ? 24 : 6) + rand(d + 200) * 26), round(rand(d + 300) * 18)],
  })),
};

const total = (d: BarDatum) => (d.values ?? []).reduce((a, b) => a + b, 0);
const euro = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function Segmented({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const seg = w / PERIODS.length;
  const thumb = useAnimatedStyle(() => ({ width: seg, transform: [{ translateX: x.value }] }));
  return (
    <View
      className="flex-row rounded-[10px] bg-dissolve-surface-2 p-[2px]"
      onLayout={(e: LayoutChangeEvent) => {
        const inner = e.nativeEvent.layout.width - 4;
        setW(inner);
        x.value = (PERIODS.indexOf(value) * inner) / PERIODS.length;
      }}
    >
      {w ? <Animated.View className="absolute bottom-[2px] left-[2px] top-[2px] rounded-[8px] bg-dissolve-background shadow-sm" style={thumb} /> : null}
      {PERIODS.map((p, i) => (
        <Pressable
          key={p}
          className="flex-1 items-center py-[6px]"
          onPress={() => {
            if (p === value) return;
            Haptics.selectionAsync();
            x.value = withTiming(i * seg, { duration: 320, easing: CALM });
            onChange(p);
          }}
        >
          <Text className={p === value ? 'text-dissolve-foreground' : 'text-dissolve-muted'} style={st.segText}>
            {p}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Spending card: scrub the bars, switch the period, the total follows the finger. */
export default function BarChartDemo() {
  const [period, setPeriod] = useState<Period>('Week');
  const [picked, setPicked] = useState<BarDatum | null>(null);
  const data = DATA[period];
  const sum = useMemo(() => data.reduce((a, d) => a + total(d), 0), [data]);
  const caption = picked ? (period === 'Day' ? `Today, ${picked.label}` : period === 'Week' ? picked.label : `Nov ${picked.label}`) : period === 'Day' ? 'Today' : period === 'Week' ? 'This week' : 'November';

  return (
    <View className="bg-dissolve-surface" style={st.card}>
      <Segmented value={period} onChange={setPeriod} />
      <Text className="text-dissolve-muted" style={st.kicker}>
        SPENT · {caption.toUpperCase()}
      </Text>
      <NumberTicker value={picked ? total(picked) : sum} decimals={0} locale="en-US" prefix="$" fontSize={34} duration={420} textClassName="font-bold tracking-[-0.8px]" className="mt-[4px]" />

      <BarChart
        data={data}
        stacked
        height={160}
        formatValue={euro}
        formatAxis={(v) => `${v}`}
        onSelect={(_, d) => setPicked(d ?? null)}
        className="mt-[6px]"
      />

      <View style={st.legend}>
        {CATEGORIES.map((c) => (
          <View key={c.name} style={st.legendItem}>
            <View className={c.className} style={st.dot} />
            <Text className="text-dissolve-muted" style={st.legendText}>
              {c.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 22, padding: 18 },
  segText: { fontSize: 13, fontWeight: '600' },
  kicker: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4, marginTop: 18 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '500' },
});
