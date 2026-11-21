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
 *
 * <ElasticSlider label="Brightness" icon={({ color, size }) => <SunIcon color={color} size={size} />} defaultValue={70} />
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createElasticSlider, ELASTIC_SLIDER_SIZES, type ElasticSliderProps as CoreProps, type ElasticSliderSize } from './elastic-slider.core';
import { useDissolveCore } from './react';

export type { ElasticSliderSize };

export type ElasticSliderProps = CoreProps & {
  /**
   * Icon before the label: a node, or a function of { color, size }. color is 'currentColor', which
   * follows the fill's inversion.
   */
  icon?: ReactNode | ((p: { color: string; size: number }) => ReactNode);
  /** Outer classes (width, margins...). It stretches to its parent by default. */
  className?: string;
  style?: CSSProperties;
};

export function ElasticSlider({ icon, className, style, ...props }: ElasticSliderProps) {
  const { host, instance } = useDissolveCore(createElasticSlider, props);
  const size = Math.round(ELASTIC_SLIDER_SIZES[props.size ?? 'md'].font * 1.2);
  const glyph = () => (typeof icon === 'function' ? icon({ color: 'currentColor', size }) : icon);
  return (
    <div ref={host} className={className} style={style}>
      {instance && icon != null ? [false, true].map((on) => createPortal(glyph(), instance.icon(on), String(on))) : null}
    </div>
  );
}
