import { createContext, useContext } from 'react';

export const ContinuumContext = createContext(null);
export function useContinuum() {
  const context = useContext(ContinuumContext);
  if (!context) throw new Error('useContinuum must be used within a ContinuumProvider');
  return context;
}
