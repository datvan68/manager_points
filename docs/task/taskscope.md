slot_id: "taskscope-00"
generation: 1
task_id: "20260910-140617-class-record-dashboard-popover"
scope_file: "docs/task/taskscope.md"
status: ready
scope_revision: 1
created_at: "2026-09-10T14:06:17+07:00"
updated_at: "2026-09-10T14:06:17+07:00"
base_commit: "3149dcdcb1f285709981a3822ff67ee0690795b5"
task: "Thêm danh sách ghi nhận theo lớp và popover chi tiết trên dashboard"
pipeline: feature_development
profile: Full
objective: "Với người dùng được phép xem ghi nhận sinh viên, thay ô tiến độ đánh giá bên phải bằng danh sách lớp của học kỳ đang chọn; mỗi lớp hiển thị tổng số lượt ghi nhận và mở popover ngắn gọn gồm sinh viên, lớp và nội dung ghi nhận."
coordination:
  depends_on: []
  warnings:
    - "Thay đổi trả về tên sinh viên theo phạm vi lớp; cần independent review về RBAC và personal-data scope trước khi hoàn tất."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/dashboard/EvaluationProgressPanel.tsx:EvaluationProgressPanel hiển thị empty state khi không có activePeriod; backend/src/system/system.service.ts:getDashboardMetrics chỉ trả tối đa 5 recentAcademicRecords, chưa có tổng hợp theo lớp."
  expected_behavior: "Dashboard staff hiển thị từng lớp dạng 'Lớp ABC - N ghi nhận'; bấm lớp mở popover các ghi nhận mới nhất, mỗi mục có 'Sinh viên - Lớp' và nội dung ghi nhận, đúng học kỳ và phạm vi truy cập."
  root_cause: null
scope:
  inspect:
    - "backend/src/auth/permissions.registry.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.tsx"
    - "frontend/src/components/ui/popover.tsx"
  write:
    - "backend/src/system/dto/system.dto.ts"
    - "backend/src/system/system.controller.ts"
    - "backend/src/system/system.service.ts"
    - "backend/src/system/class-record-summaries.controller.spec.ts"
    - "backend/src/system/class-record-summaries.service.spec.ts"
    - "frontend/src/api/system-api.ts"
    - "frontend/src/api/system-api.test.ts"
    - "frontend/src/components/dashboard/dashboard-helpers.ts"
    - "frontend/src/components/dashboard/ClassRecordPanel.tsx"
    - "frontend/src/components/dashboard/ClassRecordPanel.test.tsx"
    - "frontend/src/components/dashboard/DashboardDeferredPanels.tsx"
    - "frontend/src/app/(dashboard)/page.tsx"
    - "frontend/src/app/(dashboard)/page.test.tsx"
  preserve:
    - "Sinh viên và người không có quyền xem dữ liệu staff tiếp tục thấy EvaluationProgressPanel; không tải danh sách lớp."
    - "Dữ liệu chỉ gồm academic record active, chưa xóa và thuộc học kỳ đang chọn."
    - "Teacher chỉ thấy sinh viên thuộc lớp mình phụ trách; quyền và phạm vi phải tương đương getStudentHighlights, có kiểm tra ở controller và service."
    - "Không thay đổi schema MongoDB, API hiện có, trạng thái ghi nhận hoặc dữ liệu lưu trữ."
    - "Dashboard ban đầu vẫn tải một request metrics; danh sách lớp được tải trong khu vực deferred và không chặn nội dung chính."
  out:
    - "Thay đổi trang quản lý /students/record hoặc nghiệp vụ tạo/sửa/xóa ghi nhận."
    - "Thay đổi cách tính điểm, kỳ đánh giá hoặc quyền hiện có."
    - "Migration, seed, dependency mới, commit, push hoặc triển khai."
acceptance_criteria:
  - "AC-01: Endpoint phân trang danh sách lớp yêu cầu READ_STUDENT_RECORD, từ chối staff thiếu quyền, lọc teacher theo lớp phụ trách và chỉ trả academic record active/chưa xóa trong học kỳ yêu cầu."
  - "AC-02: Mỗi lớp trả classId, className, tổng số lượt ghi nhận đã chuẩn hóa quantity mặc định 1 và tối đa 8 ghi nhận mới nhất theo recorded_at/createdAt/_id giảm dần."
  - "AC-03: Dashboard staff hiển thị 'Lớp <tên> - <N> ghi nhận'; bấm mục mở popover ngắn gọn, mỗi ghi nhận có dòng '<tên sinh viên> - <tên lớp>' và dòng nội dung ghi nhận, có trạng thái tải/rỗng/lỗi rõ ràng và vùng cuộn giới hạn chiều cao."
  - "AC-04: Đổi học kỳ làm mới danh sách theo đúng semesterId; phản hồi cũ không được ghi đè lựa chọn mới."
  - "AC-05: Sinh viên, system operator thuần túy và staff không đủ quyền không gọi endpoint mới và vẫn giữ panel hiện hành phù hợp vai trò."
execution:
  - "E-01 [AC-01,AC-02] backend/src/system/dto/system.dto.ts + system.controller.ts + system.service.ts -> thêm query/response phân trang class-record-summaries, tái sử dụng role helpers và scopeStages của getStudentHighlights, aggregate theo class và chỉ giữ 8 bản ghi gần nhất."
  - "E-02 [AC-01,AC-02] backend/src/system/class-record-summaries.controller.spec.ts + class-record-summaries.service.spec.ts -> kiểm tra permission metadata, defense-in-depth, teacher scope, semester/status/delete filters, quantity và thứ tự preview."
  - "E-03 [AC-03,AC-04,AC-05] frontend/src/api/system-api.ts + dashboard-helpers.ts + ClassRecordPanel.tsx -> thêm type/client và panel dùng Popover hiện có; request theo semesterId, hủy/loại phản hồi stale, render đúng hai dòng mỗi ghi nhận."
  - "E-04 [AC-03,AC-04,AC-05] frontend/src/components/dashboard/DashboardDeferredPanels.tsx + frontend/src/app/(dashboard)/page.tsx -> truyền học kỳ đang chọn và chỉ thay EvaluationProgressPanel bằng ClassRecordPanel khi highlightMode=staff và có quyền đọc ghi nhận."
  - "E-05 [AC-03,AC-04,AC-05] frontend/src/api/system-api.test.ts + ClassRecordPanel.test.tsx + frontend/src/app/(dashboard)/page.test.tsx -> kiểm tra URL/query, giao diện popover, loading/error/empty, đổi học kỳ và fallback theo quyền/vai trò."
  - "E-06 [AC-01,AC-05] independent review -> xác nhận endpoint và UI không mở rộng dữ liệu cá nhân ngoài phạm vi READ_STUDENT_RECORD/lớp phụ trách."
verification:
  - "V-01 [AC-01,AC-02] npm --prefix backend test -- --runTestsByPath src/system/class-record-summaries.controller.spec.ts src/system/class-record-summaries.service.spec.ts --runInBand -> toàn bộ test endpoint, scope và aggregation pass."
  - "V-02 [AC-01,AC-02] npm --prefix backend run build -> Nest build thành công."
  - "V-03 [AC-03,AC-04,AC-05] npm --prefix frontend test -- \"src/api/system-api.test.ts\" \"src/components/dashboard/ClassRecordPanel.test.tsx\" \"src/app/(dashboard)/page.test.tsx\" -> toàn bộ test mục tiêu pass."
  - "V-04 [AC-03,AC-04,AC-05] npm --prefix frontend run typecheck -> TypeScript không có lỗi."
  - "V-05 [AC-03,AC-04,AC-05] Dev UI: đăng nhập staff có quyền, chọn hai học kỳ và mở một lớp; xác nhận tiêu đề, N, thứ tự/nội dung popover và không có stale response; đăng nhập vai trò không đủ quyền để xác nhận không gọi endpoint và không lộ tên sinh viên."
runtime_test:
  environment: "Xác minh read-only frontend URL, API base và database identity là dev, tách production trước V-05."
  resources: "Dashboard, endpoint class-record-summaries và các academic record hiện có của một lớp/học kỳ dev; chỉ đọc, không tạo/sửa/xóa dữ liệu."
  pass_signals: "Kết quả UI khớp response đã lọc; chuyển học kỳ không trộn dữ liệu; request trái quyền bị chặn và UI không gọi endpoint cho vai trò không đủ quyền."
  cleanup: "Không có dữ liệu cần khôi phục; đóng phiên kiểm thử và không lưu ảnh/log có thông tin cá nhân ngoài bằng chứng tối thiểu."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "Tên sinh viên và nội dung ghi nhận là dữ liệu cá nhân; lỗi scope có thể làm lộ dữ liệu chéo lớp hoặc chéo vai trò."
  - "Aggregation theo lớp trên tập dữ liệu lớn có thể làm chậm endpoint; bắt buộc phân trang lớp, giới hạn 8 preview và kiểm tra pipeline không tải toàn bộ records vào application memory."
stop_conditions:
  - "TASKSCOPE_CONFLICT nếu bất kỳ scope active hoặc thay đổi không rõ nguồn nào chồng lấn write paths."
  - "Dừng dependent runtime test nếu không chứng minh được frontend/API/database là dev và tách production."
  - "Không đánh dấu completed nếu independent review RBAC/personal-data chưa đạt hoặc bất kỳ mandatory verification nào chưa pass."
