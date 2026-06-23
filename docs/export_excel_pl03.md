# Export Excel Tổng Hợp Điểm Rèn Luyện (PL03)

Tài liệu này ghi chú lại cách sử dụng tính năng Xuất Excel tổng hợp điểm rèn luyện (theo mẫu PL03) và các quy ước liên quan đến template file.

## 1. Cách sử dụng (Usage)

### Frontend (UI)
- Vị trí: Chức năng nằm ở trang `/grading` (Danh sách bảng điểm).
- Có một nút "Xuất Excel" nằm cạnh nút "Xuất PDF" trong thanh công cụ `FloatingActionBar`.
- **Luồng hoạt động:**
  - Người dùng chọn "Học kỳ", "Khoa", "Lớp" (những filter này bắt buộc phải chọn và đã được áp dụng để lấy danh sách).
  - Bấm nút "Xuất Excel" để xuất toàn bộ sinh viên trong lớp thuộc học kỳ đó.
  - *Lưu ý:* Khi bấm vào nút xuất, hệ thống sẽ tải xuống toàn bộ dữ liệu thuộc bộ lọc, thay vì chỉ dữ liệu đang hiển thị trên 1 trang (bỏ qua giới hạn phân trang).
- Tính năng này chỉ hiển thị và sử dụng được với các account là Giáo viên (chủ nhiệm) hoặc Admin/Supervisor. Sinh viên (role `student`) không được sử dụng ở trang này.

### Backend (API)
- Endpoint: `GET /api/summaries-points/export-summary-excel?semesterId=...&classId=...&studentIds=...&mode=...`
  - Nếu `mode=all_filtered` (mặc định): Tự động lấy toàn bộ danh sách sinh viên thuộc `classId` và `semesterId` đó.
  - Nếu `mode=selected`: Lọc và chỉ xuất các sinh viên theo `studentIds` truyền lên.
- Phân quyền: Đã tích hợp `JwtAuthGuard`. Giáo viên chỉ được xuất dữ liệu của lớp mình phụ trách.

## 2. Quy ước file mẫu PL03

File mẫu dùng để định dạng bảng tính Excel xuất ra được đặt theo quy ước sau:

- **Tên file mẫu:** `PL03-Tong-hop-RL.xlsx` (Nên dùng `.xlsx` để tương thích tốt với thư viện `exceljs`).
- **Sheet chính:** `TT40` là sheet chứa nội dung và template. Các dữ liệu sẽ được điền vào sheet này.
- **Cấu trúc dữ liệu:**
  - Các thông tin header (Khoa, Lớp, Học kỳ/Năm học) nằm ở phần trên của sheet.
  - Bảng danh sách sinh viên bắt đầu từ dòng 11. Các cột gồm: TT, Họ và tên (tách Họ đệm và Tên), MSSV, Điểm rèn luyện, Xếp loại rèn luyện, Ghi chú.
  - Có các dòng thống kê (Số lượng, Tỉ lệ %) xếp loại (XS, Tốt, Khá, TB, Yếu) và tổng số sinh viên nằm ở bên dưới danh sách.
  - Dưới cùng là phần chữ ký của Trưởng khoa và GVCN/CVHT.
- **Dynamic Rows:** Khi số lượng sinh viên > 35, backend sẽ tự động clone style từ dòng dữ liệu mẫu, chèn thêm các dòng mới và đẩy phần thống kê cùng chữ ký xuống phía dưới. Các công thức trong vùng thống kê được cập nhật (dynamic range) để tính toán đúng theo số lượng sinh viên thực tế.

## 3. Dependencies mới

Để phục vụ cho tính năng xuất file và giữ định dạng template Excel phức tạp, dự án đã thêm các dependency sau vào Backend:

- **`exceljs`** (`^4.4.0`): Thư viện được chọn để đọc file template `.xlsx`, điền dữ liệu, clone các style/dòng, và render file output cho client. Được ưu tiên thay vì các thư viện như `xlsx` community version do hỗ trợ style (border, background, font weight, v.v.) và cell merging tốt hơn.
