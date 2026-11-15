import type { VariantName } from './types';

/** The five classic presets (kept for backward compatibility). */
export type Preset = 'dust' | 'sand' | 'ember' | 'pixel' | 'vortex';

export const PRESETS: Preset[] = ['dust', 'sand', 'ember', 'pixel', 'vortex'];

export const PRESET_ID: Record<Preset, number> = { dust: 0, sand: 1, ember: 2, pixel: 3, vortex: 4 };

export const DEFAULT_GRAIN: Record<Preset, number> = { dust: 3, sand: 2.5, ember: 3, pixel: 7, vortex: 3 };

export const PRESET_INFO: Record<Preset, string> = {
  dust: 'Blown away to the right, like a breath of wind.',
  sand: 'Grains pour down with gravity.',
  ember: 'Burns from the edge and rises as sparks.',
  pixel: 'Blocky, stepped collapse. Very digital.',
  vortex: 'Spirals into the center and vanishes.',
};

export const isPreset = (n: VariantName): n is Preset => (PRESETS as string[]).includes(n);
