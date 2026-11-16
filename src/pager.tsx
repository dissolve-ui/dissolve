import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, Text, View, useToken } from '@registry/tw';
import { neighbors } from './catalog';

/** Previous / Next across every component and effect. Replaces the screen so back stays home. */
export function Pager({ href }: { href: string }) {
  const { prev, next } = neighbors(href);
  const muted = useToken('muted');
  const cell = (stop: typeof prev, side: 'prev' | 'next') =>
    stop ? (
      <Pressable
        onPress={() => router.replace(stop.href as never)}
        className="bg-dissolve-surface active:bg-dissolve-surface-2"
        style={[p.pagerCell, side === 'next' && { alignItems: 'flex-end' }]}
        accessibilityRole="button"
        accessibilityLabel={`${side === 'prev' ? 'Previous' : 'Next'}: ${stop.title}`}
      >
        <View style={[p.pagerKicker, side === 'next' && { flexDirection: 'row-reverse' }]}>
          <SymbolView name={side === 'prev' ? 'chevron.left' : 'chevron.right'} size={10} tintColor={muted} weight="semibold" />
          <Text className="text-dissolve-muted" style={p.pagerLabel}>
            {side === 'prev' ? 'Previous' : 'Next'}
          </Text>
        </View>
        <Text className="text-dissolve-foreground" style={p.pagerTitle} numberOfLines={1}>
          {stop.title}
        </Text>
      </Pressable>
    ) : (
      <View style={{ flex: 1 }} />
    );
  return (
    <View style={p.pager}>
      {cell(prev, 'prev')}
      {cell(next, 'next')}
    </View>
  );
}

const p = StyleSheet.create({
  pager: { flexDirection: 'row', gap: 10 },
  pagerCell: { flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  pagerKicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pagerLabel: { fontSize: 12 },
  pagerTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
});
