'use client';
/**
 * GooeyMenu for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the menu itself lives in gooey-menu.core.ts.
 *
 * A floating button whose actions pour out of it as drops and melt back in when it closes.
 * Place it absolutely (it reserves room for the arc above and to the left of the button).
 * Icons inherit the primary foreground color: draw them in currentColor.
 *
 * <GooeyMenu className="absolute bottom-2 right-2" items={[
 *   { icon: <CameraIcon />, onPress: openCamera, label: 'Camera' },
 *   { icon: <PhotoIcon />, onPress: openLibrary, label: 'Photo' },
 * ]} />
 *
 * <GooeyMenu size={48} distance={80} startAngle={-180} endAngle={-270} items={actions} />
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createGooeyMenu, type GooeyMenuProps as CoreProps } from './gooey-menu.core';
import { useDissolveCore } from './react';

export type GooeyMenuItem = { icon: ReactNode; onPress: () => void; label?: string };

export type GooeyMenuProps = Omit<CoreProps, 'items'> & {
  items: GooeyMenuItem[];
  /** Root classes (position, margins...). */
  className?: string;
  style?: CSSProperties;
};

export function GooeyMenu({ items, className, style, ...props }: GooeyMenuProps) {
  const { host, instance } = useDissolveCore(createGooeyMenu, { ...props, items });
  return (
    <div ref={host} className={className} style={style}>
      {instance ? items.map((it, i) => createPortal(it.icon, instance.icon(i), String(i))) : null}
    </div>
  );
}
