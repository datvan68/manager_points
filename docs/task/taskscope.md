task: "Hiển thị tài khoản ghi nhận và xoá HSSV theo batch tiến triển"
pipeline: feature_development
profile: Full
objective: "Tab Tình hình lớp học hiển thị tên tài khoản tạo báo cáo; các thao tác xoá tạm/xoá vĩnh viễn HSSV chạy tuần tự theo batch nhỏ và loại từng bản ghi thành công khỏi UI trước khi toàn bộ tác vụ kết thúc."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:class report table dùng report.teacher_name; runBulkRecordDelete gửi batch 25 nhưng chỉ lọc/refetch danh sách sau toàn bộ vòng lặp. backend/src/daily-class-report/daily-class-report.service.ts:findAll đã populate reported_by.user_name; backend/src/academic-record/academic-record.service.ts:bulkDelete đã xử lý tuần tự từng ID và trả succeeded/failed."
  expected_behavior: "Cột Giảng viên ghi nhận lấy reported_by.user_name; soft/force delete giữ batch tuần tự, cập nhật progress và loại ngay các ID succeeded, còn ID lỗi vẫn hiển thị/được chọn để thử lại."
  root_cause: "Frontend dùng trường teacher_name thay vì tài khoản reported_by và trì hoãn cập nhật academicRecords/deletedRecords đến khi mọi batch hoàn tất."

scope:
  inspect: ["backend/src/daily-class-report/daily-class-report.service.ts:findAll populate contract", "backend/src/academic-record/academic-record.service.ts:bulkDelete result contract"]
  write: ["frontend/src/api/daily-class-report-api.ts:DailyClassReport reported_by type", "frontend/src/app/(dashboard)/students/record/page.tsx:creator display and runBulkRecordDelete state updates", "frontend/src/app/(dashboard)/students/record/page.test.tsx:creator and progressive deletion regressions"]
  preserve: ["DELETE_STUDENT_RECORD guard, hierarchy/RBAC, confirmation dialogs, soft versus permanent semantics, API URLs/payload/result contract, failed-row retryability, final server refetch", "teacher_name persistence and Excel export"]
  out: ["backend/schema/migration changes", "class-report deletion flow", "new dependency or parallel delete requests"]

acceptance_criteria:
  - "AC-01: Mỗi hàng Tình hình lớp học hiển thị reported_by.user_name trong cột Giảng viên ghi nhận; thiếu population thì hiển thị fallback an toàn, không dùng teacher_name làm nguồn chính."
  - "AC-02: Xoá tạm và xoá vĩnh viễn nhiều ghi nhận gửi các batch giới hạn theo thứ tự, không chạy song song; mỗi batch kế tiếp chỉ bắt đầu sau batch trước hoàn tất."
  - "AC-03: Sau mỗi response, từng ID trong succeeded biến mất khỏi đúng danh sách và selection/progress được cập nhật khi tác vụ còn chạy; failed vẫn hiển thị, được chọn và có thông báo lỗi."
  - "AC-04: Kết thúc tác vụ, frontend refetch để đồng bộ server; toast/kết quả phản ánh đúng tổng thành công/thất bại và chặn thao tác xoá trùng khi đang chạy."

execution:
  - "E-01 [AC-01] frontend/src/api/daily-class-report-api.ts:DailyClassReport + frontend/src/app/(dashboard)/students/record/page.tsx:class report row → khai báo reported_by và resolve user_name với fallback rõ ràng."
  - "E-02 [AC-02..AC-04] frontend/src/app/(dashboard)/students/record/page.tsx:runBulkRecordDelete → giữ batch tuần tự, dùng result.succeeded để cập nhật academicRecords hoặc deletedRecords và selectedIds ngay sau từng batch, tích luỹ failed/progress, rồi refetch một lần để đối soát."
  - "E-03 [AC-01..AC-04] frontend/src/app/(dashboard)/students/record/page.test.tsx → bổ sung mock/assertion cho creator account, thứ tự batch, cập nhật hàng trong lúc batch sau còn pending, soft/force success, partial failure và chống gọi lặp."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx → focused suite passes."
  - "V-02 [AC-01] npm --prefix frontend test -- src/api/daily-class-report-api.test.ts → normalization/API contract suite passes."
  - "V-03 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-04 [AC-02..AC-04] Manual throttled-network check with >25 selected active and trash records → requests remain sequential, successful rows disappear progressively, failed rows remain actionable, UI stays responsive."

risks: ["Delete orchestration affects persistent data; implementation requires independent diff review of sequential ordering, RBAC preservation, partial failures, and list reconciliation before completion."]
stop_conditions: ["Stop if reported_by is absent from the real list response, the backend bulk result no longer returns succeeded/failed, progressive removal requires changing delete semantics/API/schema, or existing dirty changes overlap the three write paths."]
