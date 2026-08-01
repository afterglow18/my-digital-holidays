import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeRevenueCat } from './lib/revenuecat';

// Kick off RC configure() immediately on launch so the native SDK is ready
// before any component mounts. Must happen here — waiting for a component
// to mount (e.g. useRevenueCat hook) is too late for purchase flows.
initializeRevenueCat()
  .then(() => console.log("[RC] init success ✓"))
  .catch((e) => console.error("[RC] init failed:", e));

createRoot(document.getElementById('root')!).render(<App />);
