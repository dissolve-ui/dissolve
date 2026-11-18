import { useCallback, useRef, useState, type RefObject } from 'react';
import { capture, defaultHaptics, frames, measure } from '../core';
import { useDissolveContext } from '../context';
import { getVariant } from '../variants/registry';
import type { Box, BurstHandle, DissolveCtx, DissolveOptions, ResolveResult, RunExtra, ViewRef } from '../types';

const isBox = (t: unknown): t is Box => !!t && typeof (t as Box).width === 'number';

/**
 * Shared pipeline: capture, resolve (variant hook), add, haptics. The effect hooks reuse it.
 * Extra burst fields (external progress, aux, data, onFinish) go in `extra`.
 * Returns null when the view could not be captured.
 */
export async function runDissolve(
  ctx: DissolveCtx,
  ref: RefObject<ViewRef | null>,
  opts: DissolveOptions = {},
  extra: RunExtra = {},
): Promise<{ handle: BurstHandle; duration: number } | null> {
  const preset = opts.preset ?? 'dust';
  const v = getVariant(preset);
  const given = extra.image && extra.box ? { image: extra.image, box: extra.box } : null;
  const shot = given ?? (await capture(ref));
  if (!shot) return null;
  // A snapshot captured here belongs to the burst, so does anything the caller handed over.
  const owned = given ? extra.owned : [shot.image, ...(extra.owned ?? [])];
  let duration = opts.duration ?? 1500;
  let grain = opts.grain ?? v.defaultGrain;
  let r: ResolveResult = {};
  let handle: BurstHandle;
  try {
    // Generic option resolution, before the variant hook.
    let target: Box | undefined;
    if (opts.to) target = isBox(opts.to) ? opts.to : ((await measure(opts.to)) ?? undefined);

    if (v.resolve) r = await v.resolve({ opts, box: shot.box, image: shot.image, grain, duration });
    duration = r.duration ?? duration;
    grain = r.grain ?? grain;

    handle = ctx.add({
      variant: preset,
      image: shot.image,
      ...shot.box,
      grain,
      duration,
      direction: opts.direction,
      origin: opts.origin,
      velocity: opts.velocity,
      target,
      field: opts.field,
      rowBounds: opts.rows,
      n: opts.n,
      progress: extra.progress,
      aux0: extra.aux0,
      aux1: extra.aux1,
      data: r.data ?? extra.data,
      onFinish: extra.onFinish,
      owned,
      paramsOverride: r.params,
    });
  } catch (e) {
    // No burst was added: nothing else will free the snapshots it would have owned.
    owned?.forEach((img) => img.dispose());
    throw e;
  }
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
  const ref = useRef<ViewRef>(null);
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
