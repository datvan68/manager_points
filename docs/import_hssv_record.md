# Hướng dẫn Import Ghi nhận HSSV từ Excel

## Mục đích

Tính năng Import Ghi nhận HSSV cho phép quản trị viên (admin) hoặc cán bộ quản lý thêm hàng loạt các ghi nhận cho học sinh, sinh viên (HSSV) thông qua file Excel.

Ở phiên bản mới, hệ thống đã nâng cấp cơ chế nhận diện tiêu chí để **chính xác hơn** và **tránh sai sót** do trùng lặp hoặc sai khác tên gọi. Cụ thể, hệ thống giờ đây sử dụng **Mã tiêu chí** (criterion_code) do admin tự định nghĩa để xác định tiêu chí ghi nhận, thay vì dựa vào tên tiêu chí (criterion_name) như trước đây.

## Tính năng mới: Sử dụng Mã tiêu chí

1. **Mã tiêu chí (Criterion Code):**
   - Admin có thể tự đặt mã tiêu chí trong phần quản lý danh mục và tiêu chí (Ví dụ: `I.A`, `I.B.1`, `RL-01`).
   - Mã tiêu chí là duy nhất. Khi cập nhật hoặc thêm mới, hệ thống sẽ cảnh báo nếu mã đã tồn tại.
   - Khi import, hệ thống sử dụng cột `Mã tiêu chí` trong file Excel để tìm kiếm đúng tiêu chí cần gán.

2. **Khả năng tương thích:**
   - Hệ thống vẫn ưu tiên tìm kiếm theo `Mã tiêu chí` hoặc `Ma tieu chi` hoặc `criterion_code`.
   - Trong trường hợp file Excel cũ chưa kịp cập nhật, hệ thống vẫn hỗ trợ tìm kiếm dựa trên cột `Tiêu chí` / `Tieu chi` (theo tên). Tuy nhiên, khuyến nghị nên chuyển sang dùng Mã tiêu chí để đảm bảo độ chính xác 100%.

## Định dạng file Excel mẫu

File Excel cần tuân thủ cấu trúc sau:

| Ma SV | Ma tieu chi | Ngay ghi nhan | Ghi chu | Hoc ky | Trang thai |
| --- | --- | --- | --- | --- | --- |
| SV202601 | I.A | 15/05/2026 | Ghi chú mẫu |  | active |

**Giải thích các cột:**

- `Ma SV` *(Bắt buộc)*: Mã số sinh viên.
- `Ma tieu chi` *(Bắt buộc)*: Mã của tiêu chí tương ứng. Ví dụ: `I.A`.
- `Ngay ghi nhan` *(Bắt buộc)*: Ngày ghi nhận (định dạng ngày tháng hợp lệ, ví dụ: DD/MM/YYYY).
- `Hoc ky` *(Tùy chọn)*: Học kỳ ghi nhận. Nếu để trống, hệ thống sẽ tự động sử dụng học kỳ đang *active* hiện tại.
- `Trang thai` *(Tùy chọn)*: Nhận giá trị `active` hoặc `inactive`.

## Các bước thực hiện Import

1. Truy cập vào mục **Quản lý Tiêu chí**, đảm bảo các tiêu chí đã được gán **Mã tiêu chí** đầy đủ.
2. Tải xuống file Excel mẫu từ popup **"Import Ghi nhận HSSV từ Excel"**.
3. Điền dữ liệu vào file Excel theo đúng cấu trúc yêu cầu, lưu ý nhập đúng cột `Ma tieu chi`.
4. Upload file lên hệ thống.
5. Xem trước (Preview) dữ liệu:
   - Hệ thống sẽ hiển thị danh sách các bản ghi sẽ được import.
   - Các bản ghi bị lỗi (ví dụ: không tìm thấy mã tiêu chí, sai định dạng) sẽ được đánh dấu rõ ràng với thông báo lỗi cụ thể (ví dụ: `Không tìm thấy tiêu chí theo mã: <mã>`).
6. Nếu dữ liệu đã hợp lệ, nhấn **Xác nhận** để hoàn tất quá trình lưu dữ liệu vào hệ thống.

## Lưu ý

- **Không tự đổi cấu trúc file mẫu**: Tránh việc đổi tên cột hoặc xóa cột bắt buộc.
- **Tính nhất quán**: Mã tiêu chí `I.A` và `IA` là hai mã hoàn toàn khác nhau (do chứa dấu chấm). Tuy nhiên, **hệ thống tìm kiếm mã không phân biệt hoa/thường** (ví dụ: mã `i.a` hay `I.a` đều được hiểu là `I.A`) và tự động **loại bỏ khoảng trắng dư thừa** ở đầu và cuối (trim). Các dấu câu, ký tự đặc biệt (chấm, gạch ngang) vẫn bắt buộc phải giữ nguyên chính xác.
