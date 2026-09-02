slot_id: "taskscope-00"
generation: 12
task_id: "20260902-120928-filter-student-history-by-record-type"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-02T12:09:28+07:00"
updated_at: "2026-09-02T12:22:30+07:00"
base_commit: "b5e6b4c0fe675b52d59f8b398589c8c75d4436e3"
task: "Filter student history from summary buttons"
pipeline: feature_development
profile: Quick
objective: "Ba thẻ Khen thưởng, Cộng điểm và Kỷ luật trong drawer là nút lọc tương tác cho timeline lịch sử."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-02T12:22:30+07:00"
  outcome: success
  final_commit_or_state: "Working tree on b5e6b4c0fe675b52d59f8b398589c8c75d4436e3; scoped changes remain uncommitted."
  changed_paths: ["frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["V-01: focused Vitest 25/25 passed", "V-02: frontend typecheck passed", "git diff --check passed"]
  cleanup_pending: []

evidence:
  current_behavior: "page.tsx:drawer summary blocks chỉ là div hiển thị count; timeline luôn map toàn bộ drawerHistory và hai layout responsive lặp cùng hành vi."
  expected_behavior: "Mỗi thẻ là button; click lọc timeline theo đúng recordType, click lại bỏ lọc và trạng thái chọn được thể hiện trực quan/trợ năng."
  root_cause: null

scope:
  inspect: ["frontend/src/app/(dashboard)/students/record/page.tsx:drawer summary/timeline variants"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:drawer record-type filter state/UI", "frontend/src/app/(dashboard)/students/record/page.test.tsx:filter interaction coverage"]
  preserve: ["Count luôn tính trên toàn bộ drawerHistory", "thứ tự timeline hiện tại", "RBAC, xóa/chọn ghi nhận, loading/empty state", "detail page và tab Tình hình lớp học"]
  out: ["Backend/API", "bộ lọc bảng chính", "thay đổi các thẻ thống kê ngoài drawer"]

acceptance_criteria:
  - "AC-01: Ba thẻ thống kê trong cả hai drawer responsive render bằng button có tên truy cập được, pointer, hover, focus-visible và active/aria-pressed rõ ràng."
  - "AC-02: Click một thẻ chỉ hiển thị timeline recordType tương ứng; số trên cả ba thẻ vẫn phản ánh toàn bộ lịch sử."
  - "AC-03: Click lại thẻ đang active bỏ lọc và khôi phục toàn bộ timeline; chọn thẻ khác chuyển lọc trong một lần click."
  - "AC-04: Khi loại đang lọc không có dữ liệu, drawer hiển thị empty state theo bộ lọc; mở/đóng hoặc chuyển sinh viên reset về không lọc."
  - "AC-05: Lọc không làm thay đổi selected record IDs, dữ liệu nguồn, request API, hoặc quyền xem/xóa."

execution:
  - "E-01 [AC-01..AC-05] page.tsx:drawer state/derived history → thêm filter type nullable, derive visible history bằng useMemo và reset theo lifecycle drawer/student."
  - "E-02 [AC-01..AC-04] page.tsx:summary/timeline responsive variants → đổi thẻ thành button đồng nhất và render visible history/filtered empty state."
  - "E-03 [AC-01..AC-05] page.test.tsx → kiểm tra role/aria-pressed, lọc từng loại, toggle reset, switch type, empty/reset và không gọi thêm API."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-05] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused Vitest passes."
  - "V-02 [AC-01..AC-05] npm --prefix frontend run typecheck → exits 0."

risks: ["Hai drawer responsive lặp markup; filter state và accessibility phải giữ parity."]
stop_conditions: ["Dừng nếu yêu cầu filter phía server, thay đổi API, hoặc mở rộng sang màn hình ngoài drawer."]
