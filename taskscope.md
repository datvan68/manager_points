# Taskscope: Ổn định trang /permissions và bổ sung GVCN lớp cho user

## Mục tiêu

Khắc phục 4 vấn đề trên màn hình `/permissions` và hồ sơ user:

- Trang `/permissions` bị nháy/reset khi tải lại dữ liệu.
- Modal **Thêm người dùng > Thêm nhiều người dùng** báo thành công nhưng người dùng chưa kịp xem/kiểm tra kết quả.
- Thêm/sửa thông tin người dùng cần có select **GVCN lớp**, cho phép gán 1 user làm GVCN của 2 lớp trở lên.
- Tab **Thông tin cá nhân** của user đổi trường **Khoa / Phòng ban** thành **GVCN lớp** và hiển thị danh sách lớp user đang chủ nhiệm.

## Hiện trạng đã kiểm tra

- Trang chính: `frontend/src/app/permissions/page.tsx`.
- Modal user: `frontend/src/components/modals/UserModal.tsx`.
- API frontend user: `frontend/src/api/auth-api.ts`.
- API frontend lớp: `frontend/src/api/class-api.ts`.
- Backend bulk create user: `backend/src/auth/services/auth.service.ts`.
- DTO user: `backend/src/auth/dto/auth.dto.ts`.
- Schema lớp có field `advisor_id`: `backend/src/classes/schemas/class.schema.ts`.
- Trang profile hiện tại vẫn dùng field `department` trong `frontend/src/app/profile/page.tsx` và `frontend/src/app/profile/_lib/normalize-profile.ts`.

Một phần GVCN lớp đã tồn tại trong code hiện tại:

- `permissions/page.tsx` đã có state `classes`, gọi `classApi.getClasses()` và truyền `classes` vào `UserModal`.
- `UserModal.tsx` đã có `advisorClassId` trong bulk row và gửi `advisor_class_id`.
- Backend DTO đã có `advisor_class_id`.
- `AuthService.createUsersBulk` đã cập nhật `class.advisor_id` nếu có `advisor_class_id`.

Nhưng các điểm trên chưa đáp ứng hết yêu cầu mới:

- Trong bulk modal, header hiện đang theo thứ tự `Vai trò`, `Trạng thái`, `GVCN lớp`; yêu cầu là **GVCN lớp nằm bên trái Trạng thái**.
- Bulk modal đang chọn 1 lớp cho mỗi dòng, nhưng yêu cầu thêm/sửa user cần cho phép **2 lớp trở lên**.
- Single add/edit user chưa có select **GVCN lớp**.
- Profile vẫn hiển thị và lưu `department`, chưa hiển thị danh sách lớp GVCN.
- Sau bulk create, `handleBulkUserSave` gọi `fetchData()`, có thể làm bảng/loading nháy lại trong khi modal kết quả đang hiển thị.
- `fetchData` của `/permissions` phụ thuộc `[isAuthLoading, authUser]`; nếu object `authUser` thay đổi sau refresh/checkAuth, trang có thể fetch lại, bật `isDataLoading` và làm UI nháy/reset.

## Phạm vi thay đổi

### 1. Ổn định trang `/permissions`, tránh nháy/reset

File: `frontend/src/app/permissions/page.tsx`

- Tách trạng thái loading lần đầu và refresh nền:
  - `isInitialLoading`: chỉ dùng cho lần load đầu.
  - `isRefreshing`: dùng khi reload dữ liệu sau thao tác thêm/sửa/xóa.
- Không để refresh nền thay toàn bộ bảng bằng skeleton nếu đã có dữ liệu cũ; nên giữ dữ liệu cũ và chỉ hiển thị indicator nhỏ.
- Đổi effect load dữ liệu để tránh fetch lại do reference `authUser` thay đổi:
  - Có thể dùng dependency ổn định như `isAuthLoading` và `authUser?.id`.
  - Hoặc dùng `useCallback` cho `fetchData` với dependency tối thiểu.
- Khi `fetchData` chạy, không reset các state UI không cần thiết:
  - `activeTab`
  - `userCurrentPage`
  - `selectedUserIds`
  - `selectedGroup`
  - filter/search hiện tại
- Sau CRUD, reload dữ liệu theo cách nền, không làm route/page quay về trang đầu nếu không cần.

Acceptance:

- Đang ở `/permissions`, chuyển trang user page 2/3 hoặc chọn tab khác không bị tự động reset khi auth refresh hoặc reload data.
- Khi thêm/sửa/xóa user, bảng cập nhật dữ liệu nhưng trang không nhảy về skeleton toàn màn hình.

### 2. Giữ modal kết quả bulk create để user xem

File: `frontend/src/components/modals/UserModal.tsx`

- Sau khi bulk create thành công, modal phải giữ màn hình **Kết quả thêm nhiều người dùng** cho đến khi user bấm **Đóng**.
- Nút đóng overlay và phím/hành động đóng nên bị chặn trong lúc đang lưu để tránh đóng modal ngoài ý muốn.
- Không gọi `onClose()` tự động sau bulk success.
- Nếu parent reload data, không được làm `UserModal` reset `bulkResult`.
- Nên tách `onBulkSave` thành 2 việc:
  - Submit bulk và trả kết quả ngay cho modal hiển thị.
  - Parent refresh danh sách user ở nền sau khi modal đã có `bulkResult`.

File: `frontend/src/app/permissions/page.tsx`

- `handleBulkUserSave` nên trả kết quả API về modal trước, sau đó refresh data không chặn UI.
- Nếu cần dùng `fetchData`, truyền option để refresh nền và không bật loading skeleton lớn.

Acceptance:

- Sau bulk create thành công/thành công một phần, modal không tự động tắt.
- User xem được tổng số, thành công, thất bại, danh sách lỗi.
- Nút **Sửa các dòng lỗi** giữ lại dữ liệu dòng lỗi, bao gồm các lớp GVCN đã chọn.

### 3. Thêm/sửa user có select `GVCN lớp`, hỗ trợ nhiều lớp

File: `frontend/src/components/modals/UserModal.tsx`

- Single mode thêm/sửa user cần thêm field **GVCN lớp** trong phần cấu hình.
- Field này là multi-select hoặc combobox multi-select, không phải select 1 giá trị.
- Mỗi user có thể chọn 0, 1 hoặc nhiều lớp.
- Nếu role không phải Teacher/Giảng viên/GVCN:
  - Disable field GVCN lớp hoặc clear giá trị và hiển thị nhắc nhở ngắn.
- Khi edit user:
  - Cần map các lớp đang có `advisor_id` là user hiện tại thành giá trị mặc định.
  - Việc submit phải gửi danh sách class ids.
- Bulk mode:
  - Chuyển field `advisorClassId` thành `advisorClassIds: string[]` nếu yêu cầu bulk cũng cần gán nhiều lớp cho từng user.
  - Đặt cột **GVCN lớp** đúng vị trí: sau **Vai trò**, trước **Trạng thái**.
  - UI cần có min-width/overflow-x-auto để không vỡ layout khi thêm cột multi-select.

File: `frontend/src/app/permissions/page.tsx`

- Khi mở edit modal, cần truyền dữ liệu lớp hiện tại của user:
  - Dùng danh sách `classes` đã load.
  - Lọc lớp có `advisor_id` trùng `_id` user.
  - Truyền vào `initialData.advisor_class_ids` hoặc prop riêng.

Acceptance:

- Thêm 1 user có thể chọn nhiều lớp GVCN.
- Sửa user có thể xem, thêm, bỏ bớt nhiều lớp GVCN.
- Bulk modal hiển thị cột **GVCN lớp** bên trái **Trạng thái**.
- Chọn 2 lớp trở lên cho cùng một user không bị mất giá trị khi submit.

### 4. Backend hỗ trợ gán/bỏ gán nhiều lớp GVCN

File: `backend/src/auth/dto/auth.dto.ts`

- Bổ sung DTO cho single create/update user:
  - `advisor_class_ids?: string[]`
- Bulk DTO cần hỗ trợ:
  - `advisor_class_ids?: string[]`
- Có thể giữ `advisor_class_id` tạm thời để backward compatible, nhưng service nên normalize về mảng ids.

File: `backend/src/auth/services/auth.service.ts`

- Single create/update user:
  - Sau khi lưu user, đồng bộ các lớp GVCN theo danh sách `advisor_class_ids`.
  - Lớp được chọn thì set `advisor_id = user._id`.
  - Lớp đang do user làm GVCN nhưng không còn trong danh sách thì unset `advisor_id`.
- Bulk create:
  - Hỗ trợ gán nhiều lớp cho mỗi user.
  - Nếu một lớp đã có GVCN khác, không tự ghi đè; trả lỗi rõ `Lớp đã có GVCN`.
  - Nếu tạo user thành công nhưng gán lớp lỗi, cần rollback user hoặc xử lý theo transaction để tránh tạo user lỗi nửa chừng.
- Nên dùng transaction MongoDB nếu dự án đang chạy replica set; nếu không, cần có cleanup rõ ràng khi gán lớp thất bại.
- Kiểm tra role user phải là Teacher/Giảng viên/GVCN trước khi cho gán lớp.

Acceptance:

- API create/update user nhận danh sách lớp GVCN và đồng bộ đúng `classes.advisor_id`.
- Một user có thể làm GVCN nhiều lớp.
- Một lớp không bị ghi đè GVCN hiện có nếu chưa có xác nhận.
- Bulk create trả về lỗi theo từng dòng, không làm hỏng các dòng hợp lệ.

### 5. Profile đổi `Khoa / Phòng ban` thành `GVCN lớp`

File: `frontend/src/app/profile/page.tsx`

- Đổi label **Khoa / Phòng ban** thành **GVCN lớp**.
- Không dùng select hard-code danh sách khoa.
- Hiển thị danh sách lớp mà user đang làm GVCN:
  - Lấy từ API profile nếu backend trả về.
  - Hoặc gọi `classApi.getClasses()` và lọc `advisor_id` trùng user hiện tại.
- Nếu user không phải Teacher/GVCN:
  - Hiển thị `Không phụ trách lớp nào` hoặc ẩn field tùy thiết kế.
- Nếu cho phép sửa profile:
  - Không nên để user tự gán lớp GVCN trong trang profile nếu đây là quyền admin.
  - Việc gán GVCN nên thực hiện ở `/permissions` hoặc màn hình quản lý lớp.

File: `frontend/src/app/profile/_lib/normalize-profile.ts`

- Bổ sung field normalized:
  - `advisor_classes?: Class[]`
  - hoặc `advisor_class_names?: string[]`
- Giảm phụ thuộc vào `department` cho phần hiển thị profile.

Backend nếu cần:

- `GET /auth/me` nên trả thêm danh sách lớp GVCN của user:
  - `_id`
  - `class_name`
  - `class_year`
  - `dept_id.name`
- `UpdateMeDto` không nên tiếp tục cập nhật `department` nếu trường này không còn dùng trong UI.

Acceptance:

- Profile hiển thị **GVCN lớp** thay cho **Khoa / Phòng ban**.
- Teacher/GVCN thấy được 1 hoặc nhiều lớp đang chủ nhiệm.
- User không phụ trách lớp nào thấy thông báo rỗng rõ ràng.
- Không còn danh sách khoa hard-code trong profile cho field này.

## Test cần chạy

Frontend:

```bash
npm test -- --runInBand
```

Backend:

```bash
npm test -- --runInBand --testPathPatterns=auth.service.spec.ts
```

Kiểm thử thủ công:

- Vào `/permissions`, chuyển sang page khác trong bảng user, thực hiện refresh data và xác nhận không reset trang.
- Thêm nhiều user, xác nhận modal kết quả không tự động đóng.
- Tạo/sửa một Teacher và gán 2 lớp trở lên.
- Kiểm tra API `/classes` để xác nhận các lớp có `advisor_id` đúng user.
- Mở `/profile` bằng tài khoản Teacher/GVCN và xác nhận field **GVCN lớp** hiển thị danh sách lớp đúng.

## Lưu ý rủi ro

- Nếu current code đã có một phần `advisor_class_id`, cần refactor cẩn thận để không phá luồng bulk create hiện tại.
- Multi-select lớp cần tránh gửi string rỗng; nên gửi mảng ids hợp lệ.
- Cần tránh fetch waterfall trên `/permissions`; các API độc lập nên gọi song song bằng `Promise.all`.
- Không nên ghi đè GVCN lớp đã có sẵn nếu chưa có UI xác nhận.
