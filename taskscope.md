# Task ID + Pipeline

ACTIVITY-DETAIL-20260715-001 — `feature_development`

# Risk Level

Low. This is a frontend-only presentation and data-mapping correction; it does not change database schemas, permissions, production infrastructure, or external integrations.

# Objective

Make the Activity Detail page display the completion rule returned for the current activity and make sessions occurring today visually prominent in the Schedule tab. The work corrects the frontend contract from the legacy `club_id` field to the backend `activity_id` field.

# Scope

- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` — match the loaded completion rule with the current activity through `activity_id` and the current `semester_id`; submit completion-rule payloads with `activity_id`.
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx` — render today sessions before other sessions and apply a distinct card treatment plus the `Hôm nay` badge when `is_today === true`.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx` — cover display of a rule whose populated `activity_id` matches the route activity and semester.
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx` — cover the today badge, prominent card classes, and today-first ordering.

# Out of Scope

- Backend controller, service, schema, DTO, MongoDB migration, and API-route changes.
- Changes to attendance registration, attendance permissions, activity membership, scoring calculation, or completion-award synchronization.
- Redesign of tabs, global theme tokens, or schedule creation/editing workflows.

# Context & Dependencies

- The backend `ActivityCompletionRule` schema persists `activity_id` and `semester_id`; `findAllRules()` populates `activity_id`.
- `ActivityDetailPage.loadActivityData()` currently retrieves the activity, timeline, and completion-rule list in parallel. Its lookup must accept populated-object and string-ID representations for both identifiers.
- `ActivityScheduleTimeline` receives timeline items produced by `activityScheduleApi.getActivityTimeline(activityId)`. The API supplies `is_today`; this flag is the source of truth for today highlighting and ordering.
- Existing `normalizeActivityIdPayload()` already accepts legacy `club_id` and converts it to `activity_id`; the page/form payload should use the canonical field directly.

# Steps

1. PLAN — In `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`, inspect the completion-rule object returned by `activityCompletionRuleApi.getAll()` and define a single ID-normalization expression for populated or scalar `activity_id` and `semester_id` values.
2. EXECUTE — Replace the `club_id` comparison in `loadActivityData()` with the normalized `activity_id` comparison against `activityId`, while retaining the semester comparison; set `completionRule` to the matching rule or `null` only when no same-activity, same-semester rule exists.
3. EXECUTE — In `handleSaveCompletionRule()` and `ActivityCompletionRuleForm` usage, construct the creation/update payload with `activity_id: activityId` and the resolved semester ID; do not emit `club_id` from the detail page.
4. EXECUTE — In `frontend/src/components/activities/ActivityScheduleTimeline.tsx`, keep schedules with `is_today === true` ahead of other schedules, sort schedules within each group by `start_time`, and render the existing blue card treatment and `Hôm nay` badge only for today sessions.
5. VERIFY — Add a page test with a populated `activity_id` and matching `semester_id`, open the `Quy tắc hoàn thành` tab, and assert the minimum attendance and criterion text are visible.
6. VERIFY — Add or update timeline tests to assert all `is_today` sessions have the `Hôm nay` badge and highlight classes, appear before non-today sessions, and non-today sessions do not receive the highlight.
7. REFINE — Run the targeted frontend tests; if an assertion fails, correct only the matching, payload, ordering, or highlight implementation described above and rerun the same tests.

# Acceptance Criteria

- A completion rule returned with `activity_id` equal to the route activity ID and `semester_id` equal to the activity semester is rendered in the `Quy tắc hoàn thành` tab.
- Completion rules belonging to a different activity or semester are not rendered in that tab.
- Saving a completion rule from Activity Detail sends `activity_id`, never `club_id`, in the page-level payload.
- Every timeline item with `is_today === true` displays `Hôm nay`, uses the designated blue highlight classes, and is listed before non-today sessions.
- Non-today timeline items do not display `Hôm nay` or receive the today highlight classes.
- All targeted Vitest tests pass.

# Verification Commands

```powershell
cd frontend
npm test -- --run src/app/(dashboard)/activities/[activityId]/page.test.tsx src/components/activities/ActivityScheduleTimeline.test.tsx
```

# Safety Gates

No Human Gate is expected: risk is low and changes are limited to frontend source and tests. Trigger a Human Gate only if implementation requires a backend API/schema change, database modification, deployment, production configuration change, or permission change.

# Artifacts to Review

- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx`
- Targeted Vitest output for the two test files above

# Loop_iterations override (if any)

No override. Use the default of 3 PLAN → EXECUTE → VERIFY → REFINE iterations.
