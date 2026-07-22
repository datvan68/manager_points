# Task Identity and Pipeline

- Task: `grading-list-pagination-admin-export-scope`
- Pipeline: `feature_development`; Profile: **Full**; rules `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; development; base `main@510607f6`.
- Planning-only: tài liệu này không cho phép triển khai.

# Risk Level

- **High** vì export theo khoa/toàn hệ thống mở rộng phạm vi dữ liệu và cần authorization phía backend.
- Thay đổi có thể hoàn tác bằng Git; không migration, deploy hoặc persistent-data mutation.

# Objective

Tab `Rèn luyện > Danh sách` mặc định hiển thị 40 dòng và admin có thể xuất Excel đúng học kỳ theo lớp, khoa hoặc toàn bộ; role khác không vượt phạm vi được cấp.

# Scope Boundaries

- Approved/write: `frontend/src/app/(dashboard)/grading/**`, `frontend/src/api/summaries-point-api.ts`, `backend/src/summaries-point/**` và test tương ứng.
- Targets: `grading/page.tsx` (`pageSize`, `CustomPagination`, `exportScope`, `handleExportSummaryExcel`), `summaries-point-api.ts`, `export-summary-excel.dto.ts`, `SummariesPointService.generateSummaryExcel`, controller và specs.

# Out of Scope

- Không đổi mẫu PL03, schema/database, permission catalog, các tab Rèn luyện khác, deploy hoặc Git history.

# Context and Dependencies

- Hiện `pageSize` khởi tạo `20`, options chưa có `40`.
- UI/API/backend đã có `class | faculty | all`; backend chỉ cho admin dùng `faculty/all`. Cần giữ luồng xuất theo lớp hiện có và bổ sung/siết kiểm thử thay vì viết lại khi không cần.

# Steps

1. Chụp baseline cho pagination, payload export, validation DTO và role matrix.
2. Đổi mặc định thành 40, đưa 40 vào lựa chọn, giữ reset trang về 1 khi đổi số dòng.
3. Hoàn thiện UI admin chọn lớp/khoa/tất cả; validate học kỳ và ID bắt buộc theo scope.
4. Bảo đảm backend lọc đúng lớp/khoa/toàn hệ thống; từ chối non-admin với `faculty/all`; giữ quyền export lớp hiện hành.
5. Thêm regression tests, chạy verify và review độc lập về authorization/data scope.

# Acceptance Criteria

- **AC1:** Lần đầu mở tab trên desktop request `limit=40`, pagination chọn 40 và đổi page size vẫn về trang 1.
- **AC2:** Admin chọn được ba phạm vi; request chỉ gửi `classId`/`departmentId` khi scope yêu cầu và workbook chỉ chứa sinh viên đúng học kỳ/phạm vi.
- **AC3:** Thiếu học kỳ/lớp/khoa bị chặn rõ ràng; non-admin gọi `faculty/all` nhận `403` kể cả bỏ qua UI.
- **AC4:** Export theo lớp của role đang được phép không hồi quy; không có thay đổi ngoài boundary.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/grading/page.test.tsx"` => AC1-AC3 UI/API pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => không lỗi TypeScript mới.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand summaries-point/test/summaries-point.service.spec.ts summaries-point/test/summaries-point.controller.spec.ts` => AC2-AC4 pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest build pass.
- `D:\PROJECT\manager_points :: git diff --check` và `git status --short` => diff sạch, đúng scope.

# Safety Gates

- None. Dừng nếu cần đổi permission catalog, xử lý dữ liệu thật, migration, deploy hoặc mở rộng module.

# Artifacts and Checkpoints

- Final diff, kết quả test/typecheck/build và ma trận role × export scope; không chứa dữ liệu sinh viên thật.

# Execution Budgets

- Một writer mỗi path; tối đa 3 worker cho các phần độc lập; deadline 600 giây/step; retry `0..2`, ENG loop `0..3`, remediation `0..2`.
