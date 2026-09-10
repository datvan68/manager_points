slot_id: "taskscope-01"
generation: 1
task_id: "20260910-home-discipline-follow-up"
scope_file: "docs/task/taskscope-01.md"
status: in_progress
scope_revision: 4
created_at: "2026-09-10T14:11:35+07:00"
updated_at: "2026-09-10T15:04:53+07:00"
base_commit: "0f15a1b4022bfa3c0d4a6a767c65bd6fead8a120"
task: "Hiển thị đúng ghi nhận kỷ luật cần xử lý trên trang chủ"
pipeline: feature_development
profile: Full
objective: "Giữ danh sách Kỷ luật trên trang chủ gọn và dễ ưu tiên: hiển thị sinh viên chưa xử lý từ 3 ghi nhận trở lên, đồng thời đưa sinh viên đã xử lý nhưng có phát sinh mới lên đầu danh sách và đánh dấu Ghi nhận mới."
coordination:
  depends_on: []
  warnings:
    - "V-05 chưa chạy: chưa chứng minh được frontend/API/database dev tách production mà không đọc runtime secret; cần người dùng cung cấp metadata đích dev an toàn hoặc xác minh qua môi trường dev."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "backend/src/system/system.service.ts:getStudentHighlights gom toàn bộ ghi nhận kỷ luật active theo sinh viên, lọc recordCount >= 3 và không đọc AcademicRecordFollowUp; frontend/src/components/dashboard/StudentSpotlightPanel.tsx hiển thị total này dưới nhãn Kỷ luật & Chú ý và các số liệu lũy kế học kỳ."
  expected_behavior: "Danh sách kỷ luật gồm sinh viên chưa xử lý có từ 3 ghi nhận active trở lên và sinh viên đã xử lý nhưng có ít nhất 1 ghi nhận mới. Nhóm có phát sinh mới luôn đứng đầu và có text Ghi nhận mới; nhóm thông thường không có text này. Trong từng nhóm, số lần ghi nhận được sắp xếp giảm dần. Mỗi hàng chỉ giữ họ tên, MSSV, lớp, tổng số lần ghi nhận và tổng điểm bị trừ, ngoài dấu hiệu Ghi nhận mới khi áp dụng."
  root_cause: "getStudentHighlights chỉ group toàn bộ discipline active rồi lọc recordCount >= 3, chưa đối chiếu AcademicRecordFollowUp checkpoint."
scope:
  inspect:
    - "backend/src/academic-record/academic-record-follow-up.service.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/schemas/academic-record-follow-up.schema.ts"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/api/system-api.ts"
  write:
    - "backend/src/system/system.service.ts"
    - "backend/src/system/system.service.spec.ts"
    - "frontend/src/components/dashboard/dashboard-helpers.ts"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.tsx"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.test.tsx"
    - "frontend/src/components/dashboard/dashboard-helpers.test.tsx"
  preserve:
    - "GET /api/system/student-highlights tiếp tục giữ nguyên RBAC, phạm vi lớp của giáo viên, phạm vi cá nhân, học kỳ, phân trang và các trường phản hồi hiện có."
    - "Hai nhóm rewards và bonus giữ nguyên điều kiện, sắp xếp, nội dung và số tổng hiện tại."
    - "Chỉ ghi nhận kỷ luật status=active và is_deleted!=true được tính; mốc mới dùng cùng thứ tự createdAt rồi _id như luồng markHandled hiện có."
    - "Không thay đổi schema AcademicRecordFollowUp, dữ liệu đã lưu, quyền hay API đánh dấu/reset xử lý."
  out:
    - "Thay đổi trang Báo cáo hoặc semantics các bộ lọc Chưa xử lý/Đã xử lý/Ghi nhận mới"
    - "Migration, backfill hoặc ghi trực tiếp cơ sở dữ liệu"
    - "Thay đổi trang hồ sơ sinh viên và màn hình quản lý ghi nhận"
    - "Commit, push, deploy hoặc kiểm thử production"
acceptance_criteria:
  - "AC-01: Ở category=discipline, sinh viên chưa có checkpoint chỉ xuất hiện khi có ít nhất 3 ghi nhận kỷ luật active trong học kỳ; sinh viên có checkpoint và không có ghi nhận kỷ luật mới bị loại khỏi items và total."
  - "AC-02: Sinh viên có checkpoint xuất hiện lại ngay từ ghi nhận kỷ luật active đầu tiên có createdAt/_id lớn hơn checkpoint; phản hồi trả followUpStatus=new, newRecordCount và newImpactScore chỉ tính phần phát sinh, trong khi recordCount và impactScore vẫn là tổng số lần và tổng điểm bị trừ trong học kỳ để tương thích."
  - "AC-03: Hàng discipline thông thường từ 3 lần trở lên không hiển thị text Ghi nhận mới. Hàng của sinh viên đã xử lý nhưng phát sinh thêm hiển thị text Ghi nhận mới và luôn nằm trước toàn bộ hàng thông thường."
  - "AC-04: Trong nhóm Ghi nhận mới và nhóm thông thường, sắp xếp giảm dần theo số lần ghi nhận hiển thị; nếu bằng nhau, sắp xếp giảm dần theo tổng điểm bị trừ tuyệt đối, rồi dùng khóa sinh viên ổn định. Phân trang/count được áp dụng sau khi xác định danh sách và thứ tự này."
  - "AC-05: Mỗi hàng discipline chỉ hiển thị gọn họ tên, MSSV, lớp, Số lần ghi nhận và Điểm trừ là tổng điểm bị trừ trong học kỳ; không hiển thị ngày, điểm trừ phát sinh, tổng học kỳ lặp lại hoặc text trạng thái Chưa xử lý. Text Ghi nhận mới là ngoại lệ duy nhất cho hàng có phát sinh sau xử lý."
  - "AC-06: Rewards/bonus, điều kiện active/deleted, RBAC và phạm vi dữ liệu theo vai trò không thay đổi; không có schema, migration hoặc public-field removal/rename."
execution:
  - "E-01 [AC-01,AC-02,AC-03,AC-04,AC-06] backend/src/system/system.service.ts:getStudentHighlights -> với category discipline, đối chiếu checkpoint AcademicRecordFollowUp theo student+semester, xác định bản ghi sau mốc bằng cặp createdAt/_id, tính delta, lọc actionable và sắp xếp nhóm new trước rồi recordCount giảm dần trước facet; giữ pipeline hiện tại cho rewards/bonus và giữ các trường tổng lũy kế."
  - "E-02 [AC-01,AC-02,AC-03,AC-04,AC-06] backend/src/system/system.service.spec.ts -> kiểm thử unhandled đủ ngưỡng, settled bị loại, một bản ghi mới tái xuất hiện và luôn đứng đầu, thứ tự recordCount/điểm trừ giảm dần, tie-break ổn định, delta và count trước phân trang; giữ kiểm thử quyền hiện có."
  - "E-03 [AC-02,AC-03,AC-05,AC-06] frontend/src/components/dashboard/dashboard-helpers.ts và frontend/src/components/dashboard/StudentSpotlightPanel.tsx -> mở rộng kiểu dữ liệu bằng trường follow-up cộng thêm và rút gọn hàng discipline còn họ tên, MSSV, lớp, tổng số lần, tổng điểm trừ; chỉ render text Ghi nhận mới cho followUpStatus=new; giữ điều hướng hồ sơ, virtual pagination và hai category còn lại."
  - "E-04 [AC-03,AC-04,AC-05,AC-06] frontend/src/components/dashboard/StudentSpotlightPanel.test.tsx và frontend/src/components/dashboard/dashboard-helpers.test.tsx -> kiểm thử new luôn đứng đầu, sắp xếp lớn đến bé, text new chỉ xuất hiện đúng hàng, UI tối giản và bất biến rewards/bonus."
verification:
  - "V-01 [AC-01,AC-02,AC-03,AC-04,AC-06] npm --prefix backend test -- --runTestsByPath src/system/system.service.spec.ts --runInBand -> toàn bộ test file pass, gồm ba trạng thái follow-up, thứ tự ưu tiên/giảm dần và RBAC."
  - "V-02 [AC-03,AC-04,AC-05,AC-06] npm --prefix frontend test -- \"src/components/dashboard/StudentSpotlightPanel.test.tsx\" \"src/components/dashboard/dashboard-helpers.test.tsx\" -> toàn bộ test mục tiêu pass."
  - "V-03 [AC-02,AC-03,AC-05,AC-06] npm --prefix frontend run typecheck -> không có lỗi TypeScript."
  - "V-04 [AC-01,AC-02,AC-04,AC-06] npm --prefix backend run build -> Nest build thành công."
  - "V-05 [AC-01,AC-02,AC-03,AC-04,AC-05] kiểm thử dev UI/API sau khi xác minh frontend, API và database đều là dev tách production -> settled biến mất; thêm 1 kỷ luật mới làm sinh viên tái xuất hiện ở đầu với text Ghi nhận mới; nhóm thường giảm dần theo số lần; hàng chỉ còn đúng các trường UI yêu cầu; xử lý lại làm sinh viên biến mất; total và phân trang khớp danh sách actionable."
runtime_test:
  identity: "Xác minh read-only tại thời điểm chạy bằng URL frontend/API hiệu lực, database name và đích lưu trữ/queue liên quan; không đọc hoặc ghi secret và dừng V-05 nếu chưa chứng minh được tách production."
  resources: "Một sinh viên thử nghiệm được xác định rõ trong học kỳ dev hiện hành và checkpoint follow-up tương ứng; ưu tiên dữ liệu tổng hợp gắn nhãn task_id này nếu cần tạo mới."
  allowed_operations: "Qua UI/API hiện có: tạo ghi nhận kỷ luật thử nghiệm, đánh dấu đã xử lý, đọc dashboard/báo cáo và xóa chỉ các bản ghi disposable do task tạo; không ghi raw database."
  scenarios: "Đạt ngưỡng chưa xử lý; settled không phát sinh; thêm đúng 1 ghi nhận sau checkpoint; xử lý lại; kiểm tra rewards/bonus không đổi."
  pass_signals: "API items/total và UI cùng phản ánh actionable; hàng new đứng đầu và có text Ghi nhận mới; các hàng trong từng nhóm giảm dần theo recordCount; UI chỉ hiện họ tên, MSSV, lớp, tổng số lần và tổng điểm trừ; newRecordCount/newImpactScore là delta API còn recordCount/impactScore vẫn là tổng học kỳ; không có dữ liệu ngoài phạm vi vai trò."
  cleanup: "Xóa qua API các ghi nhận disposable do task tạo và reset/xóa checkpoint chỉ khi checkpoint đó do task tạo; nếu dùng record dev có sẵn thì lưu before-state tối thiểu, kiểm tra không có thay đổi xen kẽ và khôi phục chính xác."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Aggregate discipline bổ sung lookup có thể tăng chi phí; giữ lookup sau phạm vi semester/role/type và kiểm chứng phân trang/count trên dữ liệu dev."
  - "Dùng recorded_at thay createdAt sẽ lệch semantics checkpoint hiện có; bắt buộc dùng createdAt/_id cho việc xác định phát sinh mới."
stop_conditions:
  - "TASKSCOPE_CONFLICT nếu có scope active mới hoặc thay đổi không xác định trên write paths khi bắt đầu/resume."
  - "Dừng runtime V-05 nếu không chứng minh được frontend/API/database là dev tách production hoặc tích hợp ngoài chưa được vô hiệu hóa/capture."
  - "Dừng để sửa scope nếu cần đổi schema, migration, quyền, xóa/đổi tên trường API hiện có hoặc thay semantics trang Báo cáo."
