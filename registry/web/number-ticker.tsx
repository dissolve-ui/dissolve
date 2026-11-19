'use client';
/**
 * NumberTicker for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the columns live in number-ticker.core.ts.
 *
 * <NumberTicker value={1240.5} decimals={2} locale="fr-FR" suffix={' €'} fontSize={44} />
 * <NumberTicker value={balance} decimals={2} prefix="$" textClassName="text-green-600" />
 */
import type { CSSProperties } from 'react';
import { createNumberTicker, type NumberTickerProps as CoreProps } from './number-ticker.core';
import { useDissolveCore } from './react';

export type NumberTickerProps = CoreProps & {
  /** Root classes (margins, alignment...). */
  className?: string;
  style?: CSSProperties;
};

export function NumberTicker({ className, style, ...props }: NumberTickerProps) {
  const { host } = useDissolveCore(createNumberTicker, props);
  return <div ref={host} className={className} style={style} />;
}
