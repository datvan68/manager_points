# Task scope: tinh gọn giao diện truy cập tài khoản khác

## Mục tiêu

Điều chỉnh giao diện trang **Phân quyền** và trạng thái sau khi quản trị viên truy cập bằng tài khoản khác:

1. Nút **Truy cập** trong cột **Hành động** chỉ hiển thị icon, không hiển thị chữ `Truy cập`.
2. Sau khi truy cập tài khoản khác thành công, không hiển thị dải cảnh báo màu vàng ở phía trên header gồm nội dung `Đang truy cập với tư cách ...` và nút `Kết thúc truy cập` như ảnh yêu cầu.

## Phạm vi thay đổi

### 1. Trang Phân quyền

- File chính: `frontend/src/app/(dashboard)/permissions/page.tsx`.
- Giữ nguyên icon đăng nhập hiện tại (`LogIn`); khi đang xử lý vẫn hiển thị icon loading (`Loader2`).
- Loại bỏ phần chữ nhìn thấy `Truy cập` khỏi nút.
- Giữ `title`/tên truy cập được cho công nghệ hỗ trợ để người dùng vẫn nhận biết hành động và test có thể truy vấn nút theo tên.
- Giữ nguyên toàn bộ điều kiện hiển thị cho ADMIN, trạng thái disabled, hàm `handleAccessUser`, cơ chế mở tab mới và xử lý lỗi.

### 2. Header của phiên truy cập tài khoản khác

- File chính: `frontend/src/components/layout/Header.tsx`.
- Loại bỏ toàn bộ dải cảnh báo phía trên header chỉ xuất hiện khi `user.impersonation` tồn tại.
- Không thay đổi logic phiên impersonation, token, đăng xuất hoặc API.
- Vẫn giữ lối thoát phiên tại menu tài khoản: mục `Kết thúc truy cập` tiếp tục gọi `logout`. Việc bỏ dải cảnh báo không được làm người dùng mất khả năng kết thúc phiên.
- Dọn các import chỉ phục vụ dải cảnh báo nếu không còn được sử dụng.

### 3. Kiểm thử liên quan

- Cập nhật/bổ sung test cho trang Phân quyền để xác nhận:
  - ADMIN vẫn thấy và kích hoạt được nút truy cập qua tên hỗ trợ;
  - nút chỉ có icon/loading, không có nhãn chữ hiển thị;
  - người không có vai trò ADMIN vẫn không thấy hành động này;
  - luồng handoff hiện tại không thay đổi.
- Bổ sung test tập trung cho `Header` để xác nhận:
  - phiên impersonation không còn hiển thị dải `Đang truy cập với tư cách ...`;
  - mục `Kết thúc truy cập` trong menu tài khoản vẫn tồn tại và gọi đúng hành động kết thúc phiên.
- Chạy các test frontend liên quan và TypeScript typecheck/lint phù hợp với các file đã sửa.

## Ngoài phạm vi

- Không thay đổi backend, endpoint impersonation, giới hạn phiên, thời hạn phiên hoặc chính sách phân quyền.
- Không thay đổi nội dung/cách hoạt động của menu tài khoản ngoài việc bảo đảm lối thoát phiên còn dùng được.
- Không thay đổi các nút xem, sửa, xóa khác trong cột **Hành động**.
- Không chỉnh sửa bố cục chung của bảng, header hoặc các trang khác.

## Tiêu chí nghiệm thu

1. Ở tab **Người dùng** của trang Phân quyền, hành động truy cập hiển thị bằng một icon duy nhất; không còn chữ `Truy cập` cạnh icon.
2. Icon có tooltip/tên truy cập mô tả đúng tài khoản đích và sử dụng được bằng bàn phím/công nghệ hỗ trợ.
3. Nhấn icon vẫn mở và hoàn tất luồng truy cập tài khoản khác như hiện tại; trạng thái loading và disabled vẫn hoạt động.
4. Khi tab mới đăng nhập bằng tài khoản đích thành công, dải màu vàng trong ảnh không xuất hiện ở bất kỳ kích thước màn hình nào.
5. Người dùng vẫn có thể mở menu tài khoản và chọn **Kết thúc truy cập** để thoát phiên impersonation.
6. Các test liên quan và TypeScript typecheck vượt qua, không phát sinh lỗi lint mới trong phạm vi thay đổi.
