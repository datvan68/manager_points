Task: activities-index-and-realtime-create | bug_fix | Risk: MEDIUM
Objective: Remove the stale completion-rule index that causes activity creation workflows to fail and make a newly created activity appear on every other authorized account's open `/activities` page without a manual refresh.
Scope:
- backend/scripts/repair-activity-completion-rule-index.ts :: idempotent database repair (new) :: inspect legacy `club_id` data/indexes, refuse unsafe conflicts, rename valid legacy fields when necessary, drop `club_id_1_semester_id_1`, and create/verify the unique `{ activity_id: 1, semester_id: 1 }` index with dry-run as the default and an explicit `--execute` mode.
- backend/scripts/migrate-unified-activities.ts :: unified-activity forward migration :: include `activity_completion_rules` field conversion and index rebuilding so a fresh migration cannot retain the legacy unique index.
- backend/package.json :: migration commands :: expose repository-native dry-run and execute commands for the completion-rule index repair.
- backend/src/activities/activities-realtime.service.ts :: authenticated activity event stream (new) :: provide an SSE stream with connection/heartbeat events and a minimal `activity.created` invalidation event, cleaning listeners and timers on disconnect.
- backend/src/activities/activities.module.ts :: realtime provider registration :: register the activity realtime service in the existing module.
- backend/src/activities/activities.controller.ts :: activity realtime endpoint :: expose the SSE stream under `/activities/realtime` with `ACTIVITY_READ` authorization.
- backend/src/activities/activities.service.ts :: post-create notification :: emit `activity.created` only after `activity.save()` succeeds; do not publish failed or uncommitted creates.
- backend/src/activities/activities.service.spec.ts :: creation regression tests :: verify successful creates publish exactly once and failed saves publish nothing.
- backend/src/activities/activities-realtime.service.spec.ts :: stream lifecycle tests (new) :: cover initial connection, create events, heartbeat behavior, and listener/timer cleanup.
- frontend/src/hooks/useActivitiesRealtime.ts :: resilient authenticated SSE client (new) :: connect with the current access token, parse activity events, reconnect with bounded exponential backoff, and abort/release timers on unmount.
- frontend/src/app/(dashboard)/activities/page.tsx :: cross-account list synchronization :: subscribe while the page is mounted and refetch through `activityApi.getAll()` on `activity.created`, preserving the existing account-specific filtering and avoiding a full-page reload.
- frontend/src/app/(dashboard)/activities/page.test.tsx :: page synchronization tests :: verify a create event triggers one authorized list refresh, updates visible activities, and does not leave subscriptions after unmount.
- frontend/src/hooks/useActivitiesRealtime.test.ts :: SSE client tests (new) :: cover authenticated connection, event parsing, retry, abort, and cleanup.
- docs/taskscope.md :: implementation contract :: record diagnosis, safety gate, verification, and acceptance criteria.
Out: Realtime synchronization for activity edits, deletes, favorites, membership, schedules, or completion-rule changes; WebSocket infrastructure; distributed pub/sub across multiple backend replicas; unrelated database collections, pages, and behavior.
Context: The Mongoose schema already declares `{ activity_id: 1, semester_id: 1 }`, but MongoDB still reports the legacy unique index `club_id_1_semester_id_1`. Because new documents omit `club_id`, MongoDB indexes it as `null`, so a second rule in the same semester collides on `{ club_id: null, semester_id }`. The current unified migration neither converts nor rebuilds `activity_completion_rules`. The activities page fetches only on mount/manual actions and has no realtime subscription. SSE matches existing authenticated streaming patterns in this repository; clients receive only an invalidation signal and refetch the permission-filtered REST endpoint, preventing activity data leakage through the stream.
Steps:
1. Add and dry-run an idempotent repair that detects conflicting legacy/current completion-rule data before changing fields or indexes, then update the main forward migration to produce the correct rule index on future migrations.
2. Add a permission-protected activity SSE stream and publish a create invalidation only after persistence succeeds.
3. Subscribe from `/activities`, refetch the existing authorized list on create events, and preserve the current student/admin/teacher visibility logic.
4. Add backend/frontend regressions, run targeted checks and builds, review the final diff, then execute the database repair only after the gate is approved.
Verify:
- backend :: npm run migration:activity-completion-rule-index:dry-run => reports collection documents, legacy fields, conflicting records, and current/required indexes without mutating MongoDB.
- backend :: npm test -- activities/activities.service.spec.ts activities/activities-realtime.service.spec.ts --runInBand => create publication and SSE lifecycle tests pass.
- backend :: npm run build => NestJS production build succeeds.
- frontend :: npm test -- src/hooks/useActivitiesRealtime.test.ts "src/app/(dashboard)/activities/page.test.tsx" => authenticated stream and cross-account refresh regressions pass.
- frontend :: npm run typecheck => TypeScript reports no errors.
- approved target environment :: npm run migration:activity-completion-rule-index:execute, followed by the dry-run command => the legacy index/field count is zero, the required unique index exists, and no conflicting completion rules are reported.
- repository root :: manual two-account check: keep `/activities` open as account B, create an activity as authorized account A, and do not refresh B => B displays the new activity promptly when its permissions/status allow it; an unauthorized account still cannot obtain it through `GET /activities`.
- repository root :: git diff --check && git status --short => no whitespace errors or unintended files.
Done:
- Creating or configuring completion rules for two different activities in the same semester no longer raises `E11000` from `club_id_1_semester_id_1`, and uniqueness remains enforced per activity and semester.
- A successfully created activity triggers one realtime invalidation and becomes visible on other connected, authorized `/activities` pages without manual refresh.
- Failed creates emit no event, disconnected clients release resources, and all existing role-based list filtering remains authoritative.
Gate/Stop: Before `--execute` against any shared, staging, or production database, require explicit operator approval, a current backup/recovery point, the dry-run artifact, and confirmation that no conflicting `{ activity_id, semester_id }` records exist. Stop if conflicts or mixed `club_id`/`activity_id` values cannot be resolved without a data-owner decision.
Rollback: Revert the scoped code together. For an executed database repair, restore the pre-change database backup if rollback is required; do not recreate the defective legacy unique index on live activity-shaped documents.
Dependencies: Frontend and backend realtime changes must deploy together. The in-process SSE broadcaster assumes one NestJS application instance; multi-replica deployment requires a shared event bus and is outside this scope.
Artifacts: Final scoped diff, migration dry-run and approved execute logs, targeted test/build output, and two-account manual verification notes.
