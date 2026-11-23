import { ScrollView, StyleSheet } from 'react-native';
import { PagerTabs } from '@registry/pager-tabs';
import { Text, View } from '@registry/tw';

const TOPICS: Record<string, [string, string][]> = {
  'For you': [['The quiet return of the corner shop', 'Cities, 6 min'], ['Why bread needs a cold night', 'Food, 4 min'], ['A walk along the old canal', 'Travel, 9 min'], ['Designing for one hand', 'Design, 5 min'], ['Ten books for a long train', 'Books, 3 min']],
  Following: [['Maya Chen on studio light', 'Interview, 8 min'], ['Theo Martin bakes again', 'Notes, 2 min'], ['Ines Duval: cities on foot', 'Essay, 11 min'], ['Sam Okafor runs the river', 'Diary, 3 min']],
  Design: [['Designing for one hand', '5 min'], ['Grey is a color too', '4 min'], ['The case for smaller kitchens', '7 min'], ['Type that reads at night', '6 min']],
  Cities: [['The quiet return of the corner shop', '6 min'], ['Benches, and who they are for', '5 min'], ['Mapping the shade', '8 min'], ['Night buses of Lyon', '4 min']],
  Food: [['Why bread needs a cold night', '4 min'], ['Soup for a whole week', '3 min'], ['The market at nine', '5 min'], ['Coffee without the gear', '6 min']],
  Travel: [['A walk along the old canal', '9 min'], ['Trains over planes, a year in', '12 min'], ['Packing for four days', '3 min'], ['Islands out of season', '7 min']],
  Books: [['Ten books for a long train', '3 min'], ['Reading slowly on purpose', '6 min'], ['Essays on walking', '5 min'], ['Libraries after dark', '7 min']],
};
const TABS = Object.keys(TOPICS);

function Page({ tab }: { tab: string }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.list}>
      {TOPICS[tab].map(([title, meta]) => (
        <View key={title} style={st.row} accessible accessibilityLabel={`${title}. ${meta}`}>
          <Text className="font-semibold text-dissolve-foreground" style={st.title}>{title}</Text>
          <Text className="text-dissolve-muted" style={st.meta}>{meta}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/** A reading app: seven topics, more than fit, so the row scrolls. Swipe the pages or tap a tab. */
export default function PagerTabsDemo() {
  return (
    <View style={st.root}>
      <PagerTabs tabs={TABS} renderPage={(t) => <Page tab={t} />} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingTop: 4, paddingBottom: 24 },
  row: { paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 20, lineHeight: 25, letterSpacing: -0.45 },
  meta: { fontSize: 15, marginTop: 3 },
});
