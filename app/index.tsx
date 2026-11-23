import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@registry/tw';
import { DEMOS } from '@/demos';
import { EFFECTS } from '@/catalog';
import { Group, Row } from '@/ui';

const WEBSITE = 'https://dissolve.rselmi.com';
const GITHUB = 'https://github.com/dissolve-ui/dissolve';

export default function Home() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={st.content}>
      <Text className="text-dissolve-muted" style={st.tagline}>
        Views that dissolve, melt, peel or rebuild themselves.
      </Text>

      <Group>
        <Row icon="globe" title="Website" detail="dissolve.rselmi.com" external onPress={() => WebBrowser.openBrowserAsync(WEBSITE)} />
        <Row icon="chevron.left.forwardslash.chevron.right" title="GitHub" detail="dissolve-ui/dissolve" external onPress={() => WebBrowser.openBrowserAsync(GITHUB)} />
      </Group>

      <Group title={`Components · ${DEMOS.length}`}>
        {DEMOS.map((d) => (
          <Row key={d.slug} icon={d.icon} title={d.title} onPress={() => router.push(`/demo/${d.slug}`)} />
        ))}
      </Group>

      <Group title={`Effects · ${EFFECTS.length}`} footer="Every effect works on any view: wrap it, call dissolve.">
        {[
          ...EFFECTS.map((e) => <Row key={e.slug} icon={e.icon} title={e.title} onPress={() => router.push(`/effect/${e.slug}`)} />),
          <Row key="all" icon="slider.horizontal.3" title="All options" detail="Playground" onPress={() => router.push('/playground')} />,
        ]}
      </Group>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  tagline: { fontSize: 15, lineHeight: 21, paddingHorizontal: 4, paddingTop: 2 },
});
