Task: dormitory-pdf-class-faculty-spacing | bug_fix | Risk: medium | Profile: Quick
Objective: Mẫu đơn PDF KTX luôn tạo khoảng cách rõ ràng giữa giá trị `Lớp` và nhãn/giá trị `Khoa`, không chồng chữ kể cả khi tên lớp dài.
Boundary: `backend/src/dormitory/**` | Write: `backend/src/dormitory/services/registrations.service.ts`, `backend/src/dormitory/services/registrations.service.spec.ts`
Targets: CSS/HTML dòng `Lớp`–`Khoa` trong `RegistrationsService.buildApplicationHtml`; kiểm thử hợp đồng bố cục PDF trong `registrations.service.spec.ts`.
Steps: Xác nhận lỗi do `.field-class` có chiều rộng cố định nhưng cho phép nội dung tràn -> điều chỉnh bố cục/khoảng cách riêng cho dòng `Lớp`–`Khoa` để hai nhóm thông tin không lấn nhau và vẫn nằm gọn trên A4 -> bổ sung ca hồi quy với tên lớp/khoa dài -> chạy kiểm thử và kiểm tra trực quan PDF đại diện.
Verify: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/services/registrations.service.spec.ts` => toàn bộ kiểm thử dịch vụ đăng ký KTX đạt; tạo/xem PDF với lớp `CD24A-CNKTCD` và khoa `Khoa Công nghệ thông tin - Kỹ thuật điện` => giữa `Lớp` và `Khoa` có khoảng cách, không chồng hoặc cắt chữ; `D:\PROJECT\manager_points` :: `git diff --check` => không có lỗi whitespace.
Done: Dòng `Lớp`–`Khoa` không chồng chữ với dữ liệu mẫu dài; các trường khác, nội dung, khổ A4 và API xuất PDF không thay đổi; kiểm thử hồi quy đạt.
Gate: None
