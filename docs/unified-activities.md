# Hướng Dẫn Kỹ Thuật: Unified Activity Domain (Phân Hệ Hoạt Động Hợp Nhất)

Tài liệu này hướng dẫn chi tiết về cấu trúc, logic nghiệp vụ và các bước vận hành sau khi chuyển đổi hoàn toàn từ phân hệ quản lý Câu lạc bộ (Club) sang Phân hệ Hoạt động hợp nhất (Unified Activity Domain). 

Hệ thống đã loại bỏ hoàn toàn thuật ngữ "Club" ở cả mức API, mã nguồn, cơ sở dữ liệu MongoDB và phân quyền để sử dụng duy nhất thuật ngữ thống nhất là **Activity**.

---

## 1. Tổng Quan & Các Loại Hoạt Động

Toàn bộ thực thể cũ liên quan đến Câu lạc bộ (Club) đã được đổi tên vật lý thành **Activity** (lưu trữ trong MongoDB collection `activities`).

### 1.1 Loại Hoạt động (`activity_type`)
Trường `activity_type` định nghĩa loại hình hoạt động, bao gồm các giá trị:
- `'club'`: Câu lạc bộ truyền thống (áp dụng các ràng buộc giới hạn slot học kỳ).
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

- **Với loại `'club'`**: Mỗi học kỳ, mỗi sinh viên chỉ được phép có tối đa **1** tư cách thành viên hoạt động (`occupies_slot: true`). Khi chuyển đổi hoạt động, sinh viên chịu giới hạn tối đa 3 lần tự chuyển đổi (self-service) trước khi buổi sinh hoạt đầu tiên bắt đầu và phải qua phê duyệt của cố vấn/quản trị viên sau thời điểm đó.
- **Với loại phi-club (`'event'`, `'activity'`, `'festival'`)**: Sinh viên có thể tham gia **nhiều hoạt động song song** trong cùng một học kỳ. Bản ghi `ActivityMember` tương ứng được lưu với thuộc tính `occupies_slot: false`, do đó không bị chặn bởi chỉ mục độc nhất (unique index) của database và không tính vào giới hạn tự chuyển đổi hoạt động.

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
- Sinh ra một bản ghi `AcademicRecord` cho từng tiêu chí trong rule với `idempotency_key = activity-completion:<activityId>:<studentId>:<criterionId>`, `action_type = 'count'`, `quantity = 1`.
- Sinh ra một bản ghi `ActivityCompletionAward` tương ứng để lưu vết kiểm toán.
- Ràng buộc unique index trên bộ ba `{ activity_id, student_id, criterion_id }` cùng idempotency key đảm bảo không sinh giải thưởng hoặc điểm đúp kể cả khi đồng bộ lại nhiều lần.

---

## 4. Cấu Trúc Cơ Sở Dữ Liệu & Chỉ Mục (Indexes)

Sau khi chạy migration, cấu trúc các collection liên quan đến Activity và chỉ mục của chúng được cấu hình như sau:

### 4.1 Collection: `activities`
- `{ advisor_id: 1 }`
- `{ status: 1 }`
- `{ semester_id: 1 }`
- `{ activity_type: 1, participation_status: 1 }`

### 4.2 Collection: `activity_members`
- `{ activity_id: 1, student_id: 1, semester_id: 1 }` (Unique)
- `{ student_id: 1 }`
- `{ activity_id: 1, status: 1 }`
- `{ student_id: 1, semester_id: 1 }` (Unique, với `partialFilterExpression: { occupies_slot: true }` để giới hạn 1 slot club mỗi học kỳ)

### 4.3 Collection: `activity_favorites`
- `{ activity_id: 1, user_id: 1 }` (Unique)
- `{ activity_id: 1 }`
- `{ user_id: 1 }`

### 4.4 Collection: `activity_membership_transfers`
- `{ student_id: 1, semester_id: 1, mode: 1, status: 1 }`
- `{ to_membership_id: 1 }` (Unique)
- `{ to_activity_id: 1, status: 1, requested_at: -1 }`

### 4.5 Collection: `activity_schedules`
- `{ activity_id: 1, start_time: 1 }`
- `{ activity_id: 1, semester_id: 1 }`
- `{ status: 1, start_time: 1 }`

### 4.6 Collection: `activity_attendance_configs`
- `{ activity_id: 1, semester_id: 1 }` (Unique, Sparse)
- `{ semester_id: 1, status: 1 }`

---

## 5. Quy Trình Chạy Migration Dữ Liệu Cũ (Cutover)

Hệ thống cung cấp các script hỗ trợ thực hiện di chuyển toàn bộ dữ liệu từ phân hệ Club cũ sang phân hệ Activity mới, cũng như khôi phục lại (Rollback) trong trường hợp khẩn cấp.

### 5.1 Các câu lệnh thực thi

Các câu lệnh dưới đây được đăng ký trong `package.json` và chạy từ thư mục `backend`:

| Hành động | Câu lệnh | Mô tả |
|---|---|---|
| Migration (Kiểm tra thử) | `npm run migration:activities:dry-run` | Mô phỏng quá trình đổi tên collection, kiểm tra số lượng bản ghi và sự tồn tại của dữ liệu mà không làm thay đổi database thực tế. |
| Migration (Thực thi) | `npm run migration:activities:execute` | Thực thi đổi tên vật lý 6 collection, đổi tên các trường tài liệu, cập nhật bảng phân quyền, và dựng lại các chỉ mục. |
| Rollback (Kiểm tra thử) | `npm run migration:activities:rollback:dry-run` | Mô phỏng quá trình đảo ngược các bước đổi tên và trường dữ liệu về trạng thái Club. |
| Rollback (Thực thi) | `npm run migration:activities:rollback:execute` | Thực thi khôi phục hoàn toàn cơ sở dữ liệu về trạng thái Club cũ. |

### 5.2 Cơ chế an toàn hoạt động của script
- **Lớp bảo vệ Production**: Script tự động phân tích URI kết nối MongoDB và biến môi trường `NODE_ENV`. Nếu phát hiện có chứa từ khóa liên quan đến production (`prod`, `production`, `atlas`, `cluster`) hoặc `NODE_ENV = production`, script sẽ bị chặn ngay lập tức để tránh ảnh hưởng đến dữ liệu trực tiếp.
- **Tránh trùng lặp key**: Trước khi đổi tên trường dữ liệu hoặc groups/permissions, script sẽ chủ động thực hiện dọn dẹp các chỉ mục cũ và xóa các bản ghi target trùng lặp, đảm bảo không bao giờ xảy ra lỗi trùng khóa (`E11000 duplicate key error`).
