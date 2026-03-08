/**
 * Tests for CR2: Broken guard in handleIssuesLocalFilters.get
 *
 * The original guard was:
 *   if (!currentFilterIndex && currentFilterIndex.length < 0) return undefined;
 *
 * This was always false because:
 *   - !(-1) === false  (so "not found" never returned undefined)
 *   - (0).length      === undefined (so index-0 accidentally passed through)
 *
 * The fix:
 *   if (currentFilterIndex < 0) return undefined;
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Isolated reproduction of the guard logic — no store import needed
// ---------------------------------------------------------------------------

interface StoredFilter {
  key: string;
  workspaceSlug: string;
  viewId: string | undefined;
  userId: string | undefined;
  filters: Record<string, unknown>;
}

/** BUGGY implementation — kept here to document the before state */
function getLocalFilterBuggy(
  storageFilters: StoredFilter[],
  key: string,
  workspaceSlug: string,
  viewId: string | undefined,
  userId: string | undefined
): Record<string, unknown> | undefined {
  const currentFilterIndex = storageFilters.findIndex(
    (f) => f.key === key && f.workspaceSlug === workspaceSlug && f.viewId === viewId && f.userId === userId
  );
  // Original (buggy) guard
  // @ts-expect-error — intentionally reproducing the runtime bug (number has no .length)
  if (!currentFilterIndex && currentFilterIndex.length < 0) return undefined;
  return storageFilters[currentFilterIndex]?.filters || {};
}

/** FIXED implementation */
function getLocalFilterFixed(
  storageFilters: StoredFilter[],
  key: string,
  workspaceSlug: string,
  viewId: string | undefined,
  userId: string | undefined
): Record<string, unknown> | undefined {
  const currentFilterIndex = storageFilters.findIndex(
    (f) => f.key === key && f.workspaceSlug === workspaceSlug && f.viewId === viewId && f.userId === userId
  );
  if (currentFilterIndex < 0) return undefined; // Fixed guard
  return storageFilters[currentFilterIndex]?.filters || {};
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const FILTERS: StoredFilter[] = [
  { key: "PROJECT", workspaceSlug: "ws-a", viewId: "proj-1", userId: "user-1", filters: { layout: "kanban" } },
  { key: "PROJECT", workspaceSlug: "ws-a", viewId: "proj-2", userId: "user-1", filters: { layout: "list" } },
];

// ---------------------------------------------------------------------------
// Demonstrating the bug (before state)
// ---------------------------------------------------------------------------

describe("CR2 — Buggy guard (before state, for documentation)", () => {
  it("incorrectly returns {} instead of undefined when filter is not found", () => {
    const result = getLocalFilterBuggy(FILTERS, "PROJECT", "ws-a", "nonexistent", "user-1");
    // BUG: returns {} instead of undefined — callers cannot distinguish "no filter" from "empty filter"
    expect(result).toEqual({});
  });

  it("correctly returns the filter found at index 0 (accidental correct behavior)", () => {
    const result = getLocalFilterBuggy(FILTERS, "PROJECT", "ws-a", "proj-1", "user-1");
    expect(result).toEqual({ layout: "kanban" });
  });
});

// ---------------------------------------------------------------------------
// Verifying the fix (after state)
// ---------------------------------------------------------------------------

describe("CR2 — Fixed guard (after state)", () => {
  it("returns undefined when no stored filter matches", () => {
    const result = getLocalFilterFixed(FILTERS, "PROJECT", "ws-a", "nonexistent", "user-1");
    expect(result).toBeUndefined();
  });

  it("returns undefined for an empty storage array", () => {
    const result = getLocalFilterFixed([], "PROJECT", "ws-a", "proj-1", "user-1");
    expect(result).toBeUndefined();
  });

  it("returns the correct filter when found at index 0", () => {
    const result = getLocalFilterFixed(FILTERS, "PROJECT", "ws-a", "proj-1", "user-1");
    expect(result).toEqual({ layout: "kanban" });
  });

  it("returns the correct filter when found at index > 0", () => {
    const result = getLocalFilterFixed(FILTERS, "PROJECT", "ws-a", "proj-2", "user-1");
    expect(result).toEqual({ layout: "list" });
  });

  it("returns undefined when workspaceSlug does not match", () => {
    const result = getLocalFilterFixed(FILTERS, "PROJECT", "ws-different", "proj-1", "user-1");
    expect(result).toBeUndefined();
  });

  it("returns undefined when userId does not match", () => {
    const result = getLocalFilterFixed(FILTERS, "PROJECT", "ws-a", "proj-1", "user-different");
    expect(result).toBeUndefined();
  });

  it("bug fix: findIndex(-1) is truthy in JS so original !(-1) was false, bypassing the guard", () => {
    // Demonstrates WHY the original guard was broken
    const index = -1;
    expect(!index).toBe(false); // -1 is truthy, so !(-1) === false → guard never triggered
    expect(index < 0).toBe(true); // fixed: simple numeric comparison works correctly
  });
});
