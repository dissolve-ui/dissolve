'use client';
/**
 * ConfettiBurst for React on the web, from dissolve (dissolve-ui). This file is yours. Same
 * props as the React Native version; the physics live in confetti-burst.core.ts.
 *
 * A short, quiet celebration: a few small pieces of paper thrown up from a point or a button,
 * fluttering, turning and falling, gone in under two seconds. Monochrome by default.
 *
 * const confetti = useRef<ConfettiBurstHandle>(null);
 * <ConfettiBurst ref={confetti} />
 * <button ref={button} onClick={() => confetti.current?.fire({ from: button.current! })}>Place order</button>
 *
 * It renders nothing in place: the canvas goes over the viewport (or container) during a burst.
 */
import { useImperativeHandle, type Ref } from 'react';
import { createConfettiBurst, type ConfettiBurstProps as CoreProps, type FireOptions } from './confetti-burst.core';
import { useDissolveCore } from './react';

export type { ConfettiShape, FireOptions } from './confetti-burst.core';

export type ConfettiBurstHandle = {
  /** Throws one burst from a point (viewport px) or from the top of an element. */
  fire: (at?: FireOptions) => Promise<void>;
};

export type ConfettiBurstProps = CoreProps & {
  ref?: Ref<ConfettiBurstHandle>;
};

export function ConfettiBurst({ ref, ...props }: ConfettiBurstProps) {
  const { host, current } = useDissolveCore(createConfettiBurst, props);
  useImperativeHandle(ref, () => ({ fire: (at) => current.current?.fire(at) ?? Promise.resolve() }), [current]);
  return <span ref={host} hidden />;
}
