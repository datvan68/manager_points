# 1. Task ID + Pipeline

- `Task ID: ACTIVITIES-WEEK-SCHEDULE-20260716-01`
- `Pipeline: bug_fix`

# 2. Risk Level

`Risk level: low` — the intended work is limited to development frontend schedule loading, normalization, display logic, and focused regression tests. It does not require elevated permissions, data mutation, deployment, secrets, or external communication; source changes are reversible with Git. Any required backend contract or authorization change increases Scope and must pause for approval.

# 3. Objective

Ensure each activity card on `/activities` displays its scheduled or ongoing sessions for the current week instead of incorrectly showing the existing localized fallback `Chưa xếp lịch`. The fix must distinguish a genuine empty week from failed loading, incompatible response envelopes, identifier-shape mismatches, authorization failures, and date-boundary errors.

# 4. Scope

- `frontend/src/components/activities/ActivityCard.tsx` — inspect and adjust the `scheduleSummary` initialization and schedule-loading effect so an absent or empty supplied summary triggers a verified API request, supported response envelopes are normalized once, loading completes deterministically, and valid current-week rows reach the card. New technical content must be English; existing Vietnamese UI labels must be preserved.
- `frontend/src/components/activities/utils/schedule-helper.ts` — inspect and adjust `getClubScheduleSummary` and `getActivityScheduleSummary` only where required to normalize populated/string/extended-JSON activity identifiers, accepted active statuses, current-week boundaries, and valid timestamps. New technical content must be English.
- `frontend/src/components/activities/ActivityCard.test.tsx` — add or correct focused regression coverage for an empty `activity.schedule_summary`, direct and wrapped list responses, the authenticated timeline fallback when appropriate, loading completion, and the localized empty-state behavior. Test names and new technical content must be English; Vietnamese assertions are an approved functional exception.
- `frontend/src/components/activities/utils/schedule-helper.test.ts` — add or correct deterministic tests for identifier shapes, status filtering, current-week boundaries, timezone-sensitive timestamps, invalid dates, and a genuinely empty week. Test names and new technical content must be English.
- `frontend/src/api/activity-api.ts` — change only the schedule-list or activity-timeline response typing/normalization if inspection proves the client contract differs from the backend response consumed by `ActivityCard`. New technical content must be English.

# 5. Out of Scope

- Backend controllers, services, DTOs, schemas, database records, migrations, indexes, and permission policies unless a verified backend defect requires approved Scope expansion.
- Activity creation, editing, deletion, registration, membership labels, member counts, favorites, card design, location display, and activity-detail behavior.
- Changes to the meaning of the existing Vietnamese UI text, translations, localization resources, bulk formatting, dependency upgrades, or unrelated refactoring.
- Deployment, release, merge, publish, production access, database writes, and external service calls.
- Rewriting or discarding unrelated uncommitted user changes, including existing changes in the in-Scope files that are not required for this defect.
- Bulk encoding conversion, BOM conversion, or line-ending normalization.

# 6. Context & Dependencies

- The supplied screenshot shows an activity card for `CLB_01` rendering `Chưa xếp lịch`; the screenshot alone does not prove whether the API returned no schedules or the frontend discarded them.
- `/activities` loads activities with `activityApi.getAll()` and renders them through `ActivityListWorkspace`; each `ActivityCard` is responsible for resolving a missing schedule summary.
- `activityScheduleApi.getAll({ activity_id })` declares an `{ items, total }` response. The backend `ActivitySchedulesService.findAll` filters by `activity_id`, populates that field, and returns a paginated envelope.
- An authenticated `GET /activity-schedules/activity/:activityId/timeline` endpoint also exists and returns `{ viewer_mode, items, timezone }`; it must only be used when its authorization and payload semantics are appropriate for the current viewer.
- The current worktree already contains uncommitted changes in `ActivityCard.tsx`, its tests, and the schedule helper/tests that attempt empty-summary loading, response-envelope normalization, timeline fallback, and Mongo extended-JSON ID support. These changes are evidence to review and verify, not assumed-correct results.
- Schedule display currently accepts `scheduled` and `ongoing` entries and derives a current-week summary before considering future weeks. Verification must use a controlled clock because real calendar time would make tests non-deterministic.
- Frontend scripts verified from `frontend/package.json` are `npm test` (Vitest), `npm run typecheck` (TypeScript), and `npm run build` (Next.js).
- Existing source and tests contain Vietnamese localized text. Preserve UTF-8 content, existing BOM state, and existing line endings; terminal mojibake must not be treated as file corruption.
- Language exception: exact existing Vietnamese UI labels may appear in assertions because their text is functionally significant; all new technical prose, test names, comments, and documentation remain English.

# 7. Steps

## PLAN

- Inspect the applicable repository rules, current diff, activity-list data flow, `ActivityCard` loading effect, schedule API contracts, helper functions, backend response shapes, authorization guards, and existing tests.
- Reproduce the failing branch with a focused component test using the same activity ID and a fixed current-week schedule; record whether failure occurs during request, response extraction, ID/status filtering, date filtering, or rendering.
- Confirm Scope, Out of Scope, low risk, Safety Gates, verified commands, English technical-content requirements, the Vietnamese assertion exception, and encoding/line-ending preservation before editing.
- If the root cause requires a backend or permission-policy change, stop before modification and request Scope/risk approval with evidence.

## EXECUTE

- `frontend/src/components/activities/ActivityCard.tsx` — make the smallest change at `scheduleSummary` initialization and the schedule-loading effect that addresses the reproduced cause; expected result: a valid current-week API item produces a visible summary and loading/error paths cannot silently masquerade as an authoritative empty summary.
- `frontend/src/components/activities/utils/schedule-helper.ts` — change only the verified normalization or week-selection branch; expected result: equivalent activity ID shapes and valid current-week timestamps are handled consistently while cancelled, unrelated, or invalid entries remain excluded.
- `frontend/src/api/activity-api.ts` — only if required by verified response evidence, align the typed schedule response with the actual `handleResponse` output; expected result: `ActivityCard` consumes one explicit contract without unchecked nested-envelope assumptions.
- `frontend/src/components/activities/ActivityCard.test.tsx` and `frontend/src/components/activities/utils/schedule-helper.test.ts` — encode the reproduced failure and boundary cases with a fixed clock; expected result: the regression fails before the corrective logic and passes afterward.
- Preserve all existing localized UI content. Write new technical content in English, with exact Vietnamese UI strings used only for functional assertions.

## VERIFY

- Run the focused component and helper tests, then frontend type checking.
- Run the frontend build if the focused tests and typecheck pass.
- Inspect the final diff and changed-file list to ensure only necessary Scope items changed and unrelated dirty work remains intact.
- Inspect localized strings, UTF-8 content, BOM/line endings, and the diff for `U+FFFD`, mojibake additions, encoding-only changes, or line-ending-only rewrites.
- When a runnable local application and suitable test data are already available, manually verify `/activities` for a card with a current-week schedule and a card with no applicable schedule; do not start or modify external services solely for this check.

## REFINE

- Identify the exact failed Acceptance Criterion and correct only its responsible branch.
- Re-run the affected focused test first, followed by typecheck and the remaining verification commands after it passes.
- Stop on success, a Human Gate, Scope expansion, increased risk, or the iteration limit; do not broaden the fix to unrelated activity-card behavior.

# 8. Acceptance Criteria

1. When `activity.schedule_summary` is missing or an empty array and the schedule API returns a `scheduled` or `ongoing` item for the same activity in the controlled current week, the card displays the expected weekday and time range and does not display `Chưa xếp lịch`.
2. A non-empty valid `activity.schedule_summary` is rendered without an unnecessary duplicate schedule request.
3. Direct arrays and the exact verified API envelope are normalized correctly; unsupported or malformed envelopes do not throw and are covered by an explicit test expectation.
4. String IDs, populated `{ _id }` IDs, and Mongo extended-JSON `{ $oid }` IDs match the same activity; unrelated activity IDs remain excluded.
5. Cancelled or unsupported statuses, invalid timestamps, and entries outside the selected week do not appear as current-week schedule rows.
6. Current-week behavior is deterministic at Monday/Sunday boundaries under a fixed clock and does not depend on the machine's execution date.
7. A genuine empty result finishes loading and displays the existing `Chưa xếp lịch` fallback; a request failure follows the explicitly tested fallback/error behavior and does not leave the card permanently loading.
8. Any timeline fallback uses the verified `{ viewer_mode, items, timezone }` contract and is called only when appropriate; its failure is handled without an unhandled rejection.
9. Focused component/helper tests, frontend typecheck, and frontend build exit with status `0`.
10. The final diff contains only necessary in-Scope changes, preserves unrelated user edits, and introduces no membership-label or other activity-card behavior changes.
11. Newly written technical content is English. Exact Vietnamese UI strings appear only where required by existing product behavior or functional assertions, and no existing localized content is unintentionally translated.
12. UTF-8 localized content remains correct, no `U+FFFD` is introduced, BOM and line endings follow existing file conventions, and no encoding-only or line-ending-only diff is present.

# 9. Verification Commands

`D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/activities/ActivityCard.test.tsx src/components/activities/utils/schedule-helper.test.ts -> 0; all focused schedule-loading and week-summary regression tests pass`

`D:\PROJECT\manager_points\frontend :: npm run typecheck -> 0; TypeScript reports no errors`

`D:\PROJECT\manager_points\frontend :: npm run build -> 0; the Next.js production build completes successfully`

`D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported`

`D:\PROJECT\manager_points :: git status --short -> 0; changed files are reviewed against Scope and pre-existing dirty files are identified`

`D:\PROJECT\manager_points :: git diff -- docs/taskscope.md frontend/src/components/activities/ActivityCard.tsx frontend/src/components/activities/ActivityCard.test.tsx frontend/src/components/activities/utils/schedule-helper.ts frontend/src/components/activities/utils/schedule-helper.test.ts frontend/src/api/activity-api.ts -> 0; the diff matches Scope and contains no unintended localization, encoding, or line-ending changes`

# 10. Safety Gates

- Trigger: evidence shows the defect requires changing a backend controller, service, DTO, schema, permission rule, or API response. Pause: before editing any backend file. Required approval: user approval of the exact added paths/symbols, updated risk, and verification plan.
- Trigger: any database mutation, migration, index operation, or production/staging action becomes necessary. Pause: before the command or file change. Required approval: environment-specific Human Gate with impact, backup, rollback, and review evidence.
- Trigger: a fix requires changing authentication, authorization, secrets, or credentials. Pause: before the change. Required approval: user approval of the security impact and exact Scope expansion; secrets must never be logged.
- Trigger: deploy, release, merge, publish, or external communication is requested. Pause: before the action. Required approval: a separate Human Gate for that specific action.
- Trigger: a required source change is outside Section 4 or raises the risk level. Pause: before editing. Required approval: user approval of the revised taskscope.
- Trigger: bulk translation, localization modification, encoding conversion, BOM conversion, or line-ending normalization is proposed. Pause: before writing. Required approval: user approval of exact files, source/target encoding, rollback plan, and localized-content review.

# 11. Artifacts to Review

- Scope expansion: `git status --short`, the relevant focused diff, and an English evidence note naming each added path/symbol and why the frontend-only Scope is insufficient.
- Backend, authorization, database, or environment gate: focused diff, test results, affected-contract description, impact analysis, and rollback plan; add migration dry-run output and backup evidence for any database action.
- Deploy, release, merge, or publish gate: final changed-file list, focused tests, typecheck, build output, and the target environment/action.
- Encoding or localization gate: focused file diff plus BOM, line-ending, `U+FFFD`, and localized-string inspection results.

# 12. Loop_iterations Override

`Loop_iterations: 3 (default, stop early on success)`
