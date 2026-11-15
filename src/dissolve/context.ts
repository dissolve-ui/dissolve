import { createContext, useContext } from 'react';
import type { DissolveCtx } from './types';

export const DissolveContext = createContext<DissolveCtx | null>(null);

/** Provider context for builder hooks: add / remove bursts, persistent layers, reduced motion. */
export function useDissolveContext(): DissolveCtx {
  const ctx = useContext(DissolveContext);
  if (!ctx) throw new Error('react-native-dissolve hooks must be used inside <DissolveProvider>');
  return ctx;
}
