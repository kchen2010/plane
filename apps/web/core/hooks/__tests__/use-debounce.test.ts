// @ts-nocheck
/// <reference types="jest" />

import { renderHook } from "@testing-library/react";
import { useDebounce } from "../use-debounce";

// Tell Jest to hijack the global JavaScript clock
jest.useFakeTimers();

describe("useDebounce Hook", () => {
  it("should return the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("should delay the state update until the specified time has passed", () => {
    // 1. Render the hook with an initial value
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "initial", delay: 300 } }
    );

    // 2. Simulate the user typing "Frontend Bug"
    rerender({ value: "Frontend Bug", delay: 300 });

    // 3. Immediately after typing, the debounced value MUST still be the old one
    expect(result.current).toBe("initial");

    // 4. Fast-forward time by 299 milliseconds (still hasn't reached 300ms)
    jest.advanceTimersByTime(299);
    expect(result.current).toBe("initial");

    // 5. Fast-forward the final 1 millisecond
    jest.advanceTimersByTime(1);
    
    // 6. NOW the value should finally update!
    expect(result.current).toBe("Frontend Bug");
  });
});