/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import ServiceContinuumProvider from './ServiceContinuumProvider.jsx';
export { useContinuum } from './ContinuumBase.js';
const DemoContinuumProvider = lazy(() => import('./DemoContinuumProvider.jsx'));
export function ContinuumProvider({ children }) {
  return new URLSearchParams(window.location.search).get('mode') === 'demo'
    ? <Suspense fallback={<p>Opening synthetic demo…</p>}><DemoContinuumProvider>{children}</DemoContinuumProvider></Suspense>
    : <ServiceContinuumProvider>{children}</ServiceContinuumProvider>;
}
