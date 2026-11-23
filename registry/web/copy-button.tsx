'use client';
/**
 * CopyButton for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the button itself lives in copy-button.core.ts.
 *
 * An icon button that copies text: the copy icon breaks into a few grains that reform as a check,
 * with a tiny pop, while a "Copied" tooltip rises above it. After 1.5 s it settles back.
 *
 * <CopyButton text="npx dissolve-ui add copy-button" />
 *
 * <CopyButton text={() => editor.getValue()} size="sm" onCopy={(t) => track('copied', t.length)} />
 */
import type { CSSProperties } from 'react';
import { createCopyButton, type CopyButtonProps as CoreProps, type CopyButtonSize } from './copy-button.core';
import { useDissolveCore } from './react';

export type { CopyButtonSize };

export type CopyButtonProps = CoreProps & {
  /** The text to copy, or a function that returns it at click time. */
  text: string | (() => string);
  /** Outer classes (margins, background...). The size comes from the size prop. */
  className?: string;
  style?: CSSProperties;
};

export function CopyButton({ className, style, ...props }: CopyButtonProps) {
  const { host } = useDissolveCore(createCopyButton, props);
  return <button ref={host} type="button" className={className} style={style} />;
}
