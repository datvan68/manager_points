slot_id: "taskscope-00"
generation: 11
task_id: "20260902-113605-refine-student-record-selection-drawer"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-02T11:36:05+07:00"
updated_at: "2026-09-02T12:00:12+07:00"
base_commit: "e91b26d149cbcb178f5d7faa108105d86f4e1086"
task: "Refine student-record selection and drawer deletion"
pipeline: bug_fix
profile: Quick
objective: "Tab Tình hình HSSV chọn dòng có phản hồi đúng, không còn xuất Excel, và drawer có UI tinh gọn với luồng xóa xác nhận rồi cập nhật ngay."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-02T12:00:12+07:00"
  outcome: success
  final_commit_or_state: "Working tree on e91b26d149cbcb178f5d7faa108105d86f4e1086; scoped changes remain uncommitted."
  changed_paths: ["frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["V-01: focused Vitest 24/24 passed", "V-02: frontend typecheck passed", "git diff --check passed"]
  cleanup_pending: []

evidence:
  current_behavior: "page.tsx:MemoizedAcademicRecordTableCells gửi record.id nhưng checked đọc selectionId; toolbar/FloatingActionBar còn Excel; hai drawer trùng markup, xóa lịch sử gọi API ngay và chỉ refresh bảng."
  expected_behavior: "Checkbox hiển thị checked; tab student không có Excel; drawer có phân cấp/spacing tinh tế, xóa qua ConfirmModal và danh sách drawer cập nhật ngay sau thành công."
  root_cause: "page.tsx dùng sai selection key ở bảng và drawer thiếu pending-delete/confirm cùng bước đồng bộ drawerHistory sau runBulkRecordDelete."

scope:
  inspect: ["frontend/src/components/modals/ConfirmModal.tsx:loading/close contract"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:student table, toolbar, drawer UI/delete flow", "frontend/src/app/(dashboard)/students/record/page.test.tsx:focused regressions"]
  preserve: ["RBAC và API/schema", "lọc/phân trang/sắp xếp", "Excel và xóa của tab Tình hình lớp học", "drawer desktop/mobile cùng hành vi"]
  out: ["Backend", "tab lớp học/trash/import", "thiết kế lại ngoài drawer Tình hình HSSV"]

acceptance_criteria:
  - "AC-01: Chọn/bỏ chọn checkbox bảng student cập nhật dấu check, selected count và row highlight theo đúng selectionId."
  - "AC-02: Tab Tình hình HSSV không render hoặc gọi bất kỳ hành động Xuất Excel nào ở toolbar/mobile/selection bar; tab lớp học không đổi."
  - "AC-03: Hai biến thể drawer có bố cục, timeline, checkbox và footer đồng nhất, rõ focus/selected/loading/empty state, không tái hiện ô trắng thiếu dấu check như ảnh."
  - "AC-04: Nút Xóa lịch sử chỉ mở ConfirmModal; hủy không gọi API, xác nhận xóa đúng ID, khóa thao tác khi đang xử lý và giữ nguyên dữ liệu khi lỗi."
  - "AC-05: Sau xóa thành công, drawerHistory và thống kê được cập nhật/refetch trước khi hoàn tất; bảng chính cũng refresh và mục đã xóa biến mất ngay."

execution:
  - "E-01 [AC-01,AC-02] page.tsx:selection/export UI → dùng selectionId nhất quán và bỏ student Excel handlers/actions/imports không còn dùng."
  - "E-02 [AC-03..AC-05] page.tsx:drawer variants → chuẩn hóa visual states, selection theo record ID, thêm pending delete + ConfirmModal và đồng bộ drawer/table sau thành công."
  - "E-03 [AC-01..AC-05] page.test.tsx → regression cho checked state, absence of student Excel, confirm/cancel/error/success refresh và parity hai drawer."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-05] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused Vitest passes."
  - "V-02 [AC-01..AC-05] npm --prefix frontend run typecheck → exits 0."

risks: ["Drawer có hai markup responsive trùng lặp; mọi thay đổi phải giữ parity và dùng ID ổn định, không index sau refetch."]
stop_conditions: ["Dừng nếu cần đổi API/schema/RBAC, phạm vi tab lớp học, hoặc thêm dependency thiết kế mới."]
