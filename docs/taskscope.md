# Taskscope: Xem thành viên theo phòng trên trang Overview KTX

## Task Identity and Pipeline

- Task: `dormitory-overview-room-members-detail`
- Pipeline: `feature_development`
- Profile: Full
- Rules: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Branch/base: `main` at `474df00f`
- Authority: Planning only. Taskscope này không cho phép triển khai.

## Risk Level

- Risk: high vì thay đổi contract dữ liệu giữa backend/frontend và hiển thị thông tin cá nhân của sinh viên.
- Environment: development.
- Reversibility: thay đổi code/test, không migration hay ghi dữ liệu.
- Blast radius: endpoint dashboard KTX và bảng `Tình trạng phòng`.

## Objective

Trong bảng `Tình trạng phòng`, mỗi phòng có cột `Thành viên` với nút `Chi tiết`; bấm nút mở modal nhỏ liệt kê đúng Họ tên và Lớp của các thành viên hiện thuộc phòng đó.

## Scope Boundaries

- Approved/write boundaries:
  - `backend/src/dormitory/services/dormitory-reports.service.ts`
  - `backend/src/dormitory/services/dormitory-reports.service.spec.ts`
  - `frontend/src/api/dormitory-api.ts`
  - `frontend/src/app/(dashboard)/dormitory/overview/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx`
- Giữ nguyên route `GET /dormitory/reports/dashboard`, quyền truy cập hiện tại và các field response hiện có.

## Out of Scope

- Chỉnh sửa/xóa thành viên, chuyển phòng, xem hồ sơ sinh viên, thêm mã sinh viên hoặc thông tin cá nhân khác.
- Thay đổi logic số giường, trạng thái phòng, tìm kiếm phòng, công nợ, đăng ký hoặc schema/database.
- Tạo endpoint mới hay gọi API riêng cho từng phòng.

## Context and Dependencies

- `DormitoryOverviewPage` đang render `data.room_rows`; `DormitoryRoomRow` chưa có danh sách thành viên.
- `DormitoryReportsService.getDashboardStats()` đã tải roster và phòng nhưng roster query chưa populate `student_id.class_id`.
- Thành viên được xác định từ roster đang được xếp vào phòng theo nguồn phân phòng hiện hành (`room_id` hoặc hợp đồng hiệu lực mà dashboard đã dùng để xác định `assigned`). Chỉ trả DTO tối thiểu `{ full_name, class_name }`.
- Họ tên ưu tiên hồ sơ sinh viên đã liên kết, fallback `roster.full_name`; lớp fallback `Chưa cập nhật` khi không có lớp.
- Modal dùng dialog accessible hiện có của frontend, có tiêu đề nhận diện phòng, nút đóng và hỗ trợ đóng bằng Escape/overlay.

## Steps

1. Backend: populate tối thiểu họ tên và lớp; lập ánh xạ hợp đồng hiệu lực/roster sang phòng; thêm `members` vào từng `room_rows` mà không làm thay đổi các phép tính hiện tại.
2. Backend test: kiểm tra thành viên đúng phòng, fallback tên/lớp, phòng trống và không rò rỉ field ngoài DTO.
3. Frontend API: khai báo type thành viên và `members` trên `DormitoryRoomRow`.
4. Frontend UI: thêm header/cell `Thành viên`; nút `Chi tiết` mở modal nhỏ hiển thị Họ tên, Lớp và empty state; cập nhật `colSpan` của bảng rỗng.
5. Frontend test: kiểm tra mở/đóng modal, đúng phòng/danh sách, lớp fallback, phòng không có thành viên và accessibility.
6. Chạy kiểm thử tập trung, typecheck/build cần thiết và rà soát diff/status.

## Acceptance Criteria

- AC-01: Bảng `Tình trạng phòng` có cột `Thành viên`; mỗi dòng có control tên truy cập được dạng `Xem thành viên phòng <mã phòng>` và nhãn nhìn thấy là `Chi tiết`.
- AC-02: Bấm `Chi tiết` chỉ mở một modal nhỏ cho phòng đã chọn, hiển thị đúng hai cột `Họ tên` và `Lớp` cho toàn bộ thành viên của phòng.
- AC-03: Phòng không có thành viên hiển thị empty state rõ ràng; dữ liệu thiếu lớp hiển thị `Chưa cập nhật`; modal đóng được bằng nút đóng và Escape.
- AC-04: Dashboard response chỉ bổ sung `members: Array<{ full_name: string; class_name: string }>` vào room row; không trả thêm dữ liệu cá nhân và không phát sinh request theo từng phòng.
- AC-05: Logic thống kê, sắp xếp/tìm kiếm phòng, công nợ và các trạng thái lỗi/partial hiện có vẫn pass.

## Verification

- AC-02, AC-04, AC-05 :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/dormitory-reports.service.spec.ts` => focused report tests pass.
- AC-01, AC-02, AC-03, AC-05 :: `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/overview/page.test.tsx"` => focused Overview tests pass.
- AC-04, AC-05 :: `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend types compile.
- AC-04, AC-05 :: `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- AC-01 through AC-05 :: `D:\PROJECT\manager_points` :: `git diff --check`, scoped diff review, `git status --short` => no unintended changes.

## Safety Gates

- Gate: None. Yêu cầu hiện tại đã cho phép rõ việc hiển thị Họ tên và Lớp trong phạm vi trang Overview có quyền bảo vệ sẵn.
- Dừng để xin duyệt nếu cần hiển thị thêm dữ liệu cá nhân, thay đổi quyền, tạo endpoint công khai, migration hoặc sửa dữ liệu lưu trữ.
- Rollback: revert năm file code/test trong phạm vi; không cần rollback dữ liệu.

## Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Checkpoints/hashes: none trong giai đoạn planning.

## Execution Budgets

- Step deadline: 600 giây, tối đa 1.800 giây cho build.
- Concurrency: một writer trên mỗi path; serialize thay đổi contract backend/frontend.
- Retry: tối đa 2; engineering loop: tối đa 3; review remediation: tối đa 2.
