'use client';
/**
 * ThinkingOrb for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the orb itself lives in thinking-orb.core.ts.
 *
 * A sphere of dots whose motion shows what an AI agent is doing. Every state change morphs the
 * dots from where they are to the new shape (600 ms, staggered), never an instant swap.
 *
 * <ThinkingOrb state={busy ? 'thinking' : 'idle'} size={96} />
 * <ThinkingOrb state="listening" level={micLevel} interactive />
 */
import type { CSSProperties } from 'react';
import { createThinkingOrb, type OrbState, type ThinkingOrbProps as CoreProps } from './thinking-orb.core';
import { useDissolveCore } from './react';

export type { OrbState };

export type ThinkingOrbProps = CoreProps & {
  /** Classes of the container. Its size comes from size. */
  className?: string;
  style?: CSSProperties;
};

export function ThinkingOrb({ className, style, ...props }: ThinkingOrbProps) {
  const { host } = useDissolveCore(createThinkingOrb, props);
  return <div ref={host} className={className} style={style} />;
}
