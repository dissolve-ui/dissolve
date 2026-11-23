import { Pressable, StyleSheet } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Tooltip, type TooltipPlacement } from '@registry/tooltip';
import { Text, View, useToken } from '@registry/tw';

const TOOLS: [string, SFSymbol][] = [
  ['Bold', 'bold'],
  ['Italic', 'italic'],
  ['Add a link', 'link'],
  ['Comment', 'text.bubble'],
  ['Share with your team', 'square.and.arrow.up'],
];
const SIDES: TooltipPlacement[] = ['top', 'right', 'bottom', 'left'];

/** An editor toolbar: hold a tool to read its name. Then the four placements. */
export default function TooltipDemo() {
  const fg = useToken('foreground');
  return (
    <View style={st.root}>
      <View className="bg-dissolve-surface" style={st.bar}>
        {TOOLS.map(([label, icon]) => (
          <Tooltip key={label} content={label}>
            <Pressable accessibilityRole="button" accessibilityLabel={label} onLongPress={() => {}} style={({ pressed }) => [st.tool, { opacity: pressed ? 0.6 : 1 }]}>
              <SymbolView name={icon} size={18} tintColor={fg} />
            </Pressable>
          </Tooltip>
        ))}
      </View>
      <View style={st.sides}>
        {SIDES.map((side) => (
          <Tooltip key={side} content={`Placed ${side}`} placement={side}>
            <Pressable accessibilityRole="button" onLongPress={() => {}}>
              <View className="bg-dissolve-surface" style={st.side}>
                <Text className="text-dissolve-foreground" style={st.sideText}>
                  {side[0].toUpperCase() + side.slice(1)}
                </Text>
              </View>
            </Pressable>
          </Tooltip>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 40, paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
  bar: { flexDirection: 'row', gap: 2, padding: 4, borderRadius: 14, borderCurve: 'continuous' },
  tool: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sides: { flexDirection: 'row', gap: 8 },
  side: { height: 36, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sideText: { fontSize: 13, fontWeight: '600' },
});
