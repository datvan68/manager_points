# 1. Task ID + Pipeline

- Task ID: `ACTIVITY-DETAIL-20260717-01`
- Pipeline: `feature_development`

# 2. Risk Level

Risk level: `medium` — the planned change affects authenticated activity-detail navigation and server-side authorization for attendance-session reads and check-ins. It is limited to the development repository, uses existing application permissions and membership data, does not modify production, infrastructure, secrets, or persisted schemas, and is reversible through the source diff; however, an authorization mistake could expose attendance data or block legitimate check-ins.

# 3. Objective

Simplify Activity Detail by removing the duplicate administrator-only full-information card and presenting general activity information and the activity schedule in one view. Allow unregistered accounts to read the combined detail and schedule while preventing them from viewing attendance data or performing attendance check-ins through either the UI or direct attendance-session API calls.

# 4. Scope

- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` — `ActivityDetailPage`, `activeTab`, `handleTabChange`, tab navigation, the `activeTab === 'info'` panel, and attendance visibility: remove the `Thông tin đầy đủ dành cho quản trị viên` card; remove the separate schedule tab; render the existing `ActivityScheduleTimeline` below the existing general-information content; map the legacy `tab=schedule` query value to the combined information view; keep schedules readable for unregistered students; and keep attendance navigation, attendance content, own-attendance details, roster details, and check-in controls unavailable unless the current student has an active `ActivityMember` membership or the existing staff authorization applies. New identifiers and comments must be English. Existing Vietnamese labels may be moved or removed as specified, but no new Vietnamese UI wording is required.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx` — `ActivityDetailPage` regression coverage: replace the administrator full-metadata-card expectation; verify the duplicate card is absent; verify general information and schedule entries render together without selecting a schedule tab; verify `tab=schedule` remains compatible by showing the combined view; and verify a student with `none`, `pending`, `rejected`, `inactive`, or `left` membership can read the combined detail and schedule but cannot see attendance navigation, attendance status/roster data, or check-in controls, including with `tab=attendance`. Test names and technical fixtures must be English; assertions may reference existing Vietnamese UI text without changing that localized content.
- `backend/src/attendance-sessions/attendance-sessions.controller.ts` — `getActiveSession`, `getCheckins`, `checkinQr`, and `checkinProximity`: pass the authenticated requester's verified `userId` and role context from `req.user` to the service instead of relying on absent `studentId` or `_id` JWT fields; preserve the existing `JwtAuthGuard` and permission guards; and return authorization failures from the service without exposing attendance data.
- `backend/src/attendance-sessions/attendance-sessions.service.ts` — `getActiveSession`, `getCheckins`, `checkinQr`, `checkinProximity`, and `validateMembership`: resolve the requester against `ActivityMember.user_id`/`student_id`; require `status: 'active'` for student attendance-session visibility and check-in across both `club` and non-club activity contexts; return the resolved student identifier for check-in persistence; preserve the existing authorized staff read path; and reject unregistered or non-active students before returning session/check-in data or creating an `AttendanceCheckin` record. Newly written errors, identifiers, comments, and tests must be English unless an existing localized API message is reused unchanged.
- `backend/src/attendance-sessions/attendance-sessions.controller.spec.ts` — create focused controller tests for propagation of `req.user.userId` and `req.user.roleCode` to the four in-Scope service calls and for the existing guard boundary. All new content must be English.
- `backend/src/attendance-sessions/attendance-sessions.service.spec.ts` — create focused service tests proving that active members can read and check in, all non-active or missing memberships are rejected before attendance data is returned or written, both `club` and `activity` contexts use the unified `activity_members` collection, and authorized staff retain attendance visibility. All new content must be English.
- `docs/taskscope.md` — maintain this implementation boundary, evidence, acceptance criteria, verification procedure, and safety gates in English.

# 5. Out of Scope

- Activity list pages, `frontend/src/components/activities/ActivityDetailWorkspace.tsx`, activity create/edit forms, activity cards, member-management behavior, completion-rule behavior, logo/cover behavior, and unrelated dashboard routes.
- Changes to `frontend/src/components/activities/ActivityScheduleTimeline.tsx`, its visual design, schedule registration/cancellation rules, schedule ordering, or schedule API response shape unless verification proves a Scope expansion is required and the user approves an updated taskscope.
- Changes to `frontend/src/hooks/useAttendanceSession.ts` or `frontend/src/api/activity-api.ts`; the existing `enabled` option and attendance API methods are sufficient when the page does not mount the attendance panel for unauthorized viewers and the backend enforces access.
- Database schemas, migrations, indexes, seed data, membership statuses, role definitions, permission registry entries, authentication token shape, and changes to the existing `activity_members`, attendance-session, or attendance-check-in data models.
- Broad attendance redesign, attendance history UI, active-member roster privacy changes, advisor/administrator permission redesign, or support for non-activity attendance contexts beyond preserving their current behavior.
- Deployment, release, merge, publish, production actions, dependency changes, generated artifacts, repository-wide formatting, unrelated refactoring, translation, localization-resource edits, or encoding and line-ending conversion.
- Existing Vietnamese localized content outside the explicitly removed administrator card and separate schedule-tab label.

# 6. Context & Dependencies

- The active route is `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`; it owns the tab state and renders `ActivityScheduleTimeline` and the local `ActivityAttendanceTab`.
- The current information panel renders both `Thông tin đầy đủ dành cho quản trị viên` and `Chi tiết hoạt động`, duplicating values such as manager/capacity, dates, classroom, and self-registration. The requested result removes the complete administrator card rather than merging its unique fields into another card.
- The current route has separate `info` and `schedule` states. `ActivityScheduleTimeline` already accepts `canViewAttendanceRoster`, `canViewOwnAttendance`, `isStudent`, and `onOpenAttendance`, so the timeline can remain visible while attendance-specific controls stay membership-gated.
- `memberStatus` is derived from the loaded `ActivityMember` list and currently defaults to `none`. The Attendance tab and panel are already conditionally rendered for `isAdminOrAdvisor || memberStatus === 'active'`; regression tests must preserve this boundary when the schedule is moved into the information view and when attendance is requested through the query string.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx` already covers schedule navigation, active-student own-attendance visibility, staff roster visibility, invalid-user attendance-button suppression, and the administrator full-information card. These tests must be updated rather than duplicated with conflicting expectations.
- `backend/src/auth/strategies/jwt.strategy.ts` verifies that `req.user` contains `userId` and `roleCode`; it does not provide `studentId` or `_id`. The in-Scope controller currently uses `req.user.studentId || req.user._id` for check-ins, so requester propagation must be corrected.
- `backend/src/activities/schemas/activity-member.schema.ts` stores both `user_id` and `student_id` plus the statuses `pending`, `active`, `inactive`, `rejected`, and `left`. No schema or migration is needed.
- `AttendanceSessionsService.validateMembership` currently checks membership only when `context_type === 'club'`; non-club Activity Detail uses `context_type: 'activity'`. `getActiveSession` and `getCheckins` currently perform no membership authorization, so UI-only hiding would be bypassable.
- Runtime and commands verified from package manifests: the frontend uses Next.js 16.1.6, React 19.2.4, TypeScript 5.9.3, Vitest 3, `npm test`, and `npm run typecheck`; the backend uses NestJS 11, TypeScript 5.7.3, Jest 30, `npm test`, and `npm run build`.
- Environment: local development repository on Windows with PowerShell. No external service, credential, production environment, or database mutation is required for implementation verification.
- Language requirements: all new technical content is English. Existing Vietnamese UI strings and API messages remain localized data and must not be translated. No new Vietnamese label is required; tests may reference existing labels solely to verify current UI behavior.
- Preserve existing UTF-8 encoding, BOM state, and line endings. Terminal rendering issues must not be treated as file corruption.

# 7. Steps

## PLAN

- Reconfirm the current Activity Detail tab states, query-string behavior, duplicate information blocks, schedule props, membership derivation, attendance hook mount point, JWT requester shape, attendance service membership checks, and existing related tests.
- Confirm the exact Scope and Out of Scope paths, medium risk, server-side authorization boundary, safety gates, and repository-native verification commands.
- Confirm all planned technical content is English and that existing Vietnamese localized strings will only be moved, removed, reused in assertions, or preserved unchanged.
- Inspect the working tree before implementation and stop for direction if another change overlaps an in-Scope implementation or test file.

## EXECUTE

- In `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`, remove the administrator-only full-information card and any imports or helper state made unused solely by that removal.
- In the same page, remove `schedule` as a user-selectable tab, place the existing schedule timeline directly after general information, preserve its existing classroom and attendance-policy props, and normalize the legacy `tab=schedule` query to `info` without a blank view.
- Keep the combined detail and schedule visible to unregistered students while ensuring the attendance panel is not mounted, no attendance-session polling starts, and attendance-specific schedule controls remain disabled unless `memberStatus === 'active'` or the existing staff path applies.
- In `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`, update the affected existing expectations and add focused English-named cases for the combined layout, legacy schedule query, duplicate-card removal, and every non-active membership state, including a direct attendance query attempt.
- In `backend/src/attendance-sessions/attendance-sessions.controller.ts`, pass `req.user.userId` and `req.user.roleCode` into the in-Scope read and check-in service calls while retaining the existing authentication and permission guards.
- In `backend/src/attendance-sessions/attendance-sessions.service.ts`, make membership resolution apply to both unified activity context names, require an active membership for student reads and check-ins, resolve the persisted student identifier from the membership record, permit the existing authorized staff read path, and perform authorization before returning attendance data or creating a check-in.
- Create the two co-located attendance-session spec files named in Scope with mocked Mongoose models and focused authorization/requester-propagation cases. Do not require a live database.
- Write all new identifiers, comments, test names, documentation, and generated review notes in English. Preserve existing Vietnamese localized content without translation or normalization.

## VERIFY

- Run the targeted frontend Activity Detail test, targeted backend attendance-session tests, frontend type check, and backend build listed below; record exit status and relevant output.
- Inspect test assertions to confirm general details and schedules render together, no duplicate administrator card or schedule tab remains, legacy schedule links remain usable, and non-active students cannot view or execute attendance through UI or API paths.
- Inspect the final diff for only in-Scope files, no unrelated behavior, no permission broadening, and no accidental translation, encoding-only, or line-ending-only changes.
- Confirm all new technical content is English, existing Vietnamese localized content outside the specified removals is unchanged, and no `U+FFFD` replacement character was introduced.

## REFINE

- If a verification step fails, identify the exact failed acceptance criterion and apply the smallest correction in the affected in-Scope file.
- Re-run the directly affected test or build command first, then the complete verification set after it passes.
- Stop immediately on success, Scope expansion, increased risk, authorization ambiguity, an applicable Human Gate, an encoding ambiguity, or exhaustion of the configured loop iterations.

# 8. Acceptance Criteria

1. Activity Detail no longer renders the `Thông tin đầy đủ dành cho quản trị viên` section for any role, while the existing `Chi tiết hoạt động` information remains available.
2. Activity Detail exposes no separate `Lịch sinh hoạt` tab; the schedule count and all schedule entries render in the same view as general information without an additional click.
3. Opening a legacy Activity Detail URL with `tab=schedule` displays the combined information-and-schedule view and does not produce an empty panel or unauthorized attendance content.
4. An unregistered student and a student whose membership is `pending`, `rejected`, `inactive`, or `left` can read the same general activity details and schedule entries allowed by the existing schedule API.
5. Those non-active students cannot see the Attendance tab, session status, roster information, own-attendance state, QR scanner, proximity check-in, attendance-opening control, or any other check-in action; requesting `tab=attendance` does not mount the attendance panel or call attendance-session APIs.
6. Active student members retain the existing Attendance tab and check-in capabilities, and authorized administrators/advisors retain the existing attendance management and roster capabilities.
7. Direct calls by a missing or non-active activity member to read the active attendance session, read its check-ins, check in by QR, or check in by proximity are rejected before attendance data is returned or an `AttendanceCheckin` is written.
8. Active membership authorization applies consistently to both `club` and `activity` attendance-session contexts using the unified `activity_members` collection, and the created check-in uses the membership's resolved `student_id`.
9. The controller uses the verified JWT fields `userId` and `roleCode`; no in-Scope path depends on nonexistent `req.user.studentId` or `req.user._id` fields.
10. Targeted frontend and backend tests pass, frontend type checking passes, and the backend builds successfully.
11. Only files listed in Scope are modified or created; no schema, migration, permission-registry, dependency, unrelated UI, or infrastructure changes are present.
12. All newly written technical content is English. Existing Vietnamese localized content remains unchanged except for the explicitly removed administrator card and separate schedule-tab label, and no unintended translation occurs.
13. Existing encoding, BOM state, and line endings are preserved; no `U+FFFD`, mojibake rewrite, encoding-only diff, or line-ending-only diff is introduced.

# 9. Verification Commands

`D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx" -> 0; the targeted Activity Detail Vitest suite passes`

`D:\PROJECT\manager_points\backend :: npm test -- attendance-sessions.controller.spec.ts attendance-sessions.service.spec.ts --runInBand -> 0; targeted Jest authorization and requester-propagation tests pass`

`D:\PROJECT\manager_points\frontend :: npm run typecheck -> 0; TypeScript reports no errors`

`D:\PROJECT\manager_points\backend :: npm run build -> 0; NestJS compiles successfully`

`D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported`

`D:\PROJECT\manager_points :: git diff -- docs/taskscope.md "frontend/src/app/(dashboard)/activities/[activityId]/page.tsx" "frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx" backend/src/attendance-sessions/attendance-sessions.controller.ts backend/src/attendance-sessions/attendance-sessions.service.ts backend/src/attendance-sessions/attendance-sessions.controller.spec.ts backend/src/attendance-sessions/attendance-sessions.service.spec.ts -> 0; manual inspection confirms only in-Scope changes, English technical content, preserved localized content, and no unintended encoding or line-ending change`

# 10. Safety Gates

- Authorization or permission expansion: pause before changing role definitions, permission registry entries, authentication token contents, staff authorization semantics, or access for any non-activity context; require explicit user approval and an updated taskscope.
- Scope expansion: pause before modifying any path not listed in Scope, including the shared schedule component, attendance hook, API client, schema, migration, or localization resource; require explicit user approval and an updated taskscope.
- Production, deployment, release, merge, or publish: pause before any such action and require explicit user approval. All are Out of Scope.
- Database, infrastructure, secrets, authentication, or irreversible actions: pause before schema/data migration, live data modification, infrastructure change, credential operation, destructive action, or paid/external side effect and require the applicable explicit approval. None is authorized by this taskscope.
- Bulk translation, localization change, encoding conversion, or line-ending normalization: pause before the action and require explicit user approval, exact target paths, review evidence, and a rollback plan.
- Increased risk: pause if implementation reveals that active membership cannot be resolved safely from verified JWT and `ActivityMember` data, or if satisfying the objective requires broader attendance behavior changes; require user direction before continuing.

# 11. Artifacts to Review

None — no Human Gate triggered.

# 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)
