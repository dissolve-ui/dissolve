import type { SFSymbol } from 'expo-symbols';
import { VARIANTS, type VariantName } from '@/dissolve';
import { DEMOS } from '@/demos';

/**
 * How an effect page plays its variant:
 * tap = exit on tap, touch = exit from the touch point, stream = exit into a target,
 * in = entrance, fling = swipe away, hold = hold to charge, peel = drag a corner, morph = A to B.
 */
export type EffectKind = 'tap' | 'touch' | 'stream' | 'in' | 'fling' | 'hold' | 'peel' | 'morph';

export type EffectEntry = { slug: VariantName; title: string; icon: SFSymbol; kind: EffectKind; hint: string; code: string };

const exit = (preset: VariantName) => `const { ref, dissolving, dissolve } = useDissolve()

<View ref={ref} style={{ opacity: dissolving ? 0 : 1 }} />

await dissolve({ preset: '${preset}' })
removeItem()`;

const entrance = (preset: VariantName) => `<DissolveIn preset="${preset}" style={styles.card}>
  {children}
</DissolveIn>

// or by hand
const { ref, appear, wrapStyle } = useAppear()
await appear({ preset: '${preset}' })`;

const META: Record<VariantName, Omit<EffectEntry, 'slug' | 'title'>> = {
  dust: { icon: 'wind', kind: 'tap', hint: 'tap the card', code: exit('dust') },
  sand: { icon: 'hourglass', kind: 'tap', hint: 'tap the card', code: exit('sand') },
  ember: { icon: 'flame', kind: 'tap', hint: 'tap the card', code: exit('ember') },
  pixel: { icon: 'square.grid.3x3', kind: 'tap', hint: 'tap the card', code: exit('pixel') },
  vortex: { icon: 'tornado', kind: 'tap', hint: 'tap the card', code: exit('vortex') },
  snap: {
    icon: 'hand.tap',
    kind: 'touch',
    hint: 'tap anywhere on the card',
    code: `onPress={(e) => dissolve({
  preset: 'snap',
  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
})}`,
  },
  fling: {
    icon: 'hand.draw',
    kind: 'fling',
    hint: 'swipe the card away',
    code: `Gesture.Pan().onEnd((e) => {
  scheduleOnRN(dissolve, {
    preset: 'fling',
    velocity: { x: e.velocityX, y: e.velocityY },
  })
})`,
  },
  stream: {
    icon: 'tray.and.arrow.down',
    kind: 'stream',
    hint: 'tap the card, it flies into the bin',
    code: `const bin = useRef<ComponentRef<typeof View>>(null)

await dissolve({ preset: 'stream', to: bin, onArrive: bump })

// entrance: pour out of a source
<DissolveIn preset="stream" from={sendButton}>{bubble}</DissolveIn>`,
  },
  gather: { icon: 'circle.dotted', kind: 'in', hint: 'tap the card to play the entrance again', code: entrance('gather') },
  rain: { icon: 'cloud.rain', kind: 'in', hint: 'tap the card to play the entrance again', code: entrance('rain') },
  print: { icon: 'printer', kind: 'in', hint: 'tap the card to play the entrance again', code: entrance('print') },
  charge: {
    icon: 'bolt',
    kind: 'hold',
    hint: 'press and hold the card, let go to cancel',
    code: `const { ref, pressHandlers, style } = useDissolveHold({
  holdMs: 1200,
  onCommit: deleteAccount,
})

<Pressable {...pressHandlers}>
  <Animated.View ref={ref} style={[styles.card, style]} />
</Pressable>`,
  },
  shatter: {
    icon: 'burst',
    kind: 'touch',
    hint: 'tap the card where it should break',
    code: `onPress={(e) => dissolve({
  preset: 'shatter',
  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
})}`,
  },
  morph: {
    icon: 'arrow.triangle.2.circlepath',
    kind: 'morph',
    hint: 'tap the card, tap again to go back',
    code: `const { refA, refB, styleA, styleB, morph, phase } = useDissolveMorph()

<View style={[abs, styleA]}><View ref={refA}>{ready}</View></View>
<View style={[abs, styleB]}><View ref={refB}>{done}</View></View>

await morph({ reverse: phase === 'b' })`,
  },
  peel: {
    icon: 'rectangle.on.rectangle.angled',
    kind: 'peel',
    hint: 'grab near a corner or an edge and pull',
    code: `const { ref, gesture, style } = useDissolvePeel({
  onCommit: remove,
})

<GestureDetector gesture={gesture}>
  <Animated.View ref={ref} style={[styles.sticker, style]} />
</GestureDetector>`,
  },
  melt: { icon: 'drop', kind: 'tap', hint: 'tap the card', code: exit('melt') },
};

export const EFFECTS: EffectEntry[] = VARIANTS.map((v) => ({ slug: v, title: v[0].toUpperCase() + v.slice(1), ...META[v] }));

export type Stop = { href: string; title: string; group: 'Component' | 'Effect' };

/** Every page in home order: components, then effects. Previous / Next walk this list. */
export const STOPS: Stop[] = [
  ...DEMOS.map((d) => ({ href: `/demo/${d.slug}`, title: d.title, group: 'Component' as const })),
  ...EFFECTS.map((e) => ({ href: `/effect/${e.slug}`, title: e.title, group: 'Effect' as const })),
];

export function neighbors(href: string) {
  const i = STOPS.findIndex((s) => s.href === href);
  return { prev: i > 0 ? STOPS[i - 1] : undefined, next: i >= 0 && i < STOPS.length - 1 ? STOPS[i + 1] : undefined };
}
