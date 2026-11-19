'use client';
/**
 * BeforeAfter for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the frame itself lives in before-after.core.ts.
 *
 * Compare two versions of an image. Drag the round handle (or anywhere on the frame), or tap to
 * send the divider there. The before layer is clipped to the left of the divider, the pills fade
 * as the divider reaches them.
 *
 * <BeforeAfter
 *   before={<img src={raw} alt="" className="size-full object-cover" />}
 *   after={<img src={edited} alt="" className="size-full object-cover" />}
 * />
 *
 * <BeforeAfter
 *   height={240}
 *   initial={0.42}
 *   afterLabel="Vivid"
 *   renderBefore={({ width, height }) => <Photo src={raw} width={width} height={height} />}
 *   renderAfter={({ width, height }) => <Photo src={edited} width={width} height={height} />}
 * />
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createBeforeAfter, type BeforeAfterProps as CoreProps, type BeforeAfterSize } from './before-after.core';
import { useDissolveCore } from './react';

export type { BeforeAfterSize };

export type BeforeAfterProps = CoreProps & {
  /** Shown on the left of the divider. An element, or a render prop given the frame size. */
  before?: ReactNode;
  after?: ReactNode;
  renderBefore?: (size: BeforeAfterSize) => ReactNode;
  renderAfter?: (size: BeforeAfterSize) => ReactNode;
  /** Frame classes (radius, placeholder background, margins...). */
  className?: string;
  style?: CSSProperties;
};

export function BeforeAfter({ before, after, renderBefore, renderAfter, className, style, onResize, ...props }: BeforeAfterProps) {
  const [size, setSize] = useState<BeforeAfterSize | null>(null);
  const { host, instance } = useDissolveCore(createBeforeAfter, {
    ...props,
    onResize: (s: BeforeAfterSize) => {
      setSize((was) => (was?.width === s.width && was.height === s.height ? was : s));
      onResize?.(s);
    },
  });
  const show = instance && size;
  return (
    <div ref={host} className={className} style={style}>
      {show ? createPortal(renderBefore ? renderBefore(size) : before, instance.before) : null}
      {show ? createPortal(renderAfter ? renderAfter(size) : after, instance.after) : null}
    </div>
  );
}
