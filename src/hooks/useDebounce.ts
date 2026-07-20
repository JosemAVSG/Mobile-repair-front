import { useState, useEffect } from 'react';

/**
 * useDebounce — delays updating a value until a delay has elapsed
 * since the last change.
 *
 * @param value The raw value to debounce
 * @param delay Delay in milliseconds (default: 400)
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
