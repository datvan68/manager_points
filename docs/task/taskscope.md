slot_id: "taskscope-00"
generation: 6
task_id: "20260831-232012-mark-class-origin-in-status-drawer"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-08-31T23:20:12+07:00"
updated_at: "2026-08-31T23:42:00+07:00"
base_commit: "9e72d44e6a2fb0de100b612b7434460004e84d0b"
task: "Đánh dấu ghi nhận lớp trong drawer chi tiết trạng thái"
pipeline: feature_development
profile: Quick
objective: "Trong drawer Chi tiết trạng thái tại /students/record, mỗi mục gần đây có daily_report_id hiển thị một dấu hiệu nhỏ cho biết nguồn là ghi nhận lớp."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-08-31T23:42:00+07:00"
  outcome: success
  final_commit_or_state: "Working tree contains scoped UI/test changes plus pre-existing Sidebar changes."
  changed_paths: ["frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx"]
  checks_passed: ["npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx (22 tests passed)", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:drawerHistory mapping giữ bản ghi gốc trong mr.original; hai danh sách Ghi nhận gần đây chỉ hiển thị ngày, tiêu chí, loại và điểm."
  expected_behavior: "Cả drawer desktop và mobile hiển thị nhãn nhỏ 'Ghi nhận lớp' chỉ khi mr.original.daily_report_id có giá trị."
  root_cause: null

scope:
  inspect: ["frontend/src/api/academic-record-api.ts:AcademicRecord.daily_report_id contract", "backend/src/academic-record/academic-record.service.ts:populated daily_report_id response"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:hai renderer drawerHistory", "frontend/src/app/(dashboard)/students/record/page.test.tsx:focused drawer source-label coverage"]
  preserve: ["Nội dung, điểm, expand/collapse và quyền hiện có", "Bản ghi không có daily_report_id không nhận nhãn", "API, schema và dependency không đổi"]
  out: ["Thay đổi backend hoặc cấu trúc dữ liệu", "Đổi giao diện ngoài drawer Chi tiết trạng thái"]

acceptance_criteria:
  - "AC-01: Mục gần đây có daily_report_id hiển thị nhãn nhỏ 'Ghi nhận lớp' ở cả drawer desktop và mobile."
  - "AC-02: Mục không có daily_report_id không hiển thị nhãn nguồn và hành vi drawer hiện tại được giữ nguyên."

execution:
  - "E-01 [AC-01, AC-02] frontend/src/app/(dashboard)/students/record/page.tsx:hai renderer drawerHistory → thêm nhãn điều kiện từ mr.original.daily_report_id theo style badge hiện có."
  - "E-02 [AC-01, AC-02] frontend/src/app/(dashboard)/students/record/page.test.tsx → thêm fixture có/không có daily_report_id và assertion hiển thị điều kiện."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01, AC-02] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → Vitest target passes."

risks: []
stop_conditions: ["Dừng nếu daily_report_id không có trong payload drawer thực tế hoặc yêu cầu cần đổi API/schema/public contract."]
