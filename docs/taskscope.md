Task: repair-activity-completion-rule-index | devops_infra | Risk: HIGH
Objective: Khôi phục khả năng tạo quy tắc hoàn thành cho nhiều hoạt động trong cùng học kỳ.

Scope:
- backend/scripts/repair-activity-completion-rule-index.ts :: activity_completion_rules :: chạy migration có sẵn để chuẩn hóa club_id thành activity_id, xóa index cũ và đảm bảo unique index activity_id + semester_id.
- backend/package.json :: migration commands :: sử dụng đúng lệnh dry-run và execute hiện có.

Out: Thay đổi nghiệp vụ quy tắc hoàn thành; tự động xóa/gộp dữ liệu xung đột; unrelated files and behavior.

Steps:
1. backend :: chạy npm run migration:activity-completion-rule-index:dry-run :: kiểm tra trạng thái dữ liệu và index.
2. Dừng nếu bothDifferent, missingActivity hoặc duplicateCanonicalPairs lớn hơn 0.
3. Sau khi có backup và phê duyệt, chạy npm run migration:activity-completion-rule-index:execute.
4. Chạy lại dry-run và thử tạo quy tắc cho hai hoạt động khác nhau trong cùng học kỳ.

Verify:
- backend :: npm run migration:activity-completion-rule-index:dry-run => không còn legacy index/field và có đúng một unique index activity_id_1_semester_id_1.
- backend :: npm run build => build thành công.

Done:
- Không còn E11000 từ club_id_1_semester_id_1.
- Các hoạt động khác nhau có thể có quy tắc trong cùng học kỳ.
- Quy tắc trùng activity_id + semester_id vẫn bị từ chối.

Gate/Stop: Cần backup và phê duyệt trước khi chạy execute; dừng để xử lý thủ công nếu dry-run phát hiện dữ liệu mâu thuẫn.
Rollback: Khôi phục database từ backup trước migration.
Dependencies: MONGO_URI hợp lệ cho đúng môi trường và quyền quản trị index MongoDB.
Artifacts: Kết quả dry-run trước/sau, thông tin backup, phê duyệt và log execute.