task: "Đơn giản hóa form ghi nhận và ưu tiên tiêu chí dùng nhiều"
pipeline: feature_development
profile: Full
objective: "Hai form ghi nhận dùng chung tối đa 3 tiêu chí được tài khoản hiện tại chọn nhiều nhất; form Thêm Ghi nhận Rèn luyện bắt đầu từ chọn Lớp và form đánh giá lớp giữ ghi chú sau khi thêm."

evidence:
  current_behavior: "frontend/src/components/grading/AddClassReportView.tsx render criteria theo thứ tự API và handleAddViolationToList reset violationNote; frontend/src/components/grading/AddRecordView.tsx tải Khoa, bắt buộc Khoa để lọc Lớp, render criteria theo thứ tự API."
  expected_behavior: "Lịch sử chọn tiêu chí dùng chung giữa hai form, tách theo user.id và hiển thị tối đa 3 mục dưới nhãn 'Sử dụng nhiều'; AddRecordView bỏ toàn bộ trường/phụ thuộc Khoa và cho chọn trực tiếp mọi Lớp; AddClassReportView không xóa ghi chú khi Thêm thành công."
  root_cause: "Hai component chưa có abstraction lưu/xếp usage; AddRecordView giữ department state/API/filter; AddClassReportView gọi setViolationNote('') sau khi thêm."

scope:
  inspect: ["frontend/src/providers/auth-provider.tsx:UserInfo.id", "frontend/src/components/ui/select.tsx:SelectLabel/SelectSeparator", "frontend/src/api/class-api.ts:Class"]
  write: ["frontend/src/components/grading/criterion-usage.ts:new shared per-user usage helpers", "frontend/src/components/grading/AddClassReportView.tsx:criteria Select/handleAddViolationToList", "frontend/src/components/grading/AddRecordView.tsx:basic-info fields/data loading/criteria Select", "frontend/src/components/grading/AddClassReportView.test.tsx:new focused tests", "frontend/src/components/grading/AddRecordView.test.tsx:new focused tests"]
  preserve: ["Tất cả tiêu chí API vẫn xuất hiện đúng một lần và chọn được", "Validation, chống trùng, payload, edit mode, RBAC và API contracts", "AddClassReportView vẫn reset sinh viên/tiêu chí sau Thêm", "AddRecordView giữ hành vi reset sinh viên/ghi chú khi đổi Lớp và sau Thêm"]
  out: ["Backend/API/schema", "Đồng bộ lịch sử giữa thiết bị/trình duyệt", "Thay đổi Select dùng chung", "Bỏ Khoa ở trang khác"]

acceptance_criteria:
  - "AC-01: Lịch sử chọn tiêu chí dùng một localStorage key theo user.id, được cả hai form đọc/ghi; mỗi onValueChange tăng count, dữ liệu thiếu/hỏng fallback rỗng không làm lỗi."
  - "AC-02: Mỗi menu Tiêu chí ghi nhận hiển thị tối đa 3 tiêu chí count cao nhất dưới nhãn 'Sử dụng nhiều', tie giữ thứ tự API, rồi các tiêu chí còn lại; không lặp mục và không hiện nhóm khi chưa có usage hợp lệ."
  - "AC-03: Thông tin cơ bản của AddRecordView không render Khoa; Lớp là select đầu tiên, chứa toàn bộ classes từ classApi và không gọi departmentApi."
  - "AC-04: AddClassReportView giữ nguyên Ghi chú chi tiết sau Thêm thành công; người dùng vẫn sửa/xóa được và validation thất bại không đổi ghi chú."

execution:
  - "E-01 [AC-01,AC-02] criterion-usage.ts → định nghĩa storage key theo user.id, parse/validate counts, increment và stable top-3 partition dùng chung."
  - "E-02 [AC-01,AC-02,AC-04] AddClassReportView.tsx → dùng helper trong criterion onValueChange/render SelectLabel + SelectSeparator; bỏ reset violationNote sau Thêm."
  - "E-03 [AC-01,AC-02,AC-03] AddRecordView.tsx → bỏ department imports/state/fetch/edit-resolution/handler/filter/UI; render classes trực tiếp và tích hợp cùng helper/usage key cho tiêu chí."
  - "E-04 [AC-01,AC-02,AC-04] AddClassReportView.test.tsx → khóa shared usage, top 3/no duplicate/malformed storage và giữ/sửa/xóa ghi chú."
  - "E-05 [AC-01,AC-02,AC-03] AddRecordView.test.tsx → khóa không có Khoa/department API, Lớp đầu tiên có đủ dữ liệu và cùng lịch sử tiêu chí."
  - "E-06 [AC-01..AC-04] independent review → đối chiếu diff với preserve/out và xác nhận hai form dùng cùng storage contract."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02,AC-04] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx → Vitest pass."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend test -- src/components/grading/AddRecordView.test.tsx → Vitest pass."
  - "V-03 [AC-01..AC-04] npm --prefix frontend run typecheck → exit 0."
  - "V-04 [AC-01..AC-04] git diff --check -- frontend/src/components/grading → exit 0; review không có thay đổi ngoài scope."

risks: ["localStorage chỉ phản ánh lịch sử trên trình duyệt hiện tại; key theo user.id ngăn trộn tài khoản.", "Bỏ bộ lọc Khoa làm danh sách Lớp dài hơn nhưng không thay đổi dữ liệu hoặc class API."]
stop_conditions: ["Dừng nếu yêu cầu lịch sử xuyên thiết bị/backend, lớp phải giới hạn theo quyền/Khoa ngoài dữ liệu classApi hiện tại, cần đổi API/schema, hoặc phải sửa Select dùng chung."]
