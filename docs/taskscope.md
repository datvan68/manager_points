Task: activity-attendance-count-and-completion-description | bug_fix | Risk: MEDIUM
Objective: Update the visible attendance count immediately after a successful check-in and generate activity-completion records whose descriptions state the completed session count and the attendance dates used for that completion.
Scope:
- frontend/src/components/activities/ActivityScheduleTimeline.tsx :: active schedule attendance summary :: for the schedule matched to the active realtime attendance session, render `session.checkin_count` as the authoritative `Đã điểm danh` count while retaining `attendance_records.length` as the fallback for schedules without an active matching session.
- frontend/src/components/activities/ActivityScheduleTimeline.test.tsx :: realtime count regression coverage :: verify that a matching session count replaces the stale timeline count immediately and that unmatched or inactive schedule cards retain their persisted attendance totals.
- backend/src/club-attendance/activity-completion.service.ts :: completion-record description generation :: load qualifying approved `present`/`late` attendances in deterministic chronological order, partition them by `minimum_attendance`, and write each earned record as `Hoàn thành {minimum_attendance} buổi của hoạt động {activityName}, các ngày {dd/MM/yyyy list}` using the dates belonging to that completion unit.
- backend/test/activities.e2e-spec.ts :: completion award assertions :: verify the generated academic record contains the required session count, activity name, and chronologically ordered attendance dates without changing award idempotency.
- docs/taskscope.md :: implementation contract :: record the scoped changes, verification, and acceptance criteria.
Out: Realtime refresh of the expanded attendance roster; historical backfill of descriptions already stored in MongoDB; changes to attendance approval rules, completion thresholds, earned quantities, record titles, or unrelated activity UI and behavior.
Context: The timeline card currently renders only `schedule.attendance_records.length`, which is a snapshot loaded with the page, although `useAttendanceSession` already updates the matched active session's `checkin_count` through the authenticated `attendance.checkin_created` SSE event. Completion evaluation currently counts qualifying attendance documents but does not load their dates, and its descriptions use generic text. Dates must be derived only from the approved `present`/`late` records that form each earned unit, sorted by `check_in_time`, then `recorded_at`, then `_id`, and formatted in the `Asia/Ho_Chi_Minh` calendar day.
Steps:
1. Make the active matched schedule card consume the existing realtime session count and add component regressions for matched and fallback schedules.
2. Replace count-only completion evaluation with a deterministic qualifying-attendance query, derive the records used by each completion unit, and generate the requested Vietnamese description for both the first and subsequent earned units.
3. Extend the activity completion end-to-end test with fixed attendance dates and exact description assertions while preserving the existing no-duplicate checks.
4. Run targeted frontend/backend tests, broader type/build checks, and final diff/status inspection.
Verify:
- frontend :: npm test -- src/components/activities/ActivityScheduleTimeline.test.tsx => the active matched card updates `Đã điểm danh` from realtime `checkin_count`, and persisted-count fallbacks pass.
- frontend :: npm run typecheck => TypeScript reports no errors.
- backend :: npm run test:e2e -- --runInBand test/activities.e2e-spec.ts => completion creation, exact description content/date order, and idempotency assertions pass.
- backend :: npm run build => NestJS production build succeeds.
- repository root :: manual check with an activity manager page and a student account: complete a QR or proximity check-in without refreshing the manager page => the matching card's `Đã điểm danh` count increments promptly.
- repository root :: git diff --check && git status --short => no whitespace errors or unintended files.
Done:
- A successful check-in increments the active matched schedule's `Đã điểm danh` value through the existing realtime session event without a page refresh.
- Every newly generated activity-completion academic record states the configured number of completed sessions, the activity name, and the chronological `dd/MM/yyyy` attendance dates used for that earned unit.
- Multiple completion units use their own non-overlapping attendance-date groups, and existing completion-award/idempotency behavior remains intact.
Gate/Stop: Stop if qualifying attendance records lack every usable date field (`check_in_time` and `recorded_at`), because inventing a completion date would make the academic record inaccurate; otherwise no approval gate is required.
Rollback: Revert the scoped frontend, backend, test, and taskscope changes together. No database migration or historical record rewrite is included.
Dependencies: The immediate count relies on the existing authenticated attendance SSE stream and its `attendance.checkin_created.checkinCount` payload. Backend e2e verification requires the repository's configured MongoDB test environment.
Artifacts: Final scoped diff, targeted test/typecheck/build output, and the two-account manual verification result when the runtime environment is available.
