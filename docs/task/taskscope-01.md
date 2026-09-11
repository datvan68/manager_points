---
slot_id: "taskscope-01"
generation: 1
task_id: "20260911-073847-class-record-repeat-count"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 1
created_at: "2026-09-11T07:38:47+07:00"
updated_at: "2026-09-11T08:02:30+07:00"
base_commit: "9a6cae97729f161768afbc9100883c9528de890d"
task: "Hiển thị số lần lặp trong ghi nhận theo lớp"
pipeline: feature_development
profile: Full
objective: "Trong popup Ghi nhận theo lớp, mỗi sinh viên chỉ xuất hiện một dòng cho cùng một tiêu chí và dòng đó hiển thị tổng số lần được ghi nhận."
coordination:
  depends_on: []
  warnings:
    - "docs/task/taskscope.md là tệp legacy rỗng nên slot 00 được giữ nguyên và không tái sử dụng."
completion:
  completed_at: "2026-09-11T08:02:30+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree dirty with only scoped implementation/test changes and this taskscope; no commit created."
  changed_paths:
    - "backend/src/system/system.service.ts"
    - "backend/src/system/class-record-summaries.service.spec.ts"
    - "frontend/src/api/system-api.ts"
    - "frontend/src/components/dashboard/ClassRecordPanel.tsx"
    - "frontend/src/components/dashboard/ClassRecordPanel.test.tsx"
  checks_passed:
    - "V-01: backend class-record-summaries.service.spec.ts passed, 2 tests."
    - "V-02: frontend ClassRecordPanel.test.tsx passed, 3 tests."
    - "V-03: backend build and frontend typecheck exited 0."
    - "V-04: dev dashboard/API read-only verification passed with class TC26-THUD1-VH26-4K10; total 18, grouped previews showed (2 lần)/(3 lần), single-count previews had no suffix."
    - "git diff --check passed."
  cleanup_pending: []
evidence:
  current_behavior: "backend/src/system/system.service.ts:getClassRecordSummaries cộng quantity vào recordCount của lớp nhưng records vẫn chứa từng bản ghi riêng; frontend/src/components/dashboard/ClassRecordPanel.tsx chỉ hiển thị tên sinh viên và nội dung, không có số lần."
  expected_behavior: "Danh sách mới nhất được nhóm ổn định theo sinh viên và tiêu chí, tổng số lần dùng quantity đã chuẩn hóa, và UI hiển thị '(N lần)' khi nhóm có từ hai lượt trở lên."
  root_cause: "The class-level aggregation grouped directly by class after sorting, so repeated student/criterion records remained separate preview rows even though recordCount already summed normalized quantity."
scope:
  inspect:
    - "backend/src/academic-record/schemas/academic-record.schema.ts"
    - "backend/src/system/system.controller.ts"
  write:
    - "backend/src/system/system.service.ts"
    - "backend/src/system/class-record-summaries.service.spec.ts"
    - "frontend/src/api/system-api.ts"
    - "frontend/src/components/dashboard/ClassRecordPanel.tsx"
    - "frontend/src/components/dashboard/ClassRecordPanel.test.tsx"
  preserve:
    - "Giữ nguyên RBAC và bộ lọc học kỳ, trạng thái active, is_deleted của endpoint class-record-summaries."
    - "Giữ recordCount cấp lớp là tổng quantity của toàn bộ ghi nhận hợp lệ, không phải số nhóm hiển thị."
    - "Giữ tối đa tám nhóm mới nhất trong popup và thứ tự lớp hiện tại."
    - "Không thay đổi schema MongoDB, dữ liệu lưu trữ hoặc endpoint URL; thay đổi response chỉ mang tính bổ sung."
  out:
    - "Các bảng xếp hạng/StudentSpotlightPanel và màn hình ghi nhận ngoài dashboard."
    - "Migration hoặc gộp/chỉnh sửa các AcademicRecord đã lưu."
acceptance_criteria:
  - "AC-01: Hai hoặc nhiều ghi nhận active cùng semester, cùng student_id và cùng criterion_id tạo đúng một preview, với count bằng tổng quantity đã chuẩn hóa."
  - "AC-02: Các sinh viên khác nhau hoặc các criterion_id khác nhau vẫn tạo các preview riêng; bản ghi thiếu quantity hoặc quantity không chuyển đổi được được tính là một lượt theo quy tắc hiện tại."
  - "AC-03: Preview của nhóm dùng nội dung và thời điểm từ ghi nhận mới nhất, các nhóm được xếp theo thời điểm mới nhất giảm dần và chỉ trả tối đa tám nhóm cho mỗi lớp."
  - "AC-04: Popup hiển thị '(N lần)' cạnh nội dung khi count lớn hơn 1 và không thêm hậu tố khi count bằng 1; tổng 'N ghi nhận' ở hàng lớp không thay đổi ý nghĩa."
execution:
  - "E-01 [AC-01,AC-02,AC-03] backend/src/system/system.service.ts:getClassRecordSummaries -> thêm khóa nhóm student_id + criterion_id sau khi sắp xếp mới nhất, cộng normalizedQuantity thành count, giữ dữ liệu preview từ bản ghi mới nhất, sau đó nhóm theo lớp và cắt tám nhóm mới nhất."
  - "E-02 [AC-01,AC-02,AC-03] backend/src/system/class-record-summaries.service.spec.ts -> kiểm tra pipeline nhóm theo sinh viên/tiêu chí, cộng quantity, giữ thứ tự mới nhất và slice tám nhóm mà không đổi bộ lọc/RBAC."
  - "E-03 [AC-04] frontend/src/api/system-api.ts:ClassRecordPreview và frontend/src/components/dashboard/ClassRecordPanel.tsx -> bổ sung count vào contract và render hậu tố số lần có điều kiện."
  - "E-04 [AC-04] frontend/src/components/dashboard/ClassRecordPanel.test.tsx -> thêm trường hợp count=3 hiển thị '(3 lần)' và count=1 không hiển thị hậu tố."
verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix backend test -- --runTestsByPath src/system/class-record-summaries.service.spec.ts --runInBand -> suite pass và assertions xác nhận pipeline nhóm/cộng/sắp xếp/slice."
  - "V-02 [AC-04] npm --prefix frontend test -- \"src/components/dashboard/ClassRecordPanel.test.tsx\" -> suite pass với cả trường hợp một lượt và nhiều lượt."
  - "V-03 [AC-01,AC-04] npm --prefix backend run build; npm --prefix frontend run typecheck -> cả hai lệnh thoát mã 0, xác nhận response bổ sung đồng bộ kiểu dữ liệu."
  - "V-04 [AC-01,AC-03,AC-04] Kiểm tra dashboard dev với một sinh viên có nhiều ghi nhận cùng tiêu chí và một tiêu chí khác -> tổng lớp giữ nguyên tổng lượt, popup có đúng một dòng '(N lần)' cho nhóm lặp và các nhóm còn lại tách riêng."
runtime_test:
  targets: "Xác minh frontend, API, MongoDB và các dịch vụ liên quan là môi trường dev tách production trước khi kiểm thử tương tác."
  resources: "Chỉ đọc các ghi nhận dev hiện có phù hợp; nếu không có dữ liệu tái hiện thì tạo bản ghi thử có nhãn nhận diện qua API/UI hiện hành."
  scenarios: "Một sinh viên/cùng tiêu chí nhiều lượt; cùng sinh viên/khác tiêu chí; khác sinh viên/cùng tiêu chí."
  pass_signal: "Tổng lớp bằng tổng lượt, preview nhóm đúng khóa và hậu tố số lần đúng điều kiện."
  cleanup: "Xóa chỉ các bản ghi dùng thử do task tạo bằng luồng ứng dụng sau khi xác nhận; không sửa hoặc xóa dữ liệu dev có sẵn."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Thay đổi cấu trúc aggregation và response API bổ sung trường count, nên cần kiểm tra đồng bộ backend/frontend và hành vi với quantity legacy."
stop_conditions:
  - "Dừng nếu criterion_id có thể rỗng trong dữ liệu hợp lệ và việc gộp tất cả bản ghi thiếu tiêu chí của một sinh viên làm thay đổi nghiệp vụ; cần chốt khóa fallback trước khi sửa."
  - "Dừng runtime test nếu không xác minh được đích frontend/API/database là dev tách production."
---
