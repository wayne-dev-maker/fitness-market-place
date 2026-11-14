import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../services/http'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retrying a 4xx cannot succeed; only retry network and server failures.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      // Mutations are never retried automatically: a retry must be a deliberate user action.
      mutations: { retry: false },
    },
  })
}
