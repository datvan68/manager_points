task: "Restore finalized training-score history and activate the new semester"
pipeline: bug_fix
profile: Full
objective: "Student profiles show every finalized semester score, including an inactive old semester, while exactly one newly selected semester is active."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/[classId]/[id]/page.tsx renders only student.training_point_history; existing finalized semesters can therefore show an empty state. backend/src/semesters/semesters.service.ts creates/updates status independently, allowing the old semester to remain active or multiple active semesters."
  expected_behavior: "Locked scores from closed periods are stored once in training_point_history and remain visible after their semester becomes inactive; activating the new semester deactivates every previous active semester."
  root_cause: "backend/src/evaluation-periods/evaluation-periods.service.ts:archiveLockedSnapshots runs only on a new transition to closed, so already-closed periods are not backfilled; SemestersService has no single-active invariant."

scope:
  inspect: ["backend/src/summaries-point/schemas/summary-point.schema.ts:locked score fields", "frontend/src/app/(dashboard)/students/[classId]/[id]/page.tsx:archived score cards"]
  write: ["backend/src/evaluation-periods/evaluation-periods.service.ts:archiveLockedSnapshots", "backend/src/evaluation-periods/evaluation-periods.service.spec.ts", "backend/src/semesters/semesters.service.ts:create/update", "backend/src/semesters/semesters.service.spec.ts", "backend/scripts/backfill-training-point-history.ts", "backend/package.json:migration scripts"]
  preserve: ["closed-period validation", "historical semester status", "snapshot values and locked_at", "semester CRUD routes and RBAC"]
  out: ["redesigning the student profile card", "deleting summaries", "automatic date-based semester activation"]

acceptance_criteria:
  - "AC-01: Closing a period idempotently upserts one snapshot per student+period; an inactive semester snapshot remains available to the profile."
  - "AC-02: Dry-run reports missing/mismatched snapshots for existing closed periods without writing; execute repairs only eligible locked summaries and is rerunnable without duplicates."
  - "AC-03: Creating or updating semester B as active changes every other active semester to inactive and leaves exactly B active."

execution:
  - "E-01 [AC-01] Make snapshot persistence an idempotent upsert and add service regression coverage."
  - "E-02 [AC-02] Add dry-run/execute backfill with counts for scanned, repaired, skipped, and mismatched records; require explicit --execute."
  - "E-03 [AC-03] Enforce the single-active invariant in SemestersService and test create/update transitions."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01] npm --prefix backend test -- evaluation-periods/evaluation-periods.service.spec.ts --runInBand -> pass"
  - "V-02 [AC-03] npm --prefix backend test -- semesters/semesters.service.spec.ts --runInBand -> pass"
  - "V-03 [AC-02] npm --prefix backend run migration:training-point-history:dry-run -> zero writes and deterministic counts"
  - "V-04 [AC-01,AC-02,AC-03] npm --prefix backend run build -> pass"

risks: ["Backfill changes persistent student history; mismatched snapshots must be reported, not overwritten.", "Concurrent semester updates require transaction/session support or a stop for a safe uniqueness design."]
stop_conditions: ["Human approval is required before running backfill with --execute.", "Stop if locked summaries are missing required semester/period/student identifiers or multiple snapshots disagree with finalized scores."]
