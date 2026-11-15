import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { WheelPicker, WheelPickerGroup } from '../dissolve/components/WheelPicker';
import { C, mono } from '../ui';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const PERIODS = ['AM', 'PM'];
const HOURS24 = Array.from({ length: 24 }, (_, i) => String(i));
const MIN60 = Array.from({ length: 60 }, (_, i) => String(i));

function Panel({ icon, title, value, children }: { icon: SFSymbol; title: string; value: string; children: ReactNode }) {
  return (
    <View style={st.card}>
      <View style={st.head}>
        <View style={st.icon}>
          <SymbolView name={icon} size={16} tintColor={C.dark} />
        </View>
        <Text style={st.title}>{title}</Text>
        <Text style={st.value}>{value}</Text>
      </View>
      {children}
    </View>
  );
}

/** An alarm time (three wheels, one band) and a timer duration with static units. */
export default function WheelPickerDemo() {
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(30);
  const [period, setPeriod] = useState(0);
  const [dh, setDh] = useState(0);
  const [dm, setDm] = useState(25);

  const alarm = `${HOURS12[hour]}:${MINUTES[minute]} ${PERIODS[period]}`;
  const timer = useMemo(() => (dh ? `${dh} h ${pad(dm)} min` : `${dm} min`), [dh, dm]);

  return (
    <View style={{ gap: 12 }}>
      <Panel icon="alarm.fill" title="Wake up" value={alarm}>
        <WheelPickerGroup style={st.group}>
          <WheelPicker items={HOURS12} defaultIndex={hour} onChange={setHour} align="right" style={{ flexGrow: 1.1 }} />
          <WheelPicker items={MINUTES} defaultIndex={minute} onChange={setMinute} align="center" style={{ flexGrow: 0.8 }} />
          <WheelPicker items={PERIODS} defaultIndex={period} onChange={setPeriod} align="left" style={{ flexGrow: 1.1 }} />
        </WheelPickerGroup>
      </Panel>

      <Panel icon="timer" title="Focus timer" value={timer}>
        <WheelPickerGroup style={st.group}>
          <WheelPicker items={HOURS24} defaultIndex={dh} onChange={setDh} align="right" label="hours" />
          <WheelPicker items={MIN60} defaultIndex={dm} onChange={setDm} align="right" label="min" />
        </WheelPickerGroup>
      </Panel>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 16, paddingBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  icon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: C.dark, flex: 1 },
  value: { fontFamily: mono, fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] },
  group: { marginHorizontal: 4 },
});
