import { StyleSheet } from 'react-native';
import { CopyButton } from '@registry/copy-button';
import { Text, View } from '@registry/tw';

const CMD = 'npx dissolve-ui add copy-button';

/** An install command with its copy button, then the three sizes. */
export default function CopyButtonDemo() {
  return (
    <View style={st.root}>
      <View className="bg-dissolve-surface" style={st.field}>
        <Text className="text-dissolve-foreground" style={st.code} numberOfLines={1}>
          <Text className="text-dissolve-muted">$ </Text>
          {CMD}
        </Text>
        <CopyButton text={CMD} accessibilityLabel="Copy the install command" />
      </View>
      <View style={st.sizes}>
        <CopyButton size="sm" text={CMD} />
        <CopyButton size="md" text={CMD} />
        <CopyButton size="lg" text={CMD} effects="none" />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 36, paddingTop: 72, paddingBottom: 40, paddingHorizontal: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingLeft: 16, paddingRight: 8, borderRadius: 14, borderCurve: 'continuous' },
  code: { flex: 1, fontFamily: 'Menlo', fontSize: 13 },
  sizes: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 },
});
