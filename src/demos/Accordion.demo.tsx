import { StyleSheet } from 'react-native';
import { Accordion } from '@registry/accordion';
import { View } from '@registry/tw';

const FAQ = [
  { value: 'own', title: 'Do I own the code?', content: 'Yes. The CLI copies the source into your app, so every curve, timing and padding is yours to change.' },
  { value: 'web', title: 'Does it run on the web?', content: 'Every component ships a React version on the same core, with the same props, look and timings.' },
  { value: 'theme', title: 'How does it follow dark mode?', content: 'Colors come from a handful of theme tokens. Change one and every component follows, light and dark.' },
  { value: 'a11y', title: 'Is it accessible?', content: 'Headers announce their expanded state, and closed sections are hidden from VoiceOver.' },
];

/** A short FAQ, one section open at a time. */
export default function AccordionDemo() {
  return (
    <View style={st.root}>
      <Accordion items={FAQ} defaultValue={['own']} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { paddingVertical: 32, paddingHorizontal: 8 },
});
