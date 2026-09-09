---
slot_id: "taskscope-03"
generation: 1
task_id: "20260909-081613-student-dormitory-self-service"
scope_file: "docs/task/taskscope-03.md"
status: blocked
scope_revision: 2
created_at: "2026-09-09T08:16:13+07:00"
updated_at: "2026-09-09T15:30:00+07:00"
base_commit: "bba3cc4827b2ed8a291907fffb610facdefcfae2"
task: "Add a room-scoped dormitory interface for resident students"
pipeline: feature_development
profile: Full
objective: "When a linked resident student opens KTX, show only roommates in Danh sách, only the student's assigned room in Phòng, the room's electricity/water invoices, and the student's own room-fee invoices, without exposing other dormitory records or staff mutations."
coordination:
  depends_on:
    - "docs/task/taskscope-01.md generation 1 must be completed or explicitly amended so its student KTX button opens /dormitory instead of /profile."
  warnings:
    - "User-authorized amendment at scope revision 2 temporarily releases the Sidebar reservations; taskscope-03 remains blocked until taskscope-01 is completed or explicitly amended."
    - "The pre-existing deletion of docs/task/taskscope-02.md is unrelated and must be preserved."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "The STUDENT role is seeded without DORM_PAGE; Sidebar requires the /dormitory route mapping and DORM_PAGE; dormitory/layout.tsx guards the whole module with DORM_PAGE and exposes staff-oriented tabs; roster/me is the only student self-service KTX endpoint, while room, roster, utility-invoice, and room-fee list endpoints require broad staff read permissions."
  expected_behavior: "A STUDENT account with a current linked roster/room can enter /dormitory and receives server-filtered read-only data for its own room and identity; an unlinked student is denied, and staff behavior remains unchanged."
  root_cause: null
scope:
  inspect:
    - "backend/src/dormitory/schemas/dormitory-roster-entry.schema.ts"
    - "backend/src/dormitory/schemas/invoice.schema.ts"
    - "backend/src/dormitory/schemas/room-fee-invoice.schema.ts"
    - "backend/src/auth/guards/check-permission.guard.ts"
    - "frontend/src/providers/auth-provider.tsx"
  write:
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts"
    - "backend/src/dormitory/controllers/rooms.controller.ts"
    - "backend/src/dormitory/controllers/invoices.controller.ts"
    - "backend/src/dormitory/controllers/room-fee-invoices.controller.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/rooms.service.ts"
    - "backend/src/dormitory/services/invoices.service.ts"
    - "backend/src/dormitory/services/room-fee-invoices.service.ts"
    - "backend/src/dormitory/controllers/dormitory-permissions.spec.ts"
    - "backend/src/dormitory/controllers/invoices.controller.spec.ts"
    - "backend/src/dormitory/controllers/room-fee-invoices.controller.spec.ts"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/app/(dashboard)/dormitory/layout.tsx"
    - "frontend/src/app/(dashboard)/dormitory/layout.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/buildings/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/buildings/page.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/invoices/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx"
  preserve:
    - "Server authorization derives student_id, current roster_entry_id, and room_id from the authenticated user; client-supplied identity or room filters never widen student access."
    - "Resident students have read-only KTX access except for existing explicitly authorized self-service/payment-proof operations; no staff create, update, delete, assignment, configuration, meter-entry, invoice-generation, review, or bulk controls are exposed."
    - "Staff/admin route permissions, datasets, tab behavior, API response compatibility, invoice calculations, payment states, and realtime behavior remain unchanged."
    - "Only current linked residency grants access; an absent student profile, absent/currently inactive roster, or absent room assignment fails closed without returning dormitory data."
    - "Roommate output is data-minimized to fields required by the member list and excludes private application, contact, financial, history, and disciplinary fields."
  out:
    - "Automatic assignment of DORM_PAGE or staff DORM_* permissions to the global STUDENT role"
    - "Dormitory registration, contracts, violations, maintenance, reports, PDF templates, building lists, other rooms, other students, and administrative invoice/configuration workflows"
    - "Schema migrations, backfills, production data changes, and redesign of staff KTX pages"
acceptance_criteria:
  - "AC-01: A logged-in STUDENT with a current linked roster and assigned room sees the KTX navigation entry and can open /dormitory; an unlinked/unassigned student sees the existing 'Không thuộc KTX' outcome and cannot render any KTX tab data."
  - "AC-02: The resident-student KTX layout shows exactly three tabs—Danh sách, Phòng, Hóa đơn—while staff/admin retain their existing permission-driven tabs and routes."
  - "AC-03: Danh sách returns and renders only current residents assigned to the authenticated student's room, with a minimal member view; direct IDs/query parameters cannot retrieve another room or the full roster."
  - "AC-04: Phòng returns and renders only the authenticated student's assigned room and its beds/occupancy needed by the view; another room ID and the building/room collection remain inaccessible."
  - "AC-05: Hóa đơn > Thu điện nước returns only utility invoices whose room_id is the authenticated student's current room, and Hóa đơn > Thu phí phòng returns only room-fee invoices whose student/roster identity is the authenticated student."
  - "AC-06: Student views hide staff mutation/configuration/bulk/review controls; attempts to call corresponding staff endpoints or access another room/student/invoice receive 403 or 404 and disclose no target data, while authorized staff regression cases still pass."
execution:
  - "E-01 [AC-01, AC-03, AC-04] backend roster/rooms controllers and services -> add authenticated student-self read contracts that resolve the current linked roster and room server-side, return minimal roommates plus own-room detail, and fail closed for unlinked/unassigned or mismatched access."
  - "E-02 [AC-05, AC-06] backend invoice controllers and services -> add authenticated student-self list/detail queries: utility invoices constrained by resolved current room and room-fee invoices constrained by resolved student/roster identity; retain staff guards and mutation endpoints unchanged."
  - "E-03 [AC-01, AC-02] frontend/src/components/layout/Sidebar.tsx and dormitory/layout.tsx -> route a confirmed resident to /dormitory and render the three student tabs without granting broad DORM_PAGE/DORM_* permissions; preserve the existing staff branch."
  - "E-04 [AC-03, AC-04, AC-06] frontend roster/buildings pages and dormitory-api -> select resident-student self endpoints and read-only presentations, remove all staff controls in student mode, and retain existing staff calls/UI."
  - "E-05 [AC-05, AC-06] frontend invoices page and dormitory-api -> load student-scoped utility and room-fee datasets under the existing invoice subviews, hide configuration/generation/review/bulk controls, and allow only already-authorized personal payment interactions if supported by current backend ownership checks."
  - "E-06 [AC-01, AC-03, AC-04, AC-05, AC-06] focused backend tests -> prove current-room/current-student filtering, data minimization, unlinked denial, forged identifier rejection, cross-room/cross-student denial, and unchanged staff access."
  - "E-07 [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06] focused frontend tests -> prove role/membership routing, exact student tabs, scoped rendering, hidden mutations, error states, and staff regressions."
verification:
  - "V-01 [AC-01, AC-03, AC-04, AC-06] npm --prefix backend test -- --runTestsByPath src/dormitory/controllers/dormitory-permissions.spec.ts --runInBand -> student self-scope and negative cross-room cases pass."
  - "V-02 [AC-05, AC-06] npm --prefix backend test -- --runTestsByPath src/dormitory/controllers/invoices.controller.spec.ts src/dormitory/controllers/room-fee-invoices.controller.spec.ts --runInBand -> utility room scope, personal room-fee scope, forged access denial, and staff regressions pass."
  - "V-03 [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06] npm --prefix frontend test -- \"src/components/layout/Sidebar.test.tsx\" \"src/app/(dashboard)/dormitory/layout.test.tsx\" \"src/app/(dashboard)/dormitory/roster/page.test.tsx\" \"src/app/(dashboard)/dormitory/buildings/page.test.tsx\" \"src/app/(dashboard)/dormitory/invoices/page.test.tsx\" -> Vitest exits 0 with resident-student and staff branches passing."
  - "V-04 [AC-01, AC-03, AC-04, AC-05, AC-06] npm --prefix backend run build && npm --prefix frontend run typecheck -> both commands exit 0."
  - "V-05 [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06] In verified dev UI/API, test one resident student, one non-resident student, and two residents in different rooms: verify the three tabs and expected own data, then attempt copied URLs/IDs for the other room/student/invoices and observe denial with no leaked data."
runtime_test:
  environment: development
  targets: "Before interaction, verify effective frontend/API destinations and Mongo/storage targets are development resources isolated from production; stop dependent runtime actions if identity cannot be established."
  resources: "One current resident student with room members and both invoice types, one non-resident/unassigned student, and one resident in another room; use normal login and API/UI reads, with only task-scoped proof/payment writes if an acceptance case requires them."
  scenarios: "Resident opens the exact three tabs and sees same-room/own-room/scoped invoices; non-resident is denied; copied cross-room, cross-student, and cross-invoice identifiers reveal no data; staff account retains current management views."
  cleanup: "Prefer read-only scenarios. Remove only positively identified task-created proof files/records and restore any captured reversible dev state if unchanged by others; retain no personal-data exports or screenshots."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-03.md: user-requested reusable taskscope slot"
risks:
  - "Authorization and personal/financial data scoping are material risks, so the task uses Full and requires an independent review before completion."
  - "Existing staff pages currently consume broad list APIs; student mode must use distinct server-scoped contracts instead of relying on client filters."
  - "Invoice ownership fields mix student, roster-entry, and room identities; implementation must normalize them from the authenticated student's current roster and test each invoice type independently."
stop_conditions:
  - "Stop with TASKSCOPE_CONFLICT until taskscope-01 releases or explicitly changes its Sidebar.tsx reservation and /profile destination."
  - "Stop if product intent would allow former residents, unassigned applicants, room leaders, or one roommate to mutate/pay/review another resident's obligation; those behaviors require an explicit scope decision."
  - "Stop if invoice identity cannot be resolved from authenticated current residency without a schema migration or data backfill; request an approved scope amendment before persistence changes."
  - "Stop runtime testing if dev service/data isolation cannot be proven."
---
