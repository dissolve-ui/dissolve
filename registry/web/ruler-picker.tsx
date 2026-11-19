'use client';
/**
 * RulerPicker for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the ruler itself lives in ruler-picker.core.ts.
 *
 * A horizontal ruler you drag under a center needle: 1:1 pan, momentum, then a calm snap on the
 * nearest step. The value rolls above it, and graduations near the needle stretch with speed.
 *
 * <RulerPicker value={kg} onChange={setKg} min={30} max={200} step={0.1} unit="kg" />
 * <RulerPicker value={cm} onChange={setCm} min={120} max={220} unit="cm" majorEvery={10} />
 */
import type { CSSProperties } from 'react';
import { createRulerPicker, type RulerPickerProps as CoreProps } from './ruler-picker.core';
import { useDissolveCore } from './react';

export type RulerPickerProps = CoreProps & {
  /** Root classes (margins, width...). */
  className?: string;
  style?: CSSProperties;
};

export function RulerPicker({ className, style, ...props }: RulerPickerProps) {
  const { host } = useDissolveCore(createRulerPicker, props);
  return <div ref={host} className={className} style={style} />;
}
