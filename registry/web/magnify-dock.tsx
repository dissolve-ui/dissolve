'use client';
/**
 * MagnifyDock for React on the web, from dissolve (dissolve-ui). This file is yours. Same
 * props as the React Native version; the dock itself lives in magnify-dock.core.ts.
 *
 * The macOS dock: icons swell on springs around the pointer, the frosted shelf widening with
 * them; the name floats above; a click launches with a bounce, then a running dot. Press and
 * slide on a phone, lift to launch. Arrow keys, Home, End, Enter.
 *
 * <MagnifyDock
 *   items={[
 *     { key: 'mail', label: 'Mail', icon: dockIcon('mail') },
 *     { key: 'calendar', label: 'Calendar', icon: dockIcon('calendar') },
 *   ]}
 *   onLaunch={(item) => open(item.key)}
 * />
 *
 * Icons are vector specs (dockIcon presets, or your own DockIconSpec), redrawn crisp at every
 * size. It takes the full width and reserves the height it needs above the shelf.
 */
import type { CSSProperties } from 'react';
import { createMagnifyDock, type DockItem, type MagnifyDockProps as CoreProps } from './magnify-dock.core';
import { useDissolveCore } from './react';

export { dockIcon, type DockIconSpec, type DockItem, type DockLayer, type DockPaint } from './magnify-dock.core';

export type MagnifyDockProps = CoreProps<DockItem> & {
  items: readonly DockItem[];
  className?: string;
  style?: CSSProperties;
};

export function MagnifyDock({ className, style, ...props }: MagnifyDockProps) {
  const { host } = useDissolveCore(createMagnifyDock<DockItem>, props);
  return <div ref={host} className={className} style={style} />;
}
