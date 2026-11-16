import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  REGISTRY,
  useAppear,
  useDissolve,
  VARIANT_GRAIN,
  VARIANT_INFO,
  VARIANTS,
  type DissolveOptions,
  type Direction,
  type Origin,
  type VariantName,
} from '@/dissolve';
import { Button, C, Caption, Chip, Code, Section, Stage, mono } from '@/ui';

const GRAINS = [2, 3, 5, 8];
const DURATIONS = [800, 1500, 2500];
const ORIGINS = ['auto', 'touch', 'left', 'right', 'top', 'bottom', 'center'] as const;
type OriginChoice = (typeof ORIGINS)[number];

const FLINGS = [
  { label: 'slow right', v: { x: 600, y: 0 } },
  { label: 'fast right', v: { x: 2600, y: -200 } },
  { label: 'up left', v: { x: -900, y: -1400 } },
];

/** Variant specific knob forwarded as n[0]. */
const KNOB: Partial<Record<VariantName, { title: string; values: number[]; fmt: (v: number) => string }>> = {
  snap: { title: 'Push', values: [0.6, 1, 1.6], fmt: (v) => `${v}x` },
  shatter: { title: 'Shards', values: [120, 220, 400], fmt: (v) => `${v}` },
};

/** Variants that take an origin (touch point or edge). */
const usesOrigin = (v: VariantName) => REGISTRY[v].kind === 'atlas' || v === 'shatter';
const naturalOf = (v: VariantName): Direction => (REGISTRY[v].natural === 'in' ? 'in' : 'out');

export default function Playground() {
  const [variant, setVariant] = useState<VariantName>('dust');
  const [grain, setGrain] = useState<number | null>(null);
  const [duration, setDuration] = useState(1500);
  const [direction, setDirection] = useState<Direction>('out');
  const [origin, setOrigin] = useState<OriginChoice>('auto');
  const [fling, setFling] = useState(1);
  const [knob, setKnob] = useState<number | null>(null);
  const [cascade, setCascade] = useState(false);
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState(0);

  const out = useDissolve();
  const inn = useAppear();
  const target = useRef<View>(null);

  const g = grain ?? VARIANT_GRAIN[variant];
  const spec = KNOB[variant];
  const n0 = spec ? (knob ?? spec.values[1]) : undefined;
  const isMorph = variant === 'morph';
  const dir: Direction = isMorph ? 'out' : direction;
  const atlas = REGISTRY[variant].kind === 'atlas';
  const showOrigin = usesOrigin(variant);

  // The entrance card mounts hidden (useAppear), show it until the next play.
  const showIn = inn.reset;
  useEffect(() => {
    if (dir === 'in') showIn(true);
  }, [dir, showIn]);

  const pick = (v: VariantName) => {
    setVariant(v);
    setGrain(null);
    setKnob(null);
    setDirection(naturalOf(v));
    if (!usesOrigin(v)) setOrigin('auto');
    if (REGISTRY[v].kind !== 'atlas') setCascade(false);
  };

  const options = (touch?: { x: number; y: number }): DissolveOptions => {
    let o: Origin | undefined;
    if (showOrigin && origin !== 'auto') o = origin === 'touch' ? (touch ?? 'center') : origin;
    return {
      preset: variant,
      grain: g,
      duration,
      direction: dir,
      origin: o,
      velocity: variant === 'fling' ? FLINGS[fling].v : undefined,
      to: variant === 'stream' ? target : undefined,
      field: cascade ? 'cascade' : undefined,
      n: n0 !== undefined ? [n0] : undefined,
    };
  };

  const play = async (e?: GestureResponderEvent) => {
    if (busy) return;
    setBusy(true);
    // locationX is relative to the deepest touched child, so derive the local point from
    // the page coordinates and the card's window rect instead.
    let touch: { x: number; y: number } | undefined;
    const host = dir === 'in' ? inn.ref.current : out.ref.current;
    if (e && host) {
      const { pageX, pageY } = e.nativeEvent;
      touch = await new Promise((res) => host.measureInWindow((x, y) => res({ x: pageX - x, y: pageY - y })));
    }
    try {
      if (dir === 'in') {
        inn.reset();
        const { to, ...rest } = options(touch);
        await inn.appear({ ...rest, from: variant === 'stream' ? target : undefined, haptics: true });
        setK((n) => n + 1);
      } else {
        await out.dissolve(options(touch));
        await new Promise((r) => setTimeout(r, duration * 0.6));
        out.reset();
        setK((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const code = snippet(variant, g, duration, dir, origin, showOrigin, cascade, n0, fling);

  const card = (
    <>
      <View style={st.art} />
      <View>
        <Text style={st.title}>Summer trip</Text>
        <Text style={st.sub}>48 photos · Lisbon</Text>
      </View>
    </>
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Stage style={{ height: 230, alignItems: 'center', justifyContent: 'center' }}>
        {variant === 'stream' ? (
          <View ref={target} collapsable={false} style={st.target}>
            <Text style={st.targetText}>{dir === 'in' ? 'src' : 'bin'}</Text>
          </View>
        ) : null}
        <Pressable onPress={play}>
          {dir === 'in' ? (
            <View key={`in-${k}`} style={[{ width: 240 }, inn.wrapStyle]}>
              <View ref={inn.ref} collapsable={false} style={st.card}>
                {card}
              </View>
            </View>
          ) : (
            <Animated.View key={k} entering={k ? FadeIn.duration(400) : undefined} style={{ width: 240 }}>
              <View ref={out.ref} collapsable={false} style={[st.card, { opacity: out.dissolving ? 0 : 1 }]}>
                {card}
              </View>
            </Animated.View>
          )}
        </Pressable>
      </Stage>
      <Caption>{showOrigin && origin === 'touch' ? 'tap the card where it should break' : 'tap the card or press play'}</Caption>

      <Section title="Variant" note={VARIANT_INFO[variant]}>
        <View style={st.chips}>
          {VARIANTS.map((v) => (
            <Chip key={v} label={v} active={v === variant} onPress={() => pick(v)} />
          ))}
        </View>
      </Section>

      {!isMorph ? (
        <Section title="Direction" note={dir === 'in' ? 'Entrance: the grains assemble into the view.' : 'Exit: the view comes apart.'}>
          <View style={st.chips}>
            {(['out', 'in'] as const).map((d) => (
              <Chip key={d} label={d} active={d === dir} onPress={() => setDirection(d)} />
            ))}
          </View>
        </Section>
      ) : null}

      {showOrigin ? (
        <Section title="Origin">
          <View style={st.chips}>
            {ORIGINS.map((o) => (
              <Chip key={o} label={o} active={o === origin} onPress={() => setOrigin(o)} />
            ))}
          </View>
        </Section>
      ) : null}

      {variant === 'fling' ? (
        <Section title="Velocity" note="In the app it comes from the pan gesture.">
          <View style={st.chips}>
            {FLINGS.map((f, i) => (
              <Chip key={f.label} label={f.label} active={i === fling} onPress={() => setFling(i)} />
            ))}
          </View>
        </Section>
      ) : null}

      {spec ? (
        <Section title={spec.title}>
          <View style={st.chips}>
            {spec.values.map((v) => (
              <Chip key={v} label={spec.fmt(v)} active={v === n0} onPress={() => setKnob(v)} />
            ))}
          </View>
        </Section>
      ) : null}

      {atlas ? (
        <Section title="Delay field">
          <View style={st.chips}>
            <Chip label="native" active={!cascade} onPress={() => setCascade(false)} />
            <Chip label="cascade" active={cascade} onPress={() => setCascade(true)} />
          </View>
        </Section>
      ) : null}

      <Section title="Grain">
        <View style={st.chips}>
          {GRAINS.map((v) => (
            <Chip key={v} label={`${v} pt`} active={v === g} onPress={() => setGrain(v)} />
          ))}
        </View>
      </Section>
      <Section title="Duration">
        <View style={st.chips}>
          {DURATIONS.map((v) => (
            <Chip key={v} label={`${v / 1000}s`} active={v === duration} onPress={() => setDuration(v)} />
          ))}
        </View>
      </Section>

      <Section title="Code">
        <Code title={dir === 'in' ? 'appear()' : 'dissolve()'}>{code}</Code>
      </Section>
      <View style={{ height: 24 }} />
      <Button label="Play" onPress={() => play()} />
    </ScrollView>
  );
}

function snippet(
  v: VariantName,
  g: number,
  duration: number,
  dir: Direction,
  origin: OriginChoice,
  showOrigin: boolean,
  cascade: boolean,
  n0: number | undefined,
  fling: number,
) {
  const lines = [`  preset: '${v}',`, `  grain: ${g},`, `  duration: ${duration},`];
  if (showOrigin && origin === 'touch') lines.push('  origin: { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },');
  else if (showOrigin && origin !== 'auto') lines.push(`  origin: '${origin}',`);
  if (v === 'fling') lines.push(`  velocity: { x: ${FLINGS[fling].v.x}, y: ${FLINGS[fling].v.y} },`);
  if (v === 'stream') lines.push(dir === 'in' ? '  from: sourceRef,' : '  to: trashRef,');
  if (cascade) lines.push("  field: 'cascade',");
  if (n0 !== undefined) lines.push(`  n: [${n0}],`);
  if (dir === 'in') return `const { ref, appear, wrapStyle } = useAppear()\n\nawait appear({\n${lines.join('\n')}\n})`;
  if (dir !== naturalOf(v)) lines.push(`  direction: '${dir}',`);
  return `await dissolve({\n${lines.join('\n')}\n})`;
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: 240, padding: 12, borderRadius: 20, backgroundColor: C.bg, flexDirection: 'row', gap: 12, alignItems: 'center' },
  art: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#E4572E', borderWidth: 10, borderColor: '#F4B860' },
  title: { fontSize: 16, fontWeight: '600', color: C.ink },
  sub: { fontSize: 13, color: C.text, marginTop: 2 },
  target: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetText: { fontFamily: mono, fontSize: 10, color: C.onDark },
});
