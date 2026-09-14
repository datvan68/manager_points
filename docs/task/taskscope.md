slot_id: "taskscope-00"
generation: 1
task_id: "20260914-095608-timetable-ui"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 3
created_at: "2026-09-14T09:56:08+07:00"
updated_at: "2026-09-14T10:12:00+07:00"
base_commit: "e9c1f3bff28036d2516a1494d8de3c1966365dfa"
task: "Điều chỉnh UI trang thời khóa biểu"
pipeline: feature_development
profile: Full
objective: "Trang timetable dùng TabNavigation thống nhất; tab Cấu hình có thanh menu gọn, bảng cuộn trong chiều cao giới hạn và phân trang luôn ở đáy vùng bảng."
coordination:
  depends_on: []
  warnings: []
completion:
  completed_at: "2026-09-14T10:12:00+07:00"
  outcome: "completed"
  final_commit_or_state: "working tree on main at e9c1f3bff28036d2516a1494d8de3c1966365dfa; uncommitted scoped changes"
  changed_paths:
    - "frontend/src/app/(dashboard)/timetable/page.tsx"
    - "frontend/src/app/(dashboard)/timetable/page.test.tsx"
    - "frontend/src/components/ui/TabNavigation.tsx"
    - "frontend/src/components/ui/TabNavigation.test.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
  checks_passed:
    - "V-01: timetable page and TabNavigation tests passed (5 tests)"
    - "V-02: TimetableSyncPanel tests passed (7 tests)"
    - "V-03: frontend typecheck passed"
    - "V-04: dev UI ADMIN desktop passed; responsive overflow-x-auto/max-height structure verified for narrow screens"
    - "V-05: git diff --check passed and diff contained only scope.write paths"
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/app/(dashboard)/timetable/page.tsx tự dựng ba tab; TimetableSyncPanel.tsx hiển thị khối cấu hình nguồn lớn, bộ lọc trên bảng, bảng chỉ overflow-x-auto và CustomPagination nằm dưới bảng trong luồng trang. grading/page.tsx dùng TabNavigation cùng kiểu nút SlidersHorizontal; ResponsiveDataView.tsx đặt pagination ở footer ngoài vùng cuộn."
  expected_behavior: "Ba tab timetable dùng TabNavigation; tab Cấu hình giữ các chức năng hiện có trong bố cục menu giống trang ghi nhận, nhóm cấu hình nguồn trong popover mở bằng icon nâng cao; bảng cuộn trong giới hạn chiều cao và footer phân trang cố định ở đáy khung."
  root_cause: null
scope:
  inspect:
    - "frontend/src/app/(dashboard)/grading/page.tsx"
    - "frontend/src/components/ui/ResponsiveDataView.tsx"
    - "frontend/src/components/ui/popover.tsx"
    - "frontend/src/components/ui/pagination.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
  write:
    - "frontend/src/app/(dashboard)/timetable/page.tsx"
    - "frontend/src/app/(dashboard)/timetable/page.test.tsx"
    - "frontend/src/components/ui/TabNavigation.tsx"
    - "frontend/src/components/ui/TabNavigation.test.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
  preserve:
    - "Chỉ ADMIN thấy tab và chức năng đồng bộ; người dùng khác vẫn tra cứu bình thường."
    - "Giữ ba panel, trạng thái tab, callback làm mới tra cứu sau đồng bộ và hành vi đồng bộ/lưu liên kết hiện tại."
    - "Giữ lọc, chọn lớp, đồng bộ hàng loạt, tùy chọn 10/20/50 và trang hiện hành hợp lệ."
    - "TabNavigation vẫn hoạt động ở các trang đang dùng; hỗ trợ bàn phím và tên truy cập của tab/popover."
  out:
    - "Backend, API, dữ liệu lưu trữ và các trang khác ngoài điều chỉnh tương thích TabNavigation dùng chung."
acceptance_criteria:
  - "AC-01: ADMIN thấy ba tab Tra tkb, Dữ liệu đã đồng bộ, Cấu hình tkb bằng TabNavigation; chọn bằng chuột/bàn phím hiển thị đúng panel, aria-selected đúng; non-admin chỉ thấy tra cứu."
  - "AC-02: Tab Cấu hình có thanh menu theo mẫu trang ghi nhận; icon nâng cao mở/đóng popover chứa Niên học nguồn, Học kỳ nguồn, Tải danh mục nguồn, Đối chiếu lớp, Khoảng đồng bộ và Lưu liên kết; các giá trị, trạng thái disabled, hành động và thông báo vẫn hoạt động."
  - "AC-03: Bảng quản lý liên kết lớp có chiều cao giới hạn theo viewport và cuộn dọc/ngang trong khung; CustomPagination luôn ở đáy khung ngoài vùng cuộn trên desktop, vẫn truy cập được trên màn hình hẹp; đổi trang/cỡ trang và lọc giữ kết quả đúng."
execution:
  - "E-01 [AC-01] page.tsx dùng TabNavigation theo grading/page.tsx; mở rộng TabNavigation.tsx tối thiểu để cung cấp tablist/tab/aria-selected/aria-controls/id và thao tác bàn phím cần thiết; cập nhật hai bài test tương ứng."
  - "E-02 [AC-02] TimetableSyncPanel.tsx chuyển khối cấu hình nguồn vào Popover của ui/popover.tsx với nút SlidersHorizontal có aria-label trên thanh menu; giữ nguyên state/handler và bổ sung test mở, thao tác, đóng."
  - "E-03 [AC-03] TimetableSyncPanel.tsx tách vùng table overflow-auto có max-height theo viewport và footer CustomPagination bên ngoài vùng cuộn như ResponsiveDataView.tsx; bổ sung test điều hướng trang/kích cỡ trang và kiểm tra bố cục thực tế trên desktop/mobile."
verification:
  - "V-01 [AC-01] npm --prefix frontend test -- 'src/app/(dashboard)/timetable/page.test.tsx' src/components/ui/TabNavigation.test.tsx -> tab, quyền ADMIN và chuyển panel đều đạt."
  - "V-02 [AC-02,AC-03] npm --prefix frontend test -- src/components/timetable/TimetableSyncPanel.test.tsx -> popover, hành động và phân trang đạt."
  - "V-03 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck -> không có lỗi TypeScript."
  - "V-04 [AC-02,AC-03] Dev UI timetable bằng ADMIN ở desktop/mobile -> popover dùng được, bảng cuộn trong khung khi nhiều hàng và pagination còn thấy ở đáy; xác minh đích frontend/API/data là dev trước tương tác runtime."
  - "V-05 [AC-01,AC-02,AC-03] git diff --check và xem diff các file scope.write -> không có lỗi whitespace hoặc thay đổi ngoài phạm vi."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "TabNavigation là component dùng chung; kiểm tra hồi quy các trang đang dùng sau thay đổi aria và bàn phím."
stop_conditions:
  - "Dừng nếu scope khác chiếm đường dẫn ghi hoặc file mục tiêu có thay đổi không xác định."
  - "Dừng tương tác runtime nếu chưa chứng minh được các đích frontend/API/data là dev tách production."
