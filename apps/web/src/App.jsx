import { lazy, Suspense } from 'react';
import { MotionConfig } from 'motion/react';
import { ContinuumProvider, useContinuum } from './context/ContinuumContext.jsx';
import ServiceApp from './components/ServiceApp.jsx';
const DemoApp = lazy(() => import('./DemoApp.jsx'));
function AppContent() {
  const ctx = useContinuum();
  return ctx.serviceMode ? <ServiceApp /> : <Suspense fallback={<p>Opening synthetic demo…</p>}><DemoApp /></Suspense>;
}
export default function App() {
  return <MotionConfig reducedMotion="user"><ContinuumProvider><AppContent /></ContinuumProvider></MotionConfig>;
}
