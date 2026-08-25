task: "Chặn Import khôi phục dữ liệu đã bỏ chọn"
pipeline: bug_fix
profile: Full
objective: "Import chỉ khởi chạy khi có collection được chọn và không thể rơi về khôi phục toàn bộ archive do danh sách chọn rỗng."

evidence:
  current_behavior: "backend/src/system/system.service.ts:runBackupAndRestoreAsync chỉ thêm --nsInclude khi collections.length > 0; request rỗng vì thế chạy mongorestore không có bộ lọc namespace."
  expected_behavior: "Danh sách chọn rỗng bị từ chối trước khi tạo backup/job; tiến trình archive cũng fail closed nếu dữ liệu job rỗng."
  root_cause: "backend/src/system/dto/system.dto.ts:RestoreBackupImportDto không yêu cầu mảng có phần tử và backend/src/system/system.service.ts:restoreBackupImport thiếu kiểm tra phòng thủ."

scope:
  inspect: ["frontend/src/app/(dashboard)/system/page.tsx:handleRestore/selectedCollections", "backend/src/system/{dto/system.dto.ts,system.service.ts}:RestoreBackupImportDto/restoreBackupImport/runBackupAndRestoreAsync", "backend/src/system/system.service.spec.ts:restore regressions"]
  write: ["backend/src/system/dto/system.dto.ts:RestoreBackupImportDto", "backend/src/system/system.service.ts:restoreBackupImport/runBackupAndRestoreAsync", "backend/src/system/system.service.spec.ts:empty-selection regressions"]
  preserve: ["Payload/API thành công khi có collection", "lọc --nsInclude cho collection đã chọn", "backup tự động trước restore", "RBAC và hai chế độ restore"]
  out: ["Thay đổi schema dữ liệu", "restore production", "đổi giao diện modal", "thiết kế lại định dạng backup"]

acceptance_criteria:
  - "AC-01: Request collections=[] trả 400 và không tra/tạo/chạy restore job."
  - "AC-02: Archive job có collections=[] dừng ở trạng thái failed trước mongorestore; job có lựa chọn vẫn chỉ tạo --nsInclude cho các tên đã chọn."

execution:
  - "E-01 [AC-01] backend/src/system/dto/system.dto.ts:RestoreBackupImportDto và backend/src/system/system.service.ts:restoreBackupImport → yêu cầu ít nhất một collection."
  - "E-02 [AC-02] backend/src/system/system.service.ts:runBackupAndRestoreAsync → fail closed trước mongorestore nếu danh sách rỗng."
  - "E-03 [AC-01,AC-02] backend/src/system/system.service.spec.ts → kiểm tra từ chối sớm và không gọi mongorestore."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02] npm --prefix backend test -- system.service.spec.ts --runInBand → suite pass."
  - "V-02 [AC-01,AC-02] npm --prefix backend run build → exit code 0."

risks: ["Restore tác động dữ liệu bền vững; thay đổi áp dụng fail-closed và không chạy thao tác restore thật trong kiểm thử."]
stop_conditions: ["Dừng nếu cần đổi API công khai, schema/migration, chạy restore trên dữ liệu thật, hoặc xử lý archive theo collection cần thiết kế định dạng mới."]
