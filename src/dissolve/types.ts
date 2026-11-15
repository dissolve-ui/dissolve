import type { ComponentType, ReactNode, RefObject } from 'react';
import type { View } from 'react-native';
import type { SkImage } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Shared types of the engine. Owned by the master agent: builders import from here,
 * they never edit it. See docs/CONTRACT.md.
 */

export type Box = { x: number; y: number; width: number; height: number };
export type Point = { x: number; y: number };

/** Every variant name the registry knows about. */
export type VariantName =
  // classic presets (master)
  | 'dust'
  | 'sand'
  | 'ember'
  | 'pixel'
  | 'vortex'
  // A
  | 'snap'
  | 'fling'
  // B
  | 'stream'
  | 'gather'
  | 'rain'
  | 'print'
  // C
  | 'charge'
  // E
  | 'shatter'
  // F
  | 'pile'
  | 'morph'
  // casual
  | 'peel';

/** Delay fields that can replace the native delay of any atlas variant. */
export type FieldName = 'cascade';

/**
 * Where the wave starts. Edges and center are line or radial fields, a point is in
 * LOCAL coordinates of the captured view (e.g. nativeEvent.locationX / locationY).
 */
export type Origin = 'left' | 'right' | 'top' | 'bottom' | 'center' | Point;

/** out = disintegrate (grain at rest when t = 0), in = assemble (grain at rest when t = 1). */
export type Direction = 'out' | 'in';

/**
 * Numeric constants captured by the UI thread worklet. Keep it flat and numeric in the
 * hot path. All coordinates are window coordinates unless prefixed with "local".
 */
export type BurstParams = {
  /** Window position and size of the captured view. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Grain size in points and pixel ratio of the snapshot (image px per point). */
  grain: number;
  pr: number;
  cols: number;
  rows: number;
  /** Half diagonal of the view. */
  maxR: number;
  /** 0 = out, 1 = in. Variants with natural 'both' read this. */
  dir: 0 | 1;
  /** Duration in seconds (for physics written in real time). */
  sec: number;
  /** Origin in LOCAL coords (defaults to the view center), and the distance to the farthest corner. */
  hasOrigin: 0 | 1;
  ox: number;
  oy: number;
  maxD: number;
  /** Fling / swipe velocity in pt/s (0 when unset). */
  vx: number;
  vy: number;
  /** Target rect in WINDOW coords (stream). tx, ty is the center. 0 when unset. */
  tx: number;
  ty: number;
  tw: number;
  th: number;
  /** Floor in WINDOW coords (pile). Defaults to the window height. */
  floorY: number;
  /** Free numeric slots for a variant (shards, push...). Read them as P.n0..P.n3. */
  n0: number;
  n1: number;
  n2: number;
  n3: number;
};

/**
 * One captured effect. Created by dissolve() or a builder hook via ctx.add().
 */
export type Burst = {
  key: string;
  variant: VariantName;
  image: SkImage;
  /** Window rect of the captured view. */
  x: number;
  y: number;
  width: number;
  height: number;
  grain: number;
  duration: number;
  direction: Direction;
  params: BurstParams;
  /** Local Y bounds of list rows (cascade field), JS side only. */
  rowBounds?: number[];
  /** Optional delay field replacing the variant native delay. */
  field?: FieldName;
  /** Origin as given by the caller (generic origin delay field). */
  origin?: Origin;
  /**
   * External progress on the 0..variant.end scale. When set, the engine never animates
   * and never removes the burst on its own: the owner drives it and calls handle.remove().
   */
  progress?: SharedValue<number>;
  /** Extra animated inputs (charge level, clock...). Any change forces a full pass. */
  aux0?: SharedValue<number>;
  aux1?: SharedValue<number>;
  /** Called on the JS thread when an internally driven burst reaches the end. */
  onFinish?: () => void;
  /** Free payload for custom renderers (second image, mesh, rows...). */
  data?: unknown;
  /**
   * progress, aux0 and aux1 sampled when the burst was added (JS side, outside render).
   * Renderers build their initial pose from these instead of reading .value while rendering.
   */
  start: { p: number; a0: number; a1: number };
};

export type BurstInput = Omit<Burst, 'key' | 'params' | 'grain' | 'direction' | 'start'> & {
  grain?: number;
  direction?: Direction;
  origin?: Origin;
  velocity?: Point;
  /** Target rect in window coords. */
  target?: Box;
  floorY?: number;
  n?: [number?, number?, number?, number?];
  /** Merged last into the computed params (variant resolve hooks). */
  paramsOverride?: Partial<BurstParams>;
};

/** Extra burst fields for runDissolve(), used by builder hooks. */
export type RunExtra = {
  progress?: SharedValue<number>;
  aux0?: SharedValue<number>;
  aux1?: SharedValue<number>;
  data?: unknown;
  onFinish?: () => void;
  /** Reuse an existing snapshot instead of capturing again (pre-captured on touch down). */
  image?: SkImage;
  box?: Box;
};

export type BurstHandle = { key: string; remove: () => void };

/** Per grain static seed, available JS side when computing timing. */
export type GrainSeed = { i: number; col: number; row: number; lx: number; ly: number; r1: number; r2: number; r3: number; r4: number };

export type Timing = { delay: number; life: number };

/**
 * Mutable output of a step. The engine resets it to the rest pose before every call:
 * cx = x + lx, cy = y + ly, s = 1, rot = 0, r = g = b = 1, a = 1 - smoothstep(t).
 * cx, cy are the WINDOW center of the grain, s the scale, rot radians, r g b a modulate.
 */
export type GrainOut = { cx: number; cy: number; s: number; rot: number; r: number; g: number; b: number; a: number };

/**
 * UI thread worklet, called once per grain per frame (only for grains whose local t
 * changed, or every grain when aux changed).
 * d is the flat per-grain buffer, k the offset of this grain:
 *   d[k] lx, d[k+1] ly, d[k+2] r1, d[k+3] r2, d[k+4] r3, d[k+5] r4,
 *   d[k+6] delay, d[k+7] life, d[k+8 ..] the variant extras (see AtlasVariant.extra).
 * a0, a1 are the current values of burst.aux0 / aux1 (0 when unset).
 * MUST start with the 'worklet' directive and must not read any shared value.
 */
export type StepFn = (t: number, d: number[], k: number, P: BurstParams, a0: number, a1: number, o: GrainOut) => void;

/** Context of the optional async JS resolve hook, run before the burst is added. */
export type ResolveCtx = {
  opts: DissolveOptions;
  box: Box;
  image: SkImage;
  grain: number;
  duration: number;
};
export type ResolveResult = {
  params?: Partial<BurstParams>;
  grain?: number;
  duration?: number;
  data?: unknown;
  /** Replaces the default haptics pattern. Called right after the burst is added. */
  haptics?: () => void;
};

type VariantBase = {
  name: VariantName;
  /** One line shown in the playground. */
  info: string;
  defaultGrain: number;
  /** Timeline end, the internal timing animates progress 0 to end. Default 1.2. */
  end?: number;
  /**
   * Natural direction. 'out' variants are time reversed by the engine for direction 'in'
   * (and vice versa). 'both' variants are never reversed and read P.dir themselves.
   */
  natural?: Direction | 'both';
  /** Async JS hook: measure refs, compute velocity based duration, attach data... */
  resolve?: (c: ResolveCtx) => ResolveResult | Promise<ResolveResult>;
};

export type AtlasVariant = VariantBase & {
  kind: 'atlas';
  /** Number of extra floats per grain (stored at d[k+8 ..]). */
  extra?: number;
  /** JS thread, once per grain. */
  timing: (g: GrainSeed, P: BurstParams) => Timing;
  /** When P.hasOrigin, the engine replaces the delay with origin field * spread + r1 * jitter. Defaults 0.55 / 0.08. */
  spread?: number;
  jitter?: number;
  /** Set true if the variant uses P.ox/P.oy itself and must not get the generic origin delay. */
  ownsOrigin?: boolean;
  /**
   * JS thread, once, after timing. Free pass over the whole buffer to fill extras or
   * rewrite delay/life with global knowledge (sorting, heaps...).
   */
  prepare?: (d: number[], stride: number, count: number, P: BurstParams, burst: Burst) => void;
  step: StepFn;
  /**
   * How the per-grain color (o.r, o.g, o.b, o.a) is applied to the grain.
   * - 'modulate' (default): multiplies, o.a is the grain opacity.
   * - 'tint': mixes the grain toward (o.r, o.g, o.b) by o.a, keeps the grain opacity.
   *   Fade such variants out with o.s. Use it for glows that must not muddy colors.
   */
  colorMode?: 'modulate' | 'tint';
};

export type RendererProps = {
  burst: Burst;
  /** Raw progress (internal timing or the external one), 0..end. Not reversed. */
  progress: SharedValue<number>;
  end: number;
};

export type CustomVariant = VariantBase & {
  kind: 'custom';
  /** Rendered inside the full screen overlay (absoluteFill, window coords). */
  Renderer: ComponentType<RendererProps>;
};

export type Variant = AtlasVariant | CustomVariant;

export type DissolveOptions = {
  preset?: VariantName;
  /** Grain size in points. Defaults depend on the preset; capped to ~6000 grains. */
  grain?: number;
  /** Full effect duration in ms. */
  duration?: number;
  /** Soft impact plus a few ticks during the sweep. */
  haptics?: boolean;
  /** Where the wave starts. Works with every atlas preset. */
  origin?: Origin;
  /** Swipe velocity in pt/s (fling). */
  velocity?: Point;
  /** Target view or window rect (stream). */
  to?: RefObject<View | null> | Box;
  /** Floor in window coords, or 'screen' (pile). */
  floor?: number | 'screen' | RefObject<View | null>;
  /** Delay field override (cascade) and its row bounds in local Y. */
  field?: FieldName;
  rows?: number[];
  /** Called when grains arrive (stream). */
  onArrive?: () => void;
  /** Free numeric knobs forwarded to P.n0..n3. */
  n?: [number?, number?, number?, number?];
  direction?: Direction;
};

export type DissolveCtx = {
  /** Add a burst. Returns a handle to remove it (needed with external progress). */
  add: (b: BurstInput) => BurstHandle;
  remove: (key: string) => void;
  /** Persistent overlay layers drawn under the bursts (pile heap...). null removes it. */
  setLayer: (id: string, node: ReactNode | null) => void;
  reduced: boolean;
};

/**
 * Delay field (JS side, once per grain). Returns the new delay; the variant keeps its life.
 * Used by burst.field (e.g. cascade).
 */
export type FieldFn = (g: GrainSeed, P: BurstParams, burst: Burst, life?: number, end?: number) => number;
