# Tài liệu tính năng: Tiêu chí chấm điểm dạng Single Option (Chọn 1)

## 1. Giới thiệu
Tính năng "Single Option" bổ sung thêm một hình thức chấm điểm mới bên cạnh hình thức "Theo số lần" (Count) hiện tại. 
Với hình thức mới này, Admin có thể cấu hình một danh sách các lựa chọn (options) cho một tiêu chí. Khi chấm điểm, người dùng chỉ được phép chọn tối đa 1 lựa chọn, và điểm số sẽ được tính dựa trên lựa chọn đó thay vì nhân với số lần (`current_count * score_per_unit`).

**Ví dụ:** Tiêu chí "Công tác hỗ trợ quản lý lớp"
- Lớp trưởng: 10 điểm
- Lớp phó: 8 điểm
- Tổ trưởng: 6 điểm
- Ủy viên: 4 điểm

---

## 2. Thay đổi về Cấu trúc dữ liệu (Database Models)

### `Criterion` Schema
Bổ sung các trường mới để hỗ trợ chế độ chấm điểm `single_option`:
- `scoring_mode`: Xác định hình thức chấm điểm (`'count'` hoặc `'single_option'`). Mặc định đối với các tiêu chí cũ là `'count'`.
- `options`: Danh sách các lựa chọn (chỉ có khi `scoring_mode` là `'single_option'`). Mỗi option bao gồm:
  - `id`: Mã định danh duy nhất của lựa chọn.
  - `label`: Tên lựa chọn (ví dụ: "Lớp trưởng").
  - `score`: Điểm số đạt được nếu chọn lựa chọn này.
  - `sort_order` (tùy chọn): Thứ tự hiển thị.
  - `is_active` (tùy chọn): Trạng thái kích hoạt.

### `EvaluationDetail` Schema
Bổ sung các trường để lưu lại trạng thái lựa chọn ngay tại thời điểm chấm:
- `selected_option_id`: ID của lựa chọn được người chấm chọn.
- `selected_option_label`: Tên của lựa chọn (Lưu trữ dưới dạng snapshot để giữ lịch sử nếu tên thay đổi).
- `selected_option_score`: Điểm của lựa chọn (Snapshot).

---

## 3. Cập nhật API & DTOs

Các API liên quan đến `Criteria` và `EvaluationDetail` được nâng cấp để hỗ trợ validate cho `single_option`:
- Nếu `scoring_mode` là `single_option`, danh sách `options` bắt buộc phải có ít nhất 1 phần tử hợp lệ (có `label` và `score`).
- Các giá trị `score` của `options` phải là dạng số (number) và ID của các option không được trùng lặp.
- API `EvaluationDetail` nhận thêm `selected_option_id` từ client và sẽ tự động xử lý lấy `system_score` từ option tương ứng.

---

## 4. Logic tính điểm (Backend)

Hàm tính điểm hệ thống (`system_score`) được tinh chỉnh:
- **Trường hợp `count`**: `system_score = current_count * score_per_unit` (Giữ nguyên như cũ).
- **Trường hợp `single_option`**: `system_score` được lấy trực tiếp từ `score` của option được chọn (`selected_option_id`). 
  - Nếu không có option nào được chọn: `system_score = 0`.
  - Biến `current_count` tự động được gán thành `1` (nếu có chọn) hoặc `0` (nếu không chọn) để đảm bảo độ tương thích với các logic cũ trên UI/Báo cáo.
  - Client chỉ truyền lên lựa chọn (`selected_option_id`), Backend sẽ là nơi tính toán và quyết định `system_score` cuối cùng.

---

## 5. Hướng dẫn sử dụng (Giao diện Frontend)

### Cho Admin (Cấu hình danh mục /grading/categories)
Khi tạo mới hoặc chỉnh sửa một tiêu chí, Admin sẽ thấy trường **Hình thức chấm điểm**.
1. Chọn **Chọn 1 option (single_option)**.
2. Giao diện sẽ hiển thị phần quản lý Option. (Lúc này trường "Bước nhảy điểm" sẽ bị ẩn).
3. Nhấn "Thêm option" để tạo các lựa chọn, điền Tên (Label) và Điểm số (Score).
4. Nhấn Lưu lại. Trên danh sách các tiêu chí, sẽ có một nhãn (badge) nhỏ ghi chữ "Chọn 1" để phân biệt.

### Cho Người chấm điểm (/grading/score)
1. Tại các tiêu chí cấu hình dạng **Chọn 1**, giao diện chấm điểm sẽ thay thế bộ đếm (cộng/trừ số lần) bằng danh sách dạng **Radio button** hoặc **Segmented control**.
2. Người dùng chỉ được tick chọn 1 mục duy nhất.
3. Khi đổi lựa chọn (ví dụ từ "Lớp trưởng" sang "Lớp phó"), điểm hệ thống lập tức thay đổi theo điểm của lựa chọn mới.
4. Có thể bỏ chọn (nếu có quyền) để đưa điểm về 0.
