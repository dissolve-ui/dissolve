import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AvatarStack, type AvatarStackItem } from '@registry/avatar-stack';
import { Text, View } from '@registry/tw';

const PEOPLE: AvatarStackItem[] = [
  { id: 'ava', name: 'Ava Chen', src: require('../../assets/paintings/temple.jpg') },
  { id: 'ben', name: 'Ben Ortiz' },
  { id: 'chloe', name: 'Chloe Martin', src: require('../../assets/paintings/cypress.jpg') },
  { id: 'dev', name: 'Dev Patel' },
  { id: 'elena', name: 'Elena Rossi', src: require('../../assets/paintings/lake.jpg') },
  { id: 'farid', name: 'Farid Haddad' },
  { id: 'grace', name: 'Grace Kim', src: require('../../assets/paintings/villa.jpg') },
  { id: 'hugo', name: 'Hugo Laurent' },
];

/** A team: hold the stack to read the names, Add and Remove to watch it make room. */
export default function AvatarStackDemo() {
  const [n, setN] = useState(5);
  return (
    <View style={st.root}>
      <View style={st.stage}>
        <AvatarStack avatars={PEOPLE.slice(0, n)} size="lg" />
      </View>
      <View style={st.buttons}>
        <Pressable accessibilityRole="button" disabled={n <= 1} onPress={() => setN((k) => Math.max(1, k - 1))} style={({ pressed }) => ({ opacity: n <= 1 ? 0.4 : pressed ? 0.7 : 1 })}>
          <View className="bg-dissolve-surface" style={st.btn}>
            <Text className="text-dissolve-foreground" style={st.btnText}>
              Remove
            </Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={n >= PEOPLE.length} onPress={() => setN((k) => Math.min(PEOPLE.length, k + 1))} style={({ pressed }) => ({ opacity: n >= PEOPLE.length ? 0.4 : pressed ? 0.7 : 1 })}>
          <View className="bg-dissolve-primary" style={st.btn}>
            <Text className="text-dissolve-primary-foreground" style={st.btnText}>
              Add
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 36, paddingTop: 72, paddingBottom: 40 },
  stage: { alignItems: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  btn: { height: 40, minWidth: 96, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
