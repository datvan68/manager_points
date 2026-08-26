task: "Allow academic-record deletion after grading is locked"
pipeline: bug_fix
profile: Full
objective: "Authorized users can soft-delete and permanently delete academic records after grading is locked without changing the locked score shown on the student profile."

evidence:
  current_behavior: "backend/src/academic-record/academic-record.service.ts:remove/forceRemove call checkSummaryLocked and return GRADING_SUMMARY_LOCKED before deletion."
  expected_behavior: "Locked grading remains immutable, but its source academic records may be deleted under existing RBAC and daily-report rules."
  root_cause: "AcademicRecordService applies the mutation lock to deletion methods although safeSync already skips locked SummaryPoint documents."

scope:
  inspect: ["backend/src/evaluation-periods/evaluation-periods.service.ts:archiveLockedSnapshots", "backend/src/summaries-point/summaries-point.service.ts:findLatestForStudent"]
  write: ["backend/src/academic-record/academic-record.service.ts:remove/forceRemove", "backend/src/academic-record/academic-record.service.spec.ts:Summary Lock Protection"]
  preserve: ["create, bulkCreate, update, restore, and score-intent lock protection", "hierarchy permissions, daily-report guards, soft/permanent-delete preconditions", "locked SummaryPoint and student.training_point_history profile data"]
  out: ["UI changes", "schema/API changes", "deleting locked summaries or snapshots"]

acceptance_criteria:
  - "AC-01: remove succeeds for a record whose SummaryPoint is locked when existing permission and daily-report checks pass."
  - "AC-02: forceRemove succeeds for an eligible trashed record whose SummaryPoint is locked."
  - "AC-03: either deletion leaves locked SummaryPoint/snapshot values unchanged; profile lookup can still return the locked score."
  - "AC-04: non-delete mutations remain blocked with GRADING_SUMMARY_LOCKED, and existing delete RBAC/report guards remain effective."

execution:
  - "E-01 [AC-01,AC-02,AC-03] academic-record.service.ts:remove/forceRemove -> bypass only the summary-lock rejection; retain safeSync, which ignores locked summaries."
  - "E-02 [AC-01..AC-04] academic-record.service.spec.ts:Summary Lock Protection -> replace deletion-block expectations with successful deletion/unchanged-locked-score regressions; retain mutation-block tests."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix backend test -- academic-record/academic-record.service.spec.ts --runInBand -> focused suite passes."
  - "V-02 [AC-03] npm --prefix backend test -- summaries-point/test/summaries-point.service.spec.ts --runInBand -> locked-summary/snapshot profile tests pass."
  - "V-03 [AC-01..AC-04] npm --prefix backend run build -> Nest build exits 0."

risks: ["Deletion is persistent-data behavior; implementation requires independent review of RBAC and locked-score immutability."]
stop_conditions: ["Stop if deletion requires changing snapshot/summary schemas, weakening RBAC, or deleting daily-report-owned records outside the existing bypass contract."]
