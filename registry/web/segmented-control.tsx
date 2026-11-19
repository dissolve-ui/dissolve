'use client';
/**
 * SegmentedControl for React on the web, from dissolve (dissolve-ui). This file is yours. Same props
 * as the React Native version; the control itself lives in segmented-control.core.ts.
 *
 * An iOS style segmented control whose selection pill is made of grains: pick another segment and
 * the pill breaks into grains that flow over on a slight arc and reassemble there.
 *
 * <SegmentedControl segments={['Day', 'Week', 'Month', 'Year']} value={period} onChange={setPeriod} />
 *
 * <SegmentedControl segments={['Inbox', 'Archive']} defaultValue="Inbox" size="sm" className="w-56" />
 *
 * <SegmentedControl
 *   segments={[
 *     { value: 'list', label: 'List', icon: ({ color, size }) => <ListIcon color={color} size={size} /> },
 *     { value: 'grid', label: 'Grid', icon: ({ color, size }) => <GridIcon color={color} size={size} /> },
 *   ]}
 *   value={layout}
 *   onChange={setLayout}
 * />
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  createSegmentedControl,
  SEGMENTED_SIZES,
  type SegmentedControlProps as CoreProps,
  type SegmentedControlSize,
  type SegmentItem as CoreItem,
} from './segmented-control.core';
import { useDissolveCore } from './react';

export type { SegmentedControlSize };

export type SegmentItem = CoreItem & {
  /**
   * Leading icon: a node, or a function of { color, size, selected }. color is 'currentColor',
   * which is the label color (muted, or foreground once selected).
   */
  icon?: ReactNode | ((p: { color: string; size: number; selected: boolean }) => ReactNode);
};

export type SegmentedControlProps = Omit<CoreProps, 'segments'> & {
  /** The segments: plain strings, or { value, label?, icon? } items. Two or more. */
  segments: (string | SegmentItem)[];
  /** Track classes (width, margins...). It stretches to its parent by default. */
  className?: string;
  style?: CSSProperties;
};

export function SegmentedControl({ segments, className, style, ...props }: SegmentedControlProps) {
  const items = segments.map((s) => (typeof s === 'string' ? { value: s } : s));
  const { host, instance } = useDissolveCore(createSegmentedControl, { ...props, segments: items.map(({ value, label }) => ({ value, label })) });
  const size = SEGMENTED_SIZES[props.size ?? 'md'].icon;
  return (
    <div ref={host} className={className} style={style}>
      {instance
        ? items.flatMap(({ icon }, i) =>
            icon == null
              ? []
              : [false, true].map((on) =>
                  createPortal(typeof icon === 'function' ? icon({ color: 'currentColor', size, selected: on }) : icon, instance.icon(i, on), `${i}-${on}`),
                ),
          )
        : null}
    </div>
  );
}
