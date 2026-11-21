'use client';
/**
 * ElasticSlider for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the slider itself lives in elastic-slider.core.ts.
 *
 * A thick, rounded slider: the fill grows from the left with the texts inverting over it, and past
 * either end the track stretches like a rubber band, then snaps back with a bounce.
 *
 * <ElasticSlider label="Volume" value={volume} onValueChange={setVolume} formatValue={(v) => `${v}%`} />
 *
 * <ElasticSlider min={0} max={10} step={1} defaultValue={4} size="sm" showValue={false} />
 */
import type { CSSProperties } from 'react';
import { createElasticSlider, type ElasticSliderProps as CoreProps, type ElasticSliderSize } from './elastic-slider.core';
import { useDissolveCore } from './react';

export type { ElasticSliderSize };

export type ElasticSliderProps = CoreProps & {
  /** Outer classes (width, margins...). It stretches to its parent by default. */
  className?: string;
  style?: CSSProperties;
};

export function ElasticSlider({ className, style, ...props }: ElasticSliderProps) {
  const { host } = useDissolveCore(createElasticSlider, props);
  return <div ref={host} className={className} style={style} />;
}
