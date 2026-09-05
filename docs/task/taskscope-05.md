slot_id: "taskscope-05"
generation: 1
task_id: "20260905-101448-fix-roster-dob-timezone-reconciliation"
scope_file: "docs/task/taskscope-05.md"
status: blocked
scope_revision: 1
created_at: "2026-09-05T10:14:48+07:00"
updated_at: "2026-09-05T10:14:48+07:00"
base_commit: "1b24a6ad383af26554954fbcd6315db0a2d695c3"
task: "Fix date-of-birth timezone drift in KTX linking and exact reconciliation"
pipeline: bugfix
profile: Full
environment: development
risk_level: high
objective: "Treat date of birth as a Vietnamese calendar date throughout student import, KTX identity matching, recommendation scoring, and the manual-link table so an unchanged 12/03/2004 is displayed and matched as 12/03/2004 regardless of process or browser timezone."

coordination:
  depends_on:
    - "20260905-094605-add-ranked-roster-student-suggestions must be completed or cancelled and its reservations released before this task starts."
  warnings:
    - "Date of birth is personal data. Do not log row identities, birth dates, candidate lists, or audit samples."
    - "Correctness means preserving the source calendar day; it does not authorize guessing or rewriting genuinely corrupt source values."
  blocker: "TASKSCOPE_CONFLICT: docs/task/taskscope-04.md generation 3 is still in_progress and reserves backend/src/dormitory/services/dormitory-roster-link-ranking.ts, backend/src/dormitory/services/dormitory-roster-link-ranking.spec.ts, backend/src/dormitory/services/dormitory-roster.service.ts, backend/src/dormitory/services/dormitory-roster.service.spec.ts, frontend/src/components/dormitory/RosterStudentLinkModal.tsx, and frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx."
  reservation_check: "Saved as blocked in the next unused slot because no terminal slot exists and the required write paths overlap active taskscope-04 generation 3."

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []

evidence:
  current_behavior:
    - "Student spreadsheet import parses DD/MM/YYYY with new Date(y, m, d), so 12/03/2004 on a Vietnam-time process is persisted as the instant 2004-03-11T17:00:00.000Z."
    - "The class list formats that instant with local getDate/getMonth/getFullYear and displays 12/03/2004, while the KTX ranking helper uses toISOString().slice(0, 10) and returns 2004-03-11."
    - "RosterStudentLinkModal converts the returned value through a UTC Date before locale formatting; the affected row therefore shows 11/03/2004."
    - "DormitoryRosterIdentityService also builds exact identity keys and query ranges from UTC dates, so a KTX date stored as 2004-03-12T00:00:00.000Z does not match a legacy student instant at 2004-03-11T17:00:00.000Z. The same real birth date can become UNLINKED/skipped."
    - "The observed 94/100 result is consistent with an exact normalized name (70 points) plus a false one-day DOB distance (24 points), instead of DOB_EXACT and 100/100."
  expected_behavior: "For every supported representation of the same Vietnamese birth date, the class list, KTX source identity, candidate row, exact matcher, and ranking helper resolve one identical YYYY-MM-DD key; exact-name/exact-DOB candidates link under existing uniqueness rules and score 100 with DOB_EXACT."
  gap: "Date-only values are represented as instants and interpreted inconsistently as local time or UTC; tests cover plain YYYY-MM-DD strings but not legacy local-midnight Mongo Date values."

date_only_contract:
  zone: "Asia/Ho_Chi_Minh"
  wire_format: "YYYY-MM-DD"
  rules:
    - "An exact YYYY-MM-DD input is a literal calendar date and must never be shifted through a browser/process timezone."
    - "A Date or ISO timestamp is converted to its Asia/Ho_Chi_Minh calendar date. Both 2004-03-11T17:00:00.000Z (legacy local midnight) and 2004-03-12T00:00:00.000Z (canonical UTC midnight) resolve to 2004-03-12."
    - "New student spreadsheet imports store validated date-only values canonically at UTC midnight. Invalid rollovers such as 31/02/2004 remain rejected."
    - "MongoDB exact-day lookup uses the Asia/Ho_Chi_Minh day boundary [local midnight, next local midnight), which includes supported legacy and canonical instants for that calendar date."
    - "Frontend display formats the validated YYYY-MM-DD components directly as DD/MM/YYYY; it must not construct a Date for candidate-row rendering."

scope:
  inspect:
    - "backend/src/students/students.service.ts:student spreadsheet DOB parsing"
    - "backend/src/dormitory/services/dormitory-roster.service.ts:KTX DOB parsing, import matching, candidate projection"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.ts:date keys, day ranges, exact reconciliation"
    - "backend/src/dormitory/services/dormitory-roster-link-ranking.ts:calendar-date output and DOB distance"
    - "frontend/src/app/(dashboard)/students/[classId]/page.tsx:current class-list DOB semantics used as the comparison baseline"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx:candidate DOB rendering"
  write:
    - "backend/src/dormitory/services/dormitory-calendar-date.ts (new pure helper)"
    - "backend/src/dormitory/services/dormitory-calendar-date.spec.ts (new)"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.ts"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster-link-ranking.ts"
    - "backend/src/dormitory/services/dormitory-roster-link-ranking.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.spec.ts"
    - "backend/src/students/students.service.ts"
    - "backend/src/students/test/students.service.spec.ts"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx"
  preserve:
    - "Existing Student and DormitoryRosterEntry Date schema fields and persisted documents remain compatible; no destructive migration or bulk DOB rewrite is permitted."
    - "Exact matching still requires normalized full name plus exact calendar DOB and exactly one eligible Studying student with an existing class."
    - "Same-semester duplicate protection, CONFLICT behavior, optimistic update protection, DORM_REG_UPDATE authorization, pagination, and explicit manual confirmation remain unchanged."
    - "A true one-day difference remains DOB_NEAR and must not be promoted to DOB_EXACT."
    - "Manual linking by student_id remains available for ambiguous or genuinely inconsistent identities."
  out:
    - "Changing names, classes, semesters, gender matching, recommendation weights/thresholds, schema types, unrelated date fields, direct production-database access, or automatic correction of uncertain historical DOB values."

acceptance_criteria:
  - "AC-01: Given a student DOB stored as 2004-03-11T17:00:00.000Z and a KTX DOB representing 2004-03-12, exact reconciliation treats both as 2004-03-12 and returns LINKED when there is exactly one otherwise-eligible match."
  - "AC-02: The same record is returned by the candidate endpoint as date_bir=2004-03-12, scores 100/100 for an exact normalized name, and includes DOB_EXACT rather than DOB_NEAR."
  - "AC-03: The `Ngày sinh / Lớp` cell displays 12/03/2004 for date_bir=2004-03-12 in at least UTC-08:00, UTC, and Asia/Ho_Chi_Minh test environments; no browser Date conversion is used."
  - "AC-04: Student spreadsheet import of 12/03/2004 produces the canonical persisted instant 2004-03-12T00:00:00.000Z independent of server timezone, while invalid dates are rejected."
  - "AC-05: Existing canonical UTC-midnight records and legacy Vietnam-local-midnight records resolve to the same calendar key without rewriting stored DOB data; a real 11/03/2004 remains distinct from 12/03/2004."
  - "AC-06: Bulk import/reconcile and per-student reconciliation use the same helper and corrected day range; unmatched historical entries can be reprocessed through the existing guarded reconcile workflow."
  - "AC-07: Ambiguous matches remain CONFLICT, same-semester duplicates remain blocked, no candidate is auto-selected, and no DOB/identity values are added to logs."

execution:
  - "E-01 [AC-01,02,04,05,06] Add a dependency-free pure calendar-date helper for literal parsing, Asia/Ho_Chi_Minh extraction, canonical UTC storage, validated DD/MM/YYYY parsing, and Mongo day ranges."
  - "E-02 [AC-01,05,06,07] Replace duplicated UTC dateKey/dateRange/sameDate behavior in DormitoryRosterIdentityService and the KTX import fallback with the shared helper. Keep exact-name and uniqueness rules unchanged."
  - "E-03 [AC-02,05,07] Use the same calendar key in ranking output and DOB-distance scoring so equivalent historical/canonical instants are exact and genuinely different days retain their distance."
  - "E-04 [AC-04,05] Canonicalize the student spreadsheet DD/MM/YYYY parser to UTC midnight with strict component validation; do not modify existing documents."
  - "E-05 [AC-03] Format the candidate wire value by validated components in RosterStudentLinkModal and add a regression that proves 2004-03-12 renders as 12/03/2004 without timezone dependence."
  - "E-06 [AC-01..07] Add focused regressions using explicit 2004-03-11T17:00:00.000Z, 2004-03-12T00:00:00.000Z, and true adjacent-day fixtures across import, batch reconcile, per-student reconcile, ranking, and UI display."

verification:
  - "V-01 [AC-01,02,05,06,07] npm --prefix backend test -- --runInBand dormitory/services/dormitory-calendar-date.spec.ts dormitory/services/dormitory-roster-identity.service.spec.ts dormitory/services/dormitory-roster-link-ranking.spec.ts dormitory/services/dormitory-roster.service.spec.ts -> legacy/canonical equivalence, exact link/score, true adjacent day, ambiguity, and duplicates pass."
  - "V-02 [AC-04,05] npm --prefix backend test -- --runInBand students/test/students.service.spec.ts -> strict DD/MM/YYYY parsing and canonical UTC persistence pass with explicit timezone-independent expectations."
  - "V-03 [AC-03] npm --prefix frontend test -- src/components/dormitory/RosterStudentLinkModal.test.tsx -> exact DD/MM/YYYY rendering and existing selection/accessibility behavior pass."
  - "V-04 [AC-01..07] npm --prefix backend run build && npm --prefix frontend run build -> both builds exit 0."
  - "V-05 [AC-01,02,03,06] Manual development check with an anonymized fixture equivalent to the reported case: class list and candidate row both show 12/03/2004, recommendation is 100/100 with `Trùng ngày sinh`, and guarded reconcile links it."
  - "V-06 [AC-01..07] git diff --check -- all scope.write paths docs/task/taskscope-05.md -> exits 0."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-05.md: user-requested taskscope"]

risks:
  - "A date-only schema backed by BSON Date is inherently timezone-sensitive; one explicit domain timezone and date-only wire contract must be used consistently."
  - "Broadening a query window incorrectly could link a true adjacent-day student; boundary and negative tests are mandatory before enabling reconcile."
  - "Historical values with arbitrary times outside the supported legacy/canonical representations cannot be corrected safely without source evidence and must remain unmatched for manual review."

stop_conditions:
  - "taskscope-04 generation 3 remains active or any required path has another writer reservation: remain blocked and do not mutate implementation files."
  - "The required domain timezone is not Asia/Ho_Chi_Minh, or current source data uses multiple intended timezones: stop and amend the date-only contract before implementation."
  - "A correct fix would require guessing or bulk rewriting historical birth dates, changing schema types, weakening exact-match/duplicate/RBAC rules, or accessing production data: stop for explicit authorization and a separate migration plan."
