# Taskscope: Replace the Club Product Domain with a Unified Activity Domain

## 1. Task ID + Pipeline

Task ID: `TSK-UNIFIED-ACTIVITY-REBUILD-20260710`

Pipeline: `feature_development`

## 2. Risk Level

Risk Level: `high`

Reason: this task changes the primary domain used by registration, membership, schedules, attendance, and automatic academic records. Existing Club documents and references must continue to resolve during and after the change.

## 3. Objective

Replace the product-domain name `Club` with `Activity` so a club, event, activity, or festival is one configurable Activity rather than separate programs. An administrator configures participation requirements and multiple academic-record criteria directly on an Activity.

## 4. Scope

Change exactly these files and directories:

- `backend/src/clubs/schemas/club.schema.ts`
- `backend/src/clubs/schemas/club-member.schema.ts`
- `backend/src/clubs/dto/create-club.dto.ts`
- `backend/src/clubs/dto/update-club.dto.ts`
- `backend/src/clubs/dto/club-member.dto.ts`
- `backend/src/clubs/clubs.controller.ts`
- `backend/src/clubs/clubs.service.ts`
- `backend/src/clubs/clubs.module.ts`
- `backend/src/clubs/clubs.service.spec.ts`
- `backend/src/club-schedules/club-schedules.controller.ts`
- `backend/src/club-schedules/club-schedules.service.ts`
- `backend/src/club-schedules/club-schedules.module.ts`
- `backend/src/club-schedules/club-schedules.service.spec.ts`
- `backend/src/club-attendance/club-attendance-sync.service.ts`
- `backend/src/club-attendance/club-attendance.module.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.ts`
- `backend/src/attendance-sessions/attendance-sessions.module.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.spec.ts`
- `backend/src/academic-record/academic-record.module.ts`
- `backend/src/app.module.ts`
- `backend/src/club-attendance/schemas/activity-completion-rule.schema.ts`
- `backend/src/club-attendance/schemas/activity-completion-award.schema.ts`
- `backend/src/club-attendance/dto/activity-completion-rule.dto.ts`
- `backend/src/club-attendance/activity-completion.service.ts`
- `backend/src/club-attendance/activity-completion.service.spec.ts`
- `backend/src/club-attendance/activity-completion.controller.ts`
- `backend/test/activities.e2e-spec.ts`
- `backend/scripts/migrate-unified-activities.ts`
- `frontend/src/api/activity-api.ts`
- `frontend/src/api/activity-api.test.ts`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/my/page.tsx`
- `frontend/src/app/(dashboard)/activities/my/page.test.tsx`
- `frontend/src/components/activities/ActivityForm.tsx`
- `frontend/src/components/activities/ActivityMemberTable.tsx`
- `frontend/src/components/activities/ActivityCompletionRuleForm.tsx`
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx`
- `frontend/src/components/activities/StudentActivityCard.tsx`
- `docs/unified-activities.md`

## 5. Out of Scope

- Do not create a second `attendance-programs` module, collection, route, or user interface.
- Do not create a separate Event, Festival, or Activity collection. All four types use the existing `clubs` collection.
- Do not rename physical MongoDB collection names, legacy foreign-key field names, or existing data: `clubs`, `club_members`, `club_schedules`, `club_attendances`, `club_id`, and `Club` persistence classes remain compatibility internals in this delivery.
- Do not delete existing `/clubs`, `/club-schedules`, or `/club-attendance` endpoints; they remain backward-compatible aliases while new Activity routes are added.
- Do not change JWT issuance, role assignments, the existing permission registry, `.env*` files, Docker files, CI/CD files, payment flows, notifications, certificates, waiting lists, capacity rules, or production deployment configuration.
- Do not execute a production migration or modify a production database.

## 6. Context & Dependencies

- The Activity product entity is persisted by the existing `Club` Mongoose schema with `collection: 'clubs'`. The code adds `activity_type` with `club`, `event`, `activity`, and `festival`, plus `participation_status` with `draft`, `published`, `completed`, and `cancelled`.
- Existing Club documents receive `activity_type: 'club'` and `participation_status: 'published'` through the local migration script. No document is copied to another collection.
- Existing `ClubMember`, `ClubSchedule`, and `ClubAttendance` documents remain Activity members, schedules, and attendance. New public API fields use `activity_id`, while legacy aliases remain accepted.
- A Club membership consumes the current single-club semester slot. A non-club Activity membership sets `occupies_slot: false` and does not participate in Club transfer limits.
- `ActivityCompletionRule` belongs to one Activity and semester, has one minimum attendance count and one or more criterion IDs, and is configuration only, not an attendance program.
- `ActivityCompletionAward` is an immutable audit row with a unique Activity/Student/Criterion tuple.
- Approved `present` and `late` attendance each count once. When the requirement is reached, the completion service creates one AcademicRecord for every configured criterion using `activity-completion:<activityId>:<studentId>:<criterionId>`.
- Legacy per-attendance Club scoring remains active only when no ActivityCompletionRule exists for the Activity and semester.
- Existing `CLUB_*` permissions protect Activity routes in this delivery.

## 7. Steps

### PLAN

1. Inspect `backend/src/clubs/clubs.service.ts`, `backend/src/club-schedules/club-schedules.service.ts`, `backend/src/club-attendance/club-attendance-sync.service.ts`, and `backend/src/attendance-sessions/attendance-sessions.service.ts` for all membership and attendance behavior.
2. Inspect `frontend/src/api/club-api.ts` and `frontend/src/app/(dashboard)/club/` to preserve existing behavior while creating Activity-first pages.
3. Add focused tests before modifying membership-slot behavior, scoring precedence, and route aliases.

### EXECUTE

4. Add indexed `activity_type` and `participation_status` enum fields in `backend/src/clubs/schemas/club.schema.ts`; validate both in `create-club.dto.ts` and `update-club.dto.ts`.
5. In `backend/src/clubs/clubs.controller.ts` and `clubs.service.ts`, add `/activities` public routes, type filtering, Activity status checks, Activity-neutral responses, and legacy `/clubs` compatibility.
6. In `clubs.service.ts`, apply slot/transfer rules only when `activity_type === 'club'`; create non-club Activity members with `occupies_slot: false`; reject joining draft, completed, and cancelled Activities.
7. In `backend/src/club-schedules/club-schedules.controller.ts` and `club-schedules.service.ts`, add `/activity-schedules` aliases and reject schedule changes for completed or cancelled Activities without changing recurrence behavior.
8. Add the Activity completion schemas, DTO, service, controller, tests, and Mongoose registrations listed in Section 4. Published rules require `minimum_attendance >= 1`, a semester, and at least one count-mode criterion.
9. In `ActivityCompletionService`, count distinct approved `present` and `late` attendance rows. At the threshold, create one audit award and one AcademicRecord per configured criterion in a transaction with the idempotency key from Section 6.
10. In `club-attendance-sync.service.ts`, execute completion logic before legacy scoring. A configured rule suppresses per-attendance records; absent a rule preserves current behavior.
11. In `attendance-sessions.service.ts`, retain `context_type: 'club'` as a storage compatibility value while admitting all Activity types stored in `clubs`.
12. Create `backend/scripts/migrate-unified-activities.ts` to idempotently backfill missing type/status fields. It logs matched and modified counts and must not run against production.
13. Create `frontend/src/api/activity-api.ts`, Activity pages, and components listed in Section 4. Use `/activities`, `/activity-schedules`, and completion-rule APIs only; do not create or call Attendance Program APIs.
14. In `frontend/src/components/layout/Sidebar.tsx`, replace the Club navigation label with Activities and link it to `/activities`; keep `/club/*` routes available for bookmarks.
15. Write `docs/unified-activities.md` with types, compatibility routes, member-slot rules, completion logic, idempotency, and local migration steps.

### VERIFY

16. Run every command in Section 9. Confirm Club slot consumption, non-club concurrent enrollment, route aliases, multi-criterion completion, duplicate idempotency, and legacy scoring fallback.

### REFINE

17. For a failed check, change only its scoped file, rerun its focused test, then rerun Section 9. Stop for a Human Gate before database execution outside local development, permission changes, or destructive data operations.

## 8. Acceptance Criteria

- `POST /activities` creates a `clubs` document with an allowed `activity_type`; legacy `POST /clubs` defaults to `club`.
- `GET /activities?activity_type=event` returns only Event Activities, while `GET /clubs` remains operational.
- Students can join multiple non-club Activities per semester without consuming the Club slot; Club behavior remains unchanged.
- Existing schedules and attendance check-in work for every Activity type.
- A multi-criterion ActivityCompletionRule creates exactly one active AcademicRecord and one ActivityCompletionAward per criterion after the configured minimum approved attendances.
- Repeated approval or synchronization creates no duplicate ActivityCompletionAward or AcademicRecord.
- Without an ActivityCompletionRule, legacy Club scoring remains unchanged.
- The Activity UI has no Attendance Program creation flow, page, or API call.
- Every command in Section 9 exits successfully.

## 9. Verification Commands

```powershell
Set-Location backend; npm test -- clubs.service.spec.ts club-schedules.service.spec.ts activity-completion.service.spec.ts attendance-sessions.service.spec.ts
Set-Location backend; npm run test:e2e -- activities.e2e-spec.ts
Set-Location frontend; npm test -- "src/api/activity-api.test.ts" "src/app/(dashboard)/activities/page.test.tsx" "src/app/(dashboard)/activities/[activityId]/page.test.tsx" "src/app/(dashboard)/activities/my/page.test.tsx"
Set-Location backend; npm run build
Set-Location frontend; npm run build
```

## 10. Safety Gates

- Require a Human Gate before running `backend/scripts/migrate-unified-activities.ts` against a shared, staging, or production database.
- Require a Human Gate before deployment, MongoDB index changes, modifying existing production records, deleting Club collections, changing permissions, or changing Club transfer policy.
- Local source-code and test changes in Section 4 may proceed without a Human Gate.

## 11. Artifacts to Review

- `backend/test/activities.e2e-spec.ts` output.
- Unit-test output for `clubs.service.spec.ts`, `activity-completion.service.spec.ts`, and `attendance-sessions.service.spec.ts`.
- `frontend/src/api/activity-api.test.ts` and Activity page test output.
- Redacted local migration dry-run log.
- Backend and frontend build logs.
- `docs/unified-activities.md`.

## 12. loop_iterations override

`3` iterations. The default is required because this task changes a shared domain and needs separate backend, record-generation, and interface verification.