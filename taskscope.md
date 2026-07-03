# Taskscope: Role-Aware Academic Record Source of Truth and Score Projection

## Objective
Redesign the grading data model and synchronization flow so `academic_record` is the authoritative source for every student scoring event, while scores are calculated from valid record counts based on who recorded the event.

The core business rule is:

```text
AcademicRecord = one recorded occurrence
Recorded role = who recognized or submitted that occurrence
Count = number of valid occurrences by role and criterion
Score = calculated projection from resolved counts
Final score = locked approval snapshot
```

This scope focuses on making the system easier to store, synchronize, audit, and extend when student activities, teacher reviews, supervisor records, discipline events, imports, or automated services all create academic records.

## Current Problem
The current grading flow treats `academic_record` as the source for sync, but the projected score data in summary details can become stale or ambiguous.

The main ambiguity is that a single `current_count` does not explain who recorded the count:

- student self-reported count;
- teacher-recorded count;
- supervisor-recorded count;
- admin/manual adjustment count;
- automated/imported count.

When these are collapsed too early into one number, the system loses the business meaning of the record source. This makes approval, review, conflict detection, and future expansion harder.

Additional current issues:

- Manual score is parsed from `record_title` string (`"Nhập điểm tay: 8.5"`) instead of structured fields — fragile and slow.
- Single-option selection is parsed via regex from `record_title` (`/Lựa chọn option (.+)/i`) — duplicate parsing logic in `syncStudentCriterionScore` and `syncMultipleStudentCriterionScores`.
- Score calculation logic is scattered across 5+ service files instead of being centralized.
- Embedded `details[]` array in `SummaryPoint` causes `VersionError` contention on concurrent writes (retry mechanism already exists, confirming the problem occurs in production).
- No performance targets or data volume considerations despite `academic_record` being the highest-volume collection.

## Target Model

### 1. AcademicRecord as the Source of Truth
Each `academic_record` should represent one scoring occurrence or scoring adjustment. It should not primarily be treated as the final score.

Recommended fields (additions to existing schema — existing fields are preserved):

```ts
{
  // === EXISTING FIELDS (preserved) ===
  student_id: string;
  semester_id: string;
  criterion_id: string;

  daily_report_id?: string;       // PRESERVED — will be migrated to source_type/source_id
  record_title?: string;          // PRESERVED — currently used for manual score parsing (see migration note)
  evidence_url?: string;          // PRESERVED
  description?: string;           // PRESERVED

  recorded_by?: string;           // PRESERVED (user ref) — renamed conceptually to recorded_by_user_id
  recorded_at?: Date;             // PRESERVED

  status: 'active' | 'cancelled' | 'rejected' | 'confirmed';
  is_deleted: boolean;            // PRESERVED — soft-delete layer, independent of status

  idempotency_key?: string;       // PRESERVED — unique sparse index
  source?: string;                // PRESERVED during migration — will be replaced by source_type + source_id

  selected_option_id?: string;    // PRESERVED
  selected_option_label?: string; // PRESERVED
  selected_option_score?: number; // PRESERVED

  // === NEW FIELDS (additions) ===
  recorded_by_role: 'student' | 'teacher' | 'supervisor' | 'admin' | 'system' | 'import';

  record_type: 'activity' | 'discipline' | 'manual_score' | 'selected_option' | 'adjustment';
  action_type: 'count' | 'select_option' | 'manual_score' | 'bonus' | 'penalty';

  quantity: number;               // default: 1 for count-based records

  source_type?: string;           // replaces `source` field after migration
  source_id?: string;             // paired with source_type for full source reference

  payload?: Record<string, unknown>;  // structured data — replaces string-based parsing
  occurred_at: Date;
}
```

Notes:

- `recorded_by_role` values `'system'` and `'import'` are virtual roles representing automated record sources. When `recorded_by_role` is `'system'` or `'import'`, `recorded_by` (user ref) may be null or reference a service account.
- Status `'confirmed'` means the record has been verified by a teacher or supervisor at the record level. This is distinct from summary-level approval (`locked` state in `EvaluationDetail`).
- `is_deleted` remains as a separate soft-delete layer. Queries must always filter `is_deleted: { $ne: true }` in addition to checking `status`.

Migration note for `record_title` parsing:

```text
BEFORE (fragile string parsing):
  record_title: "Nhập điểm tay: 8.5" → parseFloat("8.5")
  record_title: "Lựa chọn option A"  → regex match "A"

AFTER (structured fields):
  action_type: 'manual_score', payload: { manual_score: 8.5 }
  action_type: 'select_option', selected_option_id: 'A'

During migration: sync path reads structured fields first, falls back to
title parsing for records not yet backfilled.
```

The record answers:

```text
What happened?
Who recorded it?
For which student, semester, and criterion?
Is it still valid?
Which source created it?
```

It should not be the only place where final approved score is stored.

### 2. Role-Aware Counts
The projection layer should group valid records by:

```text
student_id + semester_id + criterion_id + period_id + recorded_by_role
```

Note: `period_id` is included because `SummaryPoint` supports sub-period evaluation via `period_id`. Projections without `period_id` would lose the ability to score by evaluation sub-period.

Instead of a single ambiguous count, the system should preserve role-specific counts:

```ts
{
  student_reported_count: number;
  teacher_recorded_count: number;
  supervisor_recorded_count: number;
  admin_recorded_count: number;
  system_recorded_count: number;
  import_recorded_count: number;
}
```

This allows the UI and approval flow to show the difference between:

```text
Student claims: 3
Teacher records: 2
Supervisor records: 1
Approved count: 2
```

The system should not automatically assume all counts have equal authority.

### 3. Count Resolution Rules
Introduce a centralized count resolution layer.

Example resolution strategy:

```text
Draft:
  Show role-specific counts separately.

Student submission:
  Student records are visible as self-reported counts.

Teacher review:
  Teacher can accept, reject, correct, or add teacher-recorded counts.

Supervisor/Admin approval:
  Supervisor/Admin resolves the approved count used for final score.

Locked:
  Final score uses the approved snapshot only.
```

The system should make the approved count explicit:

```ts
{
  resolved_count: number;
  resolved_by_user_id: string;
  resolved_by_role: 'teacher' | 'supervisor' | 'admin' | 'system';
  resolved_at: Date;
  resolution_source: 'teacher_review' | 'supervisor_approval' | 'admin_override' | 'automatic_rule';
}
```

Note: `resolved_by_role` does not include `'student'` because students cannot resolve their own counts — resolution requires a higher-authority role.

#### 3.1 Conflict Definition

A conflict exists when:
- `student_reported_count ≠ teacher_recorded_count` AND no resolution exists.
- Multiple roles have non-zero counts for the same criterion AND no explicit resolution has been recorded.

A conflict does NOT apply when:
- Only one role has recorded counts (no disagreement).
- A resolution has been explicitly recorded regardless of count differences.

Auto-resolution rules (configurable):
- If only teacher has count → auto-resolve to teacher count.
- If supervisor/admin has count → supervisor/admin count takes priority.
- Student-only count always requires teacher/supervisor review before approval.

### 4. Score Engine
Move score calculation into a centralized score engine.

Score calculation context:
- `'sync'`: Triggered by academic_record changes — uses sync-specific defaults (discipline with 0 count → maxScore, reward with 0 count → 0). Replaces current `isSyncPath: true` parameter.
- `'manual'`: Triggered by user direct edit — preserves existing behavior. Replaces current `isSyncPath: false` parameter.
- `'approval'`: Triggered during final approval — uses `resolved_count` only, no fallback.

Input:

```text
criterion rule
calculation_context: 'sync' | 'manual' | 'approval'
role-specific record counts
selected option records
manual score records (from structured payload, not string parsing)
resolution rule
```

Output:

```ts
{
  resolved_count: number;
  system_score: number;
  selected_option_id?: string;
  selected_option_label?: string;
  selected_option_score?: number;
  manual_score?: number;
  calculation_reason: string;
  calculation_context: 'sync' | 'manual' | 'approval';
}
```

Score rules should stay centralized:

- normal criteria: `resolved_count * score_per_unit`, clamped by criterion/category limit;
- discipline/negative criteria: `max_score - resolved_count * abs(score_per_unit)`, clamped;
- single-option criteria: score comes from the selected option, not count multiplication;
- manual score criteria: score comes from the valid manual score record (structured `payload.manual_score`) or approved override — NOT from string parsing of `record_title`;
- locked criteria: use final approved snapshot, not live recalculation. Snapshot is stored as `EvaluationDetail.final_score` + `locked_at`.

Consolidation targets — all existing score calculation logic to migrate into the centralized engine:

```text
Backend:
  - academic-record.utils.ts:calculateCriterionScoreHelper (primary — preserve as base)
  - academic-record.service.ts: L183, L682, L2001 (inline isDiscipline/isReward checks)
  - academic-record.service.ts: calculateSyncDetail (sync-specific scoring)
  - evaluation-detail.service.ts: L859 (isRewardOrViolation logic)
  - summaries-point.service.ts: L550, L605, L952, L1569-L1570 (isDiscipline checks)
  - daily-class-report.service.ts: L711 (pointsPerUnit calculation)

Frontend:
  - grading/score/_utils/score-calculation.ts (full client-side score engine — align or derive from backend)
```

### 5. Projection / Read Model
Add or formalize a projection layer so the application does not need to scan raw records every time the score page loads.

Recommended projection:

```ts
{
  student_id: string;
  semester_id: string;
  criterion_id: string;
  period_id?: string;             // sub-period evaluation support

  counts_by_role: {
    student: number;
    teacher: number;
    supervisor: number;
    admin: number;
    system: number;
    import: number;
  };

  resolved_count: number;
  system_score: number;

  selected_option_id?: string;
  selected_option_label?: string;
  selected_option_score?: number;
  manual_score?: number;

  source_record_count: number;    // total active records (lightweight audit reference)
  last_source_record_id?: string; // most recent record (for quick audit lookup)
  // Full record list: query directly from academic_record collection when detailed audit is needed.

  last_record_at?: Date;
  version: number;
  updated_at: Date;
}
```

Note: `source_record_ids: string[]` was removed from the projection to avoid document bloat. With high-volume criteria (e.g., accumulated discipline records), an unbounded array of IDs would degrade read/write performance and risk hitting the MongoDB 16MB document limit. Use `source_record_count` for lightweight tracking and query `academic_record` directly for full audit trails.

This projection can be stored inside `summary.details` for the current grading workflow or in a dedicated collection/table such as `academic_record_projection`.

The recommended long-term direction is:

```text
academic_record
  -> academic_record_projection
  -> summary.details
  -> final approved summary snapshot
```

## Performance Requirements

### Data Volume Expectations
- `academic_record` is the highest-volume, write-heavy collection and the primary data source.
- Data must be preserved — records are append-only for active status. Cancellation sets status, does not delete documents. `is_deleted` soft-delete remains as secondary safety layer.
- No bulk purge of academic_record data without explicit human approval.

### Sync Latency Targets

```text
Single record create/update → detail sync:  ≤ 100ms (P95)
Batch sync (class-level, ~50 students × 10 criteria): ≤ 2s
Projection rebuild (full recalculation):    ≤ 5s per student (background only)
Approval freeze:                            ≤ 3s per student
```

Role-aware count grouping must not degrade sync latency beyond 20% of current baseline.

### Query Performance
- Role-aware count query must use a covered index — no collection scan.
- Detail lookup by criterion must be O(1) via indexed access, not embedded array scan.
- Projection read must not require scanning raw `academic_record` documents.

### Concurrency
- Preserve existing `VersionError` retry mechanism (3 attempts, exponential backoff at 20ms × attempt).
- Use positional array updates (`$set` with `$`) where possible to reduce contention on embedded `details[]`.
- Batch sync (`syncMultipleStudentCriterionScores`) must maintain the preloaded metadata pattern (preload all criteria and categories to avoid N+1 queries).

### Monitoring
- Add metrics for: sync duration, VersionError rate, mismatch repair frequency.
- Alert threshold: sync latency > 200ms (P95) or VersionError rate > 5%.

## Synchronization Flow

### Record Creation
Any module that recognizes a student activity should create or update an `academic_record`.

Examples:

- student submits an activity proof;
- teacher records attendance or participation;
- supervisor records discipline;
- admin imports external activity results;
- system automatically recognizes a rule-based event.

The record creation flow should be idempotent:

```text
source_type + source_id + student_id + semester_id + criterion_id + recorded_by_role
```

Recommended field:

```ts
idempotency_key: string;
```

This prevents duplicate records when the same source syncs multiple times.

`occurrence_key` (optional) groups records that belong to the same logical occurrence across multiple criteria. Example: when one discipline event affects 3 criteria, all 3 records share the same `occurrence_key = "event:{event_id}"` but have different `idempotency_key` values.

### Projection Sync — Incremental vs Full Recalculation

For **performance-critical paths** (record creation, deletion — the hot path):

Use incremental update:
```text
- Record created with role X → projection.counts_by_role[X] += quantity
- Record cancelled           → projection.counts_by_role[X] -= quantity
- Use MongoDB $inc operator — no need to load all records.
```

```ts
// Incremental update example
await ProjectionModel.findOneAndUpdate(
  { student_id, semester_id, criterion_id },
  {
    $inc: { [`counts_by_role.${recorded_by_role}`]: quantity },
    $set: { updated_at: new Date(), last_source_record_id: record._id },
    $inc: { source_record_count: 1 }
  },
  { upsert: true }
);
```

For **consistency paths** (approval, manual repair, periodic reconciliation):

Use full recalculation:
```text
1. Load active records for student + semester + criterion.
2. Group counts by recorded_by_role.
3. Resolve the count according to grading workflow rules.
4. Calculate score through the score engine.
5. Update projection.
6. Update summary detail only if the summary is not locked.
```

Reconciliation: scheduled job compares incremental counts vs actual record counts. Auto-repair on mismatch (existing mismatch detection logic in `handleScoreIntent` is preserved and extended).

### Sync Timing Strategy

Synchronous (in-request — critical path, must stay fast):
```text
- Update SummaryPoint.details.current_count (existing behavior)
- Recompute system_score (existing behavior)
- Emit realtime event (existing behavior)
```

Asynchronous (eventual, via event/queue — new, non-blocking):
```text
- Update academic_record_projection
- Run conflict detection
- Update source_record_count
```

Implementation options:
- EventEmitter (already used for `grading_event` → add projection listener)
- MongoDB Change Streams → react to `academic_record` writes
- Bull/Redis queue → for heavy batch operations

### Approval
Approval should not mutate raw academic records.

Approval should:

```text
1. Run final projection sync (full recalculation) while the summary is still editable.
2. Validate unresolved conflicts between student, teacher, supervisor, and admin counts.
3. Require explicit resolution where needed.
4. Freeze resolved_count and final_score.
5. Lock the summary.
6. Trigger rank recalculation (rank_tier, rank_label) if applicable.
7. rank_tier and rank_label must not be recalculated after rank_locked_at is set.
```

After approval:

```text
academic_record can remain auditable
projection can continue to exist
summary final_score must not be changed by automatic sync
```

### Cancellation / Reopen
Cancelling approval should:

```text
1. Clear final lock fields.
2. Return details to draft/review state.
3. Re-run projection sync (full recalculation) from academic records.
4. Restore editable role-specific counts and calculated scores.
```

### Write Contention Mitigation

The embedded `details[]` array in `SummaryPoint` causes `VersionError` on concurrent writes. Current retry logic (3 attempts, 20ms × attempt exponential backoff) confirms this occurs in production.

Mitigation options (ordered by implementation effort):

Option A (Short-term):
Use MongoDB positional update (`$set` on specific array element) instead of full document save:

```ts
await SummaryPoint.updateOne(
  { _id: summaryId, 'details.criterion_id': criterionId },
  { $set: {
    'details.$.current_count': newCount,
    'details.$.system_score': newScore,
    'details.$.counts_by_role': countsByRole
  }}
);
```

Option B (Long-term — recommended):
Move `EvaluationDetail` to a separate collection with its own document per student × semester × criterion. This eliminates array-level contention entirely. `SummaryPoint.details` becomes a computed view or cached aggregation.

Option C (Projection-first):
`academic_record_projection` handles all incremental writes. `SummaryPoint.details` is only rebuilt during approval/recompute. This aligns with the projection architecture in §5.

## UI Requirements
The grading UI should not show only one unexplained count.

For each criterion, the UI should be able to show:

```text
Student reported
Teacher recorded
Supervisor recorded
Admin/System recorded
Resolved approved count
Calculated score
Final approved score
```

The UI should make conflicts visible, for example:

```text
Student reported: 3
Teacher recorded: 2
Supervisor recorded: 1
⚠ Resolution required
```

During approval, the user should approve the resolved count/score, not a stale cached `current_count`.

## Implementation Scope

### Backend
Review and update:

- `backend/src/academic-record`
- `backend/src/evaluation-detail`
- `backend/src/summaries-point`
- `backend/src/daily-class-report` (score calculation in sync path)
- score calculation utilities
- related DTOs, schemas, and tests

Required backend work:

- Add `recorded_by_role` and `recorded_by_user_id` as first-class record metadata.
- Add or formalize `record_type`, `action_type`, `quantity`, `source_type`, `source_id`, and `occurrence_key`.
- Add idempotency support for source-created records.
- Replace string-based score parsing (`record_title.startsWith('Nhập điểm tay: ')` and regex option matching) with structured `action_type` + `payload` fields.
- Replace `isSyncPath: boolean` parameter with `calculation_context: 'sync' | 'manual' | 'approval'` in score engine.
- Build role-aware grouping for active academic records.
- Add a centralized count resolution service.
- Add a centralized score calculation service (consolidating logic from 5+ files — see §4 consolidation targets).
- Store role-specific counts in projection/detail data.
- Implement incremental count updates (`$inc`) for the performance-critical sync path.
- Implement async projection sync via EventEmitter or queue.
- Ensure locked summaries are not mutated by automatic sync.
- Ensure approval freezes resolved count and final score, not raw live counts.
- Ensure approval triggers rank recalculation when applicable.
- Add diagnostics for unresolved role-count conflicts.
- Add sync performance metrics (duration, VersionError rate, mismatch frequency).

### Frontend
Review and update:

- `/grading/score` page state and rendering
- `/grading/score/_utils/` — score-calculation.ts, realtime-event.ts, copy-score.ts
- academic record APIs
- summary approval APIs

Required frontend work:

- Display role-specific counts instead of only one ambiguous count.
- Display resolved count separately from raw role counts.
- Show conflict states when role counts disagree and no resolution exists.
- During approval, submit or confirm the resolved count/score.
- After approval, render the locked final snapshot.
- After cancellation, reload projected counts from academic records.
- Update WebSocket event payload handling to support role-specific counts.
- Update `realtime-event.ts` to merge role-aware count updates.
- Ensure backward compatibility for realtime events during migration (support both old and new payloads).
- Update `copy-score.ts` to handle role-specific counts and define which role's count is used as copy source.
- Update PDF/export utilities (`pdf-score-utils.ts`, `report-helpers.ts`) to render role-specific counts.

## Tests

### Backend Tests
Add or update tests for:

- student, teacher, supervisor, admin, system, and import records are counted separately;
- duplicate source sync does not create duplicate records;
- active records are included and cancelled/rejected records are excluded;
- projection sync groups records by role correctly;
- score engine calculates normal, discipline, single-option, and manual-score criteria correctly;
- score engine handles all three calculation contexts (`sync`, `manual`, `approval`) correctly;
- approval requires resolution when role-specific counts conflict;
- approval freezes `resolved_count` and `final_score`;
- approval triggers rank recalculation when applicable;
- locked summaries are not changed by later sync;
- cancelling approval resyncs from academic records;
- source records remain unchanged during approval;
- incremental count updates (`$inc`) produce correct counts;
- full recalculation matches incremental counts (reconciliation);
- `daily_report_id` records are correctly mapped to `source_type` + `source_id`;
- backfilled records have correct `recorded_by_role` and `quantity` defaults;
- concurrent record creation with same `idempotency_key` is handled correctly;
- `period_id` filtering works correctly in role-aware grouping;
- sync performance stays within latency targets.

### Frontend Tests
Add or update tests for:

- role-specific counts are rendered correctly;
- conflicting counts are visible;
- resolved count is used for approval;
- locked summaries display final approved score;
- cancelling approval restores editable projected counts;
- realtime events with new role-aware payload are processed correctly;
- realtime events with legacy payload (backward compatibility) still work;
- `copy-score` utility handles role-specific counts;
- PDF/export utilities render role-specific counts correctly.

## Migration Plan

1. Add new metadata fields to `academic_record` with backward-compatible defaults.
2. Backfill existing records:
   - infer `recorded_by_role` from creator role or request context where possible;
   - default unknown records to `system` or `admin` with a migration note;
   - set `quantity = 1` for count-based records;
   - parse existing `record_title` values and populate structured `action_type` + `payload` fields;
   - keep `record_title` for display/audit but stop using it for score logic after backfill;
   - split existing `source` field: `source: 'manual'` → `source_type: 'manual'`, `source_id: null`; `source: 'daily_report'` → `source_type: 'daily_report'`, `source_id: <daily_report_id>`;
   - map `daily_report_id` → `source_type: 'daily_report'`, `source_id: <daily_report_id>`.
3. Status mapping:
   - `active` → `active` (unchanged);
   - `inactive` → `cancelled` (with migration note);
   - `is_deleted: true` → `cancelled` + `is_deleted: true` (preserve soft-delete flag).
4. Add new indexes for role-aware queries:
   - `{ student_id: 1, semester_id: 1, criterion_id: 1, recorded_by_role: 1, status: 1, is_deleted: 1 }` (covered index for count-by-role queries — replaces `idx_aggregate`);
   - `{ source_type: 1, source_id: 1 }` (source-based lookups);
   - preserve existing `idempotency_key` unique sparse index.
5. Introduce projection calculation without removing existing summary detail fields.
6. Update `/grading/score` to read projection fields while still supporting legacy fields.
7. Move approval to resolved-count/final-score snapshot.
8. Deprecate ambiguous `current_count` usage after UI and APIs support role-specific counts.
9. Deprecate `daily_report_id` field after `source_type` + `source_id` migration is complete.
10. Deprecate `source` string field after `source_type` + `source_id` migration is complete.

### Rollback Plan
If critical issues are found after deployment:

1. New fields are additive — remove from read paths, keep in database.
2. Revert API to read `current_count` instead of `counts_by_role`.
3. Projection layer can be disabled without data loss.
4. `EvaluationDetail.current_count` remains populated during migration phase as the fallback read source.
5. Sync path falls back to title parsing if structured fields are not populated.

## Out of Scope

- Replacing all existing grading screens in one step.
- Changing the business meaning of existing criteria.
- Deleting historical academic records.
- Allowing automatic sync to mutate locked summaries.
- Building a full event streaming platform unless needed later.
- Changing the `EvaluationPeriod` structure or sub-period evaluation flow.
- Modifying the ranking system logic (`rank_tier`, `rank_label` computation rules).
- Reworking the `DailyClassReport` module internals.
- Changing the realtime WebSocket transport protocol (only payload format changes).
- Modifying the reports/export page layout (only data source changes).

## Acceptance Criteria

- `academic_record` is the clear source of truth for scoring occurrences.
- Every record clearly stores who recorded it and where it came from.
- Counts are grouped by recorder role before score calculation.
- The approved count is explicit and auditable.
- Score calculation is centralized and does not depend on scattered UI logic or string parsing.
- Approval freezes a resolved score snapshot without mutating raw records.
- The system can add new record sources without rewriting approval logic.
- The grading UI can explain why a score was calculated from specific records and roles.
- Existing realtime score updates continue to work during and after migration.
- PDF/Excel export renders correctly with new data model.
- `period_id`-based evaluation is preserved and functional.
- Copy-score between students works with role-aware counts.
- No regression in score calculation across all criterion types (`khen_thuong`, `cong_diem`, `ky_luat`) and scoring modes (`count`, `single_option`).
- Sync latency for a single student × criterion update does not exceed current baseline by more than 20%.
- Batch sync performance stays within defined targets.

## Deliverable
A role-aware academic record and scoring design where every student activity is stored as an auditable record, counts are resolved according to who recorded them, and scores are calculated through a centralized projection and score engine before approval freezes the final snapshot. The redesign preserves data integrity, maintains sync performance at scale, and provides a clear rollback path during migration.
