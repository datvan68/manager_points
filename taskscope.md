# Task Scope: Active Student Rank Card Lazy Load And Visibility Check

## User Request

Check whether the `ACTIVE STUDENT RANK CARD` has been lazy-loaded and whether its visibility is restricted so only `student` and `admin` users can see it.

## Scope Checked

- `frontend/src/app/grading/score/page.tsx`
- `frontend/src/components/guards/RouteGuard.tsx`
- `frontend/src/providers/auth-provider.tsx`
- `frontend/src/utils/role.util.ts`
- `backend/src/auth/services/auth.service.ts`

## Finding 1: The Active Student Rank Card Is Not Component-Lazy-Loaded

Status: **Not satisfied**

The `ACTIVE STUDENT RANK CARD` is rendered inline inside `frontend/src/app/grading/score/page.tsx`.

Relevant evidence:

- The rank card render block starts at `frontend/src/app/grading/score/page.tsx:2540`.
- The file imports `Suspense` from React at `frontend/src/app/grading/score/page.tsx:3`, but there is no `next/dynamic` import in this file.
- The page-level `Suspense` wrapper around `GradingScoreWithGuard` appears near `frontend/src/app/grading/score/page.tsx:3361`, but that only wraps the page/search-param flow. It does not lazy-load the rank card itself.
- The rank card JSX includes animated UI, rank tier rendering, avatar rendering, sparkles, and score display directly in the main page bundle.

Conclusion:

- The page is route-split by Next.js as a page, but the `ACTIVE STUDENT RANK CARD` itself is not lazy-loaded as a separate component.
- If the requirement means card-level lazy loading, this still needs implementation.

## Finding 2: The Rank Card Is Not Restricted To Student And Admin Only

Status: **Not satisfied**

The current render condition is:

```tsx
{activeStudent && activeStudentRankStyle && activeStudentCongrats && (
  <motion.div>
    ...
  </motion.div>
)}
```

This condition only checks whether there is an active student and rank view data. It does not check the current user's role.

Supporting evidence:

- `currentUserRole` is derived in `frontend/src/app/grading/score/page.tsx` near the role setup block.
- `shouldShowStudentSlider` already hides the student slider for students with `currentUserRole !== "student"`, but there is no equivalent derived boolean for the rank card.
- The page is wrapped with `<RouteGuard requiredPermission="GRADING_PAGE">` near `frontend/src/app/grading/score/page.tsx:3352`.
- `RouteGuard` checks permissions, not the rank card visibility rule.
- Seeded roles in `backend/src/auth/services/auth.service.ts` give `GRADING_PAGE` to `Teacher`, `Supervisor`, and `Student`. Admin receives all permissions.

Practical impact:

- Any role that can reach `/grading/score` and has an `activeStudent` can see the rank card.
- Teacher and supervisor users are not explicitly excluded by the rank card render condition.
- The `taskId` access path can bypass the normal `RouteGuard` after task validation and render `GradingScoreContent` directly, so the card still needs its own role-level visibility guard if the rule is strict.

## Recommended Fix Scope

### 1. Add a Card-Specific Visibility Boolean

Use a clear derived boolean before rendering the card:

```tsx
const shouldShowActiveStudentRankCard =
  isStudentRole(currentUser) || isAdminUser(currentUser);
```

Then update the render guard:

```tsx
{shouldShowActiveStudentRankCard &&
  activeStudent &&
  activeStudentRankStyle &&
  activeStudentCongrats && (
    <ActiveStudentRankCard ... />
  )}
```

Notes:

- If `admin` must include only `ADMIN`, use `isAdminUser(currentUser)`.
- If `admin` should include `SUPERVISOR`, use `isAdminOrSupervisor(currentUser)` from `frontend/src/utils/role.util.ts` instead. The user request says `student & admin`, so the conservative interpretation is `STUDENT` and `ADMIN` only.

### 2. Extract The Rank Card Into A Separate Component

Create a dedicated component, for example:

- `frontend/src/components/grading/ActiveStudentRankCard.tsx`

Move the rank card JSX and its helper-only visual subcomponents into that file if they are only used by the card:

- `DiamondSparkle`
- `FloatingDiamond`
- the card JSX currently under `ACTIVE STUDENT RANK CARD`

Keep shared rank calculations in the page unless the component should own presentation-only calculations.

### 3. Lazy-Load The Component With `next/dynamic`

In `frontend/src/app/grading/score/page.tsx`:

```tsx
import dynamic from "next/dynamic";

const ActiveStudentRankCard = dynamic(
  () => import("@/components/grading/ActiveStudentRankCard"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[110px] w-full rounded-2xl" />,
  },
);
```

This matches the local Next.js pattern already used in `frontend/src/app/grading/page.tsx` for heavy grading UI components.

## Acceptance Criteria

- The rank card code is no longer rendered inline in `frontend/src/app/grading/score/page.tsx`.
- The page imports the card through `next/dynamic`.
- The card only renders when the current user is a student or admin.
- Teacher users with `GRADING_PAGE` can still access `/grading/score`, but do not see the `ACTIVE STUDENT RANK CARD`.
- Supervisor users do not see the card unless product explicitly decides supervisors count as admin for this feature.
- The `taskId` access path also respects the same card-level visibility rule.
- Existing score editing, approval, and rank calculation logic remains unchanged.

## Manual Verification Checklist

1. Log in as `STUDENT` and open `/grading/score`; verify the rank card appears when an active student exists.
2. Log in as `ADMIN` and open `/grading/score`; verify the rank card appears.
3. Log in as `TEACHER` and open `/grading/score`; verify the rank card does not appear.
4. Log in as `SUPERVISOR` and open `/grading/score`; verify the rank card does not appear unless the product decision changes.
5. Open `/grading/score?taskId=...` with a valid task flow for a non-student/non-admin role; verify the rank card still does not appear.
6. Build or run the frontend and confirm no dynamic import/type errors are introduced.

## Current Conclusion

The current implementation does **not** satisfy the requested checks:

- The `ACTIVE STUDENT RANK CARD` is not lazy-loaded at component level.
- The card is not restricted to only `student` and `admin` users.

The fix should be frontend-only unless backend/API authorization rules also need to hide the underlying score/rank data from non-student/non-admin users.
