slot_id: "taskscope-00"
generation: 22
task_id: "20260903-143337-compact-dormitory-room-mobile-status"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T14:33:37+07:00"
updated_at: "2026-09-03T14:36:26+07:00"
base_commit: "f736dcb471d110315cfac462009b3885009f69dc"
task: "Compact mobile dormitory room status"
pipeline: feature_development
profile: Quick
objective: "Make each room in /dormitory/overview easy to scan on mobile with room, type, available beds, details, and an explicit status."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T14:36:26+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree contains the scoped implementation changes; no commit created."
  changed_paths: ["frontend/src/app/(dashboard)/dormitory/overview/page.tsx", "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix frontend test -- src/app/(dashboard)/dormitory/overview/page.test.tsx (12 passed)", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/dormitory/overview/page.tsx:DormitoryOverviewPage renders compact room cards below lg with room, type, occupied/total beds, available beds, detail button, and an unlabeled occupancy ring."
  expected_behavior: "Below lg, each room card visibly and compactly presents Phòng, Loại, Còn chỗ, Chi tiết, and Trạng thái; status remains understandable without relying on the occupancy ring alone."
  root_cause: "The compact card layout includes a non-required bed-count field and exposes the state only through an icon's accessible label."

scope:
  inspect: ["frontend/src/app/(dashboard)/dormitory/overview/page.tsx:DormitoryOverviewPage compact room-card branch", "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx:compact viewport coverage"]
  write: ["frontend/src/app/(dashboard)/dormitory/overview/page.tsx:DormitoryOverviewPage compact room-card fields", "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx:mobile room-card assertions"]
  preserve: ["Desktop table layout and data fields", "Room search, room ordering, state derivation, occupancy accessibility label, and detail modal behavior", "Existing API and realtime refresh contracts"]
  out: ["Backend/API/schema changes", "Desktop table redesign", "Other dormitory overview sections", "New dependencies"]

acceptance_criteria:
  - "AC-01: At a viewport below lg, every rendered room card visibly labels and displays Phòng, Loại, Còn chỗ, Chi tiết, and Trạng thái in a compact readable layout."
  - "AC-02: The mobile status field shows the derived textual room state while retaining the existing occupancy context/accessibility; the non-required occupied/total-bed field is absent from the compact card."
  - "AC-03: Mobile room-detail buttons, search filtering, empty state, and the desktop room table remain unchanged."
  - "AC-04: Focused page tests assert the requested mobile fields and preserve room-detail access."

execution:
  - "E-01 [AC-01..AC-03] page.tsx:DormitoryOverviewPage compact branch -> reorganize the card metadata around the five requested fields; render the state text beside or with the existing occupancy indicator and remove the compact occupied/total-bed field."
  - "E-02 [AC-04] page.test.tsx:compact viewport test -> assert labelled mobile fields/state and existing detail-button access."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/dormitory/overview/page.test.tsx' -> focused tests pass."
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-01..AC-04] git diff --check -> no whitespace errors."

risks: ["A status displayed only by color or an icon would not meet the requested mobile readability; retain both text and the current aria-label."]
stop_conditions: ["Stop if the desired mobile status wording differs from the currently derived room states, or the change requires API, schema, RBAC, or a third implementation file."]
