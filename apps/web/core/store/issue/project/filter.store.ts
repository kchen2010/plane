/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isEmpty, set } from "lodash-es";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
// base class
import { computedFn } from "mobx-utils";
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import { EIssueFilterType } from "@plane/constants";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  TIssueKanbanFilters,
  IIssueFilters,
  TIssueParams,
  IssuePaginationOptions,
  TWorkItemFilterExpression,
  TSupportedFilterForUpdate,
} from "@plane/types";
import { EIssueLayoutTypes, EIssuesStoreType } from "@plane/types";
import { handleIssueQueryParamsByLayout } from "@plane/utils";
import type { IBaseIssueFilterStore } from "../helpers/issue-filter-helper.store";
import { IssueFilterHelperStore } from "../helpers/issue-filter-helper.store";
// helpers
// types
import type { IIssueRootStore } from "../root.store";
import { ProjectService } from "@/services/project";
// constants
// services

export interface IProjectIssuesFilter extends IBaseIssueFilterStore {
  //helper actions
  getFilterParams: (
    options: IssuePaginationOptions,
    projectId: string,
    cursor: string | undefined,
    groupId: string | undefined,
    subGroupId: string | undefined
  ) => Partial<Record<TIssueParams, string | boolean>>;
  getIssueFilters(projectId: string): IIssueFilters | undefined;
  // action
  fetchFilters: (workspaceSlug: string, projectId: string) => Promise<void>;
  updateFilterExpression: (
    workspaceSlug: string,
    projectId: string,
    filters: TWorkItemFilterExpression
  ) => Promise<void>;
  updateFilters: (
    workspaceSlug: string,
    projectId: string,
    filterType: TSupportedFilterTypeForUpdate,
    filters: TSupportedFilterForUpdate
  ) => Promise<void>;
}

export class ProjectIssuesFilter extends IssueFilterHelperStore implements IProjectIssuesFilter {
  // observables
  filters: { [projectId: string]: IIssueFilters } = {};
  // root store
  rootIssueStore: IIssueRootStore;
  // services
  projectService;

  constructor(_rootStore: IIssueRootStore) {
    super();
    makeObservable(this, {
      // observables
      filters: observable,
      // computed
      issueFilters: computed,
      appliedFilters: computed,
      // actions
      fetchFilters: action,
      updateFilterExpression: action,
      updateFilters: action,
    });
    // root store
    this.rootIssueStore = _rootStore;
    // services
    this.projectService = new ProjectService();
  }

  get issueFilters() {
    const projectId = this.rootIssueStore.projectId;
    if (!projectId) return undefined;

    return this.getIssueFilters(projectId);
  }

  get appliedFilters() {
    const projectId = this.rootIssueStore.projectId;
    if (!projectId) return undefined;

    return this.getAppliedFilters(projectId);
  }

  getIssueFilters(projectId: string) {
    const displayFilters = this.filters[projectId] || undefined;
    if (isEmpty(displayFilters)) return undefined;

    return this.computedIssueFilters(displayFilters);
  }

  getAppliedFilters(projectId: string) {
    const userFilters = this.getIssueFilters(projectId);
    if (!userFilters) return undefined;

    const filteredParams = handleIssueQueryParamsByLayout(userFilters?.displayFilters?.layout, "issues");
    if (!filteredParams) return undefined;

    const filteredRouteParams: Partial<Record<TIssueParams, string | boolean>> = this.computedFilteredParams(
      userFilters?.richFilters,
      userFilters?.displayFilters,
      filteredParams
    );

    return filteredRouteParams;
  }

  getFilterParams = computedFn(
    (
      options: IssuePaginationOptions,
      projectId: string,
      cursor: string | undefined,
      groupId: string | undefined,
      subGroupId: string | undefined
    ) => {
      const filterParams = this.getAppliedFilters(projectId);
      const paginationParams = this.getPaginationParams(filterParams, options, cursor, groupId, subGroupId);
      return paginationParams;
    }
  );

  fetchFilters = async (workspaceSlug: string, projectId: string) => {
    const _filters = await this.projectService.getProjectUserProperties(workspaceSlug, projectId);

    const richFilters = _filters?.rich_filters;
    const displayFilters = this.computedDisplayFilters(_filters?.display_filters);
    const displayProperties = this.computedDisplayProperties(_filters?.display_properties);

    // fetching the kanban toggle helpers in the local storage
    const kanbanFilters = {
      group_by: [],
      sub_group_by: [],
    };
    const currentUserId = this.rootIssueStore.currentUserId;
    if (currentUserId) {
      const _localFilters = this.handleIssuesLocalFilters.get(
        EIssuesStoreType.PROJECT,
        workspaceSlug,
        projectId,
        currentUserId
      ) as { kanban_filters?: { group_by?: string[]; sub_group_by?: string[] } } | undefined;
      kanbanFilters.group_by = _localFilters?.kanban_filters?.group_by || [];
      kanbanFilters.sub_group_by = _localFilters?.kanban_filters?.sub_group_by || [];
    }

    runInAction(() => {
      set(this.filters, [projectId, "richFilters"], richFilters);
      set(this.filters, [projectId, "displayFilters"], displayFilters);
      set(this.filters, [projectId, "displayProperties"], displayProperties);
      set(this.filters, [projectId, "kanbanFilters"], kanbanFilters);
    });
  };

  /**
   * NOTE: This method is designed as a fallback function for the work item filter store.
   * Only use this method directly when initializing filter instances.
   * For regular filter updates, use this method as a fallback function for the work item filter store methods instead.
   */
  updateFilterExpression: IProjectIssuesFilter["updateFilterExpression"] = async (
    workspaceSlug,
    projectId,
    filters
  ) => {
    try {
      runInAction(() => {
        set(this.filters, [projectId, "richFilters"], filters);
      });

      void this.rootIssueStore.projectIssues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation");
      await this.projectService.updateProjectUserProperties(workspaceSlug, projectId, {
        rich_filters: filters,
      });
    } catch (error) {
      console.error("error while updating rich filters", error);
      throw error;
    }
  };

  private async _applyDisplayFilters(
    workspaceSlug: string,
    projectId: string,
    updatedDisplayFilters: IIssueDisplayFilterOptions,
    currentDisplayFilters: IIssueDisplayFilterOptions
  ): Promise<void> {
    const mergedFilters: IIssueDisplayFilterOptions = { ...currentDisplayFilters, ...updatedDisplayFilters };

    // clear sub_group_by when group_by is unset
    if (mergedFilters.group_by === null) {
      mergedFilters.sub_group_by = null;
      updatedDisplayFilters.sub_group_by = null;
    }
    // kanban cannot have the same group_by and sub_group_by
    if (mergedFilters.layout === EIssueLayoutTypes.KANBAN && mergedFilters.group_by === mergedFilters.sub_group_by) {
      mergedFilters.sub_group_by = null;
      updatedDisplayFilters.sub_group_by = null;
    }
    // kanban requires a group_by; default to state when switching from an ungrouped layout
    if (mergedFilters.layout === EIssueLayoutTypes.KANBAN && mergedFilters.group_by === null) {
      mergedFilters.group_by = "state";
      updatedDisplayFilters.group_by = "state";
    }

    runInAction(() => {
      Object.keys(updatedDisplayFilters).forEach((_key) => {
        set(
          this.filters,
          [projectId, "displayFilters", _key],
          updatedDisplayFilters[_key as keyof IIssueDisplayFilterOptions]
        );
      });
    });

    if (this.getShouldClearIssues(updatedDisplayFilters)) {
      this.rootIssueStore.projectIssues.clear(true);
    }
    if (this.getShouldReFetchIssues(updatedDisplayFilters)) {
      void this.rootIssueStore.projectIssues.fetchIssuesWithExistingPagination(workspaceSlug, projectId, "mutation");
    }

    await this.projectService.updateProjectUserProperties(workspaceSlug, projectId, {
      display_filters: mergedFilters,
    });
  }

  private async _applyDisplayProperties(
    workspaceSlug: string,
    projectId: string,
    updatedDisplayProperties: IIssueDisplayProperties,
    currentDisplayProperties: IIssueDisplayProperties
  ): Promise<void> {
    const mergedProperties: IIssueDisplayProperties = { ...currentDisplayProperties, ...updatedDisplayProperties };

    runInAction(() => {
      Object.keys(updatedDisplayProperties).forEach((_key) => {
        set(
          this.filters,
          [projectId, "displayProperties", _key],
          updatedDisplayProperties[_key as keyof IIssueDisplayProperties]
        );
      });
    });

    await this.projectService.updateProjectUserProperties(workspaceSlug, projectId, {
      display_properties: mergedProperties,
    });
  }

  private _applyKanbanFilters(
    workspaceSlug: string,
    projectId: string,
    updatedKanbanFilters: TIssueKanbanFilters,
    currentKanbanFilters: TIssueKanbanFilters
  ): void {
    const mergedKanbanFilters: TIssueKanbanFilters = { ...currentKanbanFilters, ...updatedKanbanFilters };

    const currentUserId = this.rootIssueStore.currentUserId;
    if (currentUserId)
      this.handleIssuesLocalFilters.set(
        EIssuesStoreType.PROJECT,
        EIssueFilterType.KANBAN_FILTERS,
        workspaceSlug,
        projectId,
        currentUserId,
        { kanban_filters: mergedKanbanFilters }
      );

    runInAction(() => {
      Object.keys(updatedKanbanFilters).forEach((_key) => {
        set(this.filters, [projectId, "kanbanFilters", _key], updatedKanbanFilters[_key as keyof TIssueKanbanFilters]);
      });
    });
  }

  updateFilters: IProjectIssuesFilter["updateFilters"] = async (workspaceSlug, projectId, type, filters) => {
    try {
      if (isEmpty(this.filters) || isEmpty(this.filters[projectId])) return;

      switch (type) {
        case EIssueFilterType.DISPLAY_FILTERS:
          await this._applyDisplayFilters(
            workspaceSlug,
            projectId,
            filters as IIssueDisplayFilterOptions,
            this.filters[projectId].displayFilters as IIssueDisplayFilterOptions
          );
          break;
        case EIssueFilterType.DISPLAY_PROPERTIES:
          await this._applyDisplayProperties(
            workspaceSlug,
            projectId,
            filters as IIssueDisplayProperties,
            this.filters[projectId].displayProperties as IIssueDisplayProperties
          );
          break;
        case EIssueFilterType.KANBAN_FILTERS:
          this._applyKanbanFilters(
            workspaceSlug,
            projectId,
            filters as TIssueKanbanFilters,
            this.filters[projectId].kanbanFilters as TIssueKanbanFilters
          );
          break;
        default:
          break;
      }
    } catch (error) {
      void this.fetchFilters(workspaceSlug, projectId);
      throw error;
    }
  };
}
