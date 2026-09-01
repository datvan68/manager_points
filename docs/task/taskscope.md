slot_id: "taskscope-00"
generation: 9
task_id: "20260901-214051-align-grouped-student-records-ui"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-01T21:40:51+07:00"
updated_at: "2026-09-01T21:56:00+07:00"
base_commit: "efd6bd4b22855d07d7e9600258b91342d252cb59"
task: "Align grouped student-record table actions and exports"
pipeline: feature_development
profile: Quick
objective: "Mỗi dòng Tình hình HSSV thể hiện một sinh viên và toàn bộ ghi nhận khớp bộ lọc, với thông tin gần nhất, thao tác nhóm và chế độ xuất dữ liệu không gây nhầm lẫn."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-01T21:56:00+07:00"
  outcome: "Grouped student records now show the latest filtered record in one labeled column, expose only detail viewing per row, keep bulk student deletion filter-scoped, and provide separate summary/detail Excel exports."
  final_commit_or_state: "Working tree on main at base commit efd6bd4b22855d07d7e9600258b91342d252cb59; changes uncommitted."
  changed_paths:
    - "frontend/src/app/(dashboard)/students/record/page.tsx"
    - "frontend/src/app/(dashboard)/students/record/page.test.tsx"
    - "docs/task/taskscope.md"
  checks_passed:
    - "npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' --run (24 tests passed)"
    - "npm --prefix frontend run typecheck (passed)"
    - "git diff --check (passed; only line-ending normalization warnings)"
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:mappedRecords/TableCells/actions/exports → dòng nhóm trộn tổng hợp với tiêu chí-ngày của latestRecord; sửa/xóa cuối dòng tác động latestRecord; checkbox mở rộng thành các child ID khớp bộ lọc; footer drawer có nút sửa không hoạt động; Excel nhóm mang cột chi tiết."
  expected_behavior: "Bảng nhóm hiển thị Ghi nhận gần nhất, chỉ xem chi tiết ở từng dòng; xóa toàn nhóm chỉ qua checkbox chọn sinh viên; drawer không có nút sửa chung; xuất tổng hợp và chi tiết tách biệt."
  root_cause: null

scope:
  inspect: ["frontend/src/api/academic-record-api.ts:getAcademicRecords contracts", "frontend/src/components/grading/AddRecordView.tsx:edit contract"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:GhiNhanTab grouped table/drawer/export flows", "frontend/src/app/(dashboard)/students/record/page.test.tsx:grouped table/actions/export coverage"]
  preserve: ["RBAC and student read-only state", "groupBy=student, active filters, pagination, totals, detail-history loading and soft-delete APIs", "No API/schema/dependency change"]
  out: ["Backend changes", "Tình hình lớp học", "Per-record edit redesign inside history", "Permanent-delete/trash flows"]

acceptance_criteria:
  - "AC-01: Mỗi dòng vẫn là một sinh viên với toàn bộ ghi nhận khớp bộ lọc; Tiêu chí và Ngày ghi nhận được thay bằng một cột Ghi nhận gần nhất chứa đúng tiêu chí và ngày của latestRecord."
  - "AC-02: Hành động từng dòng HSSV chỉ còn Xem chi tiết; không còn sửa hoặc xóa latestRecord tại dòng, và nút Sửa ghi nhận chung ở footer drawer bị loại bỏ."
  - "AC-03: Checkbox được trình bày là chọn sinh viên; xóa toàn nhóm chỉ xuất hiện qua bulk action, bản xem trước tiếp tục nêu số sinh viên và tổng child records khớp bộ lọc trước khi xóa mềm."
  - "AC-04: Người dùng có hai chế độ xuất rõ ràng: tổng hợp theo sinh viên và lịch sử chi tiết theo từng ghi nhận; tiêu chí/ngày chỉ là cột chi tiết hoặc được ghi nhãn là thông tin gần nhất trong bản tổng hợp."
  - "AC-05: Người dùng thiếu quyền sửa/xóa và vai trò sinh viên không nhận thêm hành động; bộ lọc hiện hành tiếp tục giới hạn lịch sử, preview xóa và dữ liệu xuất chi tiết."

execution:
  - "E-01 [AC-01,AC-02] page.tsx:TableCells/table actions/drawer footer → gộp latest criterion-date, giữ Eye, bỏ edit/delete dòng và sửa chung."
  - "E-02 [AC-03] page.tsx:selection/FloatingActionBar/delete preview → làm rõ chọn sinh viên và chỉ giữ group deletion qua checkbox với số lượng ảnh hưởng."
  - "E-03 [AC-04,AC-05] page.tsx:Excel handlers → tách workbook tổng hợp nhóm và lịch sử child records, tái dùng filter/history params và RBAC hiện có."
  - "E-04 [AC-01..AC-05] page.test.tsx → cập nhật focused tests cho cột, action, selection/delete preview, hai chế độ export và quyền."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-05] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → Vitest target passes."
  - "V-02 [AC-01..AC-05] npm --prefix frontend run typecheck → TypeScript exits 0."

risks: ["Xuất chi tiết có thể cần tải nhiều child records; phải giữ đúng bộ lọc và không thay đổi API contract."]
stop_conditions: ["Dừng nếu cần API/schema mới, thay đổi RBAC, dependency, backend, hoặc xử lý dữ liệu ngoài bộ lọc hiện hành."]
