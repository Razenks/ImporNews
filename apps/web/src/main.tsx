import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PlaceProvider } from './place';
import './styles.css';
import './motion.css';
import { initMotion } from './motion';

initMotion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlaceProvider>
      <App />
    </PlaceProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
