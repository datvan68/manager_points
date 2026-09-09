---
slot_id: "taskscope-01"
generation: 2
task_id: "20260909-101811-mobile-roster-room-bed-picker"
scope_file: "docs/task/taskscope-01.md"
status: ready
scope_revision: 1
created_at: "2026-09-09T10:18:11+07:00"
updated_at: "2026-09-09T10:18:11+07:00"
base_commit: "76620017a5b415043e5a385f2bb9f59053763e1c"
task: "Điều chỉnh luồng chọn phòng và giường KTX trên mobile"
pipeline: feature_development
profile: Quick
objective: "Trên tab Danh sách KTX ở mobile, chạm biểu tượng chọn/đổi phòng mở giao diện toàn màn hình chọn phòng; chạm một phòng chuyển sang giao diện toàn màn hình chọn giường, trong khi desktop giữ popover và hợp đồng phân phòng hiện tại."
coordination:
  depends_on: []
  warnings:
    - "docs/task/taskscope.md là tệp legacy rỗng nên slot 00 được giữ nguyên; slot 01 được tái sử dụng sau khi generation 1 hoàn tất với đầy đủ bằng chứng."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:RoomAssignmentPopover dùng một icon khoảng 28px mở popover rộng 20rem; phòng và giường nằm nối tiếp trong cùng vùng cuộn, và phân phòng chỉ xảy ra sau khi chọn giường. ResponsiveDataView vẫn đặt icon này trong cụm thao tác của card mobile."
  expected_behavior: "Mobile dùng một bề mặt toàn màn hình chuyển hai bước Phòng -> Giường với vùng chạm rõ ràng, điều hướng quay lại và trạng thái tải/lỗi; desktop tiếp tục dùng popover hiện tại."
  root_cause: null
scope:
  inspect:
    - "frontend/src/components/ui/ResponsiveDataView.tsx"
    - "frontend/src/components/ui/dialog.tsx"
    - "frontend/src/api/dormitory-api.ts"
  write:
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
  preserve:
    - "Giữ nguyên DORM_ROOM_READ/DORM_REG_UPDATE và điều kiện hiển thị thao tác hiện tại."
    - "Giữ nguyên API suggestRooms, beds.getByRoom, roster.assignRoom và roster.unassignRoom; không tự chọn giường và không đổi payload room_id/bed_id."
    - "Giữ nguyên kiểm tra phòng/giường khả dụng, chống phản hồi giường cũ, toast, cập nhật tại chỗ và xác nhận bỏ phòng."
    - "Giữ nguyên popover và mật độ thao tác hiện tại từ breakpoint lg trở lên."
  out:
    - "Thay đổi backend, RBAC, hợp đồng KTX, dữ liệu MongoDB hoặc thuật toán gợi ý phòng."
    - "Thiết kế lại toàn bộ card Danh sách KTX hay các icon thao tác khác."
    - "Tự động phân giường chỉ bằng một lần chạm vào phòng."
acceptance_criteria:
  - "AC-01: Ở viewport dưới lg, chạm nút Thêm phòng/Đổi phòng mở bề mặt modal toàn màn hình có tiêu đề Chọn phòng, nút đóng và danh sách phòng; mỗi hàng phòng có vùng chạm tối thiểu 44px và hiển thị tên, số giường trống, trạng thái."
  - "AC-02: Trên mobile, chạm phòng khả dụng chuyển cùng bề mặt toàn màn hình sang bước Chọn giường của đúng phòng; có nút quay lại danh sách phòng, tải giường đúng một lần và không tạo modal/popover chồng lớp."
  - "AC-03: Chạm giường trống gọi assignRoom đúng roster_entry_id, room_id và bed_id; trong lúc chờ khóa thao tác, thành công đóng toàn bộ luồng và cập nhật card, thất bại giữ bước giường cùng thông báo để thử lại."
  - "AC-04: Phòng/giường không khả dụng và giường hiện tại không thể kích hoạt; thao tác Bỏ chọn phòng vẫn yêu cầu xác nhận và giữ hành vi hiện tại."
  - "AC-05: Ở viewport lg trở lên, nút chọn/đổi phòng vẫn mở popover Phòng -> Giường hiện tại và không thay đổi API hay kết quả phân phòng."
execution:
  - "E-01 [AC-01, AC-02, AC-05] frontend/src/app/(dashboard)/dormitory/roster/page.tsx:RoomAssignmentPopover -> nhận trạng thái compact từ page, tách phần render danh sách phòng/giường dùng chung và dùng Dialog toàn viewport trên mobile; cùng một dialog đổi bước thay vì mở lớp thứ hai, còn desktop giữ Popover."
  - "E-02 [AC-02..AC-04] RoomAssignmentPopover state/handlers -> thêm điều hướng quay lại Phòng, reset request/state khi đóng, giữ bedRequestRef chống phản hồi cũ, trạng thái loading/error/assigning và luồng xác nhận bỏ phòng."
  - "E-03 [AC-01..AC-05] frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx -> thêm regression theo matchMedia cho mobile hai bước, quay lại, unavailable/loading/error/success và desktop popover; xác nhận payload API và đóng/giữ dialog tương ứng."
verification:
  - "V-01 [AC-01..AC-05] npm --prefix frontend test -- \"src/app/(dashboard)/dormitory/roster/page.test.tsx\" -> toàn bộ test roster và các case mobile/desktop mới đều pass."
  - "V-02 [AC-01..AC-05] npm --prefix frontend run typecheck -> không có lỗi TypeScript do thay đổi."
  - "V-03 [AC-01, AC-02, AC-04, AC-05] kiểm tra dev UI tại /dormitory/roster ở 390x844 và viewport desktop -> mobile mở toàn màn hình, chuyển Phòng/Giường/quay lại/đóng đúng; desktop vẫn dùng popover; không thực hiện chọn giường trên dữ liệu thật."
runtime_test:
  environment: "Trước V-03 xác minh frontend, API và kho dữ liệu hiệu lực đều là dev tách khỏi production bằng metadata không chứa bí mật; dừng phần runtime nếu không chứng minh được."
  resources: "Chỉ đọc một bản ghi roster và danh sách phòng/giường hiện có qua UI; không gửi assign/unassign và không sửa dữ liệu dev."
  scenarios: "Viewport 390x844: mở, chọn phòng, quay lại, đóng; desktop: mở popover và quan sát danh sách."
  cleanup: "Đóng dialog/popover, reset viewport override; không có dữ liệu cần khôi phục."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Radix Dialog và Popover dùng portal/focus trap khác nhau; phải dùng duy nhất một surface theo breakpoint để tránh focus hoặc overlay chồng nhau."
  - "Thay đổi viewport khi picker đang mở có thể làm stale state; handler đóng/reset phải nhất quán khi chuyển breakpoint."
stop_conditions:
  - "Dừng nếu sản phẩm yêu cầu chọn phòng là phân giường ngay, vì hiện chưa có quy tắc tự chọn giường và API bắt buộc bed_id."
  - "Dừng nếu cần thay đổi breakpoint lg hoặc component ResponsiveDataView dùng chung; đó là mở rộng ngoài hai write paths đã duyệt."
  - "Dừng nếu phát hiện taskscope hoạt động khác giữ hai write paths hoặc các path này có thay đổi chưa rõ chủ sở hữu."
---
