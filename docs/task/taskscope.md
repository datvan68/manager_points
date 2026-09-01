slot_id: "taskscope-00"
generation: 8
task_id: "20260901-205416-compact-subsystem-group-cards"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-01T20:54:16+07:00"
updated_at: "2026-09-01T20:58:01+07:00"
base_commit: "9c3eb91996b56db1d7da8e5da8c9012152ca2fa1"
task: "Tinh gọn thẻ nhóm trong Quản lý Phân hệ Hệ thống"
pipeline: feature_development
profile: Quick
objective: "Các thẻ phân hệ trong popup quản lý phân hệ có mô tả ngắn, bố cục compact và không còn nội dung thống kê/phụ phía dưới mô tả."

coordination:
  depends_on: []
  warnings: ["Worktree đang có thay đổi chưa commit từ taskscope-00 generation 7 tại trang /system; phạm vi này chỉ ghi SubsystemPopup và test tương ứng nên không xung đột."]

completion:
  completed_at: "2026-09-01T20:58:01+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree retains scoped changes; no commit requested."
  changed_paths: ["frontend/src/components/popups/SubsystemPopup.tsx", "frontend/src/components/popups/SubsystemPopup.test.tsx"]
  checks_passed: ["npm --prefix frontend test -- src/components/popups/SubsystemPopup.test.tsx (10 passed)", "npm --prefix frontend run typecheck", "rg footer marker: no border-t matches; hidden wrappers present", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "SubsystemPopup.tsx lặp markup thẻ theo bốn nhóm; mỗi thẻ có mô tả dài và footer stat/progress/event/avatar bên dưới mô tả."
  expected_behavior: "Mỗi thẻ chỉ giữ biểu tượng, tên, điều khiển trạng thái cần thiết và mô tả ngắn; không hiển thị footer thông tin phụ dưới mô tả."
  root_cause: null

scope:
  inspect: ["docs/design/DESIGN.compact.md", "frontend/src/components/popups/SubsystemPopup.tsx: INITIAL_MODULES và card markup theo nhóm"]
  write: ["frontend/src/components/popups/SubsystemPopup.tsx: card content/description", "frontend/src/components/popups/SubsystemPopup.test.tsx: focused card coverage"]
  preserve: ["RBAC, tìm kiếm, điều hướng, trạng thái bảo trì và badge trạng thái", "Tên nhóm, tên phân hệ, href và API contracts", "Không thêm dependency"]
  out: ["Trang /system", "Backend/API/schema", "Thay đổi quyền hoặc nghiệp vụ bảo trì"]

acceptance_criteria:
  - "AC-01: Mô tả của toàn bộ phân hệ được rút gọn nhưng vẫn nêu đúng công dụng chính và vẫn được dùng khi tìm kiếm."
  - "AC-02: Mọi thẻ không còn footer/stat/progress/event/avatar hoặc mục phụ nào phía dưới mô tả; chiều cao và khoảng cách được thu gọn theo docs/design/."
  - "AC-03: Click điều hướng, lọc theo quyền, tìm kiếm, badge trạng thái và công tắc bảo trì của quản trị viên vẫn hoạt động."

execution:
  - "E-01 [AC-01] Rút gọn INITIAL_MODULES.desc mà không đổi id/group/name/href/status."
  - "E-02 [AC-02, AC-03] Tinh gọn card markup của mọi nhóm, bỏ footer stat và giữ các control trạng thái cần thiết."
  - "E-03 [AC-01, AC-02, AC-03] Bổ sung test xác nhận mô tả ngắn, không có nội dung footer cũ và điều hướng/control không hồi quy."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01, AC-02, AC-03] npm --prefix frontend test -- src/components/popups/SubsystemPopup.test.tsx"
  - "V-02 [AC-01, AC-02, AC-03] npm --prefix frontend run typecheck"
  - "V-03 [AC-02] rg -n 'border-t border-slate-100/60|className=\"hidden\"' frontend/src/components/popups/SubsystemPopup.tsx -> footer cũ không còn hiển thị."
  - "V-04 [AC-01, AC-02, AC-03] git diff --check"

risks: ["Markup thẻ đang lặp theo nhóm; phải sửa đồng nhất và không xóa nhầm công tắc bảo trì hoặc badge trạng thái."]
stop_conditions: ["Dừng nếu yêu cầu bỏ cả badge trạng thái/công tắc bảo trì hoặc thay đổi quyền truy cập phân hệ."]
