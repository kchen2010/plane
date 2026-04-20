import { useSearchParams } from "next/navigation";
import { act } from "react";
import type React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
// local imports
import { ProjectLayoutRoot } from "../project-layout-root";

vi.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "test-workspace", projectId: "test-project" }),
  usePathname: () => "/test-workspace/projects/test-project/issues",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: vi.fn(),
}));

vi.mock("swr", () => ({
  default: (key: string | null, fetcher: () => Promise<void>) => {
    if (key) void fetcher();
    return { data: undefined, error: undefined };
  },
}));

vi.mock("@/components/work-item-filters/filters-hoc/project-level", () => ({
  ProjectLevelWorkItemFiltersHOC: ({
    children,
    initialWorkItemFilters,
  }: {
    children: (props: { filter: unknown }) => React.ReactNode;
    initialWorkItemFilters: unknown;
  }) => children({ filter: initialWorkItemFilters }),
}));

vi.mock("@/components/work-item-filters/filters-row", () => ({
  WorkItemFiltersRow: () => <div data-testid="filters-row" />,
}));

vi.mock("../../peek-overview", () => ({
  IssuePeekOverview: () => <div data-testid="peek-overview" />,
}));

vi.mock("../calendar/roots/project-root", () => ({
  CalendarLayout: () => <div data-testid="calendar-layout" />,
}));

vi.mock("../gantt", () => ({
  BaseGanttRoot: () => <div data-testid="gantt-layout" />,
}));

vi.mock("../kanban/roots/project-root", () => ({
  KanBanLayout: () => <div data-testid="kanban-layout" />,
}));

vi.mock("../list/roots/project-root", () => ({
  ListLayout: () => <div data-testid="list-layout" />,
}));

vi.mock("../spreadsheet/roots/project-root", () => ({
  ProjectSpreadsheetLayout: () => <div data-testid="spreadsheet-layout" />,
}));

vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: vi.fn(),
}));

describe("ProjectLayoutRoot - URL persistence", () => {
  const mockUpdateFilters = vi.fn();
  const mockFetchFilters = vi.fn();
  const mockUpdateFilterExpression = vi.fn();
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useIssues).mockReturnValue({
      issues: { getIssueLoader: () => "loaded" },
      issuesFilter: {
        getIssueFilters: () => ({ displayFilters: { layout: "list" } }),
        fetchFilters: mockFetchFilters,
        updateFilters: mockUpdateFilters,
        updateFilterExpression: mockUpdateFilterExpression,
      },
    } as unknown as ReturnType<typeof useIssues>);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
  });

  const renderProjectLayoutRoot = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<ProjectLayoutRoot />);
    });
  };

  it("overrides server layout when URL contains a different valid layout", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ layout: "kanban" }) as ReturnType<typeof useSearchParams>
    );

    renderProjectLayoutRoot();

    await vi.waitFor(() => {
      expect(mockFetchFilters).toHaveBeenCalledWith("test-workspace", "test-project");
      expect(mockUpdateFilters).toHaveBeenCalledWith("test-workspace", "test-project", "DISPLAY_FILTERS", {
        layout: "kanban",
      });
    });
  });

  it("does not update filters when URL layout matches the server layout", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams({ layout: "list" }) as ReturnType<typeof useSearchParams>
    );

    renderProjectLayoutRoot();

    await vi.waitFor(() => {
      expect(mockFetchFilters).toHaveBeenCalledWith("test-workspace", "test-project");
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });
  });
});
