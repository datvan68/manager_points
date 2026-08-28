task: "Hiển thị kết quả và tinh giản Search sidebar mobile"
pipeline: bug_fix
profile: Quick
objective: "Khi nhập truy vấn hợp lệ trên mobile, trạng thái/kết quả luôn hiện ngay dưới thanh Search và giao diện chỉ còn một lớp card của chính thanh Search."

evidence:
  current_behavior: "Ảnh 375px cho thấy input nhận giá trị 'Đạt' nhưng không thấy loading, empty state, lỗi hoặc danh sách kết quả. Sidebar bọc StudentDirectorySearch bằng một card có overflow-y-auto; panel kết quả bên trong lại dùng absolute top-full."
  root_cause: "Panel trạng thái/kết quả bị ancestor overflow cắt khỏi vùng hiển thị. Wrapper mobile đồng thời tạo thêm nền, border, padding, shadow và bo góc trùng với card của thanh Search."

scope:
  write: ["frontend/src/components/layout/Sidebar.tsx", "frontend/src/components/layout/Sidebar.test.tsx", "frontend/src/components/students/StudentDirectorySearch.test.tsx"]
  preserve: ["StudentDirectorySearch request/debounce", "mobile autofocus/keyboard", "canSearchStudents RBAC", "backdrop/X/Escape close", "desktop search"]
  out: ["backend/API/schema", "đổi thiết kế kết quả hoặc bottom navigation"]

acceptance_criteria:
  - "AC-01: Với query trim >=2 ký tự, mobile hiển thị dưới input đúng một trong bốn trạng thái: loading, danh sách, empty hoặc error; không bị clip bởi Search surface."
  - "AC-02: Dữ liệu trả về hiển thị tên, mã sinh viên và lớp; danh sách dài cuộn được trong viewport 375x667 và 390x844."
  - "AC-03: Xóa wrapper card dư quanh thanh Search; không còn lớp nền/border/padding/shadow/rounded lồng bên ngoài, nhưng vẫn giữ căn giữa, max-width, z-index và đóng bằng backdrop."
  - "AC-04: Không regress focus/bàn phím, debounce/request, RBAC và các cách đóng hiện có."

execution:
  - "E-01 [AC-01,AC-03] Bỏ wrapper DOM/card dư trong mobile Search surface; chuyển class định vị cần thiết vào StudentDirectorySearch và loại overflow ancestor gây clip."
  - "E-02 [AC-01..AC-04] Cập nhật tests để chứng minh kết quả mobile không nằm trong overflow-clipping wrapper và surface chỉ có một card Search."

verification:
  - "npm --prefix frontend test -- src/components/layout/Sidebar.test.tsx src/components/students/StudentDirectorySearch.test.tsx"
  - "Manual 375x667 và 390x844: nhập 'Đạt', kiểm tra từng trạng thái, cuộn danh sách, mở bàn phím và đóng bằng X/backdrop/Escape."

risks: ["Các file trong scope đang có thay đổi chưa commit; giữ nguyên diff hiện hữu ngoài yêu cầu này."]
temporary_artifacts: { create: [], cleanup: [], retain: ["docs/task/taskscope.md"] }
