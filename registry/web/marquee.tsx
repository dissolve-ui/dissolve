'use client';
/**
 * Marquee for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the motion lives in marquee.core.ts.
 *
 * An endless row (logos, words, cards) that scrolls on its own and is seamless at any width.
 * Hover or press to ease it to a stop, drag to scrub with inertia, edges faded by a mask.
 *
 * <Marquee speed={40} accessibilityLabel="What people say">
 *   {quotes.map((q) => <QuoteCard key={q.id} quote={q} />)}
 * </Marquee>
 *
 * Children are rendered once; the copies that fill the row are made for you and hidden from
 * screen readers.
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createMarquee, type MarqueeProps as CoreProps } from './marquee.core';
import { useDissolveCore } from './react';

export type MarqueeProps = CoreProps & {
  /** The items of the row, once. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Marquee({ children, className, style, ...props }: MarqueeProps) {
  const { host, instance } = useDissolveCore(createMarquee, props);
  return (
    <div ref={host} className={className} style={style}>
      {instance ? createPortal(children, instance.content) : null}
    </div>
  );
}
