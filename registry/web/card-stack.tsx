'use client';
/**
 * CardStack for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as the
 * React Native version; the stack itself lives in card-stack.core.ts.
 *
 * A Wallet style stack. Cards overlap and show their top strip; tap one and it comes forward while
 * the others slide down and compress under it. Drag the focused card down to put it back, swipe it
 * sideways to go to the next one. The cards are yours: renderCard draws them, the stack adds the
 * chrome (corner radius, clip and shadow).
 *
 * <CardStack items={cards} keyExtractor={(c) => c.id} renderCard={(c) => <PaymentCard card={c} />} onFocus={setActive} />
 *
 * <CardStack items={passes} renderCard={(p) => <Pass pass={p} />} peek={44} cardClassName="rounded-2xl shadow-lg" />
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createCardStack, type CardStackProps as CoreProps } from './card-stack.core';
import { useDissolveCore } from './react';

export type CardStackProps<T> = Omit<CoreProps, 'keys'> & {
  items: T[];
  /** Renders one card face. It is clipped to the card radius. */
  renderCard: (item: T, index: number) => ReactNode;
  /** Stable keys for the cards. Default: the index. */
  keyExtractor?: (item: T, index: number) => string;
  /** Container classes (margins, padding, width...). */
  className?: string;
  style?: CSSProperties;
};

export function CardStack<T>({ items, renderCard, keyExtractor, className, style, ...props }: CardStackProps<T>) {
  const keys = items.map((item, i) => (keyExtractor ? keyExtractor(item, i) : String(i)));
  const { host, instance } = useDissolveCore(createCardStack, { ...props, keys });
  return (
    <div ref={host} className={className} style={style}>
      {instance ? items.map((item, i) => createPortal(renderCard(item, i), instance.slot(keys[i]), keys[i])) : null}
    </div>
  );
}
