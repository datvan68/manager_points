# 1. Task ID + Pipeline

- **Task ID:** `UNIFIED-ACTIVITIES-CANONICALIZATION-001`
- **Pipeline:** `feature_development`

# 2. Risk Level

- **Risk level:** `medium`
- **Reason:** The task consolidates two user-facing route trees and API clients into `/activities`, affecting navigation, permissions, notifications, memberships, schedules, and attendance entry points. It deliberately retains the existing MongoDB collections and `club_id` persistence fields, so it does not require a database migration or production data rewrite.

# 3. Objective

Make Activity the only canonical product domain: a club is an Activity whose `activity_type` is `club`, not a separate subsystem. Preserve old `/club/**` bookmarks through redirects and retain backend storage compatibility while removing duplicate Club UI/API behavior.

# 4. Scope

The following files/modules may be changed.

## Frontend canonical Activity routes and UI

- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/my/page.tsx`
- `frontend/src/app/(dashboard)/activities/my/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/schedule/page.tsx`
- `frontend/src/app/(dashboard)/activities/schedule/page.test.tsx`
- `frontend/src/components/activities/**`
- `frontend/src/api/activity-api.ts`
- `frontend/src/api/activity-api.test.ts`

## Frontend legacy compatibility routes

- `frontend/src/app/(dashboard)/club/layout.tsx`
- `frontend/src/app/(dashboard)/club/layout.test.tsx`
- `frontend/src/app/(dashboard)/club/page.tsx`
- `frontend/src/app/(dashboard)/club/clubs/page.tsx`
- `frontend/src/app/(dashboard)/club/clubs/[clubId]/page.tsx`
- `frontend/src/app/(dashboard)/club/schedules/page.tsx`
- `frontend/src/app/(dashboard)/club/my/page.tsx`
- `frontend/src/app/(dashboard)/club/attendance/page.tsx`
- `frontend/src/app/(dashboard)/club/attendance/approval/page.tsx`
- `frontend/src/app/(dashboard)/club/config/page.tsx`
- Existing tests located under `frontend/src/app/(dashboard)/club/**` must be converted to redirect-compatibility tests or removed only when their replaced behavior is covered under `/activities/**`.

## Frontend navigation and shared policy

- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/popups/SubsystemPopup.tsx`
- `frontend/src/utils/module-maintenance.util.ts`
- `frontend/src/utils/module-maintenance.util.test.ts`
- `frontend/src/app/(dashboard)/club/clubs/membership-policy.ts`
- `frontend/src/app/(dashboard)/club/clubs/membership-policy.test.ts`
- `frontend/src/app/(dashboard)/club/clubs/student-club-view.ts`
- `frontend/src/app/(dashboard)/club/clubs/student-club-view.test.ts`
- `frontend/src/app/(dashboard)/club/clubs/schedule-helper.ts`
- `frontend/src/app/(dashboard)/club/clubs/schedule-helper.test.ts`

## Backend compatibility routes and Activity-facing metadata

- `backend/src/clubs/clubs.controller.ts`
- `backend/src/clubs/clubs.controller.spec.ts`
- `backend/src/clubs/clubs.service.ts`
- `backend/src/clubs/clubs.service.spec.ts`
- `backend/src/club-schedules/club-schedules.controller.ts`
- `backend/src/club-schedules/club-schedules.service.ts`
- `backend/src/club-schedules/club-schedules.service.spec.ts`
- `backend/src/club-schedules/club-schedule-active-notification.service.ts`
- `backend/src/club-schedules/club-schedule-active-notification.service.spec.ts`
- `backend/src/club-attendance/club-attendance.controller.ts`
- `backend/src/club-attendance/club-attendance.service.ts`
- `backend/src/club-attendance/club-attendance.service.spec.ts` if present or created
- `backend/src/club-attendance-config/club-attendance-config.controller.ts`
- `backend/src/club-attendance-config/club-attendance-config.service.ts`
- `backend/src/club-attendance-config/club-attendance-config.service.spec.ts` if present or created
- `backend/test/activities.e2e-spec.ts`
- `docs/unified-activities.md`

# 5. Out of Scope

- Do not rename MongoDB collections `clubs`, `club_members`, `club_schedules`, `club_attendances`, `club_attendance_configs`, `club_favorites`, or `schedule_registrations` in this task.
- Do not rename persisted fields `club_id`, `from_club_id`, or `to_club_id` to `activity_id` in this task.
- Do not modify `backend/scripts/migrate-unified-activities.ts` or execute it with `--apply`.
- Do not change the existing meaning of `activity_type`; `club`, `event`, `activity`, and `festival` remain valid types.
- Do not remove the backend `/clubs`, `/club-schedules`, `/club-attendance`, or `/club-attendance-config` aliases until external consumers have a separately approved deprecation plan.
- Do not change the club-only semester slot rule, transfer limit, or `occupies_slot` behavior.
- Do not change completion thresholds, academic-record generation, attendance scoring suppression, or idempotency keys.
- Do not redesign Activity cards, calendar layout, recurrence behavior, membership status controls, or attendance screens beyond terminology and route integration required by this consolidation.
- Do not change authentication guards, permission codes such as `CLUB_READ`, `CLUB_CREATE`, or `CLUB_MEMBER_MANAGE`; permission renaming requires a separate authorization migration.
- Do not deploy, merge, rewrite production data, or delete the legacy backend aliases.

# 6. Context & Dependencies

- `docs/unified-activities.md` defines the existing domain decision: every club/event/general activity/festival is stored as one Activity entity in MongoDB collection `clubs`.
- `backend/src/clubs/schemas/club.schema.ts` already provides `activity_type` and `participation_status`; no entity merge is required.
- `ClubsController` currently exposes both `/clubs` and `/activities`; `ClubSchedulesController` exposes both `/club-schedules` and `/activity-schedules`.
- The current frontend already has canonical `/activities`, `/activities/[activityId]`, `/activities/my`, and `/activities/schedule` pages, but the complete legacy `/club/**` UI remains active.
- `frontend/src/api/activity-api.ts` already calls `/activities` and `/activity-schedules`, but retains `club_id` compatibility fields because the backend storage contract has not been migrated.
- `frontend/src/api/club-api.ts` must stop being imported by active canonical Activity pages. The file itself remains untouched in this task unless repository-wide search proves no consumers remain and deletion is explicitly approved in a follow-up task.
- Club-specific behavior is selected by `activity.activity_type === 'club'`; it must not be inferred from the route used to open the record.
- Legacy page redirects must preserve relevant identifiers, query strings, and tab intent:
  - `/club` and `/club/clubs` → `/activities?activityType=club`
  - `/club/clubs/:clubId` → `/activities/:clubId`
  - `/club/schedules` → `/activities/schedule?activityType=club`
  - `/club/my` → `/activities/my?activityType=club`
  - `/club/attendance` and `/club/attendance/approval` must redirect to the corresponding Activity attendance destination created or confirmed during PLAN; do not guess a destination without tracing the current attendance navigation.
  - `/club/config` must redirect to the Activity configuration/completion-rule destination confirmed during PLAN.
- Notification links currently generated as `/club/clubs/:id?tab=schedules` must become `/activities/:id?tab=schedule`.
- Existing MongoDB `club_id` values are Activity IDs. At frontend boundaries, expose `activityId` names and map to/from `club_id` only inside `activity-api.ts`.

# 7. Steps — PLAN → EXECUTE → VERIFY → REFINE

## PLAN

1. Run repository-wide searches for imports from `@/api/club-api`, links beginning with `/club`, variables/types/components beginning with `Club`, user-visible strings containing `CLB` or `câu lạc bộ`, and backend Swagger summaries/tags containing Club terminology.
2. Build a route matrix for every file under `frontend/src/app/(dashboard)/club/**`, recording its canonical `/activities/**` destination, identifier mapping, query-string mapping, and whether the current page owns unique functionality not yet present under `/activities`.
3. Compare the legacy detail tabs against `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`: information, members, schedule, attendance/configuration, and completion rule. If a legacy function is absent, add it to the canonical Activity detail/page within Section 4 before redirecting its old route.
4. Confirm the Activity attendance and configuration destinations from existing navigation and components. If no canonical destination exists, stop and request clarification rather than inventing a route outside Section 4.
5. Record baseline results for frontend tests, frontend typecheck, backend unit tests, backend build, and `activities.e2e-spec.ts` before editing.

## EXECUTE

6. Make `/activities`, `/activities/[activityId]`, `/activities/my`, and `/activities/schedule` the only pages containing Activity management implementation. Ensure these pages support all `activity_type` values and apply club-only rules using `activity_type === 'club'`.
7. Replace active canonical imports from `@/api/club-api` with exports from `@/api/activity-api`. Rename frontend-local types, props, handlers, and variables to `Activity`, `ActivityMember`, `ActivitySchedule`, `activityId`, and `activityIds`; keep `club_id` only in API compatibility payload/response types.
8. Move reusable membership policy, student-view policy, card design helpers, and schedule helpers from `frontend/src/app/(dashboard)/club/clubs/**` into `frontend/src/components/activities/` or a new `frontend/src/components/activities/utils/` module. Update imports and corresponding test paths; do not duplicate helper implementations.
9. Replace each legacy `/club/**` page implementation with a server-side `redirect()` where possible. Preserve record IDs and recognized query parameters according to the route matrix. Legacy pages must not fetch data, render a second management UI, or call `club-api` before redirecting.
10. Update `Sidebar.tsx` and `SubsystemPopup.tsx` so only one Activity navigation entry is displayed and its canonical href is `/activities`. Remove duplicate Club navigation visibility without changing permission evaluation.
11. Update `module-maintenance.util.ts` so `/activities/**` resolves to the existing maintenance/permission module used for the unified domain; retain `/club/**` recognition only for redirect compatibility tests.
12. In `activity-api.ts`, expose Activity terminology to components while isolating legacy backend keys in request/response mapping helpers. Normalize populated references and scalar IDs in one helper; components must not repeat `typeof value === 'object' ? value._id : value` logic.
13. In `ClubsController`, keep both controller route aliases but make `/activities` primary in Swagger tags, operation summaries, parameter descriptions, and tests. `/clubs` remains an explicit legacy alias whose collection response defaults to `activity_type=club` only if that current behavior is verified by tests.
14. In schedule, attendance, and attendance-config controllers, add or confirm canonical Activity aliases and `activity_id` query/body compatibility at the controller boundary while continuing to pass the stored ID to existing services. When both `activity_id` and `club_id` are supplied and differ, return `400 Bad Request`; do not choose one silently.
15. Keep service persistence queries using `club_id`, but rename method parameters and user-facing exception text to Activity terminology where they apply to all activity types. Club-only transfer/slot messages must remain Club-specific.
16. Update active-schedule notifications to link to `/activities/:activityId?tab=schedule` and use Activity wording for all types; allow Club wording only when the loaded entity has `activity_type === 'club'`.
17. Update `docs/unified-activities.md` with the canonical route table, legacy redirect table, API alias policy, `activity_id` boundary mapping, and a clear statement that collection/field renaming is deferred.
18. Add or update tests for canonical activity CRUD/list/detail, membership behavior for club and non-club types, legacy redirects, single navigation entry, schedule/attendance/config aliases, conflicting `activity_id` and `club_id`, and notification URLs.

## VERIFY

19. Run every command in Section 9 and attach exit codes.
20. Run `rg` checks proving active canonical frontend code has no import from `@/api/club-api`, no canonical navigation points to `/club/**`, and no Activity component displays generic Club wording for non-club types.
21. Manually verify as an administrator: open the Activity list, filter each type, open detail tabs, create/edit an Activity, schedule it, manage registrations, and configure completion criteria.
22. Manually verify as a student: register for a Club-type Activity and a non-club Activity, confirm slot restrictions apply only to the Club type, and open My Activities and schedule detail.
23. Open every legacy `/club/**` route from the route matrix and confirm one redirect reaches the expected canonical page while preserving ID/query intent and without duplicate API requests.
24. Trigger or unit-test an active schedule notification and confirm its URL uses `/activities/:id?tab=schedule`.

## REFINE

25. If a legacy page contains unique behavior absent from `/activities`, port only that behavior into the canonical Activity component before reinstating the redirect; do not keep two implementations.
26. If a canonical component still requires a `club_id`, move that translation into `activity-api.ts` unless it is a persisted backend DTO explicitly listed in Context.
27. If Club-only constraints affect non-club activities, correct the condition at the service/policy boundary using `activity_type === 'club'`; do not disable the constraint globally.
28. If an external-consumer compatibility test fails, restore the legacy backend alias while retaining the canonical Activity endpoint.
29. Re-run all verification commands after each refinement. Stop after three failed iterations and report remaining failures with artifacts.

# 8. Acceptance Criteria

- Activity is the only visible subsystem entry; no duplicate Club menu/subsystem entry remains.
- `/activities` manages `club`, `event`, `activity`, and `festival` records from the same entity source.
- `/activities/[activityId]` provides the required information, members, schedule, attendance/configuration, and completion-rule capabilities previously reachable through Club pages.
- `/activities/schedule` schedules all Activity types; Club is only a filter/type, not a separate calendar implementation.
- All legacy `/club/**` routes redirect to documented `/activities/**` destinations without rendering or fetching through the old UI.
- Active canonical frontend code imports `activity-api.ts`, not `club-api.ts`.
- Frontend components use Activity terminology and `activityId`; legacy `club_id` is isolated to compatibility mappings in the API layer.
- Canonical backend endpoints accept Activity terminology while legacy endpoint and `club_id` aliases continue working.
- Conflicting `activity_id` and `club_id` inputs return HTTP 400.
- Notification links open `/activities/:id?tab=schedule`.
- Club-only slot and transfer constraints still apply only when `activity_type === 'club'`; other types allow concurrent participation.
- MongoDB collection names, stored fields, existing IDs, attendance records, completion awards, and idempotency keys are unchanged.
- Frontend tests/typecheck/build, backend tests/build, and Activity E2E tests pass.

# 9. Verification Commands

Run from `D:\PROJECT\manager_points`:

```powershell
npm --prefix frontend test -- --run src/components/activities
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix backend test -- --runInBand
npm --prefix backend run build
npm --prefix backend run test:e2e -- --runInBand test/activities.e2e-spec.ts
rg -n "@/api/club-api" frontend/src/app/\(dashboard\)/activities frontend/src/components/activities
rg -n "href=.?['\"]?/club|router\.(push|replace)\(['\"]?/club|routeUrl:.?['\"]?/club" frontend/src backend/src
rg -n "club_id|Club|CLB|câu lạc bộ" frontend/src/app/\(dashboard\)/activities frontend/src/components/activities
```

Expected `rg` handling:

- The first command must return no matches.
- The second may match only files under `frontend/src/app/(dashboard)/club/**` that implement redirects or explicit compatibility tests.
- The third may match compatibility types/mappers and wording guarded by `activity_type === 'club'`; every remaining match must be listed and justified in the verification report.

# 10. Safety Gates

No Human Gate is required for local source/test/document changes within Section 4.

Stop and request approval under `.agents/Rules/safety.md` if any of these becomes necessary:

- Renaming collections or persisted `club_id` fields, executing `migrate:unified-activities -- --apply`, or modifying database data: `risk_level: high`.
- Removing legacy backend endpoints before consumer verification: `risk_level: high`.
- Production deployment/configuration or production database access: `risk_level: high`.
- Deleting production resources, destructive data migration, or credential-impacting action: `risk_level: critical`.
- Merging into `main`, `master`, or `release/*`; deleting a remote branch; resetting/rebasing shared history; handling secrets; or changing production CI/CD: use the level required by `safety.md`.
- Any required file outside Section 4: stop and submit the exact path and reason before editing.

# 11. Artifacts to Review

If a Human Gate is triggered, attach:

- Git diff for every changed file.
- The route matrix for all `/club/**` redirects.
- The API compatibility matrix for `/activities`/`/clubs`, `/activity-schedules`/`/club-schedules`, attendance, and attendance configuration.
- Full outputs and exit codes from Section 9.
- The remaining-match justification for all three `rg` checks.
- Screenshots of the single Activity navigation entry, list filters, detail tabs, schedule, and legacy redirect destinations.
- Redacted request/response examples for `activity_id`, `club_id`, and conflicting-ID validation.
- Migration dry-run output if a database rename is proposed; never attach credentials or an unredacted MongoDB URI.

# 12. loop_iterations override

- **Override:** None.
- Use the default `3` PLAN → EXECUTE → VERIFY → REFINE iterations defined by `.agents/Rules/global.md` and `.agents/Rules/safety.md`.
