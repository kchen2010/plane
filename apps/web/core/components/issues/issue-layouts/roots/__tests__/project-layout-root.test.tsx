// @ts-nocheck
/// <reference types="jest" />
import { render, waitFor } from "@testing-library/react";
import { ProjectLayoutRoot } from "../project-layout-root";
import { useSearchParams } from "next/navigation";
import { useIssues } from "@/hooks/store/use-issues";

// 1. Mock Next.js Navigation (Simulating the URL)
jest.mock("next/navigation", () => ({
  useParams: () => ({ workspaceSlug: "test-workspace", projectId: "test-project" }),
  useSearchParams: jest.fn(),
}));

// 2. Mock SWR so it executes our restoration logic immediately
jest.mock("swr", () => (key: any, fetcher: any) => {
  if (key) fetcher();
  return { data: undefined, error: undefined };
});

// 3. Mock the custom hook we created for syncing
jest.mock("@/hooks/use-layout-url-sync", () => ({
  useLayoutUrlSync: jest.fn(),
}));

// 4. Mock the Plane MobX Store
jest.mock("@/hooks/store/use-issues", () => ({
  useIssues: jest.fn(),
}));

describe("ProjectLayoutRoot - URL Persistence", () => {
  const mockUpdateFilters = jest.fn();
  const mockFetchFilters = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup the mock store: Pretend the server thinks the layout is "list"
    (useIssues as jest.Mock).mockReturnValue({
      issues: { getIssueLoader: () => "loaded" },
      issuesFilter: {
        issueFilters: {
          "test-project": { displayFilters: { layout: "list" } },
        },
        fetchFilters: mockFetchFilters,
        updateFilters: mockUpdateFilters,
        updateFilterExpression: jest.fn(),
      },
    });
  });

  it("should override server layout if URL contains a different valid layout", async () => {
    // Simulate user navigating to the page with ?layout=kanban in the URL
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams({ layout: "kanban" })
    );

    render(<ProjectLayoutRoot />);

    await waitFor(() => {
      // Step 1: It should fetch the initial filters from the server
      expect(mockFetchFilters).toHaveBeenCalledWith("test-workspace", "test-project"); 
      
      // Step 2: It should update the store with the "kanban" layout from the URL
      expect(mockUpdateFilters).toHaveBeenCalledWith(
        "test-workspace",
        "test-project",
        "DISPLAY_FILTERS",
        { layout: "kanban" }
      );
    });
  });

  it("should NOT call updateFilters if URL layout matches the server layout", async () => {
    // Simulate user navigating to ?layout=list (which matches the server default)
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams({ layout: "list" })
    );

    render(<ProjectLayoutRoot />);

    await waitFor(() => {
      // It should fetch filters...
      expect(mockFetchFilters).toHaveBeenCalled();
      // ...but it should NOT redundantly update the store
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });
  });
});