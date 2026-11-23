'use client';
/**
 * AvatarStack for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the stack itself lives in avatar-stack.core.ts.
 *
 * Overlapping avatars with a "+N" chip. Hover (or press and hold) to spread them apart with a name
 * tooltip; adding or removing a person animates the stack.
 *
 * <AvatarStack
 *   avatars={[
 *     { id: 'ava', name: 'Ava Chen', src: 'https://example.com/ava.jpg' },
 *     { id: 'ben', name: 'Ben Ortiz' },
 *   ]}
 * />
 *
 * <AvatarStack avatars={team} max={3} size="sm" />
 */
import type { CSSProperties } from 'react';
import { createAvatarStack, type AvatarStackItem, type AvatarStackProps as CoreProps, type AvatarStackSize } from './avatar-stack.core';
import { useDissolveCore } from './react';

export type { AvatarStackItem, AvatarStackSize };

export type AvatarStackProps = CoreProps & {
  avatars: AvatarStackItem[];
  /** Outer classes (margins...). */
  className?: string;
  style?: CSSProperties;
};

export function AvatarStack({ className, style, ...props }: AvatarStackProps) {
  const { host } = useDissolveCore(createAvatarStack, props);
  return <div ref={host} className={className} style={style} />;
}
