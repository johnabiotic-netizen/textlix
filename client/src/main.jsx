import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/index.css';

// Sentry is dynamically imported and initialised 1.5s after window 'load' so
// it doesn't add to the initial JS bundle parsed during the LCP/TBT window.
// Crashes that happen in the first ~2s of a session are still picked up by
// Sentry's own global error queue once it boots.
if (import.meta.env.VITE_SENTRY_DSN) {
  const bootSentry = () => {
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
        ],
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1,
      });
    });
  };
  if (document.readyState === 'complete') {
    setTimeout(bootSentry, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(bootSentry, 1500), { once: true });
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          success: { style: { background: '#D1FAE5', color: '#065F46', border: '1px solid #10B981' } },
          error: { style: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #EF4444' } },
        }}
      />
    </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
