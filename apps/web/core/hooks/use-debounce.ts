import { useState, useEffect } from "react";

export default useDebounce;
/**
 * A hook that delays updating its value until a specified delay has passed
 * without any new updates. Perfect for search inputs to prevent excessive re-renders.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set a timer to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function: If the user types again before the delay finishes,
    // this clears the previous timer, preventing the old value from setting.
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
