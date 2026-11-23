/**
 * Accordion, from dissolve (dissolve-ui). This file is yours: change the timings, the paddings,
 * the chevron, anything. Colors come from the dissolve theme tokens (global.css), so it follows
 * light and dark mode out of the box.
 *
 * Expandable sections on hairline dividers. Tap a header and its section opens on a smooth height
 * curve while the chevron turns over, then the content fades in and slides down into place. One
 * section open at a time (type="single", the default) or any number (type="multiple"). Selection
 * tick on every change. Reduced motion: the section opens at once and the content simply fades.
 *
 * Plain motion only, no grains: an accordion is read, not played with.
 *
 * <Accordion
 *   items={[
 *     { value: 'shipping', title: 'Shipping', content: 'Orders leave the studio within two days.' },
 *     { value: 'returns', title: 'Returns', content: <ReturnsPolicy /> },
 *   ]}
 *   defaultValue={['shipping']}
 * />
 *
 * <Accordion type="multiple" items={faq} value={open} onValueChange={setOpen} />
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View as RNView } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Animated, Text, View, cn, useToken } from './tw';
import { CALM } from './motion';

export type AccordionItem = {
  /** Unique key, also what value and onValueChange hold. */
  value: string;
  /** Header text. */
  title: string;
  /** The section. A string is set in the muted body style; any node renders as is. */
  content: ReactNode;
  /** The header cannot be pressed. */
  disabled?: boolean;
};

export type AccordionProps = {
  items: AccordionItem[];
  /** 'single': opening a section closes the other. 'multiple': each opens on its own. Default 'single'. */
  type?: 'single' | 'multiple';
  /** In single mode, the open section can be closed again. Default true. */
  collapsible?: boolean;
  /** Open sections (controlled). In single mode, at most one. */
  value?: string[];
  /** Initially open sections when uncontrolled. Default none. */
  defaultValue?: string[];
  /** Called with the open sections on every change. */
  onValueChange?: (value: string[]) => void;
  /** Selection tick on every change. Default true. */
  haptics?: boolean;
  /** Outer classes (margins, padding, background...). */
  className?: string;
};

/** Height curve when opening and closing. */
const OPEN = 320;
const CLOSE = 260;
/** The content waits a beat, fades in and slides down into place. */
const CONTENT_DELAY = 60;
const CONTENT_IN = 240;
const CONTENT_OUT = 120;
const SLIDE = 6;
/** Reduced motion: a plain fade. */
const FADE = 150;

export function Accordion({
  items,
  type = 'single',
  collapsible = true,
  value,
  defaultValue,
  onValueChange,
  haptics = true,
  className,
}: AccordionProps) {
  const [inner, setInner] = useState<string[]>(defaultValue ?? []);
  const open = value ?? inner;

  const toggle = (key: string) => {
    const isOpen = open.includes(key);
    let next: string[];
    if (type === 'multiple') next = isOpen ? open.filter((k) => k !== key) : [...open, key];
    else if (isOpen) {
      if (!collapsible) return;
      next = [];
    } else next = [key];
    if (haptics) Haptics.selectionAsync();
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  return (
    <View className={cn(className)}>
      {items.map((item, i) => (
        <Section key={item.value} item={item} open={open.includes(item.value)} last={i === items.length - 1} onToggle={() => toggle(item.value)} />
      ))}
    </View>
  );
}

function Section({ item, open, last, onToggle }: { item: AccordionItem; open: boolean; last: boolean; onToggle: () => void }) {
  const reduced = useReducedMotion();
  const muted = useToken('muted');
  /** Natural height of the content, measured off the clipped box. */
  const h = useSharedValue(0);
  /** 0 closed, 1 open: the height and the chevron. */
  const p = useSharedValue(open ? 1 : 0);
  /** The content's own fade and slide. */
  const c = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      p.value = open ? 1 : 0;
      c.value = withTiming(open ? 1 : 0, { duration: FADE });
      return;
    }
    p.value = withTiming(open ? 1 : 0, { duration: open ? OPEN : CLOSE, easing: CALM });
    c.value = open ? withDelay(CONTENT_DELAY, withTiming(1, { duration: CONTENT_IN, easing: CALM })) : withTiming(0, { duration: CONTENT_OUT });
  }, [open, reduced, p, c]);

  const bodyStyle = useAnimatedStyle(() => ({ height: h.value * p.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: c.value, transform: [{ translateY: (c.value - 1) * SLIDE }] }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 180}deg` }] }));

  return (
    <View className={cn(!last && 'border-b border-dissolve-border')}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: !!item.disabled }}
        disabled={item.disabled}
        onPress={onToggle}
        style={({ pressed }) => [st.header, { opacity: item.disabled ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <Text className="text-dissolve-foreground" style={st.title}>
          {item.title}
        </Text>
        <Animated.View style={[st.chevron, chevronStyle]}>
          <RNView style={[st.bar, st.barL, { backgroundColor: muted }]} />
          <RNView style={[st.bar, st.barR, { backgroundColor: muted }]} />
        </Animated.View>
      </Pressable>
      <Animated.View style={[st.body, bodyStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View
          style={[st.measure, contentStyle]}
          onLayout={(e) => {
            h.value = e.nativeEvent.layout.height;
          }}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          {typeof item.content === 'string' ? (
            <Text className="text-dissolve-muted" style={st.text}>
              {item.content}
            </Text>
          ) : (
            item.content
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, paddingVertical: 14 },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  chevron: { width: 14, height: 14 },
  // Two rounded bars meeting at the bottom: a chevron with round caps, no icon font needed.
  bar: { position: 'absolute', top: 6.1, width: 7, height: 1.8, borderRadius: 1 },
  barL: { left: 1.1, transform: [{ rotate: '40deg' }] },
  barR: { right: 1.1, transform: [{ rotate: '-40deg' }] },
  body: { overflow: 'hidden' },
  // Absolute, so it lays out at its natural height whatever the clipped box measures.
  measure: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 18 },
  text: { fontSize: 15, lineHeight: 22 },
});
