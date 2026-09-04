slot_id: "taskscope-01"
generation: 2
task_id: "20260904-102054-fix-roster-import-optional-assignment-service"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 1
created_at: "2026-09-04T10:20:54+07:00"
updated_at: "2026-09-04T10:26:38+07:00"
base_commit: "c6aea998a872371cffec4a3c8fa6a2912476a089"
task: "Fix optional room-assignment service narrowing in roster import"
pipeline: bug_fix
profile: Quick
objective: "The backend watch build compiles while preserving existing room-capacity validation, bed assignment, and compensation deletion for imported roster rows."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-04T10:26:38+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree retains the user's existing docs/task/taskscope.md change; scoped implementation is complete."
  changed_paths: ["backend/src/dormitory/services/dormitory-roster.service.ts"]
  checks_passed: ["npm --prefix backend test -- dormitory/services/dormitory-roster.service.spec.ts --runInBand", "npm --prefix backend run build"]
  cleanup_pending: []

evidence:
  current_behavior: "backend/src/dormitory/services/dormitory-roster.service.ts:290 calls optional this.roomAssignmentService after awaiting roster save; TypeScript reports TS2532."
  expected_behavior: "importRows captures a narrowed local assignment service before the save await and the build accepts the subsequent bed-assignment call."
  root_cause: "Control-flow narrowing of an optional instance property does not survive the intervening await."

scope:
  inspect: ["backend/src/dormitory/services/dormitory-roster.service.ts:importRows assignment branch", "backend/src/dormitory/services/dormitory-roster.service.spec.ts:import room-code coverage"]
  write: ["backend/src/dormitory/services/dormitory-roster.service.ts:importRows optional roomAssignmentService use"]
  preserve: ["ServiceUnavailableException when an import requests a room but the service is unavailable", "validateImportCapacity before saving grouped rows", "assignFirstAvailableBed and findByIdAndDelete compensation behavior", "Bulk-delete implementation and all API contracts"]
  out: ["Room assignment algorithm changes", "Bulk-delete changes", "DTO/schema/dependency changes", "Test rewrites unless the focused test exposes a regression"]

acceptance_criteria:
  - "AC-01: TypeScript no longer reports TS2532 at importRows bed assignment."
  - "AC-02: A row with room_code still rejects when no assignment service is available and otherwise invokes assignFirstAvailableBed after save."
  - "AC-03: Capacity validation and compensation deletion continue to pass their existing focused tests."

execution:
  - "E-01 [AC-01, AC-02] backend/src/dormitory/services/dormitory-roster.service.ts:importRows → capture roomAssignmentService in a local constant, guard it before await, and use the narrowed constant for bed assignment."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-02, AC-03] npm --prefix backend test -- dormitory/services/dormitory-roster.service.spec.ts --runInBand → roster import tests pass."
  - "V-02 [AC-01] npm --prefix backend run build → Nest compilation succeeds without TS2532."

risks: []
stop_conditions: ["The active taskscope reservation remains unresolved.", "The fix requires changing room-assignment behavior, DTOs, schemas, or contracts."]
