task: "Gỡ các phân hệ trùng lặp khỏi sidebar"
pipeline: feature_development
profile: Quick
objective: "Sidebar desktop và mobile không còn hiển thị Thông báo, Báo cáo hoặc Quản trị hệ thống; người dùng vẫn mở được các phân hệ này từ modal quản lý phân hệ."

evidence:
  current_behavior: "frontend/src/components/layout/Sidebar.tsx:allMenuItems chứa /notifications, /reports, /system; mobile navigation còn render shortcut /notifications riêng cho người dùng không phải admin. frontend/src/components/popups/SubsystemPopup.tsx:subsystems đã có Quản trị hệ thống, Thống kê báo cáo và Quản lý thông báo."
  expected_behavior: "Ba mục trùng lặp không xuất hiện trong sidebar ở mọi breakpoint; modal phân hệ và các route đích không thay đổi."
  root_cause: "Sidebar chưa được đồng bộ sau khi ba lối điều hướng được đưa vào modal quản lý phân hệ."

scope:
  inspect: ["frontend/src/components/popups/SubsystemPopup.tsx:subsystems — xác nhận ba phân hệ và route thay thế"]
  write: ["frontend/src/components/layout/Sidebar.tsx:allMenuItems/mobile navigation", "frontend/src/components/layout/Sidebar.test.tsx:sidebar navigation regression"]
  preserve: ["Các menu Trang chủ, Học sinh sinh viên, Hoạt động, Rèn luyện và Cài đặt", "RBAC/route filtering", "route /notifications, /reports, /system", "Header notification và SubsystemPopup"]
  out: ["Xóa hoặc sửa các trang phân hệ", "Thay đổi quyền/backend", "Thiết kế lại modal hoặc sidebar"]

acceptance_criteria:
  - "AC-01: Sidebar desktop không render link/nhãn Thông báo, Báo cáo hoặc Quản trị hệ thống cho bất kỳ vai trò nào."
  - "AC-02: Mobile bottom navigation không render shortcut đến /notifications, /reports hoặc /system."
  - "AC-03: Các mục sidebar còn lại và modal quản lý phân hệ tiếp tục hoạt động theo hành vi hiện tại."

execution:
  - "E-01 [AC-01,AC-02,AC-03] frontend/src/components/layout/Sidebar.tsx → bỏ ba entry khỏi allMenuItems, bỏ shortcut Thông báo mobile và dọn import chỉ trở nên không dùng vì thay đổi này."
  - "E-02 [AC-01,AC-02,AC-03] frontend/src/components/layout/Sidebar.test.tsx → thêm regression kiểm tra ba destination vắng mặt trên desktop/mobile và menu đại diện còn lại vẫn hiện."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md — user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- src/components/layout/Sidebar.test.tsx → toàn bộ test Sidebar pass."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck → exit code 0."

risks: []
stop_conditions: ["Dừng nếu yêu cầu cần xóa route/quyền, sửa SubsystemPopup hoặc thay đổi hành vi chuông thông báo ngoài Sidebar."]
