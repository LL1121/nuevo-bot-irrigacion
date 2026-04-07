import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import { initLogger, captureException } from './utils/logger'
import { initPerformanceMonitoring } from './utils/monitoring'
import { env } from './config/env'

async function bootstrap() {
  // Inicializar logger (Sentry si está instalado y configurado)
  await initLogger();
  
  // Inicializar performance monitoring y Web Vitals tracking
  await initPerformanceMonitoring();

  // Global handlers for unexpected errors
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = 'reason' in ev ? (ev as PromiseRejectionEvent).reason : ev;
    captureException(reason || ev, { type: 'unhandledrejection' });
  });

  window.addEventListener('error', (ev) => {
    captureException(ev.error || ev.message, { type: 'window.onerror' });
  });

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

bootstrap().catch(err => {
  if (env.enableLogging) console.error('Bootstrap error:', err);
});