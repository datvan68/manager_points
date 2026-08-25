task: "Sửa lỗi quay lại làm mất bản nháp trên hai form Ghi nhận"
pipeline: bug_fix
profile: Full
objective: "Khi đang tạo Ghi nhận HSSV hoặc Ghi nhận lớp, người dùng rời form rồi mở lại trong cùng tab phải nhận lại đầy đủ dữ liệu chưa submit thay vì form trắng."

evidence:
  current_behavior: "Cơ chế sessionStorage đã tồn tại, nhưng frontend/src/components/grading/AddRecordView.tsx:handleBack và AddClassReportView.tsx:handleBack đều gọi clearDraft() trước onBack(). Nút mũi tên Quay lại và nút Hủy bỏ cùng dùng handler này, nên thao tác quay ra danh sách xóa bản nháp ở cả hai form. Các test hiện tại chỉ kiểm tra schema draft, chưa mô phỏng rời form và mount lại."
  expected_behavior: "Quay lại danh sách/chuyển khỏi form không xóa dữ liệu tạo mới; mở lại đúng loại form trong cùng tab khôi phục bản nháp. Chỉ lưu thành công hoặc thao tác hủy bỏ có chủ đích mới xóa draft."
  root_cause: "Luồng điều hướng ra ngoài và luồng loại bỏ bản nháp đang dùng chung handleBack có clearDraft(), trái với yêu cầu phục hồi sau khi quay lại."

scope:
  inspect:
    - "frontend/src/hooks/useRecordDraft.ts: save/restore/clear contract"
    - "frontend/src/app/(dashboard)/students/record/page.tsx: add-view onBack/onSuccess lifecycle"
  write:
    - "frontend/src/components/grading/AddRecordView.tsx"
    - "frontend/src/components/grading/AddRecordView.test.tsx"
    - "frontend/src/components/grading/AddClassReportView.tsx"
    - "frontend/src/components/grading/AddClassReportView.test.tsx"
  preserve:
    - "sessionStorage key theo version, user và loại form"
    - "API payload, validation, RBAC, edit mode và xóa draft sau submit thành công"
    - "Không khôi phục draft của form/người dùng khác"
  out:
    - "Backend/database draft"
    - "Đồng bộ giữa tab, thiết bị hoặc sau khi đóng tab/đăng xuất"
    - "Thay đổi RouteGuard hoặc thiết kế lại giao diện form"

acceptance_criteria:
  - "AC-01: Tại form tạo Ghi nhận HSSV, nhập dữ liệu rồi bấm mũi tên Quay lại; mở lại form trong cùng tab phải khôi phục lớp, ngày, chế độ nhập, HSSV/tiêu chí/ghi chú đang chọn và danh sách vi phạm đã thêm."
  - "AC-02: Tại form tạo Ghi nhận lớp, nhập dữ liệu rồi bấm mũi tên Quay lại; mở lại form trong cùng tab phải khôi phục lớp, ngày, giáo viên, ghi chú lớp, chế độ nhập, lựa chọn tạm và vi phạm đã thêm; số chuyên cần được tính lại."
  - "AC-03: Điều hướng khỏi form bằng unmount/chuyển trang không xóa draft; dữ liệu mới nhất được lưu trước khi gọi onBack khi người dùng bấm Quay lại."
  - "AC-04: Nút Hủy bỏ là thao tác loại bỏ có chủ đích và phải tách khỏi Quay lại; sau Hủy bỏ, lần mở form kế tiếp không phục hồi dữ liệu cũ."
  - "AC-05: Submit thành công vẫn xóa draft; submit lỗi vẫn giữ draft; edit mode không đọc hoặc ghi draft tạo mới."

execution:
  - "E-01 [AC-01, AC-03..AC-05] AddRecordView.tsx → tách handler Quay lại (lưu/giữ draft) khỏi handler Hủy bỏ (xóa draft), dùng cùng một phép dựng snapshot để tránh lệch field."
  - "E-02 [AC-02..AC-05] AddClassReportView.tsx → áp dụng cùng lifecycle; chỉ persist state nguồn, không persist số chuyên cần dẫn xuất."
  - "E-03 [AC-01, AC-03..AC-05] AddRecordView.test.tsx → bổ sung regression test nhập → Quay lại → remount/restore, Hủy bỏ → không restore, submit lỗi/thành công giữ/xóa đúng."
  - "E-04 [AC-02..AC-05] AddClassReportView.test.tsx → bổ sung cùng ma trận regression và xác nhận chuyên cần được tính lại từ draft."

temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested rolling taskscope"

verification:
  - "V-01 [AC-01, AC-03..AC-05] npm --prefix frontend test -- src/components/grading/AddRecordView.test.tsx → pass."
  - "V-02 [AC-02..AC-05] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx → pass."
  - "V-03 [AC-01..AC-05] npm --prefix frontend run typecheck → exit 0."
  - "V-04 [AC-01..AC-05] Manual trên cả hai form: nhập dở → Quay lại → mở lại có dữ liệu; Hủy bỏ hoặc lưu thành công → mở lại form trắng; lỗi lưu → draft còn."

risks:
  - "Hai nút Quay lại và Hủy bỏ hiện dùng chung handler; khi tách phải giữ rõ semantics để không vô tình lưu draft sau submit hoặc trong edit mode."
  - "Test component cần mock dữ liệu nền/auth/API nhưng phải kiểm tra hành vi UI thực, không chỉ validator của schema."

stop_conditions:
  - "Dừng nếu yêu cầu đổi sang lưu dài hạn qua đóng tab/đăng xuất, đồng bộ server, hoặc thay đổi API/RBAC."
