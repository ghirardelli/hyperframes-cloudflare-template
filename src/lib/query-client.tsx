import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ApiError, setUnauthorizedHandler } from "./api-client";

let browserQueryClient: QueryClient | undefined;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => shouldRetry(error, failureCount),
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function getQueryClient(): QueryClient {
  if (isServer) return createAppQueryClient();
  browserQueryClient ??= createAppQueryClient();
  return browserQueryClient;
}

export function AppQueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    setUnauthorizedHandler(() => queryClient.clear());
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function TestQueryProvider({
  children,
  client = createTestQueryClient(),
}: Readonly<{ children: ReactNode; client?: QueryClient }>) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function shouldRetry(error: unknown, failureCount: number): boolean {
  if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
  return failureCount < 2;
}
