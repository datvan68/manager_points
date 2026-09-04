slot_id: "taskscope-01"
generation: 3
task_id: "20260904-103753-release-bed-on-roster-deletion"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 1
created_at: "2026-09-04T10:37:53+07:00"
updated_at: "2026-09-04T10:52:00+07:00"
base_commit: "fde261035686e7d52cc302994ae29a98b9b3a5e1"
task: "Release assigned beds when deleting dormitory roster entries"
pipeline: bug_fix
profile: Full
objective: "Deleting one or more Dormitory Roster entries succeeds without contract-reference blocking and leaves each released occupied bed in status `Trống`."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-04T10:52:00+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree contains the scoped implementation and tests; no commit was requested."
  changed_paths: ["backend/src/dormitory/services/dormitory-roster.service.ts", "backend/src/dormitory/services/room-assignment.service.ts", "backend/src/dormitory/services/dormitory-roster.service.spec.ts", "backend/src/dormitory/services/room-assignment.service.spec.ts"]
  checks_passed: ["npm --prefix backend test -- dormitory/services/dormitory-roster.service.spec.ts --runInBand", "npm --prefix backend test -- dormitory/services/room-assignment.service.spec.ts --runInBand", "npm --prefix backend run build", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "backend/src/dormitory/services/dormitory-roster.service.ts:remove and bulkRemove reject entries referenced by Contract, then delete roster documents without changing Bed.status."
  expected_behavior: "Roster deletion does not query or block on Contract references; any assigned occupied bed is atomically or compensatingly released to `Trống` and room availability is refreshed."
  root_cause: "Deletion owns neither the assigned Bed state nor room availability, while its contract-reference guard reflects a removed product feature."

scope:
  inspect: ["backend/src/dormitory/services/dormitory-roster.service.ts:remove, bulkRemove", "backend/src/dormitory/services/room-assignment.service.ts:unassignRoom and bed/room compensation conventions", "backend/src/dormitory/services/dormitory-roster.service.spec.ts:deletion coverage", "backend/src/dormitory/services/room-assignment.service.spec.ts:bed-release coverage"]
  write: ["backend/src/dormitory/services/dormitory-roster.service.ts:remove and bulkRemove", "backend/src/dormitory/services/room-assignment.service.ts:roster-deletion bed-release helper", "backend/src/dormitory/services/dormitory-roster.service.spec.ts:single and bulk deletion expectations", "backend/src/dormitory/services/room-assignment.service.spec.ts:release/compensation regression coverage"]
  preserve: ["DORM_REG_DELETE authorization", "invalid, duplicate, and not-found bulk result reporting", "non-assigned roster deletion", "bed statuses Bảo trì and Đã nghỉ", "room availability projections and overview invalidation"]
  out: ["Removing Contract schema, APIs, or historical data", "Changing non-deletion contract behavior", "Database migration", "Frontend redesign"]

acceptance_criteria:
  - "AC-01: Deleting a roster entry with an assigned bed no longer checks Contract and changes its `Đang sử dụng` bed to `Trống`, clears the assignment, refreshes the affected room, and emits the existing invalidation."
  - "AC-02: Bulk deletion applies AC-01 to every existing selected entry; Contract references never produce `blocked` results, while invalid and not-found IDs retain their categorized results."
  - "AC-03: If a release or deletion step fails, compensation does not leave a roster entry pointing at a free bed or a deleted entry with an occupied bed."
  - "AC-04: Entries without an assigned bed remain deletable and existing permission/API routes remain unchanged."

execution:
  - "E-01 [AC-01, AC-03, AC-04] backend/src/dormitory/services/room-assignment.service.ts → add a deletion-specific operation that conditionally detaches an assigned roster entry, changes only an occupied bed to `Trống`, syncs its room, and restores both assignment and bed state when a later required step fails."
  - "E-02 [AC-01, AC-02, AC-04] backend/src/dormitory/services/dormitory-roster.service.ts → remove Contract-reference checks from remove/bulkRemove and delegate each existing entry deletion to the bed-release operation; retain existing bulk input/result semantics except `blocked` is always empty."
  - "E-03 [AC-01, AC-02, AC-03, AC-04] backend/src/dormitory/services/dormitory-roster.service.spec.ts and backend/src/dormitory/services/room-assignment.service.spec.ts → replace contract-block assertions with release, bulk, no-bed, and compensation assertions."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01, AC-02, AC-04] npm --prefix backend test -- dormitory/services/dormitory-roster.service.spec.ts --runInBand → roster deletion tests pass."
  - "V-02 [AC-01, AC-03] npm --prefix backend test -- dormitory/services/room-assignment.service.spec.ts --runInBand → release and compensation tests pass."
  - "V-03 [AC-01, AC-02, AC-03, AC-04] npm --prefix backend run build → Nest compilation succeeds."

risks: ["The roster and bed collections are updated separately; failure handling must preserve their one-to-one occupancy invariant."]
stop_conditions: ["The change requires deleting or migrating existing Contract records.", "The existing service/spec conventions cannot provide compensating restoration without an API, schema, or transaction change.", "Another active taskscope reserves a target path before execution begins."]
