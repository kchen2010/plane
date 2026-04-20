# Code Quality and Modernization Report

## Project

Plane is an open-source project management platform built as a TypeScript monorepo. Because the full system is large, this quality pass focuses on three representative frontend/shared components with visible user impact and manageable verification scope.

## Selected Components

| Component                          | Files                                                                                                                                                                            | Reason for selection                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Project issue layout persistence   | `apps/web/core/components/issues/issue-layouts/roots/project-layout-root.tsx`, `apps/web/core/hooks/use-layout-url-sync.ts`, `apps/web/tests/cr1-url-layout-persistence.test.ts` | Layout selection is core navigation state. Losing it affects refreshes, shared links, and user workflow continuity.                  |
| Issue filter search responsiveness | `apps/space/core/components/issues/filters/selection.tsx`, `apps/space/core/hooks/use-debounce.ts`, `apps/web/core/hooks/use-debounce.ts`                                        | Filter search runs during typing and can trigger avoidable re-renders. This is a good target for performance-oriented modernization. |
| Shared avatar initials utility     | `packages/utils/src/string.ts`, `packages/utils/src/__tests__/string.test.ts`                                                                                                    | Shared utilities have high reuse. Small defects, such as whitespace or invalid-input handling, can spread across multiple apps.      |

## Metrics Used

| Metric                     | Why it is relevant                                                                                  | How it was applied                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional correctness     | The assignment requires real quality improvement, not cosmetic cleanup.                             | Added/kept tests for URL layout restoration, local filter guard behavior, reaction deletion behavior, and string initials edge cases.       |
| Type safety                | Plane is a strict TypeScript project, so reducing `any` and `@ts-nocheck` improves maintainability. | Replaced unsafe casts in `ProjectLayoutRoot` with the project filter interface and changed `getFirstCharacters` to accept `unknown` safely. |
| Performance responsiveness | Search/filter UIs should not recompute on every keystroke when the user is still typing.            | Added debounced filter search state so expensive child filter lists receive updates only after a 300 ms pause.                              |
| Regression coverage        | Modernization must avoid changing behavior accidentally.                                            | Ran the existing web Vitest suite and package/app type checks where possible.                                                               |
| Build health               | Type and test commands provide objective evidence for the report.                                   | Recorded successful and failing verification commands below, including pre-existing failures outside the changed scope.                     |

## Modernization Work

### 1. Project Issue Layout Persistence

Problem:

Project issue layouts should be restorable from a URL query parameter such as `?layout=kanban`. The previous modernization draft had the correct feature direction, but it weakened code quality by using `any` and bypassing typed store methods.

Changes:

- Kept URL-driven layout restoration in `ProjectLayoutRoot`.
- Used `IProjectIssuesFilter` instead of broad `any` casts.
- Restored the typed `getIssueFilters(projectId)` access pattern used by neighboring cycle/module/project-view roots.
- Passed a definite `updateFilters` callback to the filter HOC and intentionally discarded the async promise with `void`, matching the HOC contract.
- Converted the local component test file from Jest globals and `@ts-nocheck` to Vitest-style mocks, although it is not included in the app's default Vitest glob because this React Router app does not resolve `next/navigation` in Vitest without extra aliasing.

Quality impact:

- Better type safety and maintainability.
- URL state now has a clear priority: URL query value overrides stored server preference only when it is valid and different.
- Regression behavior is covered by `apps/web/tests/cr1-url-layout-persistence.test.ts`.

### 2. Issue Filter Search Responsiveness

Problem:

The issue filter selection search passed the raw search string into child filter lists on every keystroke. In a filter-heavy UI, this can cause unnecessary recomputation and visible input lag.

Changes:

- Added a local debounce hook for the Space app at `apps/space/core/hooks/use-debounce.ts`.
- Normalized the Web debounce hook at `apps/web/core/hooks/use-debounce.ts` so it has both named and default exports and no invalid default export before declaration.
- Updated `apps/space/core/components/issues/filters/selection.tsx` to pass the debounced query to `FilterPriority` and `FilterState`.

Quality impact:

- The input remains immediate because `filtersSearchQuery` still updates on each keystroke.
- Child filter components receive updates after a 300 ms pause, reducing avoidable render pressure.
- `space` type checking passes after the new hook was added.

### 3. Shared Avatar Initials Utility

Problem:

`getFirstCharacters` is used to derive initials for display. The previous behavior was fragile for multiple spaces, lowercase names, empty strings, and non-string values.

Changes:

- Changed the input type from `string` to `unknown` to match the defensive runtime behavior.
- Split names with `/\s+/` so multiple spaces are handled correctly.
- Limited initials to the first two words and uppercased the result.
- Returned `"?"` for empty, null, undefined, or non-string input.
- Updated the test file to express the expected edge cases.

Quality impact:

- More robust shared UI behavior.
- Fewer assumptions at call sites.
- `@plane/utils` type checking passes after excluding package test files from production compilation.

## Verification Results

| Command                                      | Result | Notes                                                                                                                                                                                        |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd --filter=web test`                 | Passed | 3 test files, 25 tests passed.                                                                                                                                                               |
| `pnpm.cmd --filter=@plane/utils check:types` | Passed | Confirms the updated shared utility compiles.                                                                                                                                                |
| `pnpm.cmd --filter=space check:types`        | Passed | Confirms the new Space debounce hook resolves and compiles. The command warns that `apps/space/.env` is missing, but exits successfully.                                                     |
| `pnpm.cmd --filter=web check:types`          | Failed | Remaining errors are pre-existing/outside this pass: `core/components/issues/filters.tsx` and `core/components/views/form.tsx`. The errors introduced by this modernization pass were fixed. |

Environment note:

The repo requires Node `>=22.18.0`; the local machine is running Node `22.17.0`. Commands still ran, but pnpm reported an engine warning.

## Version Control Practice

Recommended commit sequence:

1. `git add apps/web/core/components/issues/issue-layouts/roots/project-layout-root.tsx apps/web/core/components/issues/issue-layouts/roots/__tests__/project-layout-root.test.tsx`
2. `git commit -m "Improve typed project layout URL persistence"`
3. `git add apps/space/core/components/issues/filters/selection.tsx apps/space/core/hooks/use-debounce.ts apps/web/core/hooks/use-debounce.ts`
4. `git commit -m "Debounce issue filter search input"`
5. `git add packages/utils/src/string.ts packages/utils/src/__tests__/string.test.ts packages/utils/tsconfig.json`
6. `git commit -m "Harden shared initials utility"`
7. `git add docs/quality-modernization-report.md`
8. `git commit -m "Document quality modernization work"`

This sequence keeps feature, performance, utility, and documentation changes reviewable as separate units.

## Limitations and Future Work

- The web type-check command still reports unrelated strictness issues in existing view/filter files. Those should be handled in a separate change request.
- The `ProjectLayoutRoot` component still depends on `next/navigation` while the web package is configured as a React Router app. A future modernization could introduce an adapter layer or test alias so component-level tests run directly in Vitest.
- The debounce delay is fixed at 300 ms in the filter UI. Future work could make this a shared constant if multiple apps standardize on the same delay.
