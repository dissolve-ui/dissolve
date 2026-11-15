import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve } from '@/dissolve';
import { Button, C, Caption, Stage } from '@/ui';
import { layout } from '@/ui';

const TASKS = [
  { id: '1', title: 'Record the demo video', tag: 'Launch' },
  { id: '2', title: 'Write the README', tag: 'Docs' },
  { id: '3', title: 'Pick a final name', tag: 'Brand' },
  { id: '4', title: 'Publish to npm', tag: 'Launch' },
  { id: '5', title: 'Post on X', tag: 'Launch' },
];

function Task({ task, onRemove }: { task: (typeof TASKS)[number]; onRemove: () => void }) {
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
            setTimeout(async () => { await dissolve({ preset: 'sand', duration: 1600 }); onRemove(); }, 280);
          }}
          style={[st.check, done && st.checked]}
        >
          {done ? <Text style={st.tick}>✓</Text> : null}
        </Pressable>
        <Text style={[st.title, done && st.titleDone]}>{task.title}</Text>
        <Text style={st.tag}>{task.tag}</Text>
      </View>
    </Animated.View>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState(TASKS);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Stage style={{ gap: 8, minHeight: 330 }}>
        {tasks.map((t) => (
          <Task key={t.id} task={t} onRemove={() => setTasks((l) => l.filter((x) => x.id !== t.id))} />
        ))}
      </Stage>
      <Caption>check a task · preset sand</Caption>
      <Button label="Reset" onPress={() => setTasks(TASKS)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: 'white' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#C9C9C9', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: C.dark, borderColor: C.dark },
  tick: { color: 'white', fontSize: 13, fontWeight: '700' },
  title: { flex: 1, fontSize: 15, color: C.ink },
  titleDone: { color: C.muted, textDecorationLine: 'line-through' },
  tag: { fontSize: 11, color: C.muted, fontFamily: 'Menlo' },
});
