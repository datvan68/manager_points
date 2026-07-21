Task: activity-member-progress-management | bug_fix | Risk: MEDIUM
Objective: Keep activity-completion academic records synchronized with rule changes, expose each member's current participation count with an admin-only reset, and remove the recent-check-in list from the Attendance tab.
Scope:
- backend/src/activities/schemas/activity-member.schema.ts :: completion progress state :: store a reset timestamp and monotonically increasing progress version per activity membership so reset starts a new count without deleting attendance audit data.
- backend/src/club-attendance/club-attendance.module.ts :: completion-service models :: register the activity-member model required to resolve membership progress and reset state.
- backend/src/club-attendance/activity-completion.service.ts :: rule reconciliation, member counts, and reset :: count only approved `present`/`late` attendances after the member's latest reset; when `criterion_ids`, `minimum_attendance`, or status changes, immediately reconcile affected members' active completion awards/academic records to the saved rule; provide an admin reset that increments the progress version, sets the reset timestamp, deactivates currently earned completion records, removes their award links, and returns a zero current count while preserving raw attendance.
- backend/src/club-attendance/activity-completion.controller.ts :: progress read/reset endpoints :: expose member participation counts for an activity/semester and an admin-only reset endpoint; validate that the member belongs to the requested activity and semester and reject non-admin reset attempts.
- backend/test/activities.e2e-spec.ts :: completion lifecycle regressions :: verify current counts, criterion replacement, threshold/status reconciliation, reset authorization, zero-after-reset behavior, preserved attendance history, and earning new versioned records after later qualifying attendance.
- frontend/src/api/activity-api.ts :: member progress contract :: add the participation-count field and typed APIs for loading member counts and resetting one member's completion progress.
- frontend/src/app/(dashboard)/activities/[activityId]/page.tsx :: member progress orchestration and proximity caller :: load counts for the activity's semester, pass them to the member table, show/reset progress only for administrators, confirm reset, refresh members/rule-derived state after success, and stop supplying recent-check-in rows to the proximity panel.
- frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx :: activity detail regressions :: verify the page loads and refreshes member progress, wires admin reset without exposing it to non-admin viewers, and keeps the Attendance tab free of recent-check-in details.
- frontend/src/components/activities/ActivityMemberTable.tsx :: Members tab columns/actions :: add `Số lượt tham gia`, render each member's current qualifying count, and add a Reset action under `Thao tác` only when the viewer is an administrator and the member is eligible.
- frontend/src/components/activities/ActivityMemberTable.test.tsx :: member table regressions :: cover count rendering, admin-only Reset visibility, confirmation, pending state, callback success, and failure handling.
- frontend/src/components/attendance/ProximityPanel.tsx :: Attendance tab proximity content :: remove the `Gần đây` heading and all recent-check-in values while retaining the live `Đã điểm danh` total and proximity controls.
- frontend/src/components/attendance/ProximityPanel.test.tsx :: hidden recent-check-in regression :: verify the panel never renders `Gần đây`, student details, codes, or distances and still renders the aggregate count.
- frontend/src/components/activities/ActivityDetailWorkspace.tsx :: proximity-panel caller :: stop supplying recent check-in rows after that presentation contract is removed.
- docs/taskscope.md :: implementation contract :: record the agreed scope, verification, and acceptance criteria.
Out: Deleting or rewriting raw attendance/check-in audit documents; bulk reset; historical migration outside records produced by the edited activity rule; changes to membership roles, attendance approval rules, or unrelated activity UI and behavior.
Context: `Số lượt tham gia` means the current activity/semester progress used by the completion rule: approved `present`/`late` attendance since the membership's latest reset. Reset is intentionally audit-preserving. Rule reconciliation is set-based: records for removed criteria are deactivated, records for newly selected criteria are generated from currently earned units, retained criteria are recomputed for the new threshold/status, and idempotency keys include the membership progress version so post-reset awards cannot collide with prior records.
Steps:
1. Add versioned reset state to memberships and centralize the qualifying-attendance query used by counts and completion evaluation.
2. Reconcile all affected member awards/academic records after a rule update, including removed/added criteria, changed thresholds, and inactive rules.
3. Add admin-protected count/reset endpoints and regression coverage for authorization, audit preservation, and post-reset re-earning.
4. Wire participation counts and confirmed admin reset into the Members tab with component/page coverage.
5. Remove the recent-check-in section from every proximity-panel caller and cover the remaining aggregate display.
6. Run targeted backend/frontend tests, type/build checks, and final diff/status inspection.
Verify:
- backend :: npm run test:e2e -- --runInBand test/activities.e2e-spec.ts => rule edits update existing records, admins can reset, non-admins cannot, raw attendance remains, and new progress can earn records again.
- backend :: npm run build => NestJS production build succeeds.
- frontend :: npm test -- src/components/activities/ActivityMemberTable.test.tsx src/components/attendance/ProximityPanel.test.tsx src/app/\(dashboard\)/activities/\[activityId\]/page.test.tsx => member count/reset and hidden recent-check-in regressions pass.
- frontend :: npm run typecheck => TypeScript reports no errors.
- repository root :: git diff --check && git status --short => no whitespace errors or unintended files.
Done:
- Saving a completion rule with different criteria immediately leaves each affected member with active completion academic records only under the new criteria and with quantities/descriptions matching the current rule and progress.
- The Members tab shows `Số lượt tham gia` for every member; only administrators see and can confirm Reset, after which that member shows 0 without raw attendance deletion and subsequent qualifying attendance starts a new progress version.
- The Attendance tab no longer displays `Gần đây` or any associated student, code, time/distance values, while `Đã điểm danh` remains visible.
Gate/Stop: Stop if the existing academic-record idempotency/index contract cannot support progress-version keys or if rule reconciliation cannot identify records exclusively owned by the target activity/semester; changing or deleting broader academic data requires explicit approval.
Rollback: Revert the scoped code/tests and remove the optional membership reset fields; raw attendance remains recoverable because reset never deletes it, while any new versioned academic records must be deactivated before reverting if the feature has already been used.
Dependencies: Existing MongoDB activity attendance, completion award, academic record, and membership collections; authenticated realtime attendance remains unchanged.
Artifacts: Scoped diff plus targeted test, typecheck, build, and final status output.
