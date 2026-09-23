slot_id: "taskscope-01"
generation: 1
task_id: "20260923-100500-export-discipline-followup-and-recorders"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 3
created_at: "2026-09-23T22:10:36+07:00"
updated_at: "2026-09-23T22:36:00+07:00"
base_commit: "d99ee3af99c066f5051db3172b1552466bfa01c2"
task: "Bổ sung trạng thái xử lý kỷ luật và người ghi nhận vào Excel tab Ghi nhận SV"
pipeline: feature_development
profile: Quick
objective: "Excel xuất từ tab Ghi nhận SV cho thấy rõ sinh viên đã xử lý nhưng có phát sinh kỷ luật mới, đồng thời cung cấp người xử lý và người tạo từng ghi nhận kỷ luật."
coordination:
  depends_on: []
  warnings: []
completion:
  completed_at: "2026-09-23T22:36:00+07:00"
  outcome: "Implemented Excel follow-up fields and a filtered discipline-detail sheet for the Ghi nhận SV export without changing API, schema, or other report tabs."
  final_commit_or_state: "Working tree on main at base commit d99ee3af99c066f5051db3172b1552466bfa01c2; changes uncommitted."
  changed_paths:
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/app/(dashboard)/reports/page.test.tsx"
  checks_passed:
    - "V-01: npm --prefix frontend test -- \"src/app/(dashboard)/reports/page.test.tsx\" -> 4 tests passed."
    - "V-02: npm --prefix frontend run typecheck -> passed with no TypeScript errors."
    - "V-03: git diff --check -- frontend/src/app/(dashboard)/reports/page.tsx frontend/src/app/(dashboard)/reports/page.test.tsx -> passed."
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/app/(dashboard)/reports/page.tsx:recordCols và handleExportSingleTab -> Excel ghi nhận chỉ chứa số liệu tổng hợp; loader record lấy nhóm sinh viên nhưng không tải chi tiết bản ghi. frontend/src/components/reports/report-helpers.ts:mapAcademicRecordStudentGroup đã ánh xạ follow_up_status, new_record_count, handled_at, handled_by; bảng cũng dùng các trường này. backend/src/academic-record/academic-record.service.ts:findAll -> nhóm ghi nhận đã tính new status sau checkpoint; endpoint chi tiết populate recorded_by."
  expected_behavior: "Sheet tổng hợp Excel có trạng thái xử lý, số ghi nhận mới, thời điểm xử lý và người xử lý; sheet chi tiết kỷ luật có thông tin từng ghi nhận gồm người ghi nhận."
  root_cause: null
scope:
  inspect:
    - "frontend/src/components/reports/report-helpers.ts:mapAcademicRecordStudentGroup/processReportsData"
    - "frontend/src/components/reports/report-types.ts:AcademicRecordReportRow/AcademicRecordStudentSummaryRow"
    - "frontend/src/api/academic-record-api.ts:AcademicRecord/getAcademicRecords"
    - "backend/src/academic-record/academic-record.service.ts:findAll grouped and detail paths"
  write:
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/app/(dashboard)/reports/page.test.tsx"
  preserve:
    - "Trạng thái new chỉ dựa trên ghi nhận kỷ luật active sau checkpoint xử lý do backend trả về; không tự tính lại trong frontend."
    - "Giữ bộ lọc hiện tại cho cả nhóm sinh viên và chi tiết bản ghi; chỉ xuất dữ liệu phù hợp bộ lọc và giới hạn export đang có."
    - "Phân biệt recorded_by (người tạo ghi nhận) với handled_by (người xác nhận xử lý); giá trị thiếu phải thể hiện rõ, không gán nhầm người."
    - "Không thay đổi schema, RBAC, API hoặc dữ liệu lưu trữ."
  out:
    - "Hiển thị thêm cột trên giao diện bảng; yêu cầu chỉ áp dụng cho file Excel."
    - "Thay đổi định nghĩa nghiệp vụ trạng thái follow-up/checkpoint."
    - "Tạo migration hoặc sửa dữ liệu người ghi nhận cũ."
acceptance_criteria:
  - "AC-01: Sheet tổng hợp ghi nhận có các cột trạng thái xử lý, số ghi nhận mới, thời điểm xử lý và người xử lý; sinh viên settled không có ghi nhận mới thể hiện 0, trạng thái new thể hiện số lượng backend trả về."
  - "AC-02: Workbook xuất riêng từ tab Ghi nhận SV có sheet chi tiết kỷ luật theo từng bản ghi với sinh viên, ngày, tiêu chí/nội dung, người ghi nhận và trạng thái bản ghi; không đưa khen thưởng/cộng điểm vào sheet này."
  - "AC-03: Sheet chi tiết lọc theo cùng kỳ, lớp, khoa, tìm kiếm, ngày và trạng thái follow-up mà báo cáo hiện áp dụng; recorded_by hoặc handled_by rỗng được biểu diễn thành giá trị dễ hiểu."
  - "AC-04: Export workbook tổng hợp toàn báo cáo tiếp tục hoạt động và không làm thay đổi sheet/cột của tab khác ngoài các thay đổi ghi nhận được yêu cầu."
  - "AC-05: Test hồi quy liên quan chứng minh cột export và chọn đúng bản ghi kỷ luật/giữ bộ lọc; frontend typecheck pass."
execution:
  - "E-01 [AC-01,AC-04] frontend/src/app/(dashboard)/reports/page.tsx:recordCols/handleExportSingleTab -> thêm cột follow-up vào sheet tổng hợp, dùng nhãn trạng thái tiếng Việt và xuất giá trị 0/không xác định rõ ràng; giữ nguyên các tab khác."
  - "E-02 [AC-02,AC-03,AC-04] frontend/src/app/(dashboard)/reports/page.tsx:fetchFullDatasetForExport/handleExportSingleTab -> với export riêng tab record, tải đầy đủ raw academic records qua API đang dùng, áp dụng filter hiện hành, lọc nhóm kỷ luật bằng criterion_type ky_luat (fallback phân loại hiện có nếu cần), rồi thêm sheet chi tiết với recorded_by. Tái sử dụng giới hạn trang/export và workbook helper hiện hữu."
  - "E-03 [AC-05] frontend/src/app/(dashboard)/reports/page.test.tsx -> bổ sung regression coverage cho thông tin follow-up, sheet chi tiết và tham số/bộ lọc export; dùng quy ước test hiện có."
verification:
  - "V-01 [AC-05] npm --prefix frontend test -- 'src/app/(dashboard)/reports/page.test.tsx' -> các test export kiểm tra cột follow-up, sheet chi tiết và bộ lọc kỷ luật pass."
  - "V-02 [AC-05] npm --prefix frontend run typecheck -> không có lỗi TypeScript."
  - "V-03 [AC-01,AC-02,AC-03,AC-04] kiểm tra diff và test workbook/export -> trạng thái mới lấy từ API, chi tiết đúng loại và filter, export tổng hợp còn giữ workbook tương thích."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Export chi tiết toàn bộ bản ghi có thể cần phân trang; phải dùng helper/giới hạn export hiện có để tránh chỉ xuất trang đang xem hoặc tải không giới hạn."
  - "Một ghi nhận kỷ luật có thể thiếu populated recorded_by trong dữ liệu cũ; phải xuất nhãn thiếu dữ liệu, không suy diễn người tạo."
stop_conditions:
  - "Dừng và đề nghị scope amendment nếu endpoint đang có không cung cấp recorded_by hoặc tiêu chí phân biệt kỷ luật đủ tin cậy và cần thay đổi backend/API."
  - "Dừng nếu việc thêm sheet làm tăng dữ liệu xuất vượt giới hạn hiện hành hoặc phải thay đổi các bộ lọc nghiệp vụ ngoài phạm vi."

