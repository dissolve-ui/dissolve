'use client';
/**
 * Tooltip for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as the
 * React Native version; the tooltip itself lives in tooltip.core.ts.
 *
 * A small label with an arrow for the element it wraps: hover, focus or press and hold, it grows in
 * after the delay, flips and slides to stay on screen. role="tooltip" and aria-describedby on the
 * wrapped element, Escape hides it.
 *
 * <Tooltip content="Share">
 *   <button aria-label="Share" onClick={share}><ShareIcon /></button>
 * </Tooltip>
 *
 * <Tooltip content="Archived items are kept 30 days" placement="bottom" delay={250}>
 *   <InfoIcon tabIndex={0} />
 * </Tooltip>
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createTooltip, type TooltipPlacement, type TooltipProps as CoreProps } from './tooltip.core';
import { useDissolveCore } from './react';

export type { TooltipPlacement };

export type TooltipProps = Omit<CoreProps, 'content'> & {
  /** The label. A string, or any node. */
  content: ReactNode;
  /** The element it describes. Make it focusable (a button, a link, tabIndex) for keyboard users. */
  children: ReactElement;
  /** Classes of the wrapper around the element (margins...). */
  className?: string;
  style?: CSSProperties;
};

export function Tooltip({ content, children, className, style, ...props }: TooltipProps) {
  const { host, instance } = useDissolveCore(createTooltip, props);
  return (
    <span ref={host} className={className} style={{ display: 'inline-flex', ...style }}>
      {children}
      {instance ? createPortal(content, instance.slot()) : null}
    </span>
  );
}
