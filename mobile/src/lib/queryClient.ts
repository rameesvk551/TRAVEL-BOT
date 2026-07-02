// FILE: mobile/src/lib/queryClient.ts
// React Query client configuration — matches web defaults.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 min
      gcTime: 10 * 60 * 1000,      // 10 min (garbage collection)
      retry: 2,
      refetchOnWindowFocus: false,  // not relevant on mobile, but safe default
      refetchOnReconnect: true,     // re-fetch when network returns
    },
    mutations: {
      retry: 1,
    },
  },
});
