slot_id: "taskscope-01"
generation: 1
task_id: "20260905-105810-dormitory-room-filter-leader-permissions"
scope_file: "docs/task/taskscope-01.md"
status: in_progress
scope_revision: 2
created_at: "2026-09-05T10:58:10+07:00"
updated_at: "2026-09-05T11:24:00+07:00"
base_commit: "f9b267999e8a3ee5e132be9e34edfe58b1c719cb"
task: "Filter the KTX roster by room, manage room leaders, and align visible permissions"
pipeline: feature_development
profile: Full
objective: "Let authorized staff filter the KTX roster by room, select or remove one room leader per assigned room, recognize that leader in the list, and expose UI actions only when their backend permissions and read dependencies are satisfied."

coordination:
  depends_on: []
  warnings:
    - "docs/task/taskscope.md is an empty untracked user file, so slot 00 is reserved and untouched."
    - "The tracked empty docs/task/taskscope-05.md is deleted in the worktree; preserve that unrelated user change."
    - "Implementation and focused verification completed, but V-04 manual UI evidence and the required independent authorization/index/concurrency review are still outstanding; scope remains in_progress."
  reservation_check: "No readable active lifecycle scope reserves the source paths below. taskscope-01.md did not exist immediately before publication. Recheck scope identities, Git status and candidate writes before execution."
  execution_policy: "Planning deliverable only in this turn. Implementation requires the user to pin this exact file. Authorization and persistent-index changes require independent review; any runtime/production index or permission grant requires the Human Gate."

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending:
    - "V-04 manual desktop/mobile UI check with synthetic rooms"
    - "Independent review of RBAC, partial unique index, concurrency and rollback behavior"

evidence:
  current_behavior:
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:DormitoryRosterPage sends only search/page/limit, has no room selector, and renders room assignment under DORM_REG_UPDATE although the bed lookup also requires DORM_ROOM_READ."
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts:findAll and DormitoryRosterService.findAll do not accept/filter room_id; rows already populate room_id."
    - "DormitoryRosterEntry has room_id/bed_id but no leader state. RoomAssignmentService moves or clears assignments without leader semantics."
    - "frontend/src/app/(dashboard)/dormitory/layout.tsx shows the combined Phòng page with DORM_BUILDING_READ alone, while that page immediately calls both DORM_BUILDING_READ and DORM_ROOM_READ endpoints."
    - "Existing DORM_REG_READ/UPDATE, DORM_ROOM_READ and admin bypass permissions are registered and enforced; hidden direct KTX routes still use their backend permission codes and must not be removed merely because they are absent from tabs."
  expected_behavior: "Room-filtered pagination is stable on desktop/mobile; each assigned room has at most one leader with an explicit badge and authorized toggle; visible controls and tabs match every API permission they invoke."
  root_cause: null

scope:
  inspect:
    - "backend/src/dormitory/dormitory.module.ts:model registrations"
    - "backend/src/auth/permissions.registry.ts and backend/src/auth/services/auth.service.ts:declared KTX permissions and default group sync"
    - "backend/src/auth/guards/check-permission.guard.ts:all/any permission semantics and admin bypass"
    - "frontend/src/providers/auth-provider.tsx:hasPermission semantics"
    - "frontend/src/components/dormitory/DormitoryChoicePopover.tsx:existing responsive filter pattern"
    - "frontend/package.json and backend/package.json:verification entrypoints"
  write:
    - "backend/src/dormitory/schemas/dormitory-roster-entry.schema.ts"
    - "backend/src/dormitory/schemas/dormitory-roster-entry.schema.spec.ts"
    - "backend/src/dormitory/dto/set-room-leader.dto.ts"
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts"
    - "backend/src/dormitory/controllers/dormitory-permissions.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.spec.ts"
    - "backend/src/dormitory/services/room-assignment.service.ts"
    - "backend/src/dormitory/services/room-assignment.service.spec.ts"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/api/dormitory-api.test.ts"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/layout.tsx"
    - "frontend/src/app/(dashboard)/dormitory/layout.test.tsx"
  preserve:
    - "Existing DORM_PAGE module gate, admin bypass, public/self-service roster boundaries, granular KTX permission codes and backend guards for hidden/direct routes."
    - "Existing roster search, pagination, mobile infinite loading, selection, PDF, import, identity linking, room/bed assignment, active-contract and rollback behavior."
    - "At most one roster membership per Student/semester; no real student data access, permission grants, automatic leader backfill or leader inference."
    - "API compatibility: room_id and leader fields are additive; callers omitting room_id receive the current unfiltered result shape."
  out:
    - "Production/runtime data access, live index application, permission/role grants, backfill or migration execution."
    - "New KTX tabs, redesign of hidden Contracts/Violations/Maintenance/Reports routes, invoice permission redesign, or removal of backend-used permission codes."
    - "Changing building, room, bed, contract or Student ownership models; selecting leaders who are not currently assigned to a room."

acceptance_criteria:
  - "AC-01: KTX > Danh sách displays a responsive room filter sourced through a DORM_REG_READ-protected roster room-options endpoint. Choosing a room sends its exact room_id on initial, refreshed, paginated and mobile load-more requests; clearing it restores all rooms, resets page/selection, and stale responses cannot replace the active filter. Invalid room_id returns 400; a valid room with no members returns an empty page with correct metadata."
  - "AC-02: A DORM_REG_UPDATE user can mark an assigned roster entry as room leader or remove that role. The backend rejects missing/unassigned entries, never permits more than one is_room_leader=true entry for the same room, replaces the prior leader deterministically, is idempotent for repeated requests, and returns 403 before mutation without DORM_REG_UPDATE."
  - "AC-03: The roster shows an accessible 'Trưởng phòng' badge on the leader row in desktop and mobile presentations, plus permission-gated select/remove controls. Changing leaders refreshes the affected rows without losing the active search, room filter, page or selection; failures retain prior UI state and show an error."
  - "AC-04: Leader status is preserved when only the bed changes inside the same room, but is cleared when the leader changes room, is unassigned, or is deleted. Existing assignment/contract compensation restores the previous leader flag when the assignment itself rolls back. No existing roster entry is promoted automatically."
  - "AC-05: Visible KTX UI permissions match invoked endpoints: roster read/filter/PDF use DORM_REG_READ; create/import use DORM_REG_CREATE; edit/link/reconcile/leader use DORM_REG_UPDATE; delete uses DORM_REG_DELETE; room assignment additionally requires DORM_ROOM_READ; the combined Phòng tab requires both DORM_BUILDING_READ and DORM_ROOM_READ. Admin bypass remains unchanged, and no hidden/backend-used permission code is deleted."
  - "AC-06: The leader field and partial unique room-leader index are backward-compatible for documents without the field. Synthetic tests cover empty rooms, leader replacement, concurrent duplicate attempts, room transfer/unassignment rollback, permission denial, responsive filtering and additive API typing."

execution:
  - "E-01 [AC-02,04,06] dormitory-roster-entry.schema.ts + schema spec -> add optional/default-false is_room_leader and a named partial unique index scoped to assigned room_id + true leader state; prove legacy documents are outside the index."
  - "E-02 [AC-01] dormitory-roster.controller.ts + dormitory-roster.service.ts and service spec -> validate/forward room_id in findAll and add a bounded _id/room_code/room_name room-options read before parameter routes under DORM_REG_READ; retain current search/pagination response shape."
  - "E-03 [AC-02,03,06] new set-room-leader.dto.ts, controller/service and focused specs -> add a boolean leader endpoint under DORM_REG_UPDATE; validate assignment, clear the prior leader and conditionally set the target with duplicate-key/conflict handling and idempotent response."
  - "E-04 [AC-04,06] room-assignment.service.ts + spec -> carry leader state through same-room bed changes, clear it on actual transfer/unassign/delete, and include it in the existing compensating rollback paths."
  - "E-05 [AC-01,02,03,06] dormitory-api.ts + API spec -> add typed room options, room_id query and leader mutation/response fields without changing existing callers."
  - "E-06 [AC-01,03,05] roster/page.tsx + page test -> add desktop/mobile room selector, include the frozen filter in every load path, render leader badge/toggle with confirmation and truthful error state, and require DORM_ROOM_READ in addition to roster permissions for the existing assignment popover."
  - "E-07 [AC-05] dormitory/layout.tsx + layout test and dormitory-permissions.spec.ts -> expose the combined Phòng tab only when both read endpoints are authorized and add a visible-action/backend-guard permission matrix regression test for the changed roster operations; preserve admin bypass and hidden route permissions."
  - "E-08 [AC-01..06] Run focused verification, inspect schema/index and RBAC diffs independently, then review changed paths and record completion evidence before closing the scope."

verification:
  - "V-01 [AC-01,02,04,05,06] npm --prefix backend test -- --runTestsByPath src/dormitory/schemas/dormitory-roster-entry.schema.spec.ts src/dormitory/services/dormitory-roster.service.spec.ts src/dormitory/services/room-assignment.service.spec.ts src/dormitory/controllers/dormitory-permissions.spec.ts --runInBand -> all pass, including invalid room, leader uniqueness/replacement, rollback and 403-before-service cases."
  - "V-02 [AC-01,03,05,06] npm --prefix frontend test -- src/api/dormitory-api.test.ts 'src/app/(dashboard)/dormitory/roster/page.test.tsx' 'src/app/(dashboard)/dormitory/layout.test.tsx' -> all pass; deferred-response cases prove filter reset/stale-request behavior and denied controls."
  - "V-03 [AC-01..06] npm --prefix frontend run typecheck; npm --prefix backend run build -> both exit 0."
  - "V-04 [AC-01,03,05] Synthetic manual UI check at desktop and mobile widths with two rooms: filter/clear, replace/remove leader, denied-permission controls and failed mutation; no real student records."
  - "V-05 [AC-01..06] git diff --check -- backend/src/dormitory frontend/src/api/dormitory-api.ts 'frontend/src/app/(dashboard)/dormitory' docs/task/taskscope-01.md; final changed-path/AC review -> no whitespace errors, unintended writes or unresolved independent-review findings."

temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"

risks:
  - "High: authorization visibility and a persistent unique index change. Code and synthetic checks are authorized by the scope; production index creation or permission grants are not."
  - "Concurrent leader replacement spans multiple documents. The unique partial index is the final invariant; service compensation must never report success after a partial failure."
  - "Room transfer has existing multi-document compensation. Losing/restoring leader state must be tested together with bed and contract rollback."

stop_conditions:
  - "TASKSCOPE_PIN_* / TASKSCOPE_CONFLICT, changed scope identity, overlapping active reservation, or unknown dirty change on a named write path: stop before mutation."
  - "A product decision to allow multiple/co-leaders, leaders without an assigned bed, or a dedicated permission code changes behavior/IAM and requires a scope amendment."
  - "Any need to modify existing live documents/indexes, grant/revoke role permissions, or run against production requires the Human Gate; do not substitute startup auto-indexing for an approved migration."
  - "Do not complete without an independent review of authorization, partial unique-index semantics and concurrent/rollback behavior; if no authorized reviewer is available, leave the scope incomplete and report the blocker."
