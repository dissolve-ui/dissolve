import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { usePile, useDissolve } from '@/dissolve';
import { Button, C, Code, layout } from '@/ui';

const TODOS = [
  { id: '1', title: 'Water the plants', tag: 'Home' },
  { id: '2', title: 'Book the dentist', tag: 'Health' },
  { id: '3', title: 'Reply to Malo', tag: 'Friends' },
  { id: '4', title: 'Ship the playground', tag: 'Work' },
  { id: '5', title: 'Buy oat milk', tag: 'Home' },
];

function Todo({ todo, floor, onRemove }: { todo: (typeof TODOS)[number]; floor: React.RefObject<View | null>; onRemove: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  const [done, setDone] = useState(false);
  return (
    <Animated.View layout={layout} entering={FadeIn.duration(300)}>
      <View ref={ref} collapsable={false} style={[st.task, { opacity: dissolving ? 0 : 1 }]}>
        <Pressable
          hitSlop={10}
          disabled={done}
          onPress={() => {
            setDone(true);
            setTimeout(async () => {
              await dissolve({ preset: 'pile', floor });
              onRemove();
            }, 260);
          }}
          style={[st.check, done && st.checked]}
        >
          {done ? <Text style={st.tick}>✓</Text> : null}
        </Pressable>
        <Text style={[st.title, done && st.titleDone]}>{todo.title}</Text>
        <Text style={st.tag}>{todo.tag}</Text>
      </View>
    </Animated.View>
  );
}

export default function Pile() {
  const [todos, setTodos] = useState(TODOS);
  const floor = useRef<View>(null);
  const { sweepPile, clearPile } = usePile();

  // The heap lives in the global overlay: drop it when leaving the screen.
  useEffect(() => () => clearPile(), [clearPile]);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <View style={{ gap: 8 }}>
        {todos.map((t) => (
          <Todo key={t.id} todo={t} floor={floor} onRemove={() => setTodos((l) => l.filter((x) => x.id !== t.id))} />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Code title="pile">{`await dissolve({ preset: 'pile', floor: floorRef })\nawait sweepPile({ preset: 'dust', origin: 'left' })`}</Code>
      <View style={st.buttons}>
        <Button label="Sweep" onPress={() => sweepPile({ preset: 'dust', origin: 'left', haptics: true })} />
        <Button
          label="Reset"
          onPress={() => {
            clearPile();
            setTodos(TODOS);
          }}
        />
      </View>
      <View style={{ height: 200 }} />
      <View ref={floor} collapsable={false} style={st.floor} />
      <Text style={st.caption}>check a task · the sand piles up on the floor</Text>
    </View>
  );
}

const st = StyleSheet.create({
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: C.surface },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#C9C9C9', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: C.dark, borderColor: C.dark },
  tick: { color: 'white', fontSize: 13, fontWeight: '700' },
  title: { flex: 1, fontSize: 15, color: C.ink },
  titleDone: { color: C.muted, textDecorationLine: 'line-through' },
  tag: { fontSize: 11, color: C.muted, fontFamily: 'Menlo' },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 },
  floor: { height: 2, borderRadius: 1, backgroundColor: C.line },
  caption: { fontFamily: 'Menlo', fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 10, marginBottom: 20 },
});
