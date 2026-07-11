# 1. Task ID + Pipeline
- **Task ID:** `ACTIVITIES-SCHEDULE-ID-DETAIL-RULES-007`
- **Pipeline:** `feature_development`

# 2. Risk Level
- **Risk level:** Medium.
- Schedule payload and permission-aware UI changes; no database, production, or destructive action.

# 3. Objective
Eliminate `activity_id must be a mongodb id` by using canonical activity identifiers for every schedule write. Make the detail schedule tab view/registration-only and move completion-rule administration to an activity-level modal while retaining student-readable information.

# 4. Scope
- `frontend/src/api/activity-api.ts`
- `frontend/src/api/activity-api.test.ts`
- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx`
- `frontend/src/components/activities/ActivityListWorkspace.tsx`
- `frontend/src/components/activities/ActivityListWorkspace.test.tsx`

# 5. Out of Scope
- Backend controllers, DTOs, services, schemas, collections, migrations, and seed data.
- Restoring `club_id` or `/club-schedules` as the primary frontend contract.
- Schedule create/edit/delete/recurrence/drag-drop inside activity detail.
- Attendance, membership, favorites, templates, activity CRUD, points, auth, layouts, navigation, deployment, commit, push, or production data.

# 6. Context & Dependencies
- Clubs are merged into activities; schedule writes use `activity_id`.
- `ActivityScheduleWorkspace.tsx` still builds create/update/bulk/recurrence payloads with `club_id`.
- `activity-api.ts` is the final request boundary.
- Backend requires a scalar 24-character MongoDB ObjectId, never an object, code, name, or legacy identifier.
- Detail currently mixes viewing with creation and embeds the editable completion-rule form.
- Reuse existing completion-rule APIs/forms and management permission checks.

# 7. Steps — PLAN → EXECUTE → VERIFY → REFINE
## PLAN
1. Trace schedule create/update calls for drops, moves, bulk save, recurrence, and modal save.
2. Separate request/response types and define one request-boundary activity ID normalizer.
3. Identify the existing activity management role/ownership predicate.

## EXECUTE
4. In `activity-api.ts`, use `activity_id` in write DTOs, strip `club_id`, extract only `_id` from populated objects, validate with `/^[a-f\d]{24}$/i`, and throw before HTTP mutation when invalid.
5. In `ActivityScheduleWorkspace.tsx`, rename write-path club fields. Every create/update/bulk/recurrence body must contain scalar `activity_id` and `semester_id`; never use code/name.
6. Render from `schedule.activity_id`. A temporary render-only `schedule.club_id` fallback is acceptable only when it cannot enter a request.
7. Remove schedule create/edit/delete handlers and controls from detail. Keep `Lịch sinh hoạt`, chronological display, empty state, registration/cancellation, and role-appropriate information. Management remains at `/activities/schedule`.
8. Replace the editable completion-rule tab with a read-only summary of minimum attendance, criteria/awards, status, and explicit empty state. Students receive no mutation controls.
9. Add exactly one manager-only activity-level `Cấu hình quy tắc hoàn thành` button outside tab content. Reuse the rule form in a modal. Success updates local summary and closes without reload; failure preserves inputs and stays open.
10. If actions live in `ActivityListWorkspace.tsx`, place it there and let `activities/page.tsx` own selection/modal; do not duplicate it.
11. Test scalar serialization, invalid objects, drag/move, bulk save, no outgoing `club_id`, no detail mutations, student read-only rules, authorized save, and failure preservation.

## VERIFY
12. Run Section 9 focused tests, type-check, build, and static searches.
13. Confirm only Scope files changed and no backend compatibility layer was added.

## REFINE
14. Correct only failing ID normalization, permissions, modal state, or read-only behavior and rerun verification.
15. If legacy response typing fails, separate it from canonical request DTOs.
16. Stop after three failed iterations and trigger the human gate.

# 8. Acceptance Criteria
1. Create, move, edit, recurrence, and bulk-save send valid scalar `activity_id` and no `club_id`.
2. Populated objects use valid `_id`; invalid/missing `_id` causes no request.
3. Moving a saved schedule and clicking `Lưu tất cả` no longer returns the ID error.
4. Detail schedule has no create/edit/delete/recurrence/drag-drop/auto-create behavior.
5. Display and permitted student registration/cancellation remain functional.
6. Rules are read-only for students with an explicit empty state.
7. Authorized managers see exactly one activity-level rule configuration action.
8. Success updates without reload; failure preserves modal/input state.
9. Focused tests, type-check, and build pass; no out-of-scope file changes.

# 9. Verification Commands
Run from `D:\PROJECT\manager_points`:
```powershell
npm test -- --runInBand frontend/src/api/activity-api.test.ts frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx "frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx" frontend/src/app/(dashboard)/activities/page.test.tsx frontend/src/components/activities/ActivityListWorkspace.test.tsx
npm run type-check --prefix frontend
npm run build --prefix frontend
rg -n "club_id\s*:" frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/api/activity-api.ts
rg -n "activityScheduleApi\.(create|update|delete)" "frontend/src/app/(dashboard)/activities/[activityId]/page.tsx"
git diff --check
git status --short
git diff -- frontend/src/api/activity-api.ts frontend/src/api/activity-api.test.ts frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx "frontend/src/app/(dashboard)/activities/[activityId]/page.tsx" "frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx" frontend/src/app/(dashboard)/activities/page.tsx frontend/src/app/(dashboard)/activities/page.test.tsx frontend/src/components/activities/ActivityListWorkspace.tsx frontend/src/components/activities/ActivityListWorkspace.test.tsx
```
Expected: no outgoing `club_id` property and no detail schedule create/update/delete call.

# 10. Safety Gates
Request approval before backend/database changes, migrations/repairs/deployments, permission expansion, retaining `club_id` in writes, accepting code/name as IDs, out-of-scope files, or continuing after three failed iterations.

# 11. Artifacts to Review
- Sanitized failing request body and backend response.
- Frontend stack trace; test, type-check, and build output.
- `git status --short` and scoped diff.
- Manager/student screenshots of schedule tab, rule summary, and modal.
- Exact API-contract or permission decision requiring approval.

# 12. loop_iterations override
- Use default `3` iterations; sufficient for one identifier regression and two contained UI changes.
