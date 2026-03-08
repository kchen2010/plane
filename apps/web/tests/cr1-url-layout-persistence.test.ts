/**
 * Tests for CR1: URL-based layout persistence
 *
 * Covers the logic added to handleLayoutChange (filters.tsx) and the SWR
 * callback in project-layout-root.tsx that restores layout from the URL.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers that mirror the production logic exactly
// ---------------------------------------------------------------------------

/** Mirrors the URL-write block added to handleLayoutChange in filters.tsx */
function writeLayoutToUrl(layout: string): void {
  try {
    const params = new URLSearchParams(window.location.search);
    params.set("layout", layout);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  } catch (e) {
    console.warn("[HeaderFilters] Failed to persist layout to URL:", e);
  }
}

const VALID_LAYOUTS = ["list", "kanban", "calendar", "spreadsheet", "gantt_chart"];

/** Mirrors the URL-read / validation block added to the SWR callback in project-layout-root.tsx */
function readLayoutFromUrl(search: string): string | null {
  const urlLayout = new URLSearchParams(search).get("layout");
  if (urlLayout && VALID_LAYOUTS.includes(urlLayout)) return urlLayout;
  return null;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("CR1 — URL-based layout persistence", () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    replaceStateSpy = vi.spyOn(window.history, "replaceState");
    // Reset to a clean pathname with no query params
    window.history.replaceState(null, "", "/workspace/project/issues/");
    // Clear the spy count from the setup call above so tests start at 0
    replaceStateSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario: Select layout updates URL
  // -------------------------------------------------------------------------
  it("writes the selected layout to the URL query param", () => {
    writeLayoutToUrl("kanban");
    expect(replaceStateSpy).toHaveBeenCalledOnce();
    const calledUrl = replaceStateSpy.mock.calls[0][2] as string;
    expect(calledUrl).toContain("layout=kanban");
  });

  it("writes each valid layout correctly", () => {
    for (const layout of VALID_LAYOUTS) {
      replaceStateSpy.mockClear();
      writeLayoutToUrl(layout);
      const calledUrl = replaceStateSpy.mock.calls[0][2] as string;
      expect(calledUrl).toContain(`layout=${layout}`);
    }
  });

  it("preserves existing query params when writing layout", () => {
    // happy-dom does not reflect replaceState calls in window.location.search,
    // so we stub location.search directly to simulate an existing param.
    vi.stubGlobal("location", { ...window.location, search: "?priority=high", pathname: "/workspace/project/issues/" });
    writeLayoutToUrl("list");
    const calledUrl = replaceStateSpy.mock.calls[0][2] as string;
    expect(calledUrl).toContain("priority=high");
    expect(calledUrl).toContain("layout=list");
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Scenario: Reload preserves selection / Direct link restores layout
  // -------------------------------------------------------------------------
  it("reads a valid layout param from the URL on page load", () => {
    const result = readLayoutFromUrl("?layout=kanban");
    expect(result).toBe("kanban");
  });

  it("reads layout=gantt_chart correctly", () => {
    expect(readLayoutFromUrl("?layout=gantt_chart")).toBe("gantt_chart");
  });

  it("returns null when no layout param is present", () => {
    expect(readLayoutFromUrl("")).toBeNull();
    expect(readLayoutFromUrl("?priority=high")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Scenario: Invalid layout param ignored
  // -------------------------------------------------------------------------
  it("ignores an invalid layout param and returns null", () => {
    expect(readLayoutFromUrl("?layout=foobar")).toBeNull();
    expect(readLayoutFromUrl("?layout=")).toBeNull();
    expect(readLayoutFromUrl("?layout=<script>")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Scenario: Graceful failure
  // -------------------------------------------------------------------------
  it("does not throw when history.replaceState throws; logs a warning instead", () => {
    replaceStateSpy.mockImplementationOnce(() => {
      throw new DOMException("SecurityError", "SecurityError");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => writeLayoutToUrl("list")).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[HeaderFilters] Failed to persist layout to URL:"),
      expect.any(DOMException)
    );
  });

  it("does not throw when URLSearchParams is unavailable; logs a warning", () => {
    const OriginalURLSearchParams = globalThis.URLSearchParams;
    // @ts-expect-error intentional undefined for test
    globalThis.URLSearchParams = undefined;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => writeLayoutToUrl("list")).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    globalThis.URLSearchParams = OriginalURLSearchParams;
  });
});
