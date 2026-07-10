# Hướng Dẫn Kỹ Thuật: Unified Activity Domain (Phân Hệ Hoạt Động Hợp Nhất)

Tài liệu này hướng dẫn chi tiết về cấu trúc, logic nghiệp vụ và các bước vận hành sau khi chuyển đổi từ phân hệ quản lý Câu lạc bộ (Club) sang Phân hệ Hoạt động hợp nhất (Unified Activity Domain).

---

## 1. Tổng Quan & Các Loại Hoạt Động

Hệ thống đã hợp nhất các thực thể Câu lạc bộ, Sự kiện, Hội thảo, Festival thành một thực thể duy nhất: **Activity** (được lưu trữ vật lý trong MongoDB collection `clubs`). 

### 1.1 Loại Hoạt động (`activity_type`)
Trường `activity_type` có các giá trị sau:
- `'club'`: Câu lạc bộ truyền thống (áp dụng ràng buộc slot học kỳ).
- `'event'`: Sự kiện.
- `'activity'`: Hoạt động chung.
- `'festival'`: Lễ hội học sinh sinh viên.

### 1.2 Trạng thái hoạt động (`participation_status`)
Vòng đời của một hoạt động được quản lý qua trường `participation_status`:
- `'draft'`: Bản nháp, chỉ người tạo/cố vấn nhìn thấy. Chặn sinh viên tham gia.
- `'published'`: Đang hoạt động/mở đăng ký cho sinh viên.
- `'completed'`: Đã hoàn thành. Chặn đăng ký gia nhập và không cho phép thay đổi lịch sinh hoạt.
- `'cancelled'`: Đã hủy. Chặn đăng ký gia nhập và không cho phép thay đổi lịch sinh hoạt.

---

## 2. Ràng Buộc Slot Thành Viên (Membership Slot Rules)

- **Với loại `'club'`**: Mỗi học kỳ, mỗi sinh viên chỉ được phép có tối đa **1** tư cách thành viên hoạt động (`occupies_slot: true`). Khi chuyển CLB, sinh viên chịu giới hạn 3 lần tự chuyển trước buổi học đầu và phải qua duyệt sau đó.
- **Với loại phi-club (`'event'`, `'activity'`, `'festival'`)**: Sinh viên có thể tham gia **nhiều hoạt động song song** trong cùng một học kỳ. Bản ghi `ClubMember` tương ứng được lưu với thuộc tính `occupies_slot: false`, do đó không bị chặn bởi chỉ mục độc nhất (unique index) của database và không tính vào giới hạn chuyển câu lạc bộ.

---

## 3. Cơ Chế Hoàn Thành Hoạt Động (Activity Completion)

Để phục vụ tự động hóa việc tính điểm rèn luyện theo quy tắc hoàn thành thay vì cộng điểm điểm danh riêng lẻ:

### 3.1 Quy tắc hoàn thành (`ActivityCompletionRule`)
- Mỗi hoạt động trong một học kỳ được định nghĩa tối đa 1 quy tắc hoàn thành hoạt động chứa:
  - `minimum_attendance`: Số buổi điểm danh tối thiểu cần đạt (>= 1).
  - `criterion_ids`: Danh sách các tiêu chí rèn luyện được cộng điểm khi hoàn thành.
- Khi hoạt động có cấu hình completion rule, hệ thống tự động **ngưng cộng điểm điểm danh riêng lẻ (suppress legacy scoring)** để tránh sinh điểm đúp.

### 3.2 Ghi nhận hoàn thành (`ActivityCompletionAward` & `AcademicRecord`)
Khi một buổi điểm danh của sinh viên được phê duyệt (`Present` hoặc `Late`), hệ thống đếm số buổi điểm danh đã phê duyệt của họ trong học kỳ đó. Tại thời điểm chạm ngưỡng `minimum_attendance`:
- Hệ thống chạy MongoDB Transaction tự động phát thưởng.
- Sinh ra một bản ghi `AcademicRecord` cho từng tiêu chí trong rule với `idempotency_key = activity-completion:<clubId>:<studentId>:<criterionId>`, `action_type = 'count'`, `quantity = 1`.
- Sinh ra một bản ghi `ActivityCompletionAward` tương ứng để lưu vết kiểm toán.
- Ràng buộc unique index trên bộ ba `{ club_id, student_id, criterion_id }` cùng idempotency key đảm bảo không sinh giải thưởng hoặc điểm đúp kể cả khi đồng bộ lại nhiều lần.

---

## 4. Khả Năng Tương Thích Ngược & Đường Dẫn Route (Compatibility Routes)

Hệ thống cung cấp song song các endpoint alias phục vụ tương thích ngược với các bookmark cũ của sinh viên hoặc các tích hợp ngoài:

| Thực thể | Endpoint Mới | Endpoint Tương Thích Ngược (Alias) |
|---|---|---|
| Hoạt động | `/activities` | `/clubs` (mặc định lấy `activity_type = club`) |
| Lịch sinh hoạt | `/activity-schedules` | `/club-schedules` |
| Điểm danh | `/activity-completion` | `/club-attendance` |

Các API phía frontend đã được chuyển đổi để ưu tiên gọi các Endpoint Mới.

---

## 5. Hướng Dẫn Chạy Migration Dữ Liệu Cũ Local

Đối với cơ sở dữ liệu phát triển ở local chứa dữ liệu cũ chưa có hai trường `activity_type` và `participation_status`, tiến hành chạy script migration để điền dữ liệu mặc định:

```bash
# Di chuyển vào backend
cd backend

# Chạy script migration
npm run migrate:unified-activities
```

*Lưu ý an toàn*: Script đã tích hợp lớp bảo vệ để ngăn chặn việc thực thi trực tiếp trên database production thông qua phân tích URI kết nối và biến môi trường `NODE_ENV`.
