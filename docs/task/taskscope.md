slot_id: "taskscope-00"
generation: 13
task_id: "20260902-123000-preserve-student-drawer-responsive-layout"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-02T12:30:00+07:00"
updated_at: "2026-09-02T12:35:20+07:00"
base_commit: "3d4a0c74eb9160da03232026291574dc260e3ab4"
task: "Preserve mobile and tablet student drawer layout"
pipeline: feature_development
profile: Quick
objective: "Giữ nguyên responsive drawer mobile/tablet khi dùng ba nút lọc lịch sử."

coordination:
  depends_on: ["20260902-120928-filter-student-history-by-record-type"]
  warnings: []

completion:
  completed_at: "2026-09-02T12:35:20+07:00"
  outcome: success
  final_commit_or_state: "Working tree unchanged apart from taskscope metadata."
  changed_paths: ["docs/task/taskscope.md"]
  checks_passed: ["V-01: focused Vitest 25/25 passed", "V-02: frontend typecheck passed", "Responsive drawer structure verified unchanged in both branches"]
  cleanup_pending: []

evidence:
  current_behavior: "Hai nhánh drawer responsive dùng chung DrawerTypeFilterButton và visibleDrawerHistory."
  expected_behavior: "Ba thẻ vẫn lọc được; layout, scroll và breakpoint mobile/tablet không đổi."
  root_cause: null

scope:
  inspect: ["frontend/src/app/(dashboard)/students/record/page.tsx:DrawerTypeFilterButton và drawer responsive"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:responsive regression fix nếu cần", "frontend/src/app/(dashboard)/students/record/page.test.tsx:responsive coverage"]
  preserve: ["filter/toggle/aria-pressed đã có", "layout, breakpoint, chiều rộng, scroll và thứ tự nội dung drawer mobile/tablet", "desktop drawer, RBAC, API và thao tác xóa/chọn"]
  out: ["Thiết kế lại drawer", "thay đổi breakpoint", "backend/API", "các màn hình ngoài /students/record"]

acceptance_criteria:
  - "AC-01: Drawer mobile/tablet giữ nguyên breakpoint, kích thước, scroll và thứ tự nội dung."
  - "AC-02: Ba thẻ Khen thưởng, Cộng điểm, Kỷ luật vẫn là button có thể click/toggle và lọc đúng timeline ở cả hai nhánh responsive."
  - "AC-03: Trạng thái active/focus không gây dịch chuyển layout, tràn ngang hoặc che nội dung trên mobile/tablet."
  - "AC-04: Không thay đổi desktop drawer, request API, selected IDs, quyền hoặc dữ liệu nguồn."

execution:
  - "E-01 [AC-01..AC-04] page.tsx → chỉ chỉnh tối thiểu nếu filter button làm đổi layout."
  - "E-02 [AC-01..AC-04] page.test.tsx → kiểm tra parity, toggle và responsive container."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused Vitest passes."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."

risks: ["Hai nhánh drawer responsive lặp markup; thay đổi phải giữ parity và không tác động desktop."]
stop_conditions: ["Dừng nếu cần thiết kế lại drawer hoặc thay đổi breakpoint ngoài yêu cầu bảo toàn responsive."]
