# Taskscope: Hóa đơn điện - nước KTX theo phòng

## Task Identity and Pipeline

- Task: `dormitory-monthly-utility-invoices`
- Pipeline: `feature_development`
- Profile: Full
- Rules: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Branch/base: `main` at `375b5e8382142a6e10ee56f6c78743487a90aa09`
- Authority: Planning only. Taskscope này không cho phép triển khai, migration hay sửa dữ liệu.

## Risk Level

- Risk: high vì thay đổi schema/API hóa đơn, nguồn đối tượng thu, phép tính tiền và upload chứng từ thanh toán.
- Environment: development.
- Reversibility: code/test có thể revert; dữ liệu hóa đơn cũ cần chiến lược tương thích trước khi triển khai.
- Blast radius: phân hệ hóa đơn, báo cáo công nợ KTX và giao diện `/dormitory/invoices`.

## Objective

Quản lý một đợt thu điện - nước cho mỗi phòng theo từng tháng, lấy phòng và người ở từ tab `Danh sách KTX`, cho phép cập nhật thông số trong modal Nâng cao, tự tính tiền, theo dõi hạn thu và xem chứng từ của hóa đơn đã thu.

## Scope Boundaries

- Approved boundaries:
  - `backend/src/dormitory/**`
  - vùng upload/chứng từ hiện hành của `backend/src/**` nếu được xác minh phù hợp
  - `frontend/src/api/dormitory-api.ts`
  - `frontend/src/app/(dashboard)/dormitory/invoices/**`
  - component dùng riêng cho hóa đơn dưới `frontend/src/components/dormitory/**`
- Expected write targets:
  - `backend/src/dormitory/schemas/invoice.schema.ts`
  - `backend/src/dormitory/dto/create-invoice.dto.ts`
  - `backend/src/dormitory/controllers/invoices.controller.ts`
  - `backend/src/dormitory/services/invoices.service.ts`
  - test focused mới hoặc hiện hữu cạnh invoice backend
  - `frontend/src/api/dormitory-api.ts`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
  - test focused mới hoặc hiện hữu cạnh trang invoice
- Giữ nguyên permission `DORM_INVOICE_READ`, `DORM_INVOICE_CREATE`, `DORM_INVOICE_CONFIRM` trừ khi kiểm tra chứng minh cần ánh xạ lại; không mở endpoint công khai.

## Out of Scope

- Dùng hợp đồng làm danh sách chính hoặc bắt buộc hóa đơn phải có `contract_id`.
- Thu tiền phòng, dịch vụ, tiền phạt; chia tiền điện - nước cho từng sinh viên; cổng thanh toán tự động.
- Sửa Danh sách KTX, phân phòng, giá phòng, hợp đồng hoặc dữ liệu nguồn của PDF tháng 3/2026.
- Import Excel/PDF, gửi thông báo tự động, triển khai production hoặc migration dữ liệu production.

## Context and Dependencies

- `DormitoryRosterEntry` đã có `student_id`, `semester_id`, `room_id`, `bed_id`; đây là nguồn xác định người đang ở và phòng, không phải hợp đồng.
- Invoice hiện bắt buộc `contract_id` và `student_id`; item chỉ có `type`, `description`, `amount`, chưa lưu thông số công-tơ/định mức.
- `due_date` đã tồn tại và được dùng làm hạn kết thúc thu; trạng thái hiện tại là `Chưa thanh toán`, `Đã thanh toán`, `Quá hạn` nhưng UI mới yêu cầu `Chưa thu`, `Đã thu`.
- Chứng từ upload phải tái sử dụng cơ chế lưu file/URL và quy tắc MIME, kích thước, quyền truy cập của repository sau khi xác minh; không lưu dữ liệu ảnh base64 trực tiếp trong invoice.
- Một kỳ thu dùng định dạng canonical `YYYY-MM`, hiển thị `MM/YYYY`. Ngày chốt chỉ số được lưu riêng.
- Snapshot `roster_entry_ids` và `occupant_count` tại lúc chốt để hóa đơn lịch sử không đổi khi Danh sách/phòng thay đổi.

## Steps

1. Baseline: bổ sung test cho schema/service/controller hiện tại; xác minh cơ chế upload ảnh và các consumer báo cáo đang đọc invoice.
2. Backend model/DTO: chuyển invoice điện - nước sang cấp phòng với `room_id`, `billing_month`, `reading_date`, snapshot Danh sách, chi tiết điện/nước, `payment_start_date`, `due_date`, trạng thái thu, cờ không thu, ghi chú và metadata chứng từ; thiết lập unique index `room_id + billing_month`.
3. Backend calculation: lấy `occupant_count` từ Danh sách có `room_id`; tính định mức tổng, tiêu thụ, vượt định mức, tiền điện, tiền nước và tổng tiền ở server; không tin các giá trị dẫn xuất từ client.
4. Backend lifecycle/API: tạo/cập nhật đợt thu tháng, đọc danh sách/chi tiết, xác nhận đã thu kèm chứng từ; kiểm tra chỉ số giảm, số âm, trùng kỳ, hạn thu và trường hợp `Không thu`; giữ tương thích đọc dữ liệu cũ hoặc lập migration riêng trước khi bỏ field cũ.
5. Frontend table: chỉ hiển thị `Phòng`, `Kỳ thu`, `Tiền điện`, `Tiền nước`, `Tổng tiền`, `Trạng thái`, `Thao tác`; trạng thái nhìn thấy là `Chưa thu`/`Đã thu`.
6. Modal Nâng cao: nhập/cập nhật số người, ngày chốt, chỉ số cũ/mới, định mức/người, đơn giá điện/nước, thời gian bắt đầu và hạn kết thúc thu, có thu/không thu, ghi chú; hiển thị công thức và kết quả xem trước trước khi lưu.
7. Modal thanh toán: bấm trạng thái `Đã thu` mở modal xem ảnh chứng từ, ngày/phương thức thanh toán, người xác nhận và ghi chú; có empty/error/loading state và ảnh xem được bằng bàn phím.
8. Tests/review: kiểm tra công thức, snapshot, uniqueness, validation, quyền upload/xem chứng từ, table/modal/accessibility, consumer báo cáo, build/typecheck và diff cuối.

## Acceptance Criteria

- AC-01: Danh sách hóa đơn được nhóm theo phòng từ tab Danh sách KTX; không cần hợp đồng và mỗi `room_id + billing_month` chỉ có một bản ghi.
- AC-02: Table chỉ có bảy nhóm thông tin đã chốt: Phòng, Kỳ thu, Tiền điện, Tiền nước, Tổng tiền, Trạng thái và Thao tác.
- AC-03: Modal Nâng cao lưu đủ thông số điện/nước và server tính đúng: `quota_total = occupant_count * quota_per_person`, `actual = current - previous`, `excess = max(actual - quota_total, 0)`, `amount = excess * unit_price`, `total = electricity.amount + water.amount`.
- AC-04: Chỉ số mới nhỏ hơn chỉ số cũ, số âm, kỳ sai định dạng, hạn kết thúc trước ngày bắt đầu và hóa đơn trùng phòng/kỳ bị từ chối rõ ràng; `Không thu` cho kết quả phải thu bằng 0 nhưng vẫn giữ số liệu chốt.
- AC-05: Hóa đơn lưu snapshot Danh sách/số người; thay đổi hoặc chuyển phòng sau đó không làm đổi hóa đơn đã chốt.
- AC-06: `due_date` là hạn kết thúc thu; trạng thái nghiệp vụ hiển thị đúng `Chưa thu`/`Đã thu`; quy tắc quá hạn nội bộ không làm xuất hiện trạng thái thứ ba trên table.
- AC-07: Xác nhận đã thu có thể tải ảnh chứng từ hợp lệ; metadata/URL được lưu an toàn, file sai loại/quá dung lượng bị từ chối và quyền hiện hành được thực thi.
- AC-08: Bấm `Đã thu` mở modal đúng hóa đơn và hiển thị chứng từ cùng thông tin thanh toán; không có ảnh thì hiển thị empty state, không render link hỏng.
- AC-09: Báo cáo công nợ/doanh thu KTX tiếp tục tính đúng với cấu trúc/status mới hoặc có lớp tương thích được test; dữ liệu hóa đơn cũ không bị ghi đè ngoài ý muốn.

## Verification

- AC-01, AC-03 đến AC-07, AC-09 :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts` => focused invoice service tests pass (tạo file test nếu chưa có).
- AC-07, AC-08 :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/invoices.controller.spec.ts` => upload/controller permission and validation tests pass (tạo file test nếu chưa có).
- AC-02, AC-03, AC-06, AC-08 :: `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/page.test.tsx"` => table và modal tests pass (tạo file test nếu chưa có).
- AC-01 đến AC-09 :: `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- AC-02, AC-03, AC-06, AC-08 :: `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend types compile.
- AC-01 đến AC-09 :: `D:\PROJECT\manager_points` :: `git diff --check`, scoped diff review, `git status --short` => không có thay đổi ngoài phạm vi; giữ nguyên thay đổi người dùng tại `frontend/next-env.d.ts`.

## Safety Gates

- Human Gate bắt buộc trước migration/schema mutation trên database có dữ liệu hoặc triển khai production.
- Trước gate phải có: schema/index cuối, dry-run thống kê hóa đơn cũ, chiến lược backfill/rollback, ảnh hưởng báo cáo và kết quả test/build.
- Resume point: sau khi người dùng duyệt migration/production plan; taskscope hiện tại chỉ cho phép triển khai code development nếu được yêu cầu riêng.
- Dừng nếu cần thay đổi permission, công khai chứng từ, lưu ảnh ngoài cơ chế được duyệt hoặc thay đổi dữ liệu Danh sách KTX.

## Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Khi thực thi Full: ghi base/current commit và hash cho migration/dry-run artifact tại điểm trước Human Gate; không tạo checkpoint cho bước đọc đơn giản.

## Execution Budgets

- Step deadline: 600 giây; tối đa 1.800 giây cho build/migration dry-run.
- Concurrency: tối đa 4 agent, một writer trên mỗi path; serialize schema/API trước frontend contract.
- Retry tối đa 2; engineering loop tối đa 3; review remediation tối đa 2.
