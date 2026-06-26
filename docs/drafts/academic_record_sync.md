# Cơ chế đồng bộ Academic Record mới (Một chiều)

Tài liệu/CHANGELOG này mô tả những thay đổi trong cơ chế đồng bộ số lần ghi nhận (`count`) giữa `academic_record` và `evaluation_detail` tại module chấm điểm (`/grading/score`).

## 1. Vấn đề trước đây
- Hệ thống duy trì 2 nơi cùng biểu diễn “số lần”:
  - `evaluation_detail.current_count` trong `summary_point.details`.
  - Số lượng `academic_record` active theo `student_id + semester_id + criterion_id`.
- Việc đồng bộ qua lại 2 chiều dễ phát sinh lỗi: nhảy điểm, rollback số trên UI sau khi autosave, clamp sai quyền hoặc lệch dữ liệu khi một bên ghi thành công còn bên kia thất bại.

## 2. Giải pháp: Luồng đồng bộ một chiều
Cơ chế mới thống nhất chọn **`academic_record` làm Nguồn Sự Thật Duy Nhất (Source of Truth)**. Trong khi đó, `evaluation_detail.current_count` chỉ đóng vai trò là bản tổng hợp/cache phục vụ tính điểm, hiển thị nhanh và lưu trạng thái chấm.

### Trình tự thực thi luồng một chiều:
1. **Request Intent**: UI `/grading/score` gửi ý định chỉnh count (`target_count`, `summary_id`, `criterion_id`, `reason`).
2. **Validation**: Backend kiểm tra quyền (role) và trạng thái khóa.
3. **Thao tác Academic Record**: Backend tạo mới hoặc **xóa vĩnh viễn** các `academic_record` được phép để đạt được `target_count`.
4. **Recount**: Backend đếm lại số lượng `academic_record` active thực tế còn lại trong database.
5. **Update Detail**: Backend lấy kết quả đếm thực tế để cập nhật `evaluation_detail.current_count`, `system_score`, `sv_score/gv_score` cho phù hợp.
6. **Recompute**: Backend gọi tính lại `summary.total_score`.
7. **Response**: Backend trả về `actual_count`, detail đã cập nhật và thông tin warning/clamp nếu user bị giới hạn quyền xóa.

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
_Drafted for syncing logic updates in `/grading/score` based on taskscope.md._
