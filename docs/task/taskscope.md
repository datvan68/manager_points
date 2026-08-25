task: "Chống reset và khôi phục bản nháp form ghi nhận"
pipeline: bug_fix
profile: Full
objective: "Form Ghi nhận lớp và Ghi nhận HSSV không bị reset bởi kiểm tra nền; nếu bị rời khỏi ngoài ý muốn trước khi submit, lần mở lại form trong cùng phiên tab sẽ khôi phục dữ liệu đang làm dở."

evidence:
  current_behavior: "frontend/src/components/guards/RouteGuard.tsx:maintenance useEffect gọi setMaintenanceCheckDone(false) ở mọi lần kiểm tra focus/interval 30 giây; nhánh loading unmount frontend/src/app/(dashboard)/students/record/page.tsx:GhiNhanTab nên currentView trở về list. frontend/src/components/grading/AddClassReportView.tsx và AddRecordView.tsx giữ dữ liệu tạo mới duy nhất trong useState, không có cơ chế phục hồi sau unmount."
  expected_behavior: "Kiểm tra bảo trì nền giữ nguyên cây trang; hai form tạo mới tự lưu và khôi phục bản nháp theo người dùng trong cùng tab, không phục hồi dữ liệu chỉnh sửa."
  root_cause: "RouteGuard biến revalidation nền thành bootstrap loading; form ghi nhận không có lớp persistence cho state chưa submit."

scope:
  inspect: ["frontend/src/components/guards/RouteGuard.tsx:maintenance lifecycle", "frontend/src/app/(dashboard)/students/record/page.tsx:GhiNhanTab/currentView", "frontend/src/components/grading/{AddRecordView,AddClassReportView}.tsx:create/edit state"]
  write: ["frontend/src/components/guards/RouteGuard.tsx", "frontend/src/components/guards/RouteGuard.test.tsx", "frontend/src/hooks/useRecordDraft.ts", "frontend/src/hooks/useRecordDraft.test.tsx", "frontend/src/components/grading/AddRecordView.tsx", "frontend/src/components/grading/AddRecordView.test.tsx", "frontend/src/components/grading/AddClassReportView.tsx", "frontend/src/components/grading/AddClassReportView.test.tsx"]
  preserve: ["Loading và chặn quyền/bảo trì lần đầu", "Chuyển sang màn hình bảo trì khi revalidation trả true", "API payload, RBAC, validation, idempotency và luồng edit hiện tại"]
  out: ["Backend/database draft", "Đồng bộ bản nháp giữa tab/thiết bị", "Khôi phục sau khi đóng tab hoặc đăng xuất", "Thiết kế lại form"]

acceptance_criteria:
  - "AC-01: Sau lần render đầu, kiểm tra bảo trì do focus/interval không unmount children; state form còn nguyên, nhưng maintenance=true vẫn chặn trang."
  - "AC-02: Form tạo Ghi nhận HSSV khôi phục classIds, ngày, chế độ nhập, lựa chọn tạm, ghi chú và addedViolations sau unmount/mở lại trong cùng tab."
  - "AC-03: Form tạo Ghi nhận lớp khôi phục classIds, ngày, giáo viên, ghi chú lớp, chế độ nhập, lựa chọn tạm và addedViolations; số có mặt/vắng được tính lại."
  - "AC-04: Draft dùng sessionStorage key có version + userId + loại form; dữ liệu sai schema/JSON hoặc khác người dùng không được áp dụng."
  - "AC-05: Chỉ bắt đầu persist sau hydration; submit thành công hoặc quay lại/hủy chủ động xóa draft, còn lỗi API/unmount ngoài ý muốn giữ draft; edit mode không đọc/ghi draft tạo mới."

execution:
  - "E-01 [AC-01] RouteGuard.tsx → tách bootstrap loading khỏi background maintenance revalidation; thêm regression test child mount/state và maintenance transition."
  - "E-02 [AC-04, AC-05] useRecordDraft.ts → hook sessionStorage an toàn, hydration guard, version/user/form isolation và clear; kiểm thử malformed, remount, account isolation."
  - "E-03 [AC-02, AC-05] AddRecordView.tsx → nối toàn bộ state tạo mới vào draft hook, serialize Date/Set rõ ràng, restore sau dữ liệu nền; kiểm thử round-trip và clear semantics."
  - "E-04 [AC-03, AC-05] AddClassReportView.tsx → nối state tạo mới, không persist state dẫn xuất/cache; kiểm thử round-trip, tính lại chuyên cần và clear semantics."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01] npm --prefix frontend test -- src/components/guards/RouteGuard.test.tsx → pass."
  - "V-02 [AC-02..AC-05] npm --prefix frontend test -- src/hooks/useRecordDraft.test.tsx src/components/grading/AddRecordView.test.tsx src/components/grading/AddClassReportView.test.tsx → pass."
  - "V-03 [AC-01..AC-05] npm --prefix frontend run typecheck → exit 0."
  - "V-04 [AC-02, AC-03, AC-05] Manual: nhập dở từng form, chuyển trang/quay lại và mở lại form → dữ liệu phục hồi; bấm hủy hoặc lưu thành công → lần mở sau trống."

risks: ["Draft chứa định danh HSSV và ghi chú: chỉ dùng sessionStorage theo user/form, không localStorage hay log; RouteGuard là component dùng chung nên cần regression riêng."]
stop_conditions: ["Dừng nếu yêu cầu lưu qua đóng tab/đăng nhập lại, đồng bộ server, đổi API/RBAC, hoặc xử lý dữ liệu cá nhân ngoài các field form hiện có."]
