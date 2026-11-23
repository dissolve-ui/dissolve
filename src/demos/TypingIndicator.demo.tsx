import { useState } from 'react';
import { Pressable } from 'react-native';
import { Text, View, useToken } from '@registry/tw';
import { TypingIndicator, initials, type Typer } from '@registry/typing-indicator';

const THREAD = [
  { name: 'Ana', text: 'Landed! Grabbing my bag now.' },
  { name: 'Ben', text: 'Table for four at 8 still works?' },
  { name: 'Chloe', text: 'Running ten minutes late, order without me' },
];
const PEOPLE: Typer[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'ben', name: 'Ben' },
  { id: 'chloe', name: 'Chloe' },
  { id: 'dev', name: 'Dev' },
  { id: 'eli', name: 'Eli' },
];

function Disc({ name, on }: { name: string; on?: boolean }) {
  const bg = useToken(on ? 'background' : 'surface-2');
  const fg = useToken('foreground');
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: fg }}>{initials(name)}</Text>
    </View>
  );
}

/** The end of a group thread, the indicator under it and the five people of the group as toggles: tap someone to make them start or stop typing. */
export default function TypingIndicatorDemo() {
  const [typing, setTyping] = useState<Typer[]>([]);
  const fg = useToken('foreground');
  const bg = useToken('background');
  const surface = useToken('surface');
  const toggle = (p: Typer) => setTyping((t) => (t.some((x) => x.id === p.id) ? t.filter((x) => x.id !== p.id) : [...t, p]));
  return (
    <View className="flex-1 bg-dissolve-background" style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
      <View className="flex-1 justify-center" style={{ gap: 10, width: '100%', maxWidth: 340, alignSelf: 'center' }}>
        {THREAD.map((m) => (
          <View key={m.name}>
            <Text className="text-dissolve-muted" style={{ fontSize: 12, lineHeight: 16, marginLeft: 48, marginBottom: 3 }}>{m.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Disc name={m.name} />
              <View className="bg-dissolve-surface" style={{ maxWidth: 250, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18 }}>
                <Text className="text-dissolve-foreground" style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.2 }}>{m.text}</Text>
              </View>
            </View>
          </View>
        ))}
        <View style={{ marginTop: 6, minHeight: 58 }}>
          <TypingIndicator typers={typing} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 340, alignSelf: 'center' }} accessibilityLabel="Who is typing">
        {PEOPLE.map((p) => {
          const on = typing.some((t) => t.id === p.id);
          return (
            <Pressable key={p.id} onPress={() => toggle(p)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={`${p.name} typing`}>
              {({ pressed }) => (
                <View style={{ backgroundColor: on ? fg : surface, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 16, borderRadius: 22, transform: [{ scale: pressed ? 0.96 : 1 }] }}>
                  <Disc name={p.name} on={on} />
                  <Text style={{ fontSize: 15, fontWeight: '500', color: on ? bg : fg }}>{p.name}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
