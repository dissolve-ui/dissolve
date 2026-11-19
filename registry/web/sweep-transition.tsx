'use client';
/**
 * SweepTransition for React on the web, from dissolve (dissolve-ui). This file is yours. Same props
 * as the React Native version; the sweep itself lives in sweep-transition.core.ts.
 *
 * Wrap any view and call run() with your state change. The current view is captured, the new
 * state mounts under the capture, and a band sweeps across it, bending what it passes with a
 * light refraction, a hint of RGB split and a 1 px accent rim. No blur.
 *
 * const sweep = useRef<SweepTransitionHandle>(null);
 * <SweepTransition ref={sweep} mode="vertical" className="rounded-3xl">
 *   <PlanCard plan={plan} />
 * </SweepTransition>
 * sweep.current?.run(() => setPlan('pro'), { revert: () => setPlan('free') });
 */
import { useImperativeHandle, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createSweepTransition, type SweepMode, type SweepRunOptions, type SweepTransitionHandle, type SweepTransitionProps as CoreProps } from './sweep-transition.core';
import { useDissolveCore } from './react';

export type { SweepMode, SweepRunOptions, SweepTransitionHandle };

export type SweepTransitionProps = CoreProps & {
  /** The view that changes. */
  children: ReactNode;
  /** Classes of the wrapper (radius, size...). It clips the sweep. */
  className?: string;
  style?: CSSProperties;
  ref?: Ref<SweepTransitionHandle>;
};

export function SweepTransition({ children, className, style, ref, ...props }: SweepTransitionProps) {
  const { host, instance, current } = useDissolveCore(createSweepTransition, props);
  useImperativeHandle(ref, () => ({
    // flushSync: the new state is in the DOM before the band starts.
    run: async (apply, options) => current.current?.run(() => flushSync(apply), options && { ...options, revert: options.revert && (() => flushSync(options.revert!)) }),
    cancel: () => current.current?.cancel(),
    running: () => current.current?.running() ?? false,
  }), [current]);
  return <div ref={host} className={className} style={style}>{instance ? createPortal(children, instance.slot) : null}</div>;
}
