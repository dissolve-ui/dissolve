import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { ElasticSlider } from '@registry/elastic-slider';
import { View } from '@registry/tw';

const pct = (v: number) => `${v}%`;

/** A control card: volume and brightness, then a small stepped rating. Pull past the ends. */
export default function ElasticSliderDemo() {
  const [volume, setVolume] = useState(40);
  const [brightness, setBrightness] = useState(72);
  const [rating, setRating] = useState(7);
  return (
    <View style={st.root}>
      <ElasticSlider label="Volume" value={volume} onValueChange={setVolume} formatValue={pct} />
      <ElasticSlider label="Brightness" value={brightness} onValueChange={setBrightness} formatValue={pct} />
      <ElasticSlider label="Rating" min={0} max={10} value={rating} onValueChange={setRating} size="sm" />
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 14, paddingVertical: 48, paddingHorizontal: 8 },
});
