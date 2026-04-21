/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
// plane constants
import { EIssueFilterType, ISSUE_DISPLAY_FILTERS_BY_PAGE, PROJECT_VIEW_TRACKER_ELEMENTS } from "@plane/constants";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { Spinner } from "@plane/ui";
// components
import { ProjectLevelWorkItemFiltersHOC } from "@/components/work-item-filters/filters-hoc/project-level";
import { WorkItemFiltersRow } from "@/components/work-item-filters/filters-row";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { IssuesStoreContext } from "@/hooks/use-issue-layout-store";
// local imports
import { IssuePeekOverview } from "../../peek-overview";
import { CalendarLayout } from "../calendar/roots/project-root";
import { BaseGanttRoot } from "../gantt";
import { KanBanLayout } from "../kanban/roots/project-root";
import { ListLayout } from "../list/roots/project-root";
import { ProjectSpreadsheetLayout } from "../spreadsheet/roots/project-root";

// Lookup map: adding a new layout type requires only one new entry here.
const LAYOUT_COMPONENT_MAP: Record<EIssueLayoutTypes, JSX.Element | null> = {
  [EIssueLayoutTypes.LIST]: <ListLayout />,
  [EIssueLayoutTypes.KANBAN]: <KanBanLayout />,
  [EIssueLayoutTypes.CALENDAR]: <CalendarLayout />,
  [EIssueLayoutTypes.GANTT]: <BaseGanttRoot />,
  [EIssueLayoutTypes.SPREADSHEET]: <ProjectSpreadsheetLayout />,
};

function ProjectIssueLayout(props: { activeLayout: EIssueLayoutTypes | undefined }) {
  if (!props.activeLayout) return null;
  return LAYOUT_COMPONENT_MAP[props.activeLayout] ?? null;
}

export const ProjectLayoutRoot = observer(function ProjectLayoutRoot() {
  // router
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug ? routerWorkspaceSlug.toString() : undefined;
  const projectId = routerProjectId ? routerProjectId.toString() : undefined;
  const searchParams = useSearchParams();
  // hooks
  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT);
  // derived values
  const workItemFilters = projectId ? issuesFilter?.getIssueFilters(projectId) : undefined;
  const activeLayout = workItemFilters?.displayFilters?.layout;

  useSWR(
    workspaceSlug && projectId ? `PROJECT_ISSUES_${workspaceSlug}_${projectId}` : null,
    async () => {
      if (workspaceSlug && projectId) {
        try {
          await issuesFilter?.fetchFilters(workspaceSlug, projectId);
        } catch (error) {
          console.error("[ProjectLayoutRoot] Failed to fetch filters — rendering with defaults:", error);
        }
        // Restore layout from URL query param, overriding the server-side default
        // so the user's selection survives page refreshes and direct links.
        const urlLayout = searchParams.get("layout");
        const validLayouts = Object.values(EIssueLayoutTypes) as string[];
        if (urlLayout && validLayouts.includes(urlLayout)) {
          const currentLayout = issuesFilter?.getIssueFilters(projectId)?.displayFilters?.layout;
          if (currentLayout !== (urlLayout as EIssueLayoutTypes)) {
            await issuesFilter?.updateFilters(workspaceSlug, projectId, EIssueFilterType.DISPLAY_FILTERS, {
              layout: urlLayout as EIssueLayoutTypes,
            });
          }
        }
      }
    },
    { revalidateIfStale: false, revalidateOnFocus: false }
  );

  if (!workspaceSlug || !projectId || !workItemFilters) return <></>;
  return (
    <IssuesStoreContext.Provider value={EIssuesStoreType.PROJECT}>
      <ProjectLevelWorkItemFiltersHOC
        enableSaveView
        entityType={EIssuesStoreType.PROJECT}
        entityId={projectId}
        filtersToShowByLayout={ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters}
        initialWorkItemFilters={workItemFilters}
        updateFilters={(...args) =>
          void issuesFilter?.updateFilterExpression.bind(issuesFilter, workspaceSlug, projectId)(...args)
        }
        projectId={projectId}
        workspaceSlug={workspaceSlug}
      >
        {({ filter: projectWorkItemsFilter }) => (
          <div className="relative flex h-full w-full flex-col overflow-hidden">
            {projectWorkItemsFilter && (
              <WorkItemFiltersRow
                filter={projectWorkItemsFilter}
                trackerElements={{
                  saveView: PROJECT_VIEW_TRACKER_ELEMENTS.PROJECT_HEADER_SAVE_AS_VIEW_BUTTON,
                }}
              />
            )}
            <div className="relative h-full w-full overflow-auto bg-surface-1">
              {/* mutation loader */}
              {issues?.getIssueLoader() === "mutation" && (
                <div className="fixed w-[40px] h-[40px] z-50 right-[20px] top-[70px] flex justify-center items-center bg-layer-1 shadow-sm rounded-sm">
                  <Spinner className="w-4 h-4" />
                </div>
              )}
              <ProjectIssueLayout activeLayout={activeLayout} />
            </div>
            {/* peek overview */}
            <IssuePeekOverview />
          </div>
        )}
      </ProjectLevelWorkItemFiltersHOC>
    </IssuesStoreContext.Provider>
  );
});
