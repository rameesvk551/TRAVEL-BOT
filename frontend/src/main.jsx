// FILE: /frontend/src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

window.__TRAVELBOT_FRONTEND_BUILD__ = '2026-07-06-package-category-cache-bust';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => (window.caches ? caches.keys() : []))
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => {});
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            background: '#171717',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 16px',
          },
          success: { iconTheme: { primary: '#00A884', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
