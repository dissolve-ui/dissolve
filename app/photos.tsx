import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useDissolve } from '@/dissolve';
import { Button, Caption } from '@/ui';
import { layout } from '@/ui';

const IDS = ['10', '15', '17', '25', '28', '29', '37', '42', '48', '54', '64', '76'];

function Photo({ id, size, onRemove }: { id: string; size: number; onRemove: () => void }) {
  const { ref, dissolving, dissolve } = useDissolve();
  return (
    <Animated.View layout={layout} entering={FadeIn.duration(300)}>
      <Pressable disabled={dissolving} onPress={async () => { await dissolve({ preset: 'pixel', duration: 1100 }); onRemove(); }}>
        <View ref={ref} collapsable={false} style={{ opacity: dissolving ? 0 : 1 }}>
          <Image source={`https://picsum.photos/id/${id}/400/400`} style={[st.photo, { width: size, height: size }]} transition={200} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function Photos() {
  const [ids, setIds] = useState(IDS);
  const { width } = useWindowDimensions();
  const gap = 4;
  const size = (width - 32 - gap * 2) / 3;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {ids.map((id) => (
          <Photo key={id} id={id} size={size} onRemove={() => setIds((l) => l.filter((x) => x !== id))} />
        ))}
      </View>
      <Caption>tap a photo · preset pixel</Caption>
      <View style={{ height: 16 }} />
      <Button label="Reset" onPress={() => setIds(IDS)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({ photo: { borderRadius: 6, backgroundColor: '#EEE' } });
