import type { FieldFn, FieldName, Variant, VariantName } from '../types';
import { dust, ember, pixel, sand, vortex } from './classic';
import { snap } from './snap';
import { fling } from './fling';
import { stream } from './stream';
import { gather, print, rain } from './assemble';
import { charge } from './charge';
import { cascadeField } from './cascade';
import { shatter } from './shatter';
import { pile } from './pile';
import { morph } from './morph';
import { peel } from './peel';
import { melt } from './melt';

/**
 * Static registry. Owned by the master agent: every builder export is already wired,
 * builders only edit their own variant files.
 *
 * Dispatch: the variant is resolved HERE on the JS side, then its step worklet is captured
 * by the Particles reaction closure. The UI thread never looks anything up by name.
 */
export const REGISTRY: Record<VariantName, Variant> = {
  dust,
  sand,
  ember,
  pixel,
  vortex,
  snap,
  fling,
  stream,
  gather,
  rain,
  print,
  charge,
  shatter,
  pile,
  morph,
  peel,
  melt,
};

export const FIELDS: Record<FieldName, FieldFn> = {
  cascade: cascadeField,
};

/** Display order in the playground. */
export const VARIANTS = Object.keys(REGISTRY) as VariantName[];

export function getVariant(name: VariantName): Variant {
  return REGISTRY[name] ?? dust;
}

export const VARIANT_INFO = Object.fromEntries(VARIANTS.map((n) => [n, REGISTRY[n].info])) as Record<VariantName, string>;
export const VARIANT_GRAIN = Object.fromEntries(VARIANTS.map((n) => [n, REGISTRY[n].defaultGrain])) as Record<VariantName, number>;
