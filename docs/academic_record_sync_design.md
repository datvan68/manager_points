---
title: Cơ chế đồng bộ Academic Record
date: 2026-06-25
status: Official
version: 1.0.0
---

# Cơ chế đồng bộ Academic Record mới (Một chiều)

Tài liệu này mô tả những thay đổi trong cơ chế đồng bộ số lần ghi nhận (`count`) giữa `academic_record` và `evaluation_detail` tại module chấm điểm (`/grading/score`).

## 1. Vấn đề trước đây
- Hệ thống duy trì 2 nơi cùng biểu diễn “số lần”:
  - `evaluation_detail.current_count` trong `summary_point.details`.
  - Số lượng `academic_record` active theo `student_id + semester_id + criterion_id`.
- Việc đồng bộ qua lại 2 chiều dễ phát sinh lỗi: nhảy điểm, rollback số trên UI sau khi autosave, clamp sai quyền hoặc lệch dữ liệu khi một bên ghi thành công còn bên kia thất bại.

## 2. Giải pháp: Luồng đồng bộ một chiều
Cơ chế mới thống nhất chọn **`academic_record` làm Nguồn Sự Thật Duy Nhất (Source of Truth)**. Trong khi đó, `evaluation_detail.current_count` chỉ đóng vai trò là bản tổng hợp/cache phục vụ tính điểm, hiển thị nhanh và lưu trạng thái chấm.

### Trình tự thực thi luồng một chiều (Intent-based API):
1. **Request Intent**: UI `/grading/score` gửi ý định chỉnh sửa điểm qua endpoint mới `POST /academic-records/intent`. Các intent hỗ trợ:
   - `set_target_count`: Đặt số lần vi phạm/ghi nhận (kèm `target_count`).
   - `select_option`: Chọn một tùy chọn điểm tĩnh (kèm `selected_option_id`).
   - `increase` / `decrease`: Tăng/giảm số lần (tùy chọn).
2. **Validation**: Backend kiểm tra quyền (role) và trạng thái khóa của người dùng dựa trên token.
3. **Thao tác Academic Record**: Backend xử lý dựa trên Intent:
   - Với `set_target_count`/`increase`/`decrease`: Tạo mới hoặc **xóa vĩnh viễn** các `academic_record` được phép để đạt được `target_count`.
   - Với `select_option`: Tìm kiếm record cũ và cập nhật, hoặc tạo mới `academic_record` lưu `selected_option_id`.
4. **Rebuild Evaluation Detail**: Hệ thống build lại các bản ghi `evaluation_detail` từ các `academic_record` active. Backend tính toán lại `system_score`, `sv_score`, `gv_score` và `current_count` thực tế.
5. **Recompute**: Backend gọi tính lại tổng điểm `summary.total_score`.
6. **Response & Hydration**: Backend trả về `actual_count` (hoặc `selected_option_id`), detail đã cập nhật. Frontend sử dụng dữ liệu này để Hydrate giao diện, đồng thời hiển thị Toast/Warning nếu backend từ chối thao tác (do giới hạn quyền hạn).

## 3. Các thay đổi quan trọng khác

### Xóa vĩnh viễn (Hard Delete)
Thay vì đổi trạng thái sang inactive/is_deleted (xóa mềm) khi giảm count, các bản ghi `academic_record` sẽ bị xóa vĩnh viễn (`findByIdAndDelete` / `deleteMany`) để đảm bảo tính nhất quán dữ liệu.

### Loại bỏ ràng buộc `minCount` trên Frontend
- Không còn sử dụng `non_deletable_count` hoặc `original_count` làm `minCount` bắt buộc trên UI. 
- Component (slider, nút trừ) cho phép chọn hoặc giảm số lượng về `0`.
- Frontend không tự động bơm lại các "preExistingCounts" vào `evaluationCounts` theo cách có thể làm UI bị nhảy về số cũ sau save.

### Ma trận quyền điều chỉnh Count
Sự giới hạn giảm count nay được Backend kiểm soát chặt chẽ dựa trên người tạo bản ghi:
- **Admin**: Được tăng giảm tự do từ `0 -> n` và ngược lại. Được quyền xóa vĩnh viễn mọi `academic_record` của `student_id + semester_id + criterion_id`. Chỉ bị chặn khi tiêu chí/bảng điểm đang khóa.
- **Teacher**: Được tăng count. Được giảm/xóa các bản ghi do mình tạo hoặc không thuộc Admin. Nếu cố giảm lấn vào số bản ghi của Admin thì Backend sẽ giữ lại các bản ghi của Admin, sinh ra `actual_count` lớn hơn `target_count` và trả về `clamp/warning`.
- **Student**: Chỉ được xóa bản ghi do chính Student đó tạo. Không thể xóa bản ghi từ Teacher, Admin, hay các nguồn hệ thống khác.

---
**Note**: Bản cập nhật này bao gồm việc fix các code smells, cải thiện bảo mật và tăng test coverage trong các phần liên quan đến `academic_record_sync` ở bước review trước.
