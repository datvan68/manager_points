# Taskscope: Academic Record Synchronization For Count And Option Criteria

## Objective
Fix `/grading/score` so both count-based criteria and single-option criteria are synchronized from existing `academic_record` data before rendering, autosave, realtime updates, and total score recomputation.

The current bug is visible when academic records already exist, but the grading UI still displays `00` or an empty option selection. For count-based reward criteria, this causes valid records to contribute `0`. For `single_option` criteria, this can cause a previously selected option to disappear from the UI and later be saved back as `null`.

This scope treats `academic_record` as the authoritative source for draft grading state, while preserving locked, reviewed, or finalized grading decisions.

## Problem Statement
Some criteria have valid active academic records, but the corresponding embedded grading detail is missing, stale, or contains zero/null values.

Count-based example:
- A student has teacher-created records for two green reward criteria.
- Each criterion is worth `+5` with max `5`.
- `/grading/score` still shows `00`.
- The expected visible count is `01`, and the row contribution is `+5`.

Single-option example:
- A student has an active academic record for a `single_option` criterion.
- The record contains `selected_option_id`, `selected_option_label`, and `selected_option_score`, or a legacy option ID inside `record_title`.
- `/grading/score` must show that selected option immediately.
- Autosave must not submit the option as empty unless the user explicitly clears it and has permission to do so.

The bug is dangerous because autosave or full-detail save can persist stale UI state over valid academic-record state. A user editing one unrelated criterion must not accidentally reset other criteria to `00` or `null`.

## Required Source Of Truth Rules

### Count-based criteria
- Active `academic_record` rows are the source of truth for `current_count`.
- `current_count` is the source of truth for draft `system_score`.
- Draft score fields must not let stale zero values override a positive record-derived `system_score`.
- Deleted, inactive, rejected, voided, or soft-deleted records must not be counted.
- Duplicate active records must follow criterion business rules:
  - if the criterion allows multiple occurrences, count all valid active records up to the configured cap;
  - if the criterion allows only one occurrence, count one and report duplicates for audit.

### Single-option criteria
- Active `academic_record` is the source of truth for the selected option in draft state.
- The synchronized detail must store:
  - `current_count = 1` when an active option record exists,
  - `selected_option_id`,
  - `selected_option_label`,
  - `selected_option_score`,
  - `system_score = selected_option_score`.
- If the active record has `selected_option_id`, validate it against the criterion's current `options`.
- If the active record is legacy and only stores `record_title = "Lua chon option <id>"`, parse the option ID as a backward-compatible fallback, then hydrate label and score from the criterion definition.
- If no active option record exists, draft state should be empty:
  - `current_count = 0`,
  - `selected_option_id = null`,
  - `selected_option_label = null`,
  - `selected_option_score = null`,
  - reward option score defaults to `0`,
  - non-counted violation behavior remains unchanged.
- A `single_option` criterion must never sum multiple option records. If multiple active option records exist for the same student, semester, and criterion, use one deterministic active option, preferably the latest valid active record, and report the duplicates for audit.
- Invalid option IDs must not silently score as `0`. They must be returned as a sync warning or repair skip reason unless the business rule allows automatic fallback.

### Locked and reviewed state
- Locked summaries, locked details, approved details, finalized details, and explicitly reviewed teacher scores keep their existing authority.
- Automatic synchronization may report mismatches for locked/reviewed data, but must not overwrite them unless a separate explicit admin repair flow is approved.

## Role And Permission Boundary
Admin grading must continue to work normally.

Required behavior:
- Admin users can perform normal `/grading/score` operations: count changes, option selection, manual score updates, save, autosave, and realtime updates.
- Student-specific approval rules apply only to authenticated users whose effective role is `Student`.
- Teacher-specific approval rules apply only to authenticated users whose effective role is `Teacher` or advisor-equivalent.
- Admin users must not be forced through student self-only checks, teacher class-scope checks, student submission approval checks, or teacher input approval gates.
- Admin users still must pass structural validation: authenticated request, valid `student_id`, valid `semester_id`, valid `criterion_id`, and access to the grading feature.
- Role detection must use the authenticated requester context, not request-body fields or client-provided role labels.

## Implementation Scope

### 1. Synchronize before rendering `/grading/score`
On page load, student switch, semester switch, class switch, and explicit refresh, reconcile active academic records into the grading detail map before controls render.

Required behavior:
- Fetch or compute synchronized detail state for all criteria in the selected student and semester.
- Merge synchronized counts into `evaluationCounts`.
- Merge synchronized option selections into `selectedOptionsState`.
- Merge synchronized details into `evaluationDetailsMap`.
- Do not wait for the user to edit a criterion before synchronization runs.
- Ensure category badges, row scores, roster totals, and realtime previews all read from the same synchronized state.

### 2. Backend single-criterion sync
Update `backend/src/academic-record/academic-record.service.ts`.

Required behavior:
- `syncStudentCriterionScore()` must support both `count` and `single_option` scoring modes.
- For count criteria, count valid active records and calculate `system_score`.
- For option criteria, find the active option record, resolve the selected option, and calculate `system_score` from `selected_option_score`.
- Create a missing draft detail when records exist but detail is missing.
- Repair draft details when records exist but detail has stale `current_count = 0`, missing option fields, or stale `system_score = 0`.
- Update draft `sv_score` and `gv_score` only when it is safe and the detail has not been reviewed, locked, or finalized.
- Return the synchronized `evaluation_detail`, total score, sync status, and mismatch warnings so the frontend can update without a full reload.

### 3. Backend batch sync
Make `syncMultipleStudentCriterionScores()` match the single sync behavior exactly.

Required behavior:
- Batch sync must produce the same result as running single sync for each criterion.
- Batch sync must hydrate both count criteria and option criteria.
- Batch sync must return mismatch entries for:
  - active count records with detail count `0`,
  - active option records with missing/empty `selected_option_id`,
  - invalid option IDs,
  - duplicate active option records,
  - locked/reviewed details skipped by sync.
- Batch sync must be callable during page load, student switch, semester switch, and explicit repair.

### 4. Evaluation detail bulk upsert protection
Update `backend/src/evaluation-detail/evaluation-detail.service.ts`.

Required behavior:
- Bulk upsert must not trust stale frontend `current_count = 0` when active academic records exist.
- Bulk upsert must not trust stale frontend `selected_option_id = null` when an active option record exists.
- For draft details, backend must repair stale payload values from active academic records before saving.
- For locked/reviewed/finalized details, backend must skip mutation and return a skip reason.
- A user can clear an option only through an explicit `select_option` intent with `selected_option_id = null` and valid permission. A full autosave payload with missing option state must not be treated as an explicit clear.

### 5. Frontend state hydration
Update `frontend/src/app/(dashboard)/grading/score/_utils/score-calculation.ts` and `/grading/score/page.tsx`.

Required behavior:
- `mergeDetailsWithPreExistingCounts()` must hydrate both:
  - `counts[criterionId]` from `detail.current_count`,
  - `optionsMap[criterionId]` from `detail.selected_option_id`.
- If synchronized detail contains a valid option, the option dropdown must show it immediately.
- If a realtime event returns `updatedDetail` or `updatedDetails`, update `evaluationCounts`, `selectedOptionsState`, and `evaluationDetailsMap` before recalculating totals.
- Score helpers must use one consistent effective score path for:
  - criterion row score,
  - criterion contribution,
  - category badge,
  - roster total,
  - realtime preview.
- Draft option criteria should prefer the synchronized selected option and selected option score over stale zero/null detail scores.
- Locked or reviewed option criteria should keep their persisted reviewed/final score.

### 6. Autosave guard
Autosave must not reset untouched criteria.

Required behavior:
- Autosave should submit only changed criteria where possible.
- If autosave compares fresh backend detail with local state, option criteria must compare against synchronized `selected_option_id`, not an empty local default.
- If the frontend does not have a hydrated option map yet, autosave must delay, re-fetch, or submit no-op for that option criterion.
- Backend must reject or repair stale option-clearing payloads when active option records prove a selected option exists.
- Editing one count criterion must not clear an unrelated option criterion.
- Editing one option criterion must not reset unrelated count criteria to `00`.

### 7. Summary recomputation
Update `backend/src/summaries-point/summaries-point.service.ts`.

Required behavior:
- Recompute totals after academic-record-to-detail synchronization.
- Draft count criteria use synchronized `system_score` or recomputed count-derived score.
- Draft option criteria use synchronized `selected_option_score` or recompute from `selected_option_id`.
- Locked/reviewed/finalized details keep their authoritative score.
- Category max caps and total score caps still apply.
- Existing non-counted violation behavior must remain consistent with frontend calculation.

### 8. Audit and repair report
Add logging or an admin-facing sync report.

Minimum report fields:
- `student_id`,
- `semester_id`,
- `criterion_id`,
- `scoring_mode`,
- active record count,
- selected option ID from academic record,
- selected option ID from detail,
- old detail count,
- old score fields,
- repaired detail count,
- repaired selected option ID,
- repaired system score,
- repaired or skipped status,
- skip reason.

## Out Of Scope
- Changing reward, violation, or option scoring formulas unrelated to synchronization.
- Removing category maximum score caps.
- Changing who can grade students.
- Changing lock, approval, or finalization permissions.
- Rewriting the full `/grading/score` page.
- Automatically deleting duplicate academic records.
- Automatically overwriting locked/reviewed/finalized scores.
- Automatically choosing a different option when the academic record references an invalid option ID, unless a separate product rule is approved.

## Acceptance Criteria
- A count reward criterion with one active academic record shows `01`, not `00`.
- The reported green reward criteria show record-derived counts and `+5` row contributions.
- A `single_option` criterion with an active academic record shows the selected option immediately after page load.
- The option row contribution equals the selected option score.
- If the active option record was stored with legacy `record_title`, the UI still hydrates the option when the option ID is valid.
- If multiple active option records exist, sync chooses one deterministic option and reports duplicate records.
- If an option ID is invalid, sync reports the mismatch instead of silently saving `0`.
- Page refresh, student switch, semester switch, and realtime events preserve synchronized counts and selected options.
- Autosave does not clear a valid option because local `selectedOptionsState` was empty.
- Autosave does not reset valid count records because local `evaluationCounts` was stale.
- `syncStudentCriterionScore()` and `syncMultipleStudentCriterionScores()` produce the same detail state.
- Locked, approved, finalized, or reviewed details are not overwritten by automatic sync.
- Admin users can grade normally.
- Student and teacher users still follow existing ownership, class-scope, and approval restrictions.

## Test Plan

### Backend automated tests
- Count criterion with active record and missing detail creates a draft detail with `current_count = 1`.
- Count criterion with stale detail `current_count = 0` repairs to `1`.
- Count reward with `score_per_unit = 5` and one active record produces `system_score = 5`.
- Option criterion with active record hydrates `selected_option_id`, label, score, `current_count = 1`, and `system_score`.
- Option criterion with legacy `record_title` hydrates the valid option ID.
- Option criterion with stale detail `selected_option_id = null` repairs from active record.
- Option criterion with invalid option ID returns a mismatch warning or skip reason.
- Duplicate active option records are detected and reported.
- Bulk upsert does not clear an option when the frontend payload omits `selected_option_id`.
- Explicit option clear works only through authorized `select_option` intent.
- Single sync and batch sync return equivalent details.
- Locked, reviewed, and finalized details are skipped.
- Summary recompute uses synchronized option score for draft option criteria.
- Admin can select, change, and clear options according to existing permission rules.
- Student and teacher restrictions remain enforced.

### Frontend automated tests
- `/grading/score` renders `01` for count criteria with active records.
- `/grading/score` renders the selected dropdown value for option criteria with active records.
- `mergeDetailsWithPreExistingCounts()` hydrates both counts and option map.
- Criterion row, category badge, roster total, and realtime preview agree for count criteria.
- Criterion row, category badge, roster total, and realtime preview agree for option criteria.
- Student switch clears stale local option state and loads the next student's synchronized option.
- Realtime `updatedDetail` updates count, option map, detail map, and total calculation.
- Autosave does not send an unintended option clear for untouched option criteria.

### Manual verification
Use a student with existing teacher-created academic records.

1. Open `/grading/score`.
2. Select the affected student and semester.
3. Confirm count reward criteria with records display `01`.
4. Confirm each count reward criterion displays the correct contribution, such as `+5`.
5. Select a student with an existing `single_option` academic record.
6. Confirm the option dropdown shows the record-derived option.
7. Confirm the option row score equals the selected option score.
8. Edit a different criterion and wait for autosave.
9. Refresh the page.
10. Confirm the original count criteria and option criteria remain synchronized.
11. Confirm valid academic records were not deleted, cleared, or reset.
12. Repeat as admin and confirm normal grading remains available.
13. Repeat as student or teacher and confirm existing restrictions still apply.

## Deliverable
A focused synchronization fix for `/grading/score` and backend scoring services so active academic records are reflected in count controls, option dropdowns, draft details, criterion scores, category totals, autosave payloads, realtime state, and persisted summaries without overwriting locked, reviewed, or finalized grading decisions.