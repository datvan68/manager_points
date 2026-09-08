---
slot_id: "taskscope-02"
generation: 1
task_id: "20260908-145657-mark-dormitory-room-leader"
scope_file: "docs/task/taskscope-02.md"
status: blocked
scope_revision: 3
created_at: "2026-09-08T14:56:57+07:00"
updated_at: "2026-09-08T15:03:19+07:00"
base_commit: "a92c87d0d98c088ddb0d917ff6fbfbd65c818048"
task: "Mark the room leader in the dormitory member list"
pipeline: feature_development
profile: Full
risk: medium
environment: development
objective: "In the dormitory overview room-members dialog, visibly and accessibly identify the member whose roster entry is the room leader, while leaving ordinary members and the empty state unchanged."
coordination:
  depends_on: []
  warnings:
    - "docs/task/taskscope.md is an unmigrated zero-byte legacy file; slot 00 remains reserved and untouched."
    - "The additive dashboard response-field change requires an independent compatibility review before this scope may be completed; reviewer availability is not established during planning."
    - "V-04 is blocked: the dev API returns 401 and the current localhost overview session does not expose usable room data for read-only leader verification."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths:
    - "backend/src/dormitory/services/dormitory-reports.service.ts"
    - "backend/src/dormitory/services/dormitory-reports.service.spec.ts"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/app/(dashboard)/dormitory/overview/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx"
  checks_passed:
    - "V-01: focused backend report-service tests passed (4/4)."
    - "V-02: focused frontend overview tests passed (14/14)."
    - "V-03: frontend typecheck and backend build passed."
    - "V-05 partial: git diff --check passed and scoped diff contains only the five approved write paths."
  cleanup_pending: []
evidence:
  current_behavior: "backend/src/dormitory/services/dormitory-reports.service.ts:getDashboardStats maps each room member to only full_name and class_name; frontend/src/app/(dashboard)/dormitory/overview/page.tsx renders those two values, so is_room_leader from the canonical roster entry is unavailable and no leader marker appears."
  expected_behavior: "The existing dashboard endpoint additively exposes is_room_leader for every room member and the overview dialog renders a clear 'Trưởng phòng' marker only for the true member."
  root_cause: null
scope:
  inspect:
    - "backend/src/dormitory/schemas/dormitory-roster-entry.schema.ts"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "backend/src/dormitory/controllers/dormitory-reports.controller.ts"
  write:
    - "backend/src/dormitory/services/dormitory-reports.service.ts"
    - "backend/src/dormitory/services/dormitory-reports.service.spec.ts"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/app/(dashboard)/dormitory/overview/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx"
  preserve:
    - "The dashboard route, authorization, caching, room/member selection, roster-to-room mapping, fallback names/classes, and deduplication behavior remain unchanged."
    - "The response change is additive: existing full_name and class_name fields retain their names and meanings; is_room_leader is always normalized to a boolean."
    - "Only the member with is_room_leader=true receives the marker; ordinary members and rooms without members retain their existing presentation."
  out:
    - "Changing who is room leader, roster assignment rules, schemas/indexes, permissions, database data, other dormitory screens, dependency installation, commit/push/deployment, and production testing."
acceptance_criteria:
  - "AC-01: GET /dormitory/reports/dashboard returns is_room_leader=true for the mapped leader and false for every mapped non-leader without changing member deduplication or existing fields."
  - "AC-02: Opening a populated room in the dormitory overview shows an accessible 'Trưởng phòng' marker next to exactly the member whose is_room_leader value is true, and shows no such marker when all values are false."
  - "AC-03: The existing class-name fallback, dialog close behavior, and empty-room message remain unchanged."
execution:
  - "E-01 [AC-01] backend/src/dormitory/services/dormitory-reports.service.ts:getDashboardStats -> include Boolean(roster.is_room_leader) in the deduplicated member object, preserving all current room-resolution and fallback logic."
  - "E-02 [AC-01] backend/src/dormitory/services/dormitory-reports.service.spec.ts -> extend the canonical member-mapping case with leader and non-leader roster entries and assert the exact additive response shape plus unchanged deduplication."
  - "E-03 [AC-01,AC-02] frontend/src/api/dormitory-api.ts:DormitoryRoomMember -> add the normalized is_room_leader boolean to the typed dashboard contract."
  - "E-04 [AC-02,AC-03] frontend/src/app/(dashboard)/dormitory/overview/page.tsx -> reuse the established amber 'Trưởng phòng' badge treatment from the roster page beside the member name, with an accessible label, only when the flag is true."
  - "E-05 [AC-02,AC-03] frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx -> cover one leader among ordinary members, an all-non-leader room, existing class fallback, empty state, and dialog closing."
verification:
  - "V-01 [AC-01] npm --prefix backend test -- --runTestsByPath \"src/dormitory/services/dormitory-reports.service.spec.ts\" --runInBand -> focused report-service tests pass and assert both boolean values."
  - "V-02 [AC-02,AC-03] npm --prefix frontend test -- \"src/app/(dashboard)/dormitory/overview/page.test.tsx\" -> focused overview tests pass with exactly one accessible leader marker in the positive case and none in the negative case."
  - "V-03 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck; npm --prefix backend run build -> both affected packages compile successfully."
  - "V-04 [AC-01,AC-02,AC-03] Verified dev UI/API after confirming non-production destinations: open a room with an existing leader and a room without one -> API booleans and visible markers agree, existing dialog/empty states work, and no persistent data is changed."
  - "V-05 [AC-01,AC-02,AC-03] Independent compatibility review plus git diff --check on all five write paths and scoped diff/status inspection -> additive contract is approved and no unrelated or whitespace changes are present."
runtime_test:
  targets: "Before runtime verification, establish from non-secret metadata that the effective frontend, API, database, cache, and realtime destinations are development resources isolated from production."
  resources: "Existing read-only dormitory dashboard data for one room with a configured leader and one room without a leader; do not expose member details beyond the visible task-scoped evidence."
  operations: "Read-only dashboard API request, room search, member-dialog open/close, and accessibility/console inspection; do not change roster, leader, assignment, role, or persistent data."
  scenarios:
    - "Open a populated room with one configured leader and confirm exactly that member is marked 'Trưởng phòng'."
    - "Open a room with no configured leader and confirm no leader marker appears; if available, also verify the existing empty-room state."
  cleanup: "Close the dialog and return to the starting route; no persistent data mutation or cleanup is expected."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-02.md: user-requested reusable taskscope slot"
risks:
  - "If is_room_leader is omitted or left nullable, the UI can misidentify a leader and consumers receive an inconsistent member shape."
  - "The dashboard response is a shared public frontend/backend contract, so the additive field needs independent compatibility review before completion."
stop_conditions:
  - "Apply the exact-file pin, identity, reservation, Git freshness, and release-boundary checks before execution."
  - "Stop on any overlapping active reservation or unknown change in a write path; do not overwrite unrelated work."
  - "Stop dependent runtime checks if development isolation cannot be proven or suitable read-only leader data is unavailable; record the unmet scenario instead of mutating data."
  - "Do not mark the scope completed until the required independent compatibility review is available and passes."
blocker: "Independent compatibility review is unavailable, and V-04 cannot run because the dev API returns 401 without an authenticated usable room-data session. Resume this exact scope after both prerequisites are available."
---
