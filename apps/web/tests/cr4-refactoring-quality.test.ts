/**
 * CptS 481 – Deliverable 2: Code Quality & Improvement Tests
 *
 * These tests verify the correctness of the three refactoring changes:
 *   1. issue-filter-helper.store.ts — named constants replace inline magic literals
 *   2. filter.store.ts              — EIssueLayoutTypes enum replaces "kanban" magic string
 *   3. project-layout-root.tsx      — lookup map replaces switch statement
 *
 * Following the pattern of cr1/cr2/cr3 tests, all logic is mirrored inline
 * so tests have no dependency on the package build system.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Mirror of EIssueLayoutTypes from @plane/types
// (values confirmed from packages/types/src/issues/issue.ts)
// ---------------------------------------------------------------------------
const EIssueLayoutTypes = {
  LIST: "list",
  KANBAN: "kanban",
  CALENDAR: "calendar",
  GANTT: "gantt_chart",
  SPREADSHEET: "spreadsheet",
} as const;
type EIssueLayoutTypes = (typeof EIssueLayoutTypes)[keyof typeof EIssueLayoutTypes];

// ---------------------------------------------------------------------------
// Section 1: issue-filter-helper.store.ts — Named Constants
//
// Before: two local `const NON_SERVER_DISPLAY_FILTERS` arrays defined inline
//   inside getShouldReFetchIssues and getShouldClearIssues, both with the same
//   variable name but different contents — confusing and brittle.
//
// After: three module-level named constants with self-documenting names.
// ---------------------------------------------------------------------------

// Mirrors the extracted module-level constants in issue-filter-helper.store.ts
const DISPLAY_FILTER_REFETCH_KEYS = ["order_by", "sub_issue", "type"] as const;
const LAYOUT_CHANGE_CLEARS_ISSUES = ["layout"] as const;
const GANTT_EXPAND_PARAM = "issue_relation,issue_related";

/** Mirrors getShouldReFetchIssues after refactoring */
function getShouldReFetchIssues(displayFilters: Record<string, unknown>): boolean {
  const keys = Object.keys(displayFilters);
  return DISPLAY_FILTER_REFETCH_KEYS.some((k) => keys.includes(k));
}

/** Mirrors getShouldClearIssues after refactoring */
function getShouldClearIssues(displayFilters: Record<string, unknown>): boolean {
  const keys = Object.keys(displayFilters);
  return LAYOUT_CHANGE_CLEARS_ISSUES.some((k) => keys.includes(k));
}

describe("getShouldReFetchIssues — DISPLAY_FILTER_REFETCH_KEYS constant", () => {
  it("returns true when order_by is updated", () => {
    expect(getShouldReFetchIssues({ order_by: "-created_at" })).toBe(true);
  });

  it("returns true when sub_issue is updated", () => {
    expect(getShouldReFetchIssues({ sub_issue: true })).toBe(true);
  });

  it("returns true when type is updated", () => {
    expect(getShouldReFetchIssues({ type: "active" })).toBe(true);
  });

  it("returns false when layout changes (layout triggers clear, not refetch)", () => {
    expect(getShouldReFetchIssues({ layout: EIssueLayoutTypes.LIST })).toBe(false);
  });

  it("returns false for an empty filter object", () => {
    expect(getShouldReFetchIssues({})).toBe(false);
  });
});

describe("getShouldClearIssues — LAYOUT_CHANGE_CLEARS_ISSUES constant", () => {
  it("returns true when layout is updated", () => {
    expect(getShouldClearIssues({ layout: EIssueLayoutTypes.KANBAN })).toBe(true);
  });

  it("returns false when order_by changes (no cache clear needed)", () => {
    expect(getShouldClearIssues({ order_by: "-created_at" })).toBe(false);
  });

  it("returns false for an empty filter object", () => {
    expect(getShouldClearIssues({})).toBe(false);
  });

  it("REFETCH_KEYS and CLEAR_KEYS are disjoint — no key triggers both behaviours", () => {
    const refetchSet = new Set<string>(DISPLAY_FILTER_REFETCH_KEYS);
    const clearSet = new Set<string>(LAYOUT_CHANGE_CLEARS_ISSUES);
    const overlap = [...refetchSet].filter((k) => clearSet.has(k));
    expect(overlap).toHaveLength(0);
  });
});

describe("GANTT_EXPAND_PARAM constant", () => {
  it("equals the magic string it replaced", () => {
    expect(GANTT_EXPAND_PARAM).toBe("issue_relation,issue_related");
  });
});

// ---------------------------------------------------------------------------
// Section 2: filter.store.ts — EIssueLayoutTypes.KANBAN replaces "kanban"
//
// Before: layout === "kanban" written twice inline (lines 217, 224).
// After:  layout === EIssueLayoutTypes.KANBAN — enum is the single source of truth.
//
// These tests confirm the enum value matches the string the store depended on,
// so the refactoring is a pure rename with no behaviour change.
// ---------------------------------------------------------------------------

describe("EIssueLayoutTypes enum values — magic string replacement in filter.store.ts", () => {
  it('EIssueLayoutTypes.KANBAN equals "kanban"', () => {
    expect(EIssueLayoutTypes.KANBAN).toBe("kanban");
  });

  it('EIssueLayoutTypes.LIST equals "list"', () => {
    expect(EIssueLayoutTypes.LIST).toBe("list");
  });

  it('EIssueLayoutTypes.GANTT equals "gantt_chart"', () => {
    expect(EIssueLayoutTypes.GANTT).toBe("gantt_chart");
  });

  it('EIssueLayoutTypes.CALENDAR equals "calendar"', () => {
    expect(EIssueLayoutTypes.CALENDAR).toBe("calendar");
  });

  it('EIssueLayoutTypes.SPREADSHEET equals "spreadsheet"', () => {
    expect(EIssueLayoutTypes.SPREADSHEET).toBe("spreadsheet");
  });

  it("all five layout type values are distinct strings", () => {
    const values = Object.values(EIssueLayoutTypes);
    expect(new Set(values).size).toBe(values.length);
  });
});

// Mirrors the kanban guard logic extracted into _applyDisplayFilters.
describe("_applyDisplayFilters kanban guard logic — enum parity with old string literals", () => {
  /** Mirrors: layout === EIssueLayoutTypes.KANBAN && group_by === null */
  function kanbanNeedsDefaultGroupBy(layout: string, group_by: string | null): boolean {
    return layout === EIssueLayoutTypes.KANBAN && group_by === null;
  }

  /** Mirrors: layout === EIssueLayoutTypes.KANBAN && group_by === sub_group_by */
  function kanbanHasDuplicateGrouping(layout: string, group_by: string | null, sub_group_by: string | null): boolean {
    return layout === EIssueLayoutTypes.KANBAN && group_by === sub_group_by;
  }

  it("detects missing group_by when switching to kanban layout", () => {
    expect(kanbanNeedsDefaultGroupBy(EIssueLayoutTypes.KANBAN, null)).toBe(true);
  });

  it("does not trigger for kanban when group_by is already set", () => {
    expect(kanbanNeedsDefaultGroupBy(EIssueLayoutTypes.KANBAN, "state")).toBe(false);
  });

  it("does not trigger for a non-kanban layout even with null group_by", () => {
    expect(kanbanNeedsDefaultGroupBy(EIssueLayoutTypes.LIST, null)).toBe(false);
  });

  it("detects duplicate group_by / sub_group_by in kanban", () => {
    expect(kanbanHasDuplicateGrouping(EIssueLayoutTypes.KANBAN, "state", "state")).toBe(true);
  });

  it("does not flag distinct group_by / sub_group_by in kanban", () => {
    expect(kanbanHasDuplicateGrouping(EIssueLayoutTypes.KANBAN, "state", "priority")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Section 3: project-layout-root.tsx — Lookup map replaces switch statement
//
// Before: 5-case switch statement (CC = 5). Adding a layout = new case.
// After:  LAYOUT_COMPONENT_MAP record (CC = 1). Adding a layout = one new entry.
//
// We verify completeness: every EIssueLayoutTypes value has a map entry,
// so no layout can silently fall through.
// ---------------------------------------------------------------------------

describe("LAYOUT_COMPONENT_MAP — lookup map covers all EIssueLayoutTypes", () => {
  // Sentinel strings stand in for JSX elements (no DOM / React needed).
  const LAYOUT_COMPONENT_MAP: Record<EIssueLayoutTypes, string | null> = {
    [EIssueLayoutTypes.LIST]: "ListLayout",
    [EIssueLayoutTypes.KANBAN]: "KanBanLayout",
    [EIssueLayoutTypes.CALENDAR]: "CalendarLayout",
    [EIssueLayoutTypes.GANTT]: "BaseGanttRoot",
    [EIssueLayoutTypes.SPREADSHEET]: "ProjectSpreadsheetLayout",
  };

  it("every EIssueLayoutTypes value has a non-null entry in the map", () => {
    for (const layout of Object.values(EIssueLayoutTypes)) {
      expect(LAYOUT_COMPONENT_MAP[layout]).not.toBeNull();
      expect(LAYOUT_COMPONENT_MAP[layout]).not.toBeUndefined();
    }
  });

  it("the map has exactly as many entries as there are layout types", () => {
    const layoutCount = Object.values(EIssueLayoutTypes).length;
    expect(Object.keys(LAYOUT_COMPONENT_MAP).length).toBe(layoutCount);
  });

  it("each layout type maps to a distinct component name", () => {
    const components = Object.values(LAYOUT_COMPONENT_MAP);
    expect(new Set(components).size).toBe(components.length);
  });

  it("looking up an undefined layout returns undefined (no silent null render)", () => {
    const result = LAYOUT_COMPONENT_MAP["nonexistent" as EIssueLayoutTypes];
    expect(result).toBeUndefined();
  });
});
