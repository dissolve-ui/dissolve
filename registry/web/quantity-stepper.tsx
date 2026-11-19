'use client';
/**
 * QuantityStepper for React on the web, from dissolve (dissolve-ui). This file is yours. Same props
 * as the React Native version; the stepper itself lives in quantity-stepper.core.ts.
 *
 * − / + pill for carts. The count rolls like a ticker; hold a button to repeat, faster and faster.
 * At the minimum the − turns into a trash that calls onRemove, so you can dissolve the row.
 *
 * <QuantityStepper value={qty} onChange={setQty} />
 *
 * <QuantityStepper value={qty} onChange={setQty} max={10} size="sm" onRemove={() => removeFromCart(item.id)} />
 */
import type { CSSProperties } from 'react';
import { createQuantityStepper, type QuantityStepperProps as CoreProps, type QuantityStepperSize } from './quantity-stepper.core';
import { useDissolveCore } from './react';

export type { QuantityStepperSize };

export type QuantityStepperProps = CoreProps & {
  /** Styles of the outer box (margins, position...). */
  style?: CSSProperties;
};

export function QuantityStepper({ style, ...props }: QuantityStepperProps) {
  const { host } = useDissolveCore(createQuantityStepper, props);
  return <div ref={host} style={style} />;
}
