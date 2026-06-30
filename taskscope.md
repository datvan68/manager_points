# Taskscope: Backend Review Fixes for Academic Record Realtime Sync

## Objective
Stabilize the recently implemented academic-record and grading realtime synchronization work so the backend builds cleanly and the sync contract is consistent across `academic_record`, embedded `evaluation_detail`, `summary_point.total_score`, and realtime SSE events.

This task starts from the current worktree. The immediate priority is to fix backend compile errors, then close the runtime drift risks found during review.

## Current Build Status
`npm run build` in `backend` currently fails with 23 TypeScript errors.

Main failing areas:
- `backend/src/academic-record/academic-record.service.ts:223` reads `currentSummary.class_id`, but `SummaryPoint` has no `class_id` field.
- `backend/src/evaluation-detail/evaluation-detail.service.ts:885-932` still contains unreachable legacy delete logic after a new `BadRequestException`, and that block references removed variables such as `deletedDetail` and `detailIndex`.
- `backend/src/summaries-point/summaries-point.service.ts` changed `recomputeTotalScore()` to return `Promise<any>`, but the function does not return the saved summary, so callers still receive `undefined`.

## Review Findings

### 1. Direct evaluation detail delete is now a compile blocker
`EvaluationDetailService.remove()` throws a `BadRequestException` telling callers to use academic-record intent or delete evidence records, but the old delete implementation remains below that throw.

Required fix:
- If direct delete is no longer allowed, remove the entire stale code path after the throw.
- Keep the access checks and locked-summary validation before the explicit rejection.
- Add a test proving direct `DELETE /evaluation-details/:id` returns the expected 400 response and does not mutate records or summary details.

### 2. Realtime event payload reads a field that does not exist
`syncStudentCriterionScore()` emits `classId: currentSummary.class_id`, but the `SummaryPoint` schema only stores `student_id`, `semester_id`, `period_id`, `details`, and summary/rank fields.

Required fix:
- Resolve `classId` through the related `Student.class_id`, either by populating `student_id` or by a small helper query.
- Do not read `class_id` directly from a `SummaryPoint` document unless the schema is explicitly changed.
- Centralize event payload construction so single sync and batch sync produce the same shape.

### 3. `recomputeTotalScore()` return contract is incomplete
`AcademicRecordService` expects `recomputeTotalScore()` to return a recomputed summary so it can attach `updatedDetail`, `totalScore`, and `grading` to `academic_record_changed`. The service currently saves the summary and emits `summary_recomputed`, but does not return the summary.

Required fix:
- Either return the saved summary from `recomputeTotalScore()` or reload the summary after recompute in the caller.
- Make the return type explicit, for example `Promise<SummaryPointDocument | null>`.
- Ensure the returned or reloaded document contains the updated `details`, `total_score`, `grading`, `student_id`, and `semester_id` needed by event payloads.

### 4. SSE filtering is unsafe when payload identifiers are missing
`GradingRealtimeService.getStream()` only rejects a class or semester mismatch when the payload contains that field. Events with missing `classId` or `semesterId` pass through filtered streams.

Required fix:
- Make backend events include `classId`, `semesterId`, `studentId`, and `summaryId` whenever the event is summary or grading related.
- When a client subscribes with a filter and an event lacks that identifier, drop the event or use a secure fallback lookup before sending it.
- Add tests for filtered streams so a class-scoped subscriber never receives events from another class or unscoped academic-record events.

### 5. Batch sync emits weaker events than single sync
`syncMultipleStudentCriterionScores()` recomputes summaries but emits `academic_record_changed` with only `semesterId`, `studentId`, and `summaryId`.

Required fix:
- Emit the same enriched payload shape as `syncStudentCriterionScore()`.
- Include affected `criterionIds`, changed record ids when available, `updatedDetails`, `totalScore`, `grading`, `updatedAt`, and action/source metadata.
- Avoid sending one noisy event per record when a batch can send one event per affected student/semester summary.

### 6. Locked summaries can still drift from record mutations
`syncStudentCriterionScore()` skips locked summaries, but `handleScoreIntent()` can mutate or hard-delete `academic_record` rows before it reports `sync_status: 'summary_locked'`. That can leave records and locked details inconsistent.

Required fix:
- Preflight the affected summary before mutating records for any intent.
- If the summary is locked, reject the intent before changing records unless the business rule explicitly allows record changes without score sync.
- If record changes are allowed for locked summaries, return a clear status and do not present it as a successful score sync.
- Add tests proving locked summaries do not silently drift.

### 7. ObjectId normalization is only partially fixed
`safeSync()` now handles populated refs, but related paths still use direct `.toString()` on possibly populated documents.

Required fix:
- Create one helper such as `normalizeObjectId(value): string`.
- Use it in `safeSync()`, old/new key comparison in `update()`, batch grouping in `syncMultipleStudentCriterionScores()`, event payload creation, and any identity comparisons.
- Add tests for raw ObjectIds, strings, populated Mongoose documents, and lean populated objects.

### 8. Evaluation detail update guard is inconsistent
`EvaluationDetailService.update()` rejects `rawDto.log` when it is present, but later still has a branch that writes `details.$.log`.

Required fix:
- Decide whether direct log updates are allowed for non-score workflows.
- If record-backed grading logs must be blocked, remove or narrow the later write branch.
- If non-score logs remain allowed, validate them explicitly and document which fields may bypass academic-record intent.

## Implementation Scope

1. Restore backend build.
   - Remove unreachable legacy code in `EvaluationDetailService.remove()`.
   - Stop reading `class_id` directly from `SummaryPoint`.
   - Fix `recomputeTotalScore()` return behavior and type.

2. Standardize backend sync helpers.
   - Add a shared ObjectId normalization helper.
   - Add a shared grading event payload builder.
   - Use the helpers in single create, bulk create, update, soft delete, restore, force delete, import commit, daily report sync, and intent flows.

3. Harden record-backed grading intent handling.
   - Validate affected summary existence and locked status before mutating records.
   - Keep permission-clamped deletes explicit in the response.
   - Return `actual_count`, `evaluation_detail`, `summary`, `changed_record_ids`, and `sync_status` from the same canonical post-sync snapshot.

4. Fix realtime event scoping.
   - Enrich `academic_record_changed` and `summary_recomputed` events with `classId`, `semesterId`, `studentId`, `summaryId`, and affected criterion ids.
   - Make SSE filtering strict when filters are supplied.
   - Ensure frontend callers can rely on `updatedDetail` or `updatedDetails` when present, and can fall back to refetch when absent.

5. Preserve source-of-truth rules.
   - `academic_record` remains the source of truth for record-backed counts, selected options, and manual score records.
   - `evaluation_detail.current_count`, `system_score`, selected option fields, and draft `sv_score`/`gv_score` are derived from active records or explicit academic-record intents.
   - Direct `evaluation_detail` score mutation stays blocked for record-backed criteria.

## Out of Scope
- Redesigning `/students/record`, `/grading`, or `/grading/score`.
- Changing scoring formulas, grading thresholds, category max scores, or role policy unless required to preserve the current contract.
- Running production data repair.
- Introducing a new persistence table only for realtime synchronization.

## Acceptance Criteria
- `npm run build` passes in `backend`.
- `EvaluationDetailService.remove()` has no unreachable stale code and direct delete returns a controlled 400 response.
- `recomputeTotalScore()` has a clear return contract and callers no longer receive `undefined` when a summary exists.
- `academic_record_changed` payloads include enough identifiers and data for class/semester-scoped realtime updates.
- SSE subscriptions with `classId` and `semesterId` do not receive unrelated or unscoped grading events.
- Creating, updating, soft deleting, restoring, force deleting, bulk creating, importing, and intent-mutating academic records all rebuild the matching embedded `evaluation_detail`.
- Updating a record's student, semester, or criterion syncs both the old key and the new key.
- Locked summaries do not drift silently after grading intents or record mutations.
- `/students/record`, `/grading`, and `/grading/score` can reconcile from backend responses or realtime events without manual refresh for normal unlocked summaries.

## Test Plan
- Run `npm run build` in `backend`.
- Add or update backend unit tests for:
  - `EvaluationDetailService.remove()` direct delete rejection.
  - `recomputeTotalScore()` return value and persisted totals.
  - ObjectId normalization for raw ids and populated refs.
  - single create, bulk create, update old/new key, soft delete, restore, force delete, import commit, and score intent sync.
  - locked summary preflight behavior.
  - strict SSE filtering by class and semester.
- Add integration-style tests for:
  - count-based criteria syncing `current_count`, `system_score`, `sv_score`, and `gv_score`.
  - `single_option` criteria syncing selected option fields.
  - manual score intent syncing the detail and summary total.
  - permission-clamped delete intents returning the actual count.
- Manually verify with two browser sessions:
  - one on `/students/record`;
  - one on `/grading/score`;
  - create, edit, delete, restore, select option, clear score, and confirm both screens update without reload.

## Deliverable
A buildable backend and a consistent realtime sync contract for academic record backed grading, with tests covering the compile blockers and the main drift-prone mutation paths.
