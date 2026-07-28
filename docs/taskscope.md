Task: `tasks-toolbar-quick-stats` | `feature_development` | Risk: medium | Profile: Quick

Objective: Trên trang `/students/tasks`, mỗi tab có thanh công cụ cùng hàng với thanh tab; nút biểu đồ bật/tắt đúng ba thẻ thống kê nhanh và trạng thái mặc định là ẩn.

Boundary: giao diện frontend của trang Nhiệm vụ | Write: `frontend/src/app/(dashboard)/students/tasks/page.tsx`, `frontend/src/components/students/tasks/StudentTasksTab.tsx`, `frontend/src/components/students/tasks/StudentTaskProgressTab.tsx`

Targets: `StudentTasksPageContent` và cụm sub-tab; `StudentTasksTab`/`renderKPICards`; `StudentTaskProgressTab`/`renderKPICards`, toolbar và `Dialog` bộ lọc

Steps: kiểm tra bố cục desktop/mobile và quyền tạo nhiệm vụ -> bổ sung trạng thái ẩn thống kê độc lập theo tab, nút icon biểu đồ có tooltip/`aria-label` và trạng thái active -> đưa action của tab đang mở lên cùng hàng sub-tab -> tab Danh sách chỉ hiển thị icon tìm kiếm và thêm (nút thêm vẫn theo quyền) -> tab Theo dõi hiển thị action tìm kiếm, bộ lọc và chế độ xem; gom bốn lọc Trạng thái/Đối tượng/Lớp/Nhiệm vụ vào một modal dùng chung mọi breakpoint -> giữ nguyên API, phân trang và giá trị lọc -> kiểm tra responsive và typecheck

Verify: `D:\PROJECT\manager_points\frontend :: npm run typecheck` => không có lỗi TypeScript; trình duyệt tại `/students/tasks` => hai tab đạt đúng bố cục, thống kê mặc định ẩn và toggle độc lập, modal lọc cập nhật đủ bốn lọc, tìm kiếm/thêm/quyền/chế độ xem vẫn hoạt động trên desktop và mobile

Done: Tất cả hành vi Verify đạt; không đổi backend/API hoặc quyền truy cập.

Gate: None
