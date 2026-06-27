# Taskscope: Loading Skeleton Audit for `/students`

## Objective

Audit the current loading behavior on `/students` and define a clear normalization direction before checking the rest of the student pages.

This scope starts with `/students` only. The immediate goal is to verify whether the page is using loading skeletons correctly, identify the inconsistent patterns that currently coexist, and set acceptance criteria for a follow-up cleanup.

## Current Review

In [frontend/src/app/students/loading.tsx](/D:/PROJECT/manager_points/frontend/src/app/students/loading.tsx), the route segment uses a shared route-level fallback:

```tsx
export default function Loading() {
  return <LoadingTemplate />;
}
```

In [frontend/src/components/ui/loading-template.tsx](/D:/PROJECT/manager_points/frontend/src/components/ui/loading-template.tsx), `LoadingTemplate` renders a generic page skeleton with:

- Header placeholder rows
- Three generic summary cards
- One large generic content block
- A centered spinner

In [frontend/src/app/students/page.tsx](/D:/PROJECT/manager_points/frontend/src/app/students/page.tsx), there are two more loading states:

- A `Suspense` fallback at the page boundary that renders plain text: `Loading student management...`
- An inline skeleton grid controlled by `isLoading || isDataLoading` that mimics the class cards shown in the main content area

This means `/students` currently has three different loading presentations:

1. Route-level generic skeleton via `loading.tsx`
2. Page-level text fallback via `Suspense`
3. Data-level contextual skeleton inside `StudentsPageContent`

## Findings

### 1. There are effectively two skeleton systems, plus one non-skeleton fallback

The two skeleton styles are:

- Generic shared skeleton from `LoadingTemplate`
- Context-specific class-card skeleton embedded in `/students/page.tsx`

The extra `Suspense` text fallback adds a third visual state that is not a skeleton at all.

### 2. The route-level skeleton is not aligned with the real `/students` layout

`LoadingTemplate` is a reusable placeholder, but it does not match the actual `/students` screen structure:

- `/students` has sidebar, header, tab navigation, department list, and class-card content
- `LoadingTemplate` renders a generic dashboard-like composition

Because of that, it is acceptable only as a temporary shared fallback, not as the ideal final loading UX for this page.

### 3. The inline class-card skeleton is the more correct loading pattern for `/students`

The inline skeleton in `/students/page.tsx` mirrors the actual content the user is waiting for:

- It keeps the page chrome visible
- It preserves the class-card grid structure
- It reflects local data refresh states such as initial data load and department switching

This is the correct pattern for in-page data loading after the route shell is already visible.

### 4. The `Suspense` text fallback is inconsistent with both skeleton patterns

The `Suspense` fallback currently shows only centered text:

```tsx
Loading student management...
```

That creates a visual jump because the user may see:

- generic skeleton during route loading
- plain text during suspense fallback
- contextual skeleton during data fetch

This is not a consistent loading contract.

## Conclusion

`/students` is not using loading skeletons consistently today.

The page currently mixes:

- one generic route-level skeleton
- one contextual in-page skeleton
- one plain text suspense fallback

So the observation that there are "2 loading skeleton styles" is correct, and there is also an additional text-only loading state on top of them.

## Required Direction

### 1. Separate route loading from data loading

Use one loading strategy for each layer:

- Route-level loading: placeholder for the whole `/students` page shell
- In-page data loading: placeholder for class/department content only

These two layers may both exist, but they must be intentionally different and not conflict.

### 2. Standardize the route-level fallback

The route-level fallback for `/students` should use a student-page-specific skeleton, not the current generic `LoadingTemplate`, if UX fidelity is important.

Recommended direction:

- Replace the generic route fallback with a `/students`-specific shell skeleton
- Or adapt `LoadingTemplate` so it can render a `students` variant that matches this page layout

### 3. Keep the inline contextual skeleton for data refresh

The inline class-card skeleton should remain the source of truth for:

- first client-side data load after shell render
- department switching
- local content refresh inside the page

This pattern is already closer to the correct UX than the generic fallback.

### 4. Remove the text-only suspense fallback

The `Suspense` fallback in `/students/page.tsx` should be replaced with one of these options:

- the same route-level students skeleton
- `null` if the segment-level `loading.tsx` already owns the route transition state

The page should not show a plain text loading message if the target UX is skeleton-based.

## In Scope

- Audit of loading behavior on `/students`
- Comparison between route-level loading and in-page data loading
- Identification of inconsistent loading skeleton patterns
- Definition of normalization rules for this page

## Out of Scope

- Refactoring `/students/[classId]`
- Refactoring `/students/[classId]/[id]`
- Refactoring `/students/record`
- Refactoring `/students/tasks`
- Global redesign of all app loading templates

## Acceptance Criteria

A follow-up implementation for `/students` should satisfy all of the following:

1. `/students` has a single intentional route-level skeleton style.
2. `/students` has a single intentional in-page data skeleton style.
3. The route-level skeleton and in-page skeleton do not contradict each other.
4. The `Suspense` fallback does not use plain text loading anymore.
5. Skeleton structure matches the actual `/students` layout closely enough to avoid visible layout jumps.
6. Department switching and similar local refresh flows continue using contextual content skeletons instead of blanking the whole page.

## Next Step

After `/students` is normalized, the same audit should continue in this order:

1. `/students/[classId]`
2. `/students/[classId]/[id]`
3. `/students/record`
4. `/students/tasks`
