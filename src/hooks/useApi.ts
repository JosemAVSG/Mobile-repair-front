import { useState, useEffect, useCallback, useRef } from 'react';

// ──────────────────────────────────────────────
// useApi — Generic data-fetching hook
// ──────────────────────────────────────────────

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: () => Promise<void>;
}

/**
 * Generic hook to fetch data from an async source.
 *
 * @param fetcher   Async function that returns the desired data
 * @param autoFetch If true (default), calls the fetcher on mount
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  autoFetch = true,
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: autoFetch,
    error: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetcherRef.current();
      setState({ data: result, loading: false, error: null });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error inesperado';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      execute();
    }
    // Only run on mount when autoFetch is true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, execute };
}
