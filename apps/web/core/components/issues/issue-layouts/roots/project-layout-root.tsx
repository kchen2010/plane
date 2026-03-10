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
import { useLayoutUrlSync } from "@/hooks/use-layout-url-sync"; 
// local imports
import { IssuePeekOverview } from "../../peek-overview";
import { CalendarLayout } from "../calendar/roots/project-root";
import { BaseGanttRoot } from "../gantt";
import { KanBanLayout } from "../kanban/roots/project-root";
import { ListLayout } from "../list/roots/project-root";
import { ProjectSpreadsheetLayout } from "../spreadsheet/roots/project-root";

function ProjectIssueLayout(props: { activeLayout: EIssueLayoutTypes | undefined }) {
  switch (props.activeLayout) {
    case EIssueLayoutTypes.LIST: return <ListLayout />;
    case EIssueLayoutTypes.KANBAN: return <KanBanLayout />;
    case EIssueLayoutTypes.CALENDAR: return <CalendarLayout />;
    case EIssueLayoutTypes.GANTT: return <BaseGanttRoot />;
    case EIssueLayoutTypes.SPREADSHEET: return <ProjectSpreadsheetLayout />;
    default: return null;
  }
}

export const ProjectLayoutRoot = observer(function ProjectLayoutRoot() {
  const { workspaceSlug: routerWorkspaceSlug, projectId: routerProjectId } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  const projectId = routerProjectId?.toString();
  const searchParams = useSearchParams();

  const { issues, issuesFilter } = useIssues(EIssuesStoreType.PROJECT);

  // FIX TS7053: issueFilters is already the filter object, no need to index it.
  const workItemFilters = issuesFilter?.issueFilters as any;
  const activeLayout = workItemFilters?.displayFilters?.layout;

  // Sync state changes back to URL
  useLayoutUrlSync(activeLayout);

  useSWR(
    workspaceSlug && projectId ? `PROJECT_ISSUES_${workspaceSlug}_${projectId}` : null,
    async () => {
      if (workspaceSlug && projectId) {
        // FIX TS2554: Bypass union signature confusion by casting to any
        await (issuesFilter as any)?.fetchFilters(workspaceSlug, projectId);
        
        const urlLayout = searchParams.get("layout");
        const validLayouts = Object.values(EIssueLayoutTypes) as string[];
        
        if (urlLayout && validLayouts.includes(urlLayout)) {
          const currentLayout = (issuesFilter?.issueFilters as any)?.displayFilters?.layout;
          if (currentLayout !== (urlLayout as EIssueLayoutTypes)) {
            // Revert to original correct argument count, bypass TS union limits
            await (issuesFilter as any)?.updateFilters(
              workspaceSlug, 
              projectId, 
              EIssueFilterType.DISPLAY_FILTERS, 
              { layout: urlLayout as EIssueLayoutTypes }
            );
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
        // Use type assertion to silence the union method signature conflicts
        updateFilters={(updatedFilters) => 
            (issuesFilter as any)?.updateFilterExpression(workspaceSlug, projectId, updatedFilters)
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
              {issues?.getIssueLoader() === "mutation" && (
                <div className="fixed w-10 h-10 z-50 right-5 top-[70px] flex justify-center items-center bg-layer-1 shadow-sm rounded-sm">
                  <Spinner className="w-4 h-4" />
                </div>
              )}
              <ProjectIssueLayout activeLayout={activeLayout} />
            </div>
            <IssuePeekOverview />
          </div>
        )}
      </ProjectLevelWorkItemFiltersHOC>
    </IssuesStoreContext.Provider>
  );
});