# Taskscope: Sửa cơ chế đồng bộ academic_record khi cộng/trừ điểm tại /grading/score

## Mục tiêu
- Sửa lỗi điểm tại trang `/grading/score` bị nhảy ngược khi Admin chỉnh số lần ghi nhận tiêu chí, ví dụ `00 -> 01` rồi tự về `00`, hoặc chiều ngược lại.
- Bỏ cơ chế UI ép không cho giảm dưới `non_deletable_count` / `original_count`.
- Chốt rõ phạm vi bỏ `non_deletable_count` / `original_count`: bỏ vai trò khóa `minCount` và bỏ việc dùng 2 field này để kéo điểm quay lại, nhưng chưa xóa field/API nếu vẫn cần cho audit, hiển thị tham khảo hoặc warning.
- Khi người dùng bấm trừ điểm và backend cần xóa `academic_record`, thực hiện xóa vĩnh viễn thay vì xóa mềm bằng `status: inactive` và `is_deleted: true`.
- Điều chỉnh quyền tăng/giảm theo vai trò:
  - Admin: được tăng/giảm không điều kiện, ngoại trừ tiêu chí bị khóa hoặc bảng điểm đã khóa.
  - Teacher: được tăng/giảm theo phase/quyền hiện tại, nhưng không được xóa điểm/record do Admin chấm.
  - Student: chỉ được xóa điểm/record do Student tự chấm.
- Giữ nguyên luồng tổng thể: thay đổi số lần tiêu chí vẫn đồng bộ sang `academic_record`, cập nhật `evaluation_detail`, tính lại `summary.total_score` và realtime UI.

## Hiện trạng đã kiểm tra
- Trang `/grading/score` dùng state `evaluationCounts` để lưu số lần theo từng tiêu chí.
- Khi tăng/giảm, frontend gọi:
  - `handleCountChange(...)`
  - `handleCountSet(...)`
  - `persistStudentScore(...)`
  - `evaluationDetailApi.bulkUpsertEvaluationDetails(...)`
- Backend đồng bộ số lần với `academic_record` trong:
  - `backend/src/evaluation-detail/evaluation-detail.service.ts`
  - method `syncAcademicRecords(...)`
- `evaluation_detail` hiện là embedded document trong `summary_point.details`, không phải collection độc lập có quan hệ trực tiếp với `academic_record`.
- `academic_record` là collection riêng, khớp với điểm chi tiết bằng bộ khóa nghiệp vụ `student_id + semester_id + criterion_id`.
- Hiện frontend đang lấy `minCount` từ:
  - `non_deletable_count`
  - fallback `original_count`
  - fallback `0`
- Vì vậy UI không cho giảm dưới số lượng record backend coi là không xóa được.
- Backend khi giảm count hiện xóa mềm record bằng:
  - `findByIdAndUpdate(rec._id, { status: 'inactive', is_deleted: true })`
- Backend cũng clamp count trong `update(...)` và `bulkUpsert(...)` nếu `newCount/current_count` nhỏ hơn số record không thể xóa theo `canRequesterDeleteRecord(...)`.

## Root cause giả định
- Count hiển thị trên UI được merge từ `evaluation_detail` và `preExistingCounts`.
- Khi Admin tăng/giảm, autosave gửi count mới lên backend, nhưng backend hoặc frontend có thể kéo count về dữ liệu cũ sau khi fetch lại.
- Với chiều giảm, nguyên nhân chính là UI/backend clamp theo `non_deletable_count`, `original_count`, active `academic_record` hoặc `canRequesterDeleteRecord(...)`.
- Với chiều tăng `00 -> 01`, cần kiểm tra riêng nhánh tạo mới `evaluation_detail` và `academic_record`: nếu payload không được gửi, criterion không tìm thấy, DTO bị reject, hoặc backend không tạo detail mới thì frontend fetch lại `freshDetails` sẽ đưa UI về `00`.
- Sau khi save, frontend reload `freshDetails` và `freshPreExistingCounts`, rồi merge lại; nếu backend trả về count khác count user vừa chỉnh, UI sẽ nhảy về giá trị backend trả về.
- Cơ chế xóa mềm làm record cũ vẫn tồn tại trong database, dễ gây hiểu nhầm khi audit/query nếu logic nào đó không lọc đủ `status: active` và `is_deleted != true`.

## Quyết định về `non_deletable_count` / `original_count`
- Cần bỏ cơ chế dùng `non_deletable_count` / `original_count` làm `minCount` cứng tại UI `/grading/score`.
- Count control tại `/grading/score` phải cho chỉnh từ `0` nếu người dùng có quyền sửa và tiêu chí không bị khóa.
- Không dùng `non_deletable_count` / `original_count` để tự kéo `evaluationCounts` quay lại giá trị cũ sau autosave/manual save.
- Không dùng `preExistingCounts.current_count` để tự bơm count vào bảng điểm khi chưa có `evaluation_detail`, nếu việc đó làm Admin chỉnh `00 -> 01` hoặc `01 -> 00` bị rollback.
- Backend không được clamp Admin theo `non_deletable_count`, `original_count`, `daily_report_id`, người tạo record hoặc role người tạo record.
- Teacher/Student vẫn cần chặn xóa record không thuộc quyền, nhưng chặn theo quyền trên từng `academic_record`, không chặn trước bằng `minCount` lấy từ `non_deletable_count` / `original_count` trên UI.
- Có thể giữ API/field `non_deletable_count`, `original_count`, `deletable_count`, `current_count` trong `pre-counts` nếu còn dùng cho audit, tooltip, warning hoặc debug.
- Không xóa schema/API pre-count trong task này trừ khi chứng minh không còn caller nào phụ thuộc.

## Đề xuất thiết kế đồng bộ dễ bảo trì hơn
- Hiện hệ thống đang có 2 nơi cùng biểu diễn “số lần”:
  - `evaluation_detail.current_count` trong `summary_point.details`.
  - Số lượng `academic_record` active theo `student_id + semester_id + criterion_id`.
- Nếu cả 2 cùng được ghi trực tiếp và lại đồng bộ qua lại, dễ phát sinh lỗi nhảy điểm, rollback sau autosave, clamp sai quyền hoặc lệch dữ liệu khi một bên ghi thành công còn bên kia thất bại.
- Đề xuất chọn một nguồn sự thật duy nhất cho số lần ghi nhận:
  - `academic_record` là source of truth cho số lần/ghi nhận chi tiết.
  - `evaluation_detail.current_count` là bản tổng hợp/cache phục vụ tính điểm, hiển thị nhanh và lưu trạng thái chấm.
- Luồng chuẩn nên là một chiều:
  1. UI `/grading/score` gửi ý định chỉnh count, ví dụ `target_count`, `summary_id`, `criterion_id`, `reason`.
  2. Backend kiểm tra quyền theo role và trạng thái khóa.
  3. Backend tạo/xóa vĩnh viễn các `academic_record` được phép theo target count.
  4. Backend đếm lại `academic_record` active thực tế.
  5. Backend cập nhật `evaluation_detail.current_count`, `system_score`, `sv_score/gv_score` nếu phù hợp.
  6. Backend recompute `summary.total_score`.
  7. Backend trả về `actual_count`, detail đã cập nhật và warning/clamp nếu có.
- Tránh luồng vòng lặp:
  - Không để frontend tự bơm `preExistingCounts` vào `evaluationCounts` rồi save ngược lại.
  - Không để `evaluation_detail` và `academic_record` tự đồng bộ hai chiều ở nhiều điểm khác nhau.
  - Không dùng `pre-counts` làm nguồn kéo điểm về giá trị cũ sau save.
- Nên gom logic đồng bộ vào một service/helper duy nhất, ví dụ `setCriterionCount(...)` hoặc `syncCriterionCountFromRecords(...)`, và bắt các entrypoint sau dùng chung:
  - `bulkUpsert(...)`
  - `update(...)`
  - luồng `single_option`
  - xóa evaluation detail/history nếu còn hỗ trợ
  - copy điểm nếu có thay đổi count
- Service này chịu trách nhiệm duy nhất cho:
  - kiểm tra quyền xóa/tạo record theo Admin/Teacher/Student
  - tạo/xóa `academic_record`
  - tính `actual_count`
  - cập nhật `evaluation_detail`
  - recompute summary
  - trả warning/clamp chuẩn cho frontend
- Có thể bổ sung schema ở phase sau để dễ audit và truy vết:
  - `academic_record.summary_point_id` hoặc `source_summary_id`
  - `academic_record.source`: `grading_score`, `daily_report`, `import`, `manual`
  - `academic_record.owner_role` hoặc role snapshot tại thời điểm tạo
- Trong task hiện tại, ưu tiên refactor service/luồng xử lý trước; chưa bắt buộc migrate schema nếu có thể đảm bảo đồng bộ bằng `student_id + semester_id + criterion_id`.

## Phạm vi sửa frontend
- File chính:
  - `frontend/src/app/grading/score/page.tsx`
- File helper liên quan:
  - `frontend/src/app/grading/score/_utils/score-calculation.ts`

### Thay đổi cần làm
- Bỏ việc dùng `non_deletable_count` / `original_count` làm `minCount` bắt buộc trong UI.
- Với điều khiển count thường:
  - `minCount` nên là `0`.
  - Nút trừ cho phép giảm về `0` nếu `canModifyScore === true` và tiêu chí không `is_locked`.
  - Slider/picker cũng cho chọn từ `0`.
- Khi merge dữ liệu từ backend:
  - Không tự bơm lại pre-existing count vào `evaluationCounts` theo cách khiến UI nhảy về số cũ sau save.
  - Cần tách rõ:
    - count hiện tại của bảng điểm: lấy từ `evaluation_detail.current_count`.
    - thông tin tham khảo/audit nếu còn cần hiển thị: lấy từ `preExistingCounts`.
- Với warning/clamp từ backend:
  - Admin không được nhận warning/clamp do `non_deletable_count`, `original_count`, người tạo record hoặc nguồn record.
  - Teacher/Student vẫn có thể nhận warning/clamp nếu requested count thấp hơn số record họ không được phép xóa.
  - Warning/clamp chỉ phản ánh kết quả backend sau khi kiểm tra quyền xóa từng `academic_record`; không dùng `non_deletable_count/original_count` để disable nút trừ hoặc giới hạn slider trước trên UI.
- Giữ nguyên chặn sửa với:
  - summary đã `locked`
  - tiêu chí `is_locked`
  - role/phase không được phép sửa
  - học kỳ không active

## Phạm vi sửa backend
- File chính:
  - `backend/src/evaluation-detail/evaluation-detail.service.ts`

### Thay đổi cần làm
- Trong `syncAcademicRecords(...)`:
  - Khi `diff > 0`: giữ nguyên tạo thêm `diff` bản ghi `academic_record`.
  - Khi `diff < 0`: đổi từ xóa mềm sang xóa vĩnh viễn bằng `findByIdAndDelete(...)` hoặc `deleteMany(...)` theo danh sách record được chọn.
- Rà soát các vị trí đang clamp count theo `originalCount` / `canRequesterDeleteRecord(...)`:
  - `update(...)`
  - `bulkUpsert(...)`
  - `getPreExistingCountsForSummary(...)`
  - `getPreExistingCountsBulk(...)`
- Với yêu cầu mới:
  - Admin phải có thể tăng từ `0 -> n` và giảm từ `n -> 0` không bị clamp bởi `originalCount`, `non_deletable_count`, người tạo record hoặc nguồn record; chỉ chặn nếu tiêu chí `is_locked` hoặc summary đã `locked`.
  - Teacher được xóa các record không phải do Admin chấm; nếu số cần giảm đụng đến record Admin thì chỉ xóa phần được phép và trả clamp/warning rõ ràng.
  - Student chỉ được xóa record do Student tự chấm; không được xóa record do Teacher/Admin/Supervisor hoặc nguồn khác tạo.
  - Khi giảm count, các record được phép xóa phải bị xóa vĩnh viễn.

### Ma trận quyền tăng/giảm count
- Admin:
  - Được tăng count và tạo `academic_record`.
  - Được giảm count đến `0`.
  - Được xóa vĩnh viễn mọi `academic_record` cùng `student_id + semester_id + criterion_id`.
  - Chỉ bị chặn bởi `summary.status === locked` hoặc `criterion.is_locked === true`.
- Teacher:
  - Được tăng count và tạo `academic_record` trong phase/quyền hiện tại.
  - Được giảm/xóa record do Teacher tự chấm hoặc các record không thuộc Admin theo rule nghiệp vụ hiện hành.
  - Không được xóa record do Admin chấm.
  - Nếu requested count thấp hơn số record Admin đang giữ, backend clamp về số record Admin còn lại và trả `clampResults`.
- Student:
  - Được tăng count/tự chấm trong phase/quyền hiện tại.
  - Chỉ được giảm/xóa record do chính Student tạo.
  - Không được xóa record do Teacher/Admin/Supervisor hoặc báo cáo/nghiệp vụ khác tạo.
  - Nếu requested count thấp hơn số record không thuộc Student, backend clamp và trả `clampResults`.

## Điểm cần đặc biệt kiểm tra
- `daily_report_id`: theo quyền mới, Admin vẫn được điều chỉnh tăng/giảm không điều kiện ngoại trừ tiêu chí/bảng điểm bị khóa. Cần rà soát nếu record từ báo cáo ngày có ràng buộc dữ liệu ngoài `academic_record`; nếu có FK/logic liên kết, phải xử lý đồng bộ hoặc ghi rõ exception nghiệp vụ trước khi code.
- `single_option`: chọn option tạo count `1`, bỏ chọn về `0`; backend cần xóa vĩnh viễn record tương ứng khi bỏ chọn.
- Autosave: sau save không được load lại count cũ khiến UI nhảy số.
- Realtime/recompute: sau xóa vĩnh viễn vẫn phải gọi recompute summary để tổng điểm đúng.
- Nhánh tăng `00 -> 01`: phải xác nhận `bulkUpsert(...)` tạo mới cả `evaluation_detail` và `academic_record`, sau đó `getEvaluationDetailsBySummary(...)` trả lại detail mới.
- Source of truth: mọi thay đổi count phải đi qua cùng service đồng bộ để tránh `evaluation_detail.current_count` và số lượng `academic_record` active lệch nhau.

## Acceptance criteria
- Tại `/grading/score`, Admin tăng từ `00` lên `01`, autosave/manual save xong vẫn giữ `01`, không tự nhảy về `00`.
- Admin giảm từ `01` về `00`, autosave/manual save xong vẫn giữ `00`, không tự nhảy về `01`.
- Admin không bị chặn bởi `non_deletable_count`, `original_count`, `daily_report_id`, người tạo record, hoặc role người tạo record; chỉ bị chặn bởi tiêu chí/bảng điểm bị khóa.
- Teacher giảm count không được xóa record do Admin chấm; hệ thống giữ lại số count tương ứng và có warning/clamp rõ ràng.
- Student giảm count chỉ xóa được record do Student tự chấm; record từ Teacher/Admin/Supervisor hoặc nguồn khác vẫn được giữ lại.
- Khi Admin giảm count, số lượng `academic_record` active của cùng `student_id + semester_id + criterion_id` giảm tương ứng.
- Record bị trừ được xóa vĩnh viễn khỏi collection `academic_records`, không còn ở trạng thái `inactive/is_deleted`.
- Sau mỗi lần tăng/giảm, backend trả về `actual_count` hoặc detail đã chuẩn hóa theo số `academic_record` active thực tế.
- `evaluation_detail.current_count` luôn bằng số lượng `academic_record` active thực tế mà role hiện tại được phép tạo/xóa theo kết quả backend.
- Tổng điểm category và tổng điểm summary được tính lại đúng sau tăng/giảm.
- Tiêu chí `is_locked`, summary `locked`, role/phase không được phép sửa vẫn bị chặn như hiện tại.
- Copy điểm không bị kéo ngược bởi `original_count/non_deletable_count` của sinh viên đích nếu Admin có quyền ghi đè theo yêu cầu mới.

## Test cần cập nhật / bổ sung
- Backend unit test cho `EvaluationDetailService.bulkUpsert(...)`:
  - Admin giảm count từ `1` về `0` thì gọi xóa vĩnh viễn `academicRecordModel.findByIdAndDelete` hoặc cơ chế delete tương đương.
  - Không còn clamp Admin về `originalCount`.
  - Admin tăng `0 -> 1` tạo mới `evaluation_detail` và `academic_record`, sau fetch lại vẫn là `1`.
  - Teacher giảm count không xóa record do Admin tạo.
  - Student giảm count chỉ xóa record do chính Student tạo.
  - Sau bulk upsert có gọi `recomputeTotalScore(...)`.
- Backend unit test cho service đồng bộ count/source of truth:
  - `target_count > activeRecords.length` tạo đúng số record mới.
  - `target_count < activeRecords.length` xóa vĩnh viễn đúng số record được phép.
  - Sau khi tạo/xóa record, `actual_count` được tính lại từ DB thay vì tin tuyệt đối vào payload frontend.
  - `evaluation_detail.current_count` được cập nhật theo `actual_count`.
- Frontend test/helper nếu có:
  - `mergeDetailsWithPreExistingCounts(...)` không tự thêm pre-existing count vào `counts` gây nhảy UI.
  - Count control có min là `0` thay vì `non_deletable_count/original_count`.
  - Admin chỉnh `00 -> 01` không bị ghi đè về `00` sau autosave/manual save.
  - Teacher/Student nhận warning/clamp khi cố giảm dưới số record không được phép xóa.

## Lệnh kiểm thử đề xuất
- Backend:
  - `cd backend`
  - `npm test -- evaluation-detail.service.spec.ts`
- Frontend:
  - `cd frontend`
  - `npm test -- score-calculation.test.ts`
  - `npm test -- copy-score.test.ts`
- Nếu có thời gian, chạy thêm test liên quan `/grading/score`:
  - `cd frontend`
  - `npm test -- summary-matching.test.ts`

## Ngoài phạm vi
- Không đổi công thức tính điểm/xếp loại nếu count đã đúng.
- Không đổi luồng approve/cancel approval.
- Không đổi quyền truy cập trang `/grading/score`.
- Không bắt buộc đổi schema database trong task này; các field như `summary_point_id`, `source`, `owner_role` của `academic_record` là đề xuất phase sau nếu cần audit tốt hơn.
- Không thay đổi import học vụ, báo cáo ngày, hoặc màn hình `/students/record` trừ khi phát hiện phụ thuộc trực tiếp gây lỗi.
