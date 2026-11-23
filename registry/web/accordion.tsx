'use client';
/**
 * Accordion for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as the
 * React Native version; the sections themselves live in accordion.core.ts.
 *
 * Expandable sections on hairline dividers: the section opens on a smooth height curve while the
 * chevron turns over, then the content fades in and slides down into place. Headers are buttons
 * with aria-expanded, sections are regions, Arrow Up and Down move between headers.
 *
 * <Accordion
 *   items={[
 *     { value: 'shipping', title: 'Shipping', content: 'Orders leave the studio within two days.' },
 *     { value: 'returns', title: 'Returns', content: <ReturnsPolicy /> },
 *   ]}
 *   defaultValue={['shipping']}
 * />
 *
 * <Accordion type="multiple" items={faq} value={open} onValueChange={setOpen} />
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createAccordion, type AccordionProps as CoreProps } from './accordion.core';
import { useDissolveCore } from './react';

export type AccordionItem = {
  /** Unique key, also what value and onValueChange hold. */
  value: string;
  /** Header text. */
  title: string;
  /** The section. Any node; a string is set in the muted body style. */
  content: ReactNode;
  /** The header cannot be pressed. */
  disabled?: boolean;
};

export type AccordionProps = Omit<CoreProps, 'items'> & {
  items: AccordionItem[];
  /** Outer classes (margins, padding, background...). */
  className?: string;
  style?: CSSProperties;
};

export function Accordion({ items, className, style, ...props }: AccordionProps) {
  const { host, instance } = useDissolveCore(createAccordion, { ...props, items: items.map(({ value, title, disabled }) => ({ value, title, disabled })) });
  return (
    <div ref={host} className={className} style={style}>
      {instance ? items.map((item) => createPortal(item.content, instance.slot(item.value), item.value)) : null}
    </div>
  );
}
