import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { TaskCheck } from '@registry/task-check';
import { Pressable, Text, View } from '@registry/tw';
import { Chip, mono } from '../ui';

const CALM = Easing.bezier(0.32, 0.72, 0, 1);
const layout = LinearTransition.duration(360).easing(CALM);
const enter = FadeIn.duration(260).easing(CALM);
const exit = FadeOut.duration(160).easing(CALM);

type Item = { id: string; label: string; done: boolean; settled: boolean };

const LIST: Item[] = [
  { id: '1', label: 'Oat milk, the barista one', done: false, settled: false },
  { id: '2', label: 'Sourdough from the bakery on the corner, ask for it sliced', done: false, settled: false },
  { id: '3', label: 'Lemons', done: false, settled: false },
  { id: '4', label: 'Parmigiano, 24 months', done: false, settled: false },
  { id: '5', label: 'Basil', done: true, settled: true },
];

type Mode = 'move' | 'dissolve';

/**
 * A grocery list. Check an item: the box fills, the label is struck through, then after a beat
 * it moves to "In the basket" (move) or blows away as dust (dissolve). Tap again quickly to undo.
 */
export default function TaskCheckDemo() {
  const [mode, setMode] = useState<Mode>('move');
  const [items, setItems] = useState(LIST);

  const patch = (id: string, p: Partial<Item>) => setItems((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const toggle = (id: string, done: boolean) => patch(id, done ? { done } : { done, settled: false });
  const settle = (id: string) => (mode === 'move' ? patch(id, { settled: true }) : setItems((all) => all.filter((x) => x.id !== id)));

  const todo = items.filter((x) => !x.settled);
  const basket = items.filter((x) => x.settled);
  const pristine = items.length === LIST.length && items.every((x, i) => x.done === LIST[i].done && x.settled === LIST[i].settled);

  const row = (x: Item) => (
    <Animated.View key={x.id} layout={layout} entering={enter} exiting={exit}>
      <TaskCheck
        label={x.label}
        checked={x.done}
        onCheckedChange={(v) => toggle(x.id, v)}
        after={x.settled ? 'stay' : mode}
        onSettled={() => settle(x.id)}
        className="border-b border-dissolve-border"
      />
    </Animated.View>
  );

  return (
    <View className="bg-dissolve-background" style={st.screen}>
      <View style={st.head}>
        <Text className="text-dissolve-foreground" style={st.title}>
          Groceries
        </Text>
        <Text className="text-dissolve-muted" style={st.count}>
          {todo.length} left
        </Text>
      </View>
      <View style={st.chips}>
        <Chip label="Move to basket" active={mode === 'move'} onPress={() => setMode('move')} />
        <Chip label="Dissolve" active={mode === 'dissolve'} onPress={() => setMode('dissolve')} />
      </View>

      <View style={st.list}>{todo.map(row)}</View>

      {basket.length ? (
        <Animated.View layout={layout} entering={enter} style={st.section}>
          <Text className="text-dissolve-muted" style={st.kicker}>
            IN THE BASKET
          </Text>
          {basket.map(row)}
        </Animated.View>
      ) : null}

      <Animated.View layout={layout} style={st.footer}>
        {!pristine ? (
          <Pressable onPress={() => setItems(LIST)} hitSlop={8} className="border-dissolve-border bg-dissolve-surface active:opacity-60" style={st.reset}>
            <Text className="text-dissolve-foreground" style={st.resetText}>
              Reset list
            </Text>
          </Pressable>
        ) : (
          <Text className="text-dissolve-muted" style={st.hint}>
            tap an item · tap again to undo
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { paddingHorizontal: 18, paddingVertical: 18 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  count: { fontFamily: mono, fontSize: 12 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 6 },
  list: {},
  section: { marginTop: 22 },
  kicker: { fontFamily: mono, fontSize: 11, letterSpacing: 0.4, marginBottom: 2 },
  footer: { alignItems: 'center', marginTop: 20 },
  hint: { fontFamily: mono, fontSize: 11, letterSpacing: 0.2 },
  reset: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 7 },
  resetText: { fontSize: 13, fontWeight: '500' },
});
