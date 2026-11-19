import { createContext, useContext } from 'react';
import type { DissolveCtx } from './types';

export const DissolveContext = createContext<DissolveCtx | null>(null);

/** Provider context for the effect hooks: add / remove bursts, reduced motion. */
export function useDissolveContext(): DissolveCtx {
  const ctx = useContext(DissolveContext);
  if (!ctx) throw new Error('dissolve-ui hooks must be used inside <DissolveProvider>');
  return ctx;
}
