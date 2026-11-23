'use client';
/**
 * TypingIndicator for React on the web, from dissolve (dissolve-ui). This file is yours. Same
 * props as the React Native version; the indicator lives in typing-indicator.core.ts.
 *
 * The chat typing indicator: the avatars of who is typing stacked and overlapping, a bubble of
 * three dots in a wave, and "Ana and Ben are typing" under them. Avatars pop in and shrink away
 * as people start and stop typing, the stack sliding to make room; past maxAvatars a +N disc
 * stands for the rest. With nobody typing it fades out and keeps its height.
 *
 * <TypingIndicator typers={typing.map((u) => ({ id: u.id, name: u.firstName, avatar: u.photo }))} />
 */
import type { CSSProperties } from 'react';
import { createTypingIndicator, type TypingIndicatorProps as CoreProps } from './typing-indicator.core';
import { useDissolveCore } from './react';

export type { Typer } from './typing-indicator.core';

export type TypingIndicatorProps = CoreProps & {
  className?: string;
  style?: CSSProperties;
};

export function TypingIndicator({ className, style, ...props }: TypingIndicatorProps) {
  const { host } = useDissolveCore(createTypingIndicator, props);
  return <div ref={host} className={className} style={style} />;
}
