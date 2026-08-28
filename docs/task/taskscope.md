task: "Create an independent class report for every new submission"
pipeline: bug_fix
profile: Full
objective: "Every new submission in the Class Situation flow creates a distinct DailyClassReport and linked academic records without overwriting an earlier report; explicit edit mode continues to update only the selected report."

evidence:
  current_behavior: "frontend/src/components/grading/AddClassReportView.tsx:resolveDailyReportForClass queries by class/day and calls updateDailyClassReport for a match or after HTTP 409; backend/src/daily-class-report/schemas/daily-class-report.schema.ts:uq_class_date uniquely constrains class_id + report_date."
  expected_behavior: "New mode always creates one report per selected class per submission, including multiple submissions for the same class/date; edit mode remains the only update path."
  root_cause: "The frontend implements class/day upsert semantics and MongoDB rejects a second class/day document through uq_class_date."

scope:
  inspect: ["frontend/src/components/grading/AddClassReportView.tsx:handleSave reportToEdit/new-mode split", "backend/src/daily-class-report/daily-class-report.service.ts:create/importClassRecords duplicate handling"]
  write: ["frontend/src/components/grading/AddClassReportView.tsx:resolveDailyReportForClass and new-mode save", "frontend/src/components/grading/AddClassReportView.test.tsx:daily report resolution regressions", "backend/src/daily-class-report/schemas/daily-class-report.schema.ts:class/date index", "backend/scripts/migrate-daily-class-report-class-date-index.ts:index migration", "backend/src/daily-class-report/daily-class-report-index-migration.spec.ts:migration plan/apply tests", "backend/package.json:migration scripts"]
  preserve: ["RBAC and reported_by assignment", "reportToEdit update behavior and old linked-record replacement", "one report per selected class within a submission", "import file duplicate detection", "DailyClassReport and AcademicRecord API payloads/relations", "soft delete, restore, and permanent delete semantics"]
  out: ["merging or deleting existing reports", "backfilling existing data", "changing academic score rules", "executing the production index migration"]

acceptance_criteria:
  - "AC-01: Submitting new data twice for the same class/date calls createDailyClassReport twice and produces different report IDs; no lookup/update of the earlier report occurs."
  - "AC-02: Academic records created by a new submission reference its newly created daily_report_id; records linked to earlier reports remain unchanged."
  - "AC-03: Opening an existing report in edit mode still updates that report ID and replaces only its linked academic records."
  - "AC-04: The declared and deployed class/date index is non-unique; an idempotent dry-run-first migration reports and replaces uq_class_date without changing report documents."
  - "AC-05: Import retains its current duplicate-row/existing class-date policy despite the database index becoming non-unique."

execution:
  - "E-01 [AC-01,AC-02] frontend/src/components/grading/AddClassReportView.tsx:resolveDailyReportForClass/new-mode handleSave -> remove class/day lookup, conflict-to-update recovery, and unused ApiError dependency; create once per selected class and map each returned ID to its new academic records."
  - "E-02 [AC-01..AC-03] frontend/src/components/grading/AddClassReportView.test.tsx:daily report resolution -> replace upsert assertions with repeated-create, distinct-ID, no-update, and explicit-edit preservation regressions."
  - "E-03 [AC-04] backend/src/daily-class-report/schemas/daily-class-report.schema.ts:DailyClassReportSchema.index -> replace uq_class_date with a named non-unique class/date index."
  - "E-04 [AC-04] backend/scripts/migrate-daily-class-report-class-date-index.ts + backend/package.json -> add idempotent dry-run/execute commands that inspect exact index definitions, drop uq_class_date only in execute mode, and create the non-unique replacement without document writes."
  - "E-05 [AC-04,AC-05] backend/src/daily-class-report/daily-class-report-index-migration.spec.ts -> prove dry-run performs zero writes, execute replaces only the targeted index, reruns are no-ops, and incompatible index state stops safely."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx -> focused suite passes."
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-04,AC-05] npm --prefix backend test -- daily-class-report/daily-class-report-index-migration.spec.ts daily-class-report/daily-class-report.service.spec.ts --runInBand -> focused suites pass."
  - "V-04 [AC-04] npm --prefix backend run build -> exits 0."
  - "V-05 [AC-01..AC-03] Manual development check: submit two new reports for one class/date, then edit one -> table shows two report IDs and only the edited row/linked records change."

risks: ["Dropping a unique database index changes persistent-data concurrency guarantees and requires independent review plus a Human Gate before execute-mode migration.", "Recreating the class/date index as non-unique is required to preserve query performance."]
stop_conditions: ["Stop if multiple same-day reports require aggregation or ordering rules not represented by current report IDs.", "Stop if the live index differs from uq_class_date or a conflicting class/date index exists.", "Do not run the execute-mode index migration without explicit environment-specific approval and a reviewed dry-run result."]
