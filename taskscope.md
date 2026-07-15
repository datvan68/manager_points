# 1. Task ID + Pipeline

- Task ID: `ACTIVITY-CARD-20260715-002`
- Pipeline: `feature_development`

# 2. Risk Level

- Risk level: `medium`
- Rationale: this task changes the activity list response and removes the `club_id` compatibility alias from activity schedule and attendance HTTP contracts. It does not modify production data, database schemas, authentication, authorization, or deployment configuration.

# 3. Objective

Make every activity card display the schedule for the current week and the correct active-member count. Complete the activity-domain identifier migration so application code and HTTP contracts use `activity_id` only and no longer accept, emit, or derive values from `club_id`.

# 4. Scope

The following files/modules may be changed:

- `backend/src/activities/activities.service.ts`
- `backend/src/activities/activities.service.spec.ts`
- `backend/src/activity-schedules/activity-schedules.controller.ts`
- `backend/src/activity-schedules/dto/create-schedule.dto.ts`
- `backend/src/activity-schedules/dto/query-schedule.dto.ts`
- `backend/src/activity-attendance-config/activity-attendance-config.controller.ts`
- `backend/src/activity-attendance-config/dto/attendance-config.dto.ts`
- `backend/src/club-attendance/club-attendance.controller.ts`
- `backend/src/club-attendance/dto/attendance.dto.ts`
- `frontend/src/api/activity-api.ts`
- `frontend/src/api/activity-api.test.ts`
- `frontend/src/api/club-api.ts`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/my/page.tsx`
- `frontend/src/components/activities/ActivityCard.tsx`
- `frontend/src/components/activities/ActivityCard.test.tsx`
- `frontend/src/components/activities/ActivityCompletionRuleForm.tsx`
- `frontend/src/components/activities/ActivityMemberTable.test.tsx`
- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`
- `frontend/src/components/activities/utils/schedule-helper.ts`
- `frontend/src/components/activities/utils/schedule-helper.test.ts`
- `frontend/src/components/activities/utils/student-club-view.ts`
- `frontend/src/components/activities/utils/student-club-view.test.ts`

# 5. Out of Scope

- Do not rename MongoDB collections, URL route prefixes such as `/activities` or `/club-attendance`, or user-facing labels.
- Do not migrate or rewrite persisted production documents; current activity-domain schemas already store the canonical relation as `activity_id`.
- Do not change membership eligibility, approval, transfer, favorite, attendance, or recurrence business rules.
- Do not redesign the activity card, activity list layout, schedule page layout, or card-design presets.
- Do not add one member-list request per card; the list endpoint must provide the count without a frontend N+1 request pattern.
- Do not modify modules outside the exact paths listed in Section 4. If another source file still requires a `club_id` contract change, stop and request a scope expansion.

# 6. Context & Dependencies

- `ActivityCard.tsx` currently requests schedules with `{ club_id: activity._id }`, while the canonical schedule query field is `activity_id`.
- `schedule-helper.ts` currently filters each schedule through `schedule.club_id`; schedule records returned by the backend contain `activity_id`, so valid schedules are excluded from the card summary.
- `activities.service.ts#findAll` currently returns activity documents without `active_members_count`; `ActivityCard.tsx` renders that missing property as zero.
- The correct member count is the number of `ActivityMember` records whose `activity_id` matches the activity, whose `status` is `active`, and whose `semester_id` matches the activity semester. Activities without a semester must count active memberships for that activity without inventing a semester filter.
- The backend list implementation must aggregate counts in bulk for all returned activities, not execute `countDocuments` once per activity.
- Existing compatibility code accepts `club_id` and copies it to `activity_id` in schedule, attendance configuration, and attendance controllers/DTOs. This compatibility path must be removed.
- Frontend API types and payload normalization still expose several `club_id` properties. Call sites must send `activity_id` directly, and response parsing must use canonical activity identifiers.
- `date-fns` remains the date-formatting dependency for schedule summaries. Week boundaries remain Monday 00:00:00 through Sunday 23:59:59.999 in the client's local timezone.

# 7. Steps

## PLAN

1. Enumerate every literal `club_id` occurrence under `frontend/src` and the scoped backend activity schedule/attendance modules; classify each occurrence as an identifier contract, legacy API wrapper, test fixture, or user-facing route name.
2. Define the `GET /activities` response field `active_members_count: number` and the canonical `activity_id` request/response fields used by schedules, attendance configuration, attendance, completion rules, and student activity views.

## EXECUTE

3. In `backend/src/activities/activities.service.ts`, extend `findAll` to collect the returned activity IDs, aggregate active `ActivityMember` records by `activity_id` and applicable `semester_id`, and merge `active_members_count` into every returned activity object with `0` as the explicit fallback.
4. In `backend/src/activities/activities.service.spec.ts`, add service tests proving that `findAll` returns the correct per-activity active count, excludes pending/inactive memberships, respects the activity semester, returns zero when no active membership exists, and performs a bulk aggregation rather than one query per activity.
5. In the scoped schedule and attendance backend controllers/DTOs, remove `club_id` declarations, equality checks, alias-copy logic, and Swagger query/body declarations; require or accept `activity_id` according to the existing operation semantics.
6. In `frontend/src/api/activity-api.ts`, define `active_members_count` on `Activity`; replace activity-domain `club_id` fields and query parameters with `activity_id`; remove payload fallback/deletion logic for `club_id`; and parse canonical activity ID collections without a `club_ids` alias.
7. In `frontend/src/api/club-api.ts` and every scoped frontend activity call site, replace request payloads, query parameters, response fields, and local identifier access from `club_id` to `activity_id` while preserving endpoint URLs and unrelated business behavior.
8. In `frontend/src/components/activities/ActivityCard.tsx`, request schedules with `{ activity_id: activity._id }`, render the numeric `active_members_count` returned by the list endpoint, and preserve `0` without using truthiness to select the displayed count.
9. In `frontend/src/components/activities/utils/schedule-helper.ts`, resolve schedule ownership only from `schedule.activity_id`, supporting both a string ID and a populated `{ _id }` value; keep the current-week filter, active-status filter, grouping, ordering, and next-week fallback unchanged.
10. Update all scoped frontend tests and fixtures to use `activity_id`; add card and helper regressions that prove current-week schedules render and a non-zero backend member count renders as `current/max`.

## VERIFY

11. Run the exact backend and frontend test commands in Section 9.
12. Run the exact `rg` command in Section 9 and confirm it returns no literal `club_id` occurrence in `frontend/src` or the scoped backend modules.

## REFINE

13. If verification fails, change only the scoped implementation or test whose failure directly corresponds to the acceptance criteria, then rerun all commands. Stop after three PLAN -> EXECUTE -> VERIFY iterations and report the remaining failing assertion or `club_id` occurrence.

# 8. Acceptance Criteria

- An activity card displays schedule rows for scheduled or ongoing records in the current Monday-to-Sunday week when those records identify the activity with `activity_id`.
- If the current week has no active schedule, the existing first-upcoming-week fallback still works.
- `GET /activities` returns `active_members_count` for every activity, including an explicit `0` when no matching active member exists.
- The count includes only active memberships for the relevant activity and semester and does not include pending, rejected, or inactive memberships.
- The activity list obtains member counts in a bulk backend operation; rendering multiple cards does not trigger one member request per card.
- The card renders the returned member count and maximum as `active_members_count/max_members`, including correct handling of zero and an absent maximum.
- Activity schedule, attendance configuration, attendance, completion-rule, and student activity frontend contracts use `activity_id` only.
- Backend schedule and attendance DTOs/controllers no longer accept `club_id` as an alias for `activity_id`.
- No literal `club_id` remains under `frontend/src` or in the scoped backend schedule/attendance modules.
- All verification commands pass without changing unrelated behavior.

# 9. Verification Commands

Run from the repository root:

```powershell
cd backend
npm test -- --runInBand src/activities/activities.service.spec.ts
cd ..\frontend
npm test -- --run "src/api/activity-api.test.ts" "src/components/activities/ActivityCard.test.tsx" "src/components/activities/ActivityScheduleWorkspace.test.tsx" "src/components/activities/ActivityMemberTable.test.tsx" "src/components/activities/utils/schedule-helper.test.ts" "src/components/activities/utils/student-club-view.test.ts"
cd ..
rg -n "club_id" frontend/src backend/src/activity-schedules backend/src/activity-attendance-config backend/src/club-attendance
```

Expected result for the final `rg` command: exit code `1` with no matches.

# 10. Safety Gates

- Human approval is required if implementation needs a production database migration, persisted-document rewrite, deployment, deletion, or schema/index change.
- Human approval is required if removing `club_id` would intentionally break a known external consumer not represented in this repository.
- Stop and request scope expansion if a required implementation change falls outside the exact paths in Section 4.
- No Human Gate is required for local source edits and local tests that stay within Section 4.

# 11. Artifacts to Review

- Final diff for every changed file listed in Section 4.
- Backend test output for `backend/src/activities/activities.service.spec.ts`.
- Frontend Vitest output for the six targeted test files.
- Final zero-match output and exit code from the `rg -n "club_id" ...` verification command.
- A sample `GET /activities` response showing `active_members_count` on activities with zero and non-zero active memberships.

# 12. Loop_iterations Override

- No override. Use the default `3` iterations defined by the engineering loop.

