task: "Mở rộng ghi nhận vi phạm và lưu trữ an toàn dữ liệu rèn luyện"
pipeline: feature_development
profile: Full
objective: "Cho phép ghi nhận mọi sinh viên vi phạm trong lớp, dọn ghi nhận HSSV theo khoảng ngày có bảo vệ dữ liệu đang chấm/thuộc báo cáo lớp, và lưu bản chốt điểm trong hồ sơ sinh viên trước khi bảng điểm được xóa."

evidence:
  current_behavior:
    - "frontend/src/components/grading/AddClassReportView.tsx:getViolationAddError → chặn phần tử thứ 11 bằng `violations.length >= 10`; roster thực tế phân trang 30 và hỗ trợ tải thêm."
    - "frontend/src/app/(dashboard)/students/record/page.tsx:GlobalConfigDialog → chỉ có Thùng rác/Import, chưa có dọn ghi nhận theo khoảng ngày."
    - "backend/src/academic-record/academic-record.service.ts:remove/forceRemove → chỉ bảo vệ summary `locked` và record có `daily_report_id`; chưa có preview/purge theo khoảng ngày hoặc bảo vệ các phase đang chấm."
    - "backend/src/evaluation-periods/evaluation-periods.service.ts:update → đổi thẳng trạng thái sang `closed`, chưa chụp bản điểm; backend/src/students/schemas/student.schema.ts chỉ giữ `training_point_id` tham chiếu SummaryPoint."
    - "backend/src/summaries-point/summaries-point.service.ts:remove/findLatestForStudent → không cho xóa summary locked và trang hồ sơ đọc trực tiếp SummaryPoint, nên xóa bảng điểm sẽ làm mất nguồn hiển thị."
  expected_behavior: "Không giới hạn số vi phạm; Admin xem trước và xác nhận purge an toàn; đóng kỳ tạo snapshot điểm bất biến trong hồ sơ; chỉ bảng điểm đã snapshot của kỳ đóng mới được xóa."
  root_cause: "Giới hạn cứng ở UI và mô hình hồ sơ hiện chỉ tham chiếu dữ liệu vận hành, chưa có snapshot độc lập hay quy trình purge theo trạng thái kỳ."

scope:
  inspect:
    - "backend/src/academic-record/schemas/academic-record.schema.ts:recorded_at,daily_report_id,semester_id"
    - "backend/src/evaluation-periods/schemas/evaluation-period.schema.ts:status"
    - "backend/src/summaries-point/schemas/summary-point.schema.ts:locked result fields"
  write:
    - "frontend/src/components/grading/AddClassReportView.tsx:getViolationAddError; AddClassReportView.test.tsx"
    - "frontend/src/app/(dashboard)/students/record/page.tsx:GlobalConfigDialog/purge modal; page.test.tsx; frontend/src/api/academic-record-api.ts"
    - "backend/src/academic-record/dto/purge-academic-records.dto.ts; academic-record.controller.ts; academic-record.service.ts; academic-record.module.ts; academic-record.service.spec.ts"
    - "backend/src/students/schemas/student.schema.ts:training_point_history; frontend/src/api/student-api.ts; frontend/src/app/(dashboard)/students/[classId]/[id]/page.tsx and new page.test.tsx"
    - "backend/src/evaluation-periods/evaluation-periods.module.ts; evaluation-periods.service.ts; new evaluation-periods.service.spec.ts"
    - "backend/src/summaries-point/summaries-point.controller.ts; summaries-point.service.ts; test/summaries-point.service.spec.ts; frontend/src/api/summaries-point-api.ts; frontend/src/app/(dashboard)/grading/page.tsx"
  preserve:
    - "RBAC hiện hữu; chỉ ADMIN_FULL được purge hàng loạt hoặc xóa bảng điểm đã chốt."
    - "Ghi nhận có daily_report_id và DailyClassReport không bị xóa bởi purge HSSV."
    - "API xóa đơn lẻ, thùng rác, tính điểm và dữ liệu SummaryPoint chưa đóng kỳ."
    - "Snapshot không chứa log/evidence hoặc dữ liệu cá nhân ngoài định danh sinh viên và kết quả điểm cần hiển thị."
  out:
    - "Xóa báo cáo lớp/DailyClassReport, migration xóa dữ liệu cũ, tự động purge theo lịch, thay đổi công thức chấm điểm."

acceptance_criteria:
  - "AC-01: Một lớp có trên 10 vi phạm có thể thêm và lưu toàn bộ; vẫn chặn trùng cặp student/criterion và không làm mất bản nháp/tải thêm roster."
  - "AC-02: Admin chọn startDate/endDate hợp lệ (bao gồm hai đầu theo recorded_at) và nhận preview gồm eligible, protectedClassReport, protectedActiveGrading; preview không thay đổi dữ liệu."
  - "AC-03: Modal xác nhận hiển thị khoảng ngày/các nhóm/số lượng; purge chỉ hard-delete eligible, không xóa daily_report_id hoặc semester thuộc period `sv_phase|gv_phase|admin_phase`, và trả đúng deleted/skipped counts."
  - "AC-04: Người thiếu ADMIN_FULL bị 403; ngày thiếu/đảo/không hợp lệ bị 400; execute tự tính lại tập mục tiêu thay vì tin counts từ client."
  - "AC-05: Chuyển period sang `closed` upsert idempotent một snapshot cho mỗi student+semester+period từ SummaryPoint locked, gồm total_score, grading, rank, semester/period và locked_at; nếu còn summary chưa locked hoặc lưu snapshot thất bại thì không đóng kỳ."
  - "AC-06: Trang thông tin sinh viên hiển thị điểm snapshot mới nhất sau khi SummaryPoint nguồn đã bị xóa; dữ liệu lịch sử cũ và `training_point_id` vẫn tương thích."
  - "AC-07: Admin có thể xóa hàng loạt SummaryPoint của period closed chỉ khi mọi bản ghi mục tiêu đã có snapshot khớp; period đang chấm/chưa đóng hoặc snapshot thiếu bị từ chối và không xóa một phần."

execution:
  - "E-01 [AC-01] AddClassReportView → bỏ giới hạn tổng 10, giữ kiểm tra duplicate và test phần tử 11+."
  - "E-02 [AC-02..AC-04] AcademicRecord controller/service/DTO → thêm preview + execute dùng cùng bộ lọc recorded_at; phân nhóm bảo vệ bằng daily_report_id và EvaluationPeriod; validate/RBAC/audit kết quả."
  - "E-03 [AC-02..AC-04] Student record UI/API → thêm tiện ích, chọn ngày, preview và modal xác nhận; refresh danh sách sau thành công."
  - "E-04 [AC-05,AC-06] Student schema + EvaluationPeriodsService → thêm embedded snapshot tối thiểu và archive idempotent trước transition closed; hồ sơ ưu tiên snapshot gần nhất khi summary không còn."
  - "E-05 [AC-07] SummariesPoint service/controller/UI → endpoint bulk delete theo period với preflight toàn bộ; thay luồng Promise xóa từng ID bằng thao tác nguyên khối có xác nhận."
  - "E-06 [AC-01..AC-07] Chạy test tập trung, typecheck/build và rà diff theo từng AC."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx → test phần tử 11+ pass."
  - "V-02 [AC-02..AC-04] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand → preview/purge/protected/RBAC/date tests pass."
  - "V-03 [AC-02..AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → modal/preview/confirm/refresh tests pass."
  - "V-04 [AC-05] npm --prefix backend test -- src/evaluation-periods/evaluation-periods.service.spec.ts --runInBand → close/archive/idempotency/fail-closed tests pass."
  - "V-05 [AC-06,AC-07] npm --prefix backend test -- src/summaries-point/test/summaries-point.service.spec.ts --runInBand → snapshot fallback và atomic preflight-delete tests pass."
  - "V-06 [AC-06,AC-07] npm --prefix frontend test -- 'src/app/(dashboard)/students/[classId]/[id]/page.test.tsx' 'src/app/(dashboard)/grading/page.test.tsx' → archived score/bulk-delete UI tests pass."
  - "V-07 [AC-01..AC-07] npm --prefix frontend run typecheck; npm --prefix backend run build → exit 0."

risks:
  - "Hard delete và thay đổi schema dữ liệu là high risk; cần backup/rollback và Human Gate trước khi áp dụng lên dữ liệu thật."
  - "Đóng kỳ cần fail-closed để tránh trạng thái closed nhưng snapshot thiếu; bulk delete cần preflight nguyên tập để tránh xóa một phần."
  - "Mốc ngày dùng recorded_at theo quy ước UTC hiện hữu; đổi sang múi giờ nghiệp vụ cần quyết định riêng."

stop_conditions:
  - "Dừng nếu triển khai yêu cầu migration/backfill dữ liệu đã đóng hoặc thao tác trên database thật chưa được phê duyệt Human Gate."
  - "Dừng nếu một học kỳ được phép có nhiều period chồng lấn hoặc product yêu cầu khoảng ngày theo occurred_at/createdAt thay vì recorded_at."
