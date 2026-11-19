'use client';
/**
 * SplitButton for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the button itself lives in split-button.core.ts.
 *
 * A button that divides in the middle like a drop of liquid metal: the two halves pull apart, a
 * neck between them thins into a waist, then snaps. Cancel fuses them back.
 *
 * <SplitButton label="Delete project" confirmLabel="Delete" onConfirm={remove} />
 *
 * <SplitButton label="Leave group" confirmLabel="Leave" gap={20} duration={500} className="w-72" onConfirm={leave} />
 */
import type { CSSProperties } from 'react';
import { createSplitButton, type SplitButtonProps as CoreProps } from './split-button.core';
import { useDissolveCore } from './react';

export type SplitButtonProps = CoreProps & {
  label: string;
  onConfirm: () => void;
  /** Root classes (margins, width...). */
  className?: string;
  style?: CSSProperties;
};

export function SplitButton({ className, style, ...props }: SplitButtonProps) {
  const { host } = useDissolveCore(createSplitButton, props);
  return <div ref={host} className={className} style={style} />;
}
