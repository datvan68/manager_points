# Taskscope: Điều chỉnh trang ghi chỉ số điện - nước KTX

## Task Identity and Pipeline

- Task: `dormitory-all-room-meter-readings`
- Pipeline: `feature_development`
- Profile: Full; rules 3.2.0.
- Repository: `D:\PROJECT\manager_points`; current branch `main`.
- Authority: Planning only; chưa cho phép sửa chức năng, schema, migration hoặc dữ liệu.

## Risk Level

- Risk: high vì thay đổi nguồn phòng của luồng tạo/cập nhật hóa đơn và có thể phát sinh hóa đơn cho phòng không có người ở.
- Blast radius: API ghi chỉ số Dormitory Invoice và trang `/dormitory/invoices/meter-readings`.
- Không dự kiến thay đổi schema; nếu triển khai phát hiện cần migration hoặc mutation dữ liệu đã lưu thì phải dừng tại Human Gate.

## Objective

Trang `Ghi chỉ số điện nước` hiển thị đầy đủ mọi phòng đang tồn tại trong collection phòng của database, không phụ thuộc roster/người ở; giao diện không còn thanh tìm kiếm, bộ lọc trạng thái và khối thông tin `Cấu hình áp dụng`.

## Scope Boundaries

- Backend: `backend/src/dormitory/services/invoices.service.ts` và focused tests liên quan đến `getMeterReadings`/`saveBulkMeterReadings`.
- Frontend: `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.tsx` và focused test của trang.
- API contract chỉ thay đổi nguồn/tập phòng trả về; giữ cấu trúc card, kỳ thu, tiến độ, lưu từng phòng/lưu tất cả và phản hồi lỗi hiện hành.
- Giữ nguyên cấu hình điện, nước và số ngày thu ở backend để tính hóa đơn. Yêu cầu “bỏ cấu hình áp dụng” được hiểu là bỏ khối hiển thị có nhãn `Cấu hình áp dụng` trên trang ghi chỉ số, không xóa cấu hình hay công thức tính.

## Out of Scope

- Xóa modal/icon Nâng cao hoặc API cấu hình điện, nước và hạn thu.
- Bỏ tìm kiếm/bộ lọc trên table hóa đơn chính `/dormitory/invoices`; yêu cầu này chỉ áp dụng cho trang ghi chỉ số.
- Thay đổi công thức tiền, trạng thái thu, modal chứng từ, permission, báo cáo, deploy hoặc migration production.
- Xóa phòng, tự đổi trạng thái phòng hoặc tự thêm người ở.

## Current Evidence

- Frontend hiện có state `search`, `filterStatus`, `filteredRooms`, thanh tìm kiếm, select trạng thái và khối `Cấu hình áp dụng` trong `meter-readings/page.tsx`.
- Backend `getMeterReadings` hiện truy vấn roster có `room_id`, nhóm roster theo phòng rồi chỉ trả các phòng xuất hiện trong roster; vì vậy phòng trống không được hiển thị.
- `saveBulkMeterReadings` đã đọc roster theo từng `room_id`; với phòng trống có thể giữ `occupant_count = 0` và `roster_entry_ids = []`, nhưng phải bổ sung test để xác nhận phép tính và lưu hóa đơn hợp lệ.

## Implementation Steps

1. Baseline focused tests cho danh sách hiện tại, card phòng và lưu chỉ số; ghi nhận hành vi phòng trống trước khi sửa.
2. Đổi `getMeterReadings` sang lấy toàn bộ phòng trực tiếp từ room collection, populate thông tin tòa nhà cần cho card và sắp xếp ổn định theo mã/tên phòng.
3. Tải roster theo tập `room_id` chỉ để bổ sung `occupant_count` và `roster_entry_ids`; phòng không có roster vẫn phải xuất hiện với `occupant_count = 0`, danh sách người ở rỗng và trạng thái ghi theo invoice của kỳ.
4. Giữ cách lấy chỉ số kỳ trước theo từng phòng và invoice hiện tại; tránh truy vấn tuần tự N+1 bằng truy vấn theo tập phòng/kỳ nếu thay đổi này nằm trong cùng service.
5. Xác nhận `saveBulkMeterReadings` chấp nhận phòng thực sự tồn tại nhưng không có người ở, snapshot `occupant_count = 0`, `roster_entry_ids = []`, tính tiền theo cấu hình hiện hành và vẫn chặn `room_id` không tồn tại.
6. Xóa khỏi trang ghi chỉ số: import/icon Search, state tìm kiếm, state lọc, `filteredRooms`, input search, select filter và toàn bộ khối hiển thị `Cấu hình áp dụng`. Render card trực tiếp từ `rooms`.
7. Giữ phần tiến độ `đã ghi/tổng phòng`; tổng phải tính trên toàn bộ phòng database. Giữ tải cấu hình nội bộ nếu còn cần cho preview, nhưng không render thông tin cấu hình trên giao diện.
8. Cập nhật focused tests cho phòng có người, phòng trống, không có phòng, trạng thái đã/chưa ghi, tổng tiến độ, lưu phòng trống và xác nhận các control/nhãn đã bỏ không còn trong DOM.
9. Chạy focused tests, typecheck/build phù hợp, review scoped diff và trạng thái Git; không sửa lỗi ngoài phạm vi.

## Acceptance Criteria

- AC-01: API danh sách ghi chỉ số trả đúng một item cho mọi phòng tồn tại trong room collection, kể cả phòng trống hoặc không có roster; không tạo item từ roster có tham chiếu phòng đã mất.
- AC-02: Phòng không có người ở hiển thị card bình thường với số người bằng `0`, vẫn có hai field `Số điện mới` và `Số nước mới`, chỉ số cũ/trạng thái theo dữ liệu invoice thực tế.
- AC-03: Danh sách được sắp xếp ổn định theo mã/tên phòng và không trùng phòng khi có nhiều roster entry.
- AC-04: Trang không còn input tìm kiếm, bộ lọc `Tất cả/Chưa ghi/Đã ghi`, state/filter logic tương ứng hoặc empty state do bộ lọc.
- AC-05: Trang không còn khối/nhãn `Cấu hình áp dụng` và thông tin định mức, đơn giá, hạn thu trong khối đó; cấu hình vẫn được dùng nội bộ để preview và tính toán.
- AC-06: Tiến độ `đã ghi/tổng phòng`, lưu từng card, lưu tất cả card hợp lệ, cảnh báo thay đổi chưa lưu và lỗi theo card tiếp tục hoạt động trên tập toàn bộ phòng.
- AC-07: Lưu đủ hai chỉ số cho phòng trống tạo/cập nhật duy nhất một invoice cho `room_id + billing_month`, với `occupant_count = 0`, roster snapshot rỗng; chỉ số giảm, hóa đơn đã thu và phòng không tồn tại vẫn bị từ chối.
- AC-08: Công thức điện/nước, thời điểm bắt đầu thu, hạn kết thúc, permission và table hóa đơn chính không thay đổi ngoài việc có thể nhận hóa đơn của phòng trống.

## Verification

- Backend :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts` => danh sách toàn bộ phòng, phòng trống, previous reading, idempotency và validation đều pass.
- Frontend :: `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx"` => render toàn bộ card, không có search/filter/config block, tiến độ và lưu card đều pass.
- Static :: backend `npm run build`; frontend `npm run typecheck` => compile thành công.
- Final :: repository root :: `git diff --check`, scoped diff review, `git status --short` => không có thay đổi ngoài phạm vi và giữ nguyên user-owned changes.

## Safety Gates

- Human Gate nếu cần schema/index migration, backfill/mutation dữ liệu hiện có hoặc deploy production.
- Dừng và xin xác nhận nếu “bỏ cấu hình áp dụng” thực tế có nghĩa là xóa cấu hình/công thức tính thay vì chỉ ẩn khối thông tin trên trang.
- Dừng nếu việc lập hóa đơn phòng trống cần quy tắc tính khác với `occupant_count = 0` hoặc cần loại trừ trạng thái phòng cụ thể như bảo trì/khóa.

## Artifacts and Budgets

- Planning artifact: `docs/taskscope.md`.
- Step deadline 600 giây; build tối đa 1.800 giây; retry 2; engineering loop 3; review remediation 2.
- Một writer/path; serialize backend contract trước frontend integration.
