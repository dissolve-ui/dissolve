'use client';
/**
 * BarChart for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as the
 * React Native version; the chart itself lives in bar-chart.core.ts.
 *
 * A bar chart made of small dots. The dots fly in and assemble the bars; hover or drag across the
 * chart and a bubble follows the bar under the pointer while nearby dots scatter. New data sends
 * the dots falling from the old bars and gathers them into the new ones.
 *
 * <BarChart data={[{ label: 'Mon', value: 8412 }, { label: 'Tue', value: 10230 }]} />
 * <BarChart stacked data={[{ label: 'Mon', values: [42, 18, 6] }]} formatValue={(v) => `${v} €`} />
 */
import type { CSSProperties } from 'react';
import { createBarChart, type BarChartProps as CoreProps, type BarDatum, type BarToken } from './bar-chart.core';
import { useDissolveCore } from './react';

export type { BarDatum, BarToken };

export type BarChartProps = CoreProps & {
  /** Root classes (margins, padding...). */
  className?: string;
  style?: CSSProperties;
};

export function BarChart({ className, style, ...props }: BarChartProps) {
  const { host } = useDissolveCore(createBarChart, props);
  return <div ref={host} className={className} style={style} />;
}
