task: "Khôi phục và hoàn thiện xoá vĩnh viễn lớp"
pipeline: bug_fix
profile: Full
objective: "Người có quyền xoá được lớp từ Danh sách lớp; phản hồi thành công chỉ khi lớp, sinh viên và toàn bộ dữ liệu phụ thuộc đã bị xoá vĩnh viễn."

evidence:
  current_behavior: "backend/src/classes/classes.service.ts:remove dùng session.withTransaction nhưng docker-compose*.yml cấu hình MongoDB standalone; cascade hiện chỉ xoá User, Student và Class, bỏ lại nhiều schema tham chiếu class_id/student_id/user_id."
  expected_behavior: "DELETE /classes/:id chạy được trên topology hiện hành, xoá dữ liệu phụ thuộc và lớp không thể khôi phục; 404 cho ID lớp không tồn tại, CLASS_DELETE vẫn bắt buộc."
  root_cause: "MongoDB standalone không hỗ trợ transaction; ClassesService.remove phụ thuộc transaction và chưa có manifest cascade đầy đủ."

scope:
  inspect: ["backend/src/**/schemas/*.ts:các ref Class/Student/User", "backend/src/students/students.service.ts:remove và quy tắc tài khoản/KTX", "frontend/src/app/(dashboard)/students/page.tsx:handleClassDeleteConfirm/ConfirmModal"]
  write: ["backend/src/classes/classes.service.ts:remove + purge manifest", "backend/src/classes/test/classes.service.spec.ts:regression cascade/retry/failure", "backend/test/classes.e2e-spec.ts:DELETE cascade", "backend/src/auth/permissions.registry.ts:CLASS_DELETE description"]
  preserve: ["DELETE /classes/:id và response hiện hành", "CLASS_DELETE guard/RBAC", "không xoá giảng viên cố vấn hoặc dữ liệu dùng chung; chỉ xoá record sở hữu riêng và gỡ ID sinh viên khỏi mảng tham chiếu dùng chung", "UI cảnh báo và trạng thái pending hiện có"]
  out: ["Soft-delete/khôi phục", "Đổi MongoDB sang replica set", "Xoá lớp hàng loạt", "Dọn orphan tồn tại trước thay đổi"]

acceptance_criteria:
  - "AC-01: Lớp có sinh viên xoá được trên MongoDB standalone; các bước idempotent, Class bị xoá sau cùng nên retry hoàn tất được khi bước trước lỗi."
  - "AC-02: Trước khi xoá Student/User, purge mọi document sở hữu riêng tham chiếu class_id/classId, student_id/studentId hoặc user_id của sinh viên trong điểm rèn luyện, báo cáo lớp, điểm danh, hoạt động, nhiệm vụ, KTX và auth; gỡ ID khỏi mảng của document dùng chung."
  - "AC-03: Khi trả 200, không còn Class, Student, tài khoản sinh viên hoặc tham chiếu thuộc lớp; không có API khôi phục. Lỗi giữa chừng không được xoá Class và trả lỗi."
  - "AC-04: ID không tồn tại trả 404; thiếu CLASS_DELETE bị từ chối; cố vấn, activity/task dùng chung và dữ liệu lớp khác không đổi."

execution:
  - "E-01 [AC-01..AC-04] classes.service.ts → thay transaction bằng purge idempotent theo ObjectId đã chụp, phân biệt deleteMany với $pull, xoá User/Student/Class theo thứ tự phụ thuộc và Class cuối cùng."
  - "E-02 [AC-04] permissions.registry.ts → sửa mô tả CLASS_DELETE cho đúng hành vi xoá vĩnh viễn có cascade."
  - "E-03 [AC-01..AC-04] classes.service.spec.ts + classes.e2e-spec.ts → kiểm chứng thứ tự, đầy đủ manifest, retry/failure, isolation, 404/RBAC và không còn orphan."
  - "E-04 [AC-01..AC-04] independent review → đối chiếu toàn bộ schema ref và xác nhận không xoá document dùng chung/ngoài lớp."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix backend test -- classes/test/classes.service.spec.ts --runInBand → Jest pass."
  - "V-02 [AC-01..AC-04] npm --prefix backend run test:e2e -- --runInBand test/classes.e2e-spec.ts → cascade/isolation/RBAC pass."
  - "V-03 [AC-01..AC-04] npm --prefix backend run build → exit 0; git diff --check → exit 0."

risks: ["Xoá vĩnh viễn dữ liệu cá nhân, điểm rèn luyện, hoạt động và KTX; lỗi giữa cascade có thể đã xoá một phần dù lớp được giữ để retry.", "Schema mới thêm ref Student/Class/User sau này phải cập nhật purge manifest và test inventory."]
stop_conditions: ["Dừng trước khi bật/chạy endpoint trên dữ liệu thật nếu chưa có phê duyệt Human Gate và bản sao lưu đã kiểm chứng.", "Dừng nếu nghiệp vụ yêu cầu giữ chứng từ tài chính/audit hoặc không cho phép xoá một collection được liệt kê; cần quyết định retention trước triển khai."]
