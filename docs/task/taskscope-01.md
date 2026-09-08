slot_id: "taskscope-01"
generation: 1
task_id: "20260908T075842+0700-report-tabs-student-class-records"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 1
created_at: "2026-09-08T07:58:42+07:00"
updated_at: "2026-09-08T08:03:31+07:00"
base_commit: "3564113b0bd7bada867730265d0c02e4ae5b094b"
task: "Cập nhật các tab Thống kê báo cáo"
pipeline: feature_development
profile: Quick
objective: "Trang Thống kê báo cáo chỉ hiển thị Tổng quan, Sinh viên, Điểm rèn luyện, Ghi nhận sv và Ghi nhận lớp; hai tab ghi nhận tiếp tục dùng đúng dữ liệu hiện có."
coordination:
  depends_on: []
  warnings:
    - "docs/task/taskscope.md đang rỗng và được giữ lại như slot 00 chưa migrate; task này dùng slot 01."
completion:
  completed_at: "2026-09-08T08:03:31+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree on main; changes uncommitted."
  changed_paths:
    - "frontend/src/components/reports/ReportTabs.tsx"
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/components/reports/ReportTabs.test.tsx"
  checks_passed:
    - "V-01: npm --prefix frontend test -- src/components/reports/ReportTabs.test.tsx — 2 tests passed, 0 skipped."
    - "V-02: npm --prefix frontend run typecheck — exit code 0."
    - "V-03: git diff --check -- frontend/src/components/reports/ReportTabs.tsx frontend/src/app/(dashboard)/reports/page.tsx frontend/src/components/reports/ReportTabs.test.tsx — passed."
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/reports/ReportTabs.tsx:ReportTabs hiển thị 7 tab, gồm Ghi nhận rèn luyện, Chuyên cần, Nhiệm vụ và Hệ thống & Logs; frontend/src/app/(dashboard)/reports/page.tsx ánh xạ record tới AcademicRecordReportTab và attendance tới AttendanceReportTab."
  expected_behavior: "Thanh tab có đúng 5 mục theo thứ tự hiện hành: Tổng quan, Sinh viên, Điểm rèn luyện, Ghi nhận sv, Ghi nhận lớp; không còn bốn nhãn tab bị bỏ."
  root_cause: null
scope:
  inspect:
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AttendanceReportTab.tsx"
    - "frontend/src/components/ui/TabNavigation.test.tsx"
    - "frontend/package.json"
  write:
    - "frontend/src/components/reports/ReportTabs.tsx"
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/components/reports/ReportTabs.test.tsx"
  preserve:
    - "Ghi nhận sv giữ id record, tải AcademicRecordReportTab và toàn bộ hành vi lọc, phân trang, badge, export hiện có."
    - "Ghi nhận lớp giữ id attendance, tải AttendanceReportTab và toàn bộ hành vi lọc, phân trang, badge, export hiện có."
    - "Tổng quan, Sinh viên, Điểm rèn luyện, API/backend, RBAC và dữ liệu lưu trữ không thay đổi."
  out:
    - "Xóa code/API/export của Nhiệm vụ, Chuyên cần hoặc Hệ thống khỏi page.tsx; yêu cầu chỉ bỏ khả năng truy cập qua thanh tab."
    - "Đổi tiêu đề bảng, tên sheet Excel hoặc mô hình dữ liệu bên trong các tab ghi nhận."
acceptance_criteria:
  - "AC-01: Thanh tab hiển thị đúng thứ tự Tổng quan, Sinh viên, Điểm rèn luyện, Ghi nhận sv, Ghi nhận lớp và không hiển thị Ghi nhận rèn luyện, Chuyên cần, Nhiệm vụ, Hệ thống & Logs cho mọi vai trò."
  - "AC-02: Chọn Ghi nhận sv phát onChange('record'); chọn Ghi nhận lớp phát onChange('attendance'), nên nội dung, badge, lọc, phân trang và export hiện có vẫn được dùng."
execution:
  - "E-01 [AC-01, AC-02] frontend/src/components/reports/ReportTabs.tsx:ReportTabs -> thay nhãn record/attendance, bỏ task/system khỏi danh sách hiển thị và dọn prop/icon chỉ phục vụ tab system."
  - "E-02 [AC-01] frontend/src/app/(dashboard)/reports/page.tsx:ReportTabs usage -> bỏ showSystemTab đã không còn thuộc contract điều hướng; giữ nguyên các nhánh dữ liệu/render/export ngoài thanh tab."
  - "E-03 [AC-01, AC-02] frontend/src/components/reports/ReportTabs.test.tsx (new) -> render component, khẳng định đúng tập/thứ tự nhãn, các nhãn cũ vắng mặt và callback record/attendance chính xác."
verification:
  - "V-01 [AC-01, AC-02] npm --prefix frontend test -- src/components/reports/ReportTabs.test.tsx -> Vitest chạy test mục tab, nhãn bị bỏ và callback mới với kết quả pass, không có test bị skip."
  - "V-02 [AC-01, AC-02] npm --prefix frontend run typecheck -> TypeScript hoàn tất với exit code 0."
  - "V-03 [AC-01, AC-02] git diff --check -- frontend/src/components/reports/ReportTabs.tsx 'frontend/src/app/(dashboard)/reports/page.tsx' frontend/src/components/reports/ReportTabs.test.tsx -> không có lỗi whitespace."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Các nhánh task/system vẫn tồn tại nội bộ nhưng không còn đường chọn từ thanh tab; không xóa để tránh mở rộng phạm vi và ảnh hưởng export tổng hợp."
stop_conditions:
  - "Dừng và xin mở rộng scope nếu yêu cầu thực tế là tạo báo cáo/API mới thay vì tái sử dụng record và attendance hiện có."
  - "Dừng với TASKSCOPE_CONFLICT nếu một task active khác giữ một trong ba write path hoặc có thay đổi không rõ chủ sở hữu trên các path đó."
