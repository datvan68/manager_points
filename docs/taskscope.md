Task: realtime-member-attendance-button-state | bug_fix | Risk: MEDIUM
Objective: Make each member timeline attendance button reflect its schedule's live session and completed check-in state, with unavailable and completed actions disabled.
Scope:
- backend/src/attendance-sessions/attendance-sessions.service.ts :: public realtime session payload :: include the session `schedule_id` in opened and closed events so clients can associate the live session with the correct timeline item.
- backend/src/attendance-sessions/attendance-sessions.service.spec.ts :: session event regression coverage :: assert that emitted public session data retains the linked schedule ID when a session opens or closes.
- frontend/src/components/activities/ActivityScheduleTimeline.tsx :: member attendance action state :: for today's schedule render disabled `Chưa mở` when no active session is linked, enabled `Điểm danh` only while its session is active and the member has not checked in, and disabled `Đã điểm danh` after a present-or-late record or successful current-session check-in.
- frontend/src/components/activities/ActivityScheduleTimeline.test.tsx :: timeline button regressions :: cover unopened, realtime-opened, successful, schedule-mismatch, and non-member/staff visibility states including disabled behavior and click suppression.
- frontend/src/app/(dashboard)/activities/[activityId]/page.tsx :: live attendance state wiring :: pass the active session's schedule identity and current member completion state into every timeline rendering, relying on the existing SSE hook for session-open events and local/SSE check-in state for immediate completion updates.
- frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx :: activity member flow regressions :: verify an incoming opened-session state changes the matching button from `Chưa mở` to `Điểm danh`, successful QR or proximity check-in changes it to disabled `Đã điểm danh` without a page reload, and other schedule buttons remain unavailable.
- docs/taskscope.md :: execution contract :: record the inspected cause, bounded implementation, verification, and acceptance criteria.
Out: Attendance tab management UI, QR scanner and proximity modal internals, session authorization and opening rules, attendance record persistence, non-today schedule action visibility, club timeline behavior, dependency changes, and unrelated files and behavior.
Context: The timeline currently renders an enabled `Điểm danh` action for every today item solely from `is_today`; it does not receive the active attendance session or completed check-in state. The activity page already maintains session and check-in state through `useAttendanceSession`, whose SSE handler updates immediately on `attendance.session_opened` and `attendance.checkin_created`, but the backend public session event omits `schedule_id`, preventing reliable per-schedule matching. The REST session type already supports `schedule_id`.
Steps:
1. Preserve `schedule_id` in public attendance session events and lock the contract with focused backend assertions.
2. Define the timeline button state from the matching active schedule plus the member's present-or-late or successful check-in state, disabling unavailable and completed states.
3. Wire the activity page's existing realtime/local attendance state into both member timeline render paths without navigation or reload requirements.
4. Add focused frontend regressions, then review only the scoped diff for unintended behavior, localization, encoding, and line-ending changes.
Verify:
- backend :: npm test -- --runInBand src/attendance-sessions/attendance-sessions.service.spec.ts => targeted Jest suite passes and session events expose `schedule_id`.
- frontend :: npm test -- frontend/src/components/activities/ActivityScheduleTimeline.test.tsx "frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx" => targeted Vitest suites pass for all three button states and live transitions.
- frontend :: npm run typecheck => TypeScript completes without errors.
- repository root :: git diff --check -- backend/src/attendance-sessions/attendance-sessions.service.ts backend/src/attendance-sessions/attendance-sessions.service.spec.ts frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx "frontend/src/app/(dashboard)/activities/[activityId]/page.tsx" "frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx" docs/taskscope.md => no whitespace errors in scoped files.
- repository root :: git status --short and scoped diff inspection => no unrelated or pre-existing user changes are overwritten, and localized files preserve their existing UTF-8 content and line-ending conventions.
Done:
- For an eligible member viewing today's schedule with no matching active session, the action reads `Chưa mở`, is disabled, and cannot invoke attendance.
- When a manager opens a session, connected members see only the matching schedule action change to enabled `Điểm danh` through the existing realtime stream without reloading the page.
- After the current member completes QR or proximity check-in, the matching action immediately reads `Đã điểm danh`, is disabled, and remains completed when timeline attendance data refreshes.
- Targeted backend and frontend tests, frontend type-check, and scoped diff checks pass.
Gate/Stop: Stop if the live attendance session cannot be associated with one schedule, or if satisfying the behavior requires changing session persistence, authorization, or non-activity attendance contexts outside this scope.
Rollback: Revert the public session payload field and timeline state wiring; the prior always-enabled today action behavior is restored without persisted-data changes.
Dependencies: Existing schedule-linked attendance sessions, authenticated active membership, SSE attendance stream, and successful QR or proximity check-in state. No new package, schema, index, or migration is required.
Artifacts: Final scoped diff plus targeted Jest, Vitest, and TypeScript verification output.
