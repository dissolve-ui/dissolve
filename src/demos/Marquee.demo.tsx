import { StyleSheet } from 'react-native';
import { Marquee } from '@registry/marquee';
import { Text, View } from '@registry/tw';

const QUOTES = [
  ['The calmest app on my phone.', 'Maya Ruiz'],
  ['I stopped dreading Monday planning.', 'Tom Becker'],
  ['Feels like it was always part of iOS.', 'Lena Park'],
  ['Set up in a minute, used every day since.', 'Sam Okafor'],
  ['Quiet, fast, and it never nags.', 'Inès Moreau'],
];
const FEATURES = ['Offline first', 'End to end encrypted', 'Home Screen widgets', 'Apple Watch', 'Family sharing', 'No ads, ever', 'iCloud sync', 'Dark mode'];

/** What people say about an app, and under it what the app does, drifting the other way, slower. Press to stop, drag to scrub. */
export default function MarqueeDemo() {
  return (
    <View style={st.root}>
      <Marquee speed={36} fade={40} accessibilityLabel="What people say">
        {QUOTES.map(([q, who]) => (
          <View key={who} className="bg-dissolve-surface" style={st.quote}>
            <Text className="text-dissolve-foreground" style={st.text}>{q}</Text>
            <Text className="text-dissolve-muted" style={st.who}>{who}</Text>
          </View>
        ))}
      </Marquee>
      <Marquee speed={24} gap={8} direction="right" fade={40} accessibilityLabel="Features">
        {FEATURES.map((f) => (
          <View key={f} className="bg-dissolve-surface" style={st.pill}>
            <Text className="text-dissolve-foreground" style={st.pillText}>{f}</Text>
          </View>
        ))}
      </Marquee>
    </View>
  );
}

const st = StyleSheet.create({
  root: { paddingVertical: 48, gap: 16 },
  quote: { width: 248, alignSelf: 'stretch', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16 },
  text: { fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  who: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  pillText: { fontSize: 15 },
});
