slot_id: "taskscope-00"
generation: 10
task_id: "20260901-230522-show-full-student-history"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-01T23:05:22+07:00"
updated_at: "2026-09-01T23:32:53+07:00"
base_commit: "e3ef88d5155d713bc1450d4ce50d2a4b609f1640"
task: "Show complete student history and simplify Excel export"
pipeline: bug_fix
profile: Quick
objective: "Drawer Tình hình HSSV hiển thị toàn bộ ghi nhận của sinh viên, còn màn hình chỉ cung cấp một hành động Xuất Excel thông thường."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-01T23:32:53+07:00"
  outcome: success
  final_commit_or_state: "HEAD e3ef88d5155d713bc1450d4ce50d2a4b609f1640; scoped changes remain in working tree"
  changed_paths: ["docs/task/taskscope.md", "frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx"]
  checks_passed: ["V-01: focused Vitest 24/24 passed", "V-02: frontend typecheck passed", "git diff --check passed"]
  cleanup_pending: []

evidence:
  current_behavior: "page.tsx:handleOpenDrawerChange gọi getAcademicRecords với getStudentHistoryParams nên lịch sử bị giới hạn theo học kỳ/lớp/ngày/người tạo; toolbar đồng thời render Xuất tổng hợp và Xuất lịch sử chi tiết."
  expected_behavior: "Drawer tải mọi academic record của studentId, không phụ thuộc bộ lọc bảng; xóa nhóm vẫn giới hạn theo bộ lọc; màn hình chỉ còn một nút Xuất Excel."
  root_cause: "frontend/src/app/(dashboard)/students/record/page.tsx:getStudentHistoryParams được chia sẻ sai giữa drawer toàn lịch sử và delete preview theo bộ lọc."

scope:
  inspect: ["frontend/src/api/academic-record-api.ts:getAcademicRecords response contract", "backend/src/academic-record/academic-record.service.ts:findAll unpaginated student filter"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:drawer history params and Excel actions", "frontend/src/app/(dashboard)/students/record/page.test.tsx:drawer/export regression coverage"]
  preserve: ["groupBy=student table filters, sorting, totals and RBAC", "Bulk group deletion must keep class/date/semester/creator filters and preview child IDs", "Single summary Excel format and selected-student export", "No API/schema/dependency change"]
  out: ["Backend changes", "Drawer layout redesign", "Individual record edit", "Class-report tab and trash/permanent-delete flows"]

acceptance_criteria:
  - "AC-01: Mở Xem chi tiết gọi lịch sử bằng studentId mà không truyền classId, semesterId, startDate, endDate hoặc creator; drawer sắp xếp và hiển thị toàn bộ kết quả trả về."
  - "AC-02: Bộ đếm và danh sách trong drawer phản ánh cùng tập toàn bộ ghi nhận, bao gồm ghi nhận nằm ngoài bộ lọc bảng hiện hành."
  - "AC-03: Delete preview cho sinh viên vẫn dùng đúng bộ lọc bảng hiện hành và chỉ xóa các child ID đã xem trước."
  - "AC-04: Toolbar desktop/mobile chỉ có một nút Xuất Excel; không còn nút/handler Xuất tổng hợp và Xuất lịch sử chi tiết riêng, còn xuất sinh viên đã chọn dùng nhãn Xuất Excel."
  - "AC-05: Vai trò sinh viên và người thiếu quyền không nhận thêm hành động sửa/xóa; tải lịch sử tiếp tục qua API read hiện có."

execution:
  - "E-01 [AC-01..AC-03] page.tsx:history query helpers/callers → tách params drawer toàn bộ khỏi params delete preview theo bộ lọc."
  - "E-02 [AC-04,AC-05] page.tsx:export handlers/toolbars/FloatingActionBar → giữ một luồng Xuất Excel và loại bỏ luồng chi tiết riêng."
  - "E-03 [AC-01..AC-05] page.test.tsx → thêm regression cho lịch sử ngoài filter, giữ filtered deletion và xác nhận chỉ một export action."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-05] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused Vitest passes."
  - "V-02 [AC-01..AC-05] npm --prefix frontend run typecheck → exits 0."

risks: ["Một sinh viên có lịch sử lớn sẽ được tải đầy đủ trong một request; giữ contract hiện tại và dừng nếu cần phân trang/API mới."]
stop_conditions: ["Dừng nếu yêu cầu toàn bộ lịch sử cần backend/API/schema mới, thay đổi RBAC hoặc thay đổi phạm vi xóa nhóm."]
