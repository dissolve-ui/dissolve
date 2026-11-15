import { useCallback, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { capture, defaultHaptics, frames, measure } from '../core';
import { useDissolveContext } from '../context';
import { getVariant } from '../variants/registry';
import type { Box, BurstHandle, DissolveCtx, DissolveOptions, RunExtra } from '../types';

const isBox = (t: unknown): t is Box => !!t && typeof (t as Box).width === 'number';

/**
 * Shared pipeline: capture, resolve (variant hook), add, haptics. Builder hooks reuse it.
 * Extra burst fields (external progress, aux, data, onFinish) go in `extra`.
 * Returns null when the view could not be captured.
 */
export async function runDissolve(
  ctx: DissolveCtx,
  ref: RefObject<View | null>,
  opts: DissolveOptions = {},
  extra: RunExtra = {},
): Promise<{ handle: BurstHandle; duration: number } | null> {
  const preset = opts.preset ?? 'dust';
  const v = getVariant(preset);
  const shot = extra.image && extra.box ? { image: extra.image, box: extra.box } : await capture(ref);
  if (!shot) return null;
  let duration = opts.duration ?? 1500;
  let grain = opts.grain ?? v.defaultGrain;

  // Generic option resolution, before the variant hook.
  let target: Box | undefined;
  if (opts.to) target = isBox(opts.to) ? opts.to : ((await measure(opts.to)) ?? undefined);
  let floorY: number | undefined;
  if (typeof opts.floor === 'number') floorY = opts.floor;
  else if (opts.floor && opts.floor !== 'screen') floorY = (await measure(opts.floor))?.y;

  const r = v.resolve ? await v.resolve({ opts, box: shot.box, image: shot.image, grain, duration }) : {};
  duration = r.duration ?? duration;
  grain = r.grain ?? grain;

  const handle = ctx.add({
    variant: preset,
    image: shot.image,
    ...shot.box,
    grain,
    duration,
    direction: opts.direction,
    origin: opts.origin,
    velocity: opts.velocity,
    target,
    floorY,
    field: opts.field,
    rowBounds: opts.rows,
    n: opts.n,
    progress: extra.progress,
    aux0: extra.aux0,
    aux1: extra.aux1,
    data: r.data ?? extra.data,
    onFinish: extra.onFinish,
    paramsOverride: r.params,
  });
  if (opts.haptics !== false) (r.haptics ?? (() => defaultHaptics(duration)))();
  return { handle, duration };
}

/**
 * const { ref, dissolving, dissolve } = useDissolve();
 * <View ref={ref} style={{ opacity: dissolving ? 0 : 1 }} />
 * await dissolve({ preset: 'sand' }); // resolves when the space can be reclaimed
 */
export function useDissolve() {
  const ctx = useDissolveContext();
  const ref = useRef<View>(null);
  const [dissolving, setDissolving] = useState(false);

  const dissolve = useCallback(
    async (opts: DissolveOptions = {}) => {
      if (!ref.current) return;
      if (ctx.reduced) {
        setDissolving(true);
        opts.onArrive?.();
        return;
      }
      const res = await runDissolve(ctx, ref, opts);
      if (!res) return;
      // Hide the original only once the overlay has had a frame to paint the
      // identical first state, so there is never a blank frame in between.
      frames(2).then(() => setDissolving(true));
      await new Promise((r) => setTimeout(r, res.duration * 0.6));
    },
    [ctx],
  );

  const reset = useCallback(() => setDissolving(false), []);
  return { ref, dissolving, dissolve, reset };
}
