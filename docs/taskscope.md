# Taskscope: Cấu hình và ghi chỉ số điện - nước KTX hàng loạt

## Task Identity and Pipeline

- Task: `dormitory-bulk-utility-meter-readings`
- Pipeline: `feature_development`
- Profile: Full; rules 3.2.0.
- Repository: `D:\PROJECT\manager_points`; current branch `main`.
- Authority: Planning only; chưa cho phép sửa chức năng, schema, migration hoặc dữ liệu.

## Risk Level

- Risk: high vì thay đổi cấu hình dùng chung, dữ liệu hóa đơn, phép tính tiền và thao tác hàng loạt.
- Environment: development. Code/test có thể revert; schema và dữ liệu đã lưu cần migration/backfill có kiểm soát.
- Blast radius: backend Dormitory Invoice, API và trang `/dormitory/invoices`.

## Objective

Tách cấu hình điện/nước khỏi thao tác lập đợt thu và cung cấp một màn hình ghi chỉ số mới cho tất cả phòng trong kỳ; khi một phòng được ghi đủ chỉ số hợp lệ, hệ thống tự mở thời gian thu của phòng đó và tính hạn kết thúc từ cấu hình.

## Scope Boundaries

- Approved/write boundaries:
  - `backend/src/dormitory/**` và focused tests tương ứng.
  - `frontend/src/api/dormitory-api.ts`.
  - `frontend/src/app/(dashboard)/dormitory/invoices/**` và component riêng dưới `frontend/src/components/dormitory/**`.
- Known targets: invoice schema/DTO/controller/service; invoice page/API/tests; trang mới `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.tsx` và focused test; schema/config mới thuộc module Dormitory nếu cần.
- Giữ nguyên các permission invoice hiện hành; không mở endpoint công khai.

## Out of Scope

- Đổi nguồn danh sách phòng khỏi tab `Danh sách KTX`, thu tiền phòng, import PDF/Excel, thông báo tự động, cổng thanh toán, deploy hoặc migration production.
- Sửa luồng xem chứng từ và các cột table đã chốt, ngoài việc nối lại thao tác với luồng ghi chỉ số mới.
- Tự động tạo hóa đơn cho phòng không có người ở, trừ khi yêu cầu nghiệp vụ được bổ sung sau.

## Context and Dependencies

- Trang hiện có nút `Lập đợt thu`, modal Nâng cao chứa cả phòng/kỳ, chỉ số, định mức, đơn giá và ngày thu; backend có `POST /dormitory/invoices/monthly`, `PATCH /:id/monthly`, `GET /room-info/:roomId`.
- Invoice đã lưu `electricity`, `water`, `reading_date`, `payment_start_date`, `due_date`, snapshot người ở và unique phòng/kỳ.
- Cần cấu hình dùng chung gồm hai nhóm `Thông số điện` và `Thông số nước`: định mức/người, đơn giá, đơn vị; cùng số ngày thu để tự tính hạn kết thúc. Cấu hình áp dụng cho kỳ mới và được snapshot vào từng hóa đơn, không hồi tố hóa đơn đã lập.
- Diễn giải yêu cầu: một phòng chỉ được coi là “ghi xong” khi cả `Số điện mới` và `Số nước mới` hợp lệ và được lưu thành công. Khi đó, `payment_start_date = saved_at`; `due_date = payment_start_date + configured_collection_days` theo múi giờ ứng dụng. Nếu nghiệp vụ muốn mở thu ngay khi chỉ có số điện, phải xác nhận lại trước triển khai vì chưa thể tính đủ tổng tiền.
- Chỉ số cũ lấy từ chỉ số mới gần nhất của phòng; không cho client thay đổi trong màn hình ghi hàng loạt. Danh sách phòng lấy từ roster hiện hành, khử trùng theo `room_id`.

## Steps

1. Baseline: khóa hành vi hiện tại bằng focused tests; kiểm tra consumer báo cáo và index phòng/kỳ.
2. Backend config: tạo model/API đọc-cập nhật cấu hình điện, nước và `configured_collection_days`; validate số không âm, đơn giá/định mức và số ngày thu hợp lệ; lưu người/thời điểm cập nhật.
3. Backend bulk-read API: trả danh sách phòng roster theo kỳ cùng số người, chỉ số cũ, trạng thái đã/chưa ghi; nhận các dòng `{room_id, electricity.current_reading, water.current_reading}` và xử lý mỗi phòng idempotent theo `room_id + billing_month`.
4. Khi lưu một dòng hợp lệ, server snapshot roster và cấu hình, tính consumption/quota/amount/total, đặt `reading_date` và `payment_start_date` theo thời điểm server, tự tính `due_date`; từ chối chỉ số giảm, thiếu, trùng không nhất quán hoặc sửa hóa đơn đã thu.
5. Frontend toolbar: thay nút chữ `Lập đợt thu` bằng icon Nâng cao có accessible name/tooltip; icon mở modal cấu hình chỉ gồm nhóm Thông số điện, Thông số nước và thời hạn thu tự động.
6. Thêm nút `Ghi điện nước` điều hướng sang trang riêng `/dormitory/invoices/meter-readings`; không mở modal. Trang có chọn kỳ, tìm/lọc phòng, tiến độ đã ghi/tổng phòng và danh sách tất cả phòng có người ở.
7. Mỗi phòng hiển thị thành một thẻ đứng (một card trên một hàng) gồm thông tin phòng, số người, trạng thái đã/chưa ghi, chỉ số điện/nước cũ, hai field `Số điện mới` và `Số nước mới`, lỗi tại card và thao tác lưu. Bố cục responsive nhưng không chuyển thành bảng ngang.
8. Cho phép lưu từng card hoặc lưu các card hợp lệ; sau khi lưu, đồng bộ card và table hóa đơn. Retry không tạo hóa đơn trùng, lỗi một phòng không làm mất dữ liệu hợp lệ của phòng khác; cảnh báo khi rời trang nếu còn thay đổi chưa lưu.
9. Tests/review: kiểm tra điều hướng, card layout, config snapshot, thời gian server, hạn thu, timezone, idempotency/partial failure, quyền, accessibility, báo cáo và diff cuối.

## Acceptance Criteria

- AC-01: Không còn nút chữ `Lập đợt thu`; có icon Nâng cao với tooltip/accessible name và modal tách riêng cấu hình điện, nước, số ngày thu.
- AC-02: Nút `Ghi điện nước` điều hướng tới `/dormitory/invoices/meter-readings`; trang hiển thị toàn bộ phòng có người ở từ tab Danh sách cho kỳ chọn dưới dạng các thẻ đứng, không phải modal hoặc table.
- AC-02a: Mỗi thẻ phòng hiển thị thông tin cơ bản, chỉ số cũ, trạng thái và đúng hai field nhập `Số điện mới`, `Số nước mới`; lỗi/lưu được phản hồi ngay trên đúng thẻ.
- AC-03: Chỉ số cũ tự lấy từ kỳ gần nhất; số mới thiếu, âm hoặc nhỏ hơn số cũ bị từ chối rõ tại đúng dòng.
- AC-04: Lưu đủ hai chỉ số của phòng tạo/cập nhật duy nhất một invoice cho `room_id + billing_month`, snapshot người ở và cấu hình rồi tính tiền ở server.
- AC-05: `payment_start_date` bằng thời điểm server ghi thành công phòng; `due_date` tự bằng thời điểm bắt đầu cộng số ngày cấu hình, không nhập tay trong luồng ghi chỉ số.
- AC-06: Lưu hàng loạt trả kết quả theo từng phòng; dòng thành công được giữ, dòng lỗi sửa và gửi lại được, retry không nhân bản hóa đơn.
- AC-07: Hóa đơn đã thu không bị sửa chỉ số; permission hiện hành áp dụng cho đọc/sửa cấu hình và ghi chỉ số theo ánh xạ được kiểm thử.
- AC-08: Table, trạng thái thu, modal chứng từ và báo cáo hiện hữu tiếp tục hoạt động với hóa đơn từ luồng mới.

## Verification

- AC-03 đến AC-08 :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts` => calculation, dates, idempotency and partial-result tests pass.
- AC-01, AC-02 :: `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/page.test.tsx"` => toolbar and navigation behaviors pass.
- AC-02, AC-02a, AC-05, AC-06, AC-08 :: `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx"` => vertical room cards, input, save and partial-error behaviors pass.
- AC-01 đến AC-08 :: backend :: `npm run build`; frontend :: `npm run typecheck` => compile successfully.
- Final :: repository root :: `git diff --check`, scoped diff review, `git status --short` => no unintended change; preserve user-owned changes.

## Safety Gates

- Human Gate trước schema/index migration hoặc mutation database có dữ liệu và trước deploy production.
- Gate artifact: schema/config cuối, dry-run thống kê invoice/config cần backfill, rollback, ảnh hưởng báo cáo, test/build result.
- Resume: sau khi duyệt migration/production plan. Dừng nếu cần đổi permission, hồi tố giá hóa đơn cũ hoặc thay nguồn roster.

## Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Khi thực thi Full: ghi base/current commit và hash migration/dry-run trước Human Gate; không checkpoint bước đọc đơn giản.

## Execution Budgets

- Step deadline 600 giây, tối đa 1.800 giây cho build/dry-run; retry 2; engineering loop 3; review remediation 2.
- Tối đa 4 agents, một writer/path; serialize backend contract trước frontend integration.
