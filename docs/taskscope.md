Task ID: ACTIVITY-CLUB-STUDENT-ACCESS-AND-LEAVE-20260717
Pipeline: feature_development

## Risk Level

MEDIUM — The work changes student-visible filtering and a server-enforced membership state transition, but it is limited to authenticated activity APIs and UI pages, requires no deployment or destructive migration, and can be reversed through a code rollback. The leave operation changes membership state and consumes a per-semester quota, so backend enforcement and regression tests are required.

## Objective

Preserve the student access rules for activity details and add club-specific exclusivity and leaving behavior. A student with an active club membership must see only that club among club cards, and an active club member must be able to leave from the detail hero at most three times per semester with the remaining count shown in the button.

## Scope

- `frontend/src/app/(dashboard)/activities/page.tsx` → student activity-list derivation → for student users only, when one `activity_type === 'club'` item has `membership_status === 'active'`, omit every other club item while retaining the active club and all non-club activity types; when no active club remains, show all otherwise eligible club items.
- `frontend/src/app/(dashboard)/activities/page.test.tsx` → activity-list role and membership tests → add coverage for active-club exclusivity, restoration after the membership becomes `left`, preservation of non-club items, and unchanged administrator/teacher visibility.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` → student tabs, General Information layout, and member-flow hero actions → preserve the existing student access rules; for an active student member of a club, fetch the semester leave quota, place a localized `Rời hoạt động (<remaining>)` button immediately to the right of the active-membership status element, confirm the action, call `activityApi.leaveActivity`, refresh the membership state and quota after success, and disable the button when no attempts remain or a leave request is in progress.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx` → detail access and leave-action tests → retain existing student tab/layout assertions and add club-only leave-button, position/order, countdown, success, quota-exhaustion, non-club, non-member, and failure cases.
- `frontend/src/api/activity-api.ts` → membership policy response types and activity policy methods → add explicit leave-quota fields without renaming or changing the existing transfer-quota fields; type `getMyTransferPolicy` and `leaveActivity` responses with `self_service_leaves_used` and `self_service_leaves_remaining`.
- `backend/src/activities/schemas/activity-member.schema.ts` → `ActivityMember` schema → add a non-negative integer `self_service_leave_count` with default `0`; missing values on existing documents must behave as zero, so no data migration is required.
- `backend/src/activities/activities.service.ts` → club leave quota helper, `leaveActivity`, and `getMyTransferPolicy` → count successful student-initiated active-club leaves across all of the student's membership records in the requested semester; reject a fourth active-club leave before changing membership state; atomically transition the eligible membership to `left`, clear `occupies_slot`, set `left_at`, increment its leave counter, and return the updated used/remaining leave quota. Preserve current behavior for non-club activities and pending-membership cancellation, neither of which consumes this club leave quota.
- `backend/src/activities/activities.service.spec.ts` → leave and policy service tests → verify zero-default aggregation, countdown values after successful leaves, rejection at three used attempts without mutation, atomic update conditions, semester isolation, and unchanged non-club/pending behavior.

All new identifiers, comments, test descriptions, and documentation must be English. The Vietnamese UI values `Đã tham gia` (or the existing equivalent active-membership label) and `Rời hoạt động (<remaining>)` are authorized localized product strings and must remain valid UTF-8.

## Out of Scope

- Activity types other than `club`, except for regression assertions proving they remain visible and their leave behavior is unchanged.
- Administrator-initiated member removal, bulk removal, club transfer, teacher-approval transfer, or the existing three-use self-service transfer quota.
- Changes to `ActivityDetailWorkspace.tsx`, `/club` legacy pages, `/activities/my`, attendance internals, schedule registration, completion rules, or club management pages.
- Database migrations, index rebuilds, deployment, seed changes, dependency upgrades, route changes, broad refactoring, formatting-only edits, or translation/normalization of existing localized content.
- Hiding non-club activities when a student has an active club membership.
- Treating `pending`, `rejected`, `inactive`, `left`, or missing membership as an active club membership for list exclusivity or for displaying the leave button.

## Context & Dependencies

- `activityApi.getAll()` already returns per-item `activity_type` and `membership_status`; list filtering can be performed after the existing fetch without a new endpoint.
- The active detail route resolves the current user's membership from `activityApi.getMembers()` and already defines active student membership strictly as `memberStatus === 'active'`.
- `activityApi.leaveActivity(activityId, { semester_id })` and `activityApi.getMyTransferPolicy({ semester_id })` already exist. The existing `self_service_changes_used` and `self_service_changes_remaining` fields describe club transfers and must not be repurposed; add separate leave-quota fields.
- The leave quota is per student and semester, shared across all activities whose `activity_type` is `club`. It starts at three remaining attempts, decreases only after a successful leave from an active club membership, and never becomes negative.
- A pending club request may still be cancelled through the existing endpoint, but that cancellation does not count as one of the three active-club leaves. The new detail button is shown only for an active student club member.
- Existing membership documents lack `self_service_leave_count`; schema defaulting and aggregation must treat the missing field as `0` without rewriting existing records.
- Successful leave handling must refresh detail data so the leave button and Attendance tab disappear under the existing non-member rules. The list will reveal all club cards the next time it is loaded because no club item has an active membership.
- Use the activity's normalized `semester_id`; if it is absent, do not call a quota or leave endpoint and surface the existing error pattern.
- Files contain Vietnamese localized strings. Preserve UTF-8, BOM status, and existing line endings; do not use lossy decoding, bulk encoding conversion, or terminal rendering as evidence of file corruption. Do not introduce `U+FFFD`.

## Steps

1. In the backend member schema, add `self_service_leave_count` as an integer with default zero and no migration dependency.
2. In `ActivitiesService`, add a helper that sums `self_service_leave_count` for one student and semester while treating missing values as zero. Keep this counter independent from `countCompletedSelfServiceTransfers`.
3. Modify `leaveActivity` to load the target activity and apply the quota only when `activity_type === 'club'` and the current membership is `active`. Before mutation, reject when the aggregated count is at least three. Perform the active membership status change and counter increment with an atomic conditional update so duplicate requests cannot consume more than one leave or bypass the limit. Return `self_service_leaves_used` and `self_service_leaves_remaining` in addition to the existing response fields. Preserve the existing path for pending memberships and non-club activities without incrementing the club leave count.
4. Extend `getMyTransferPolicy` with the separate leave used/remaining values while retaining all existing transfer-policy fields and meanings.
5. Extend frontend API typings so the policy endpoint and leave endpoint expose the separate leave-quota fields. Do not rename existing methods, URLs, request bodies, or transfer-quota fields.
6. Derive the student-visible activity array before rendering the list workspace. If a student has an active club membership, retain that club, remove other club items, and retain non-club items. Do not apply this filter to administrator or teacher users. When the membership state is `left` or no active club exists, retain all club items.
7. On the detail page, request the leave quota for an active student club member and render the active-membership status followed immediately by `Rời hoạt động (<remaining>)` in the same action row. Disable it at zero and while submitting. After user confirmation, call the existing leave endpoint with the normalized semester ID; on success, show a localized success toast and reload activity data/policy; on failure, preserve the active state and show the existing error style.
8. Preserve the established student-detail rules: non-active students see only General Information with no member action button; active students see General Information and Attendance; unauthorized direct tab queries fall back to General Information; an active student's General Information orders schedule first, description next, hides the detail card, and places the completion mechanism last.
9. Add focused backend and frontend tests for every new branch, including the server-side fourth-leave rejection and privileged/non-club regressions. Keep test descriptions and new fixtures in English while preserving existing Vietnamese UI literals.
10. Run every verification command, inspect the final scoped diff, and confirm no file outside Scope changed.

## Acceptance Criteria

- [ ] For a student with one active club membership, the activities list shows that club, hides all other `club` items, and continues to show `event`, `activity`, and `festival` items.
- [ ] When that student's club membership is `left` or otherwise not active, all otherwise eligible club items are visible again.
- [ ] Administrator and teacher activity lists are not filtered by the student club-exclusivity rule.
- [ ] A student with an active `club` membership sees the active-membership status and then `Rời hoạt động (N)` immediately to its right, where `N` is the server-provided remaining value from `3` through `0`.
- [ ] The leave button is absent for non-club activities and for `none`, `pending`, `rejected`, `inactive`, or `left` memberships.
- [ ] At `N = 0`, the leave button is disabled and does not call the leave endpoint.
- [ ] After confirmation and a successful active-club leave, the membership becomes `left`, `occupies_slot` is false, `left_at` is set, the per-membership leave count increments once, the response countdown decreases once, and refreshed detail access matches a non-member.
- [ ] A fourth active-club leave in the same semester is rejected by the backend before membership mutation, including when the endpoint is called directly rather than through the UI.
- [ ] Leave usage is isolated by semester and aggregated across different club membership records in the same semester; existing documents without a counter contribute zero.
- [ ] Pending-membership cancellation and non-club leave behavior remain available and do not consume the active-club leave quota.
- [ ] Existing self-service transfer counts, limits, and response fields keep their current semantics.
- [ ] Existing student detail tab and General Information layout requirements continue to pass.
- [ ] All verification commands exit successfully, the final diff contains only Scope files, new technical content is English, existing localized content remains unchanged except for the explicitly authorized UI label, no `U+FFFD` is introduced, and there is no encoding-only or line-ending-only diff.

## Verification Commands

`D:\PROJECT\manager_points\backend :: npm test -- --runInBand activities.service.spec.ts` -> exit status `0`; all activity service tests pass, including leave quota and existing transfer policy tests.

`D:\PROJECT\manager_points\backend :: npm run build` -> exit status `0`; NestJS TypeScript compilation succeeds.

`D:\PROJECT\manager_points\frontend :: npm test -- --run "src/app/(dashboard)/activities/page.test.tsx" "src/app/(dashboard)/activities/[activityId]/page.test.tsx"` -> exit status `0`; activity list and detail Vitest suites pass.

`D:\PROJECT\manager_points\frontend :: npm run typecheck` -> exit status `0`; frontend TypeScript checking succeeds.

`D:\PROJECT\manager_points :: git diff --check` -> exit status `0`; no whitespace errors are reported.

`D:\PROJECT\manager_points :: git diff -- 'docs/taskscope.md' 'frontend/src/app/(dashboard)/activities/page.tsx' 'frontend/src/app/(dashboard)/activities/page.test.tsx' 'frontend/src/app/(dashboard)/activities/[activityId]/page.tsx' 'frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx' 'frontend/src/api/activity-api.ts' 'backend/src/activities/schemas/activity-member.schema.ts' 'backend/src/activities/activities.service.ts' 'backend/src/activities/activities.service.spec.ts'` -> exit status `0`; inspection shows only the specified behavior and no unintended localization or encoding changes.

## Safety Gates + Artifacts

None — no Safety Gate is triggered. The Executor must still provide the scoped final diff and verification outputs as completion evidence.

## Iteration Limit

Loop_iterations: 3 (stop early on success)

## Escalation Triggers

The Executor must stop and report back if any required path, method, response field, or membership status differs from this taskscope; if reliable quota enforcement requires a migration or a file outside Scope; if an atomic leave update cannot be implemented with the existing Mongoose model; if direct leave calls cannot distinguish active club leaves from pending cancellation/non-club leaves; if existing transfer-quota behavior would need to change; if verification produces unexpected failures; if localized text appears corrupted; if the final diff contains an out-of-scope file; or if risk is higher than assessed.
