# Task Identity and Pipeline

- Task: `simplify-student-profile-records-stats-and-ktx`; pipeline: `feature_development`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `2d7e12c2724046b833d1efd24224d1ca951ed31e`; environment: development.
- Planning-only: tài liệu này không cho phép triển khai mã nguồn.

# Risk Level

- Risk: medium. Thay đổi frontend và dữ liệu đọc hồ sơ sinh viên; có thể hoàn tác bằng Git; không migration, ghi dữ liệu, triển khai hay đổi quyền.
- Profile Full do phạm vi đi qua mô-đun Students, Dormitory và frontend.

# Objective

Trang hồ sơ sinh viên chỉ có mục `Ghi nhận` hiển thị toàn bộ ghi nhận; thống kê nhanh chỉ còn điểm `Rèn luyện` và số lần `Vi phạm`; nếu sinh viên có đăng ký KTX đã liên kết thì hiển thị thêm dòng `KTX: Đã đăng ký`.

# Scope Boundaries

- Approved/write:
  - `backend/src/students/students.module.ts`
  - `backend/src/students/students.service.ts`
  - `backend/src/students/test/students.service.spec.ts`
  - `frontend/src/api/student-api.ts`
  - `frontend/src/app/(dashboard)/students/[classId]/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/students/[classId]/[id]/page.test.tsx` (new)
- Backend chỉ trả cờ tồn tại đăng ký KTX chính thức liên kết đúng `student_id`, qua API hồ sơ và quyền truy cập hiện hữu.

# Out of Scope

- Không đổi schema/database, quy trình đăng ký KTX, trang hồ sơ chung `/profile`, API ghi nhận, cách tính điểm rèn luyện hoặc giao diện các trang khác.

# Context and Dependencies

- Hồ sơ hiện tải categories/criteria và chỉ tải records khi chọn tab lịch sử.
- `DormRegistration` đã liên kết sinh viên bằng `student_id`; `StudentDormitorySection` hiện chỉ dùng API `getMine`, không phù hợp hồ sơ người khác.
- Vi phạm được nhận diện bởi `criterion_type === 'ky_luat'`.

# Steps

1. Bổ sung tra cứu tồn tại đăng ký KTX vào kết quả hồ sơ sinh viên, không trả dữ liệu cá nhân KTX dư thừa; thêm unit test có/không đăng ký.
2. Mở rộng kiểu `Student` với cờ KTX; bỏ tải category/criteria, trạng thái tab và khối Danh mục.
3. Tải toàn bộ ghi nhận cùng hồ sơ, hiển thị một tiêu đề `Ghi nhận`, giữ loading/empty/error phù hợp.
4. Đổi lưới thống kê còn hai thẻ: Rèn luyện dùng điểm hiện hành; Vi phạm dùng số bản ghi vi phạm, không dùng tổng điểm trừ.
5. Thêm dòng KTX có điều kiện và regression test cho ba yêu cầu; tự rà diff.

# Acceptance Criteria

- AC1: Không còn `Danh mục`/`Lịch sử ghi nhận`; `Ghi nhận` hiển thị mọi record trả về và empty state khi rỗng.
- AC2: Chỉ có hai thống kê; Rèn luyện hiển thị điểm, Vi phạm hiển thị đúng số lần.
- AC3: Dòng `KTX: Đã đăng ký` chỉ xuất hiện khi backend xác nhận có đăng ký chính thức liên kết sinh viên.
- AC4: Quyền xem hồ sơ và hành vi ngoài phạm vi không đổi; các kiểm tra tập trung đều đạt.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/students/test/students.service.spec.ts` => unit test Students đạt.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/students/[classId]/[id]/page.test.tsx"` => AC1–AC3 đạt.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => không có lỗi TypeScript do thay đổi.
- Repository root :: `git diff --check` và `git status --short` => diff sạch, không có thay đổi ngoài scope.

# Safety Gates

- Gate: None. Dừng và xin mở rộng scope nếu cần migration, đổi quyền, ghi dữ liệu hoặc sửa ngoài boundary.

# Artifacts and Checkpoints

- `docs/taskscope.md`; không checkpoint/hash riêng.

# Execution Budgets

- Một writer cho mỗi path; tối đa 3 vòng sửa/kiểm tra, 2 lần retry công cụ, 2 vòng remediation; dừng khi kiểm tra bắt buộc thất bại ngoài scope.
