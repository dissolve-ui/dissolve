'use client';
/**
 * RangeSlider for React on the web, from dissolve (dissolve-ui). This file is yours. Same props
 * as the React Native version; the slider lives in range-slider.core.ts.
 *
 * A dual handle range slider: the handles never cross, the track fills between them and the values
 * roll in bubbles while you drag. Optional steps with tick marks. Arrows, Page Up, Page Down, Home
 * and End on each handle.
 *
 * <RangeSlider min={0} max={1000} step={10} defaultValue={[120, 640]} prefix="$" onValueChange={setPrice} />
 * <RangeSlider min={0} max={10} step={1} value={km} onValueChange={setKm} suffix=" km" />
 */
import type { CSSProperties } from 'react';
import { createRangeSlider, type RangeSliderProps as CoreProps } from './range-slider.core';
import { useDissolveCore } from './react';

export type { RangeValue } from './range-slider.core';

export type RangeSliderProps = CoreProps & {
  /** Outer classes (margins, width...). The height is the slider's own. */
  className?: string;
  style?: CSSProperties;
};

export function RangeSlider({ className, style, ...props }: RangeSliderProps) {
  const { host } = useDissolveCore(createRangeSlider, props);
  return <div ref={host} className={className} style={style} />;
}
