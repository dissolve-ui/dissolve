'use client';
/**
 * PullToRefresh for React on the web, from dissolve (dissolve-ui). This file is yours. Same props
 * as the React Native version; the ring and the pull live in pull-to-refresh.core.ts.
 *
 * Pull the list down past its top (drag, touch, or the wheel past the top): grains gather into a
 * ring, it spins while onRefresh runs, then the new items are built from its grains. Wrap each
 * item in PullItem with a stable id: any id not there when the refresh started is new. Give the
 * component a height, the content scrolls inside it.
 *
 * <PullToRefresh onRefresh={reload} className="h-[480px]">
 *   {items.map((item) => (
 *     <PullItem key={item.id} id={item.id}>
 *       <Row item={item} />
 *     </PullItem>
 *   ))}
 * </PullToRefresh>
 *
 * <PullToRefresh onRefresh={reload} className="h-[520px]" contentContainerStyle={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 }}>
 *   {cards.map((card) => (
 *     <PullItem key={card.id} id={card.id} className="h-36 rounded-3xl bg-dissolve-surface p-4">
 *       <Card card={card} />
 *     </PullItem>
 *   ))}
 * </PullToRefresh>
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createPullToRefresh, type PullToRefreshProps as CoreProps } from './pull-to-refresh.core';
import { useDissolveCore } from './react';

export type { PullToken } from './pull-to-refresh.core';

export type PullToRefreshProps = Omit<CoreProps, 'onRefresh' | 'contentContainerStyle'> & {
  /** List content, PullItems anywhere inside it. */
  children: ReactNode;
  /** Runs while the ring spins. Update your data before it resolves: new PullItems are built right after. */
  onRefresh: () => Promise<void>;
  /** Styles of the content box (padding, gap, a grid...). */
  contentContainerStyle?: CSSProperties;
  /** Root classes (height, background, radius, margins...). */
  className?: string;
  style?: CSSProperties;
};

export type PullItemProps = {
  /** Stable id of the item (your data key). An id not there when the refresh started is new. */
  id: string | number;
  children?: ReactNode;
  /** Classes of the item itself (background, radius, padding...). Captured with it. */
  className?: string;
  style?: CSSProperties;
};

export function PullToRefresh({ children, className, style, contentContainerStyle, ...props }: PullToRefreshProps) {
  const { host, instance } = useDissolveCore(createPullToRefresh, { ...props, contentContainerStyle: contentContainerStyle as CoreProps['contentContainerStyle'] });
  return <div ref={host} className={className} style={style}>{instance ? createPortal(children, instance.slot) : null}</div>;
}

/** One item of the refreshed content: a row, a card, a tile. A new one is built from the ring grains. */
export function PullItem({ id, children, className, style }: PullItemProps) {
  return <div data-pull-item={id} className={className} style={style}>{children}</div>;
}
