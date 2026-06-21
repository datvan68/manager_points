# Taskscope: Sửa modal "Sửa thông tin người dùng" không cập nhật được GVCN lớp

## 1. Mục tiêu

Khắc phục lỗi ở trang `/permissions`, tab `Người dùng`: trong modal `Sửa thông tin người dùng`, mục `GVCN lớp` không chỉnh sửa/lưu được đúng phân công lớp chủ nhiệm.

Mục tiêu chính:

- User có vai trò Teacher/Giảng viên/Giáo viên/GVCN phải chỉnh được trường `GVCN lớp`.
- Khi lưu modal edit, danh sách lớp đã chọn phải được gửi lên backend qua `advisor_class_ids`.
- Backend cập nhật `classes.advisor_id` đúng theo danh sách lớp mới.
- Khi bỏ hết lớp và lưu, user đó phải được gỡ khỏi toàn bộ lớp đang chủ nhiệm.
- Khi tạo mới user Teacher/Giảng viên/Giáo viên/GVCN từ cùng modal, `GVCN lớp` cũng phải được gửi đúng.
- Modal phải hydrate đúng lớp đang được phân công khi mở form edit, kể cả khi danh sách lớp load chậm hơn danh sách user.

## 2. Hiện trạng đã kiểm tra

### Frontend modal

File chính: `frontend/src/components/modals/UserModal.tsx`

- `formData` có state `advisorClassIds`.
- Khi lưu single mode, modal đã gọi `onSave({ ...formData, advisor_class_ids: formData.advisorClassIds, status })`.
- Field `GVCN lớp` dùng `MultiClassSelect` và bị `disabled` nếu role hiện tại không được nhận diện là Teacher/Giảng viên/GVCN.
- Logic enable/disable hiện chỉ dựa vào `role.name` match regex `/Teacher|Giảng viên|GVCN/i`, chưa xét `role_code === 'TEACHER'` và chưa match tên `Giáo viên`.
- Vì vậy nếu dữ liệu role có `role_code: 'TEACHER'` nhưng tên role không match đúng regex, field `GVCN lớp` có thể bị khóa dù user là giáo viên/GVCN.
- Khi edit, modal đang tự suy ra `userClassIds` bằng cách filter `classes` theo `advisor_id`.

Vấn đề phụ:

- `useEffect` khởi tạo form có dùng `classes`, nhưng dependency array hiện chỉ có `[isOpen, initialData, roles]`.
- Nếu modal mở khi `classes` chưa có dữ liệu hoặc vừa refresh xong, `advisorClassIds` có thể không được hydrate lại.
- `handleOpenEditModal` ở page đã tính `advisor_class_ids`, nhưng modal chưa ưu tiên dùng trực tiếp `initialData.advisor_class_ids`.

### Frontend page `/permissions`

File chính: `frontend/src/app/permissions/page.tsx`

Root cause lưu không có tác dụng nằm ở `handleUserSave`:

- Khi edit user:
  - Page gọi `authApi.assignRole(editingUser._id, userData.role, token)`.
  - Sau đó gọi `authApi.updateUser(...)`.
  - Payload `updateUser` chỉ có `user_name`, `email`, `status`, `password`.
  - Payload không gửi `advisor_class_ids`, dù modal đã truyền field này lên.
- Khi tạo mới user:
  - Payload `createUser` cũng chưa gửi `advisor_class_ids`.

Kết quả: có hai biểu hiện lỗi. Một là field `GVCN lớp` có thể bị disabled do nhận diện role chưa đủ. Hai là nếu field chọn được thì backend vẫn không nhận danh sách lớp để cập nhật.

### API client

File chính: `frontend/src/api/auth-api.ts`

- `authApi.updateUser(userId, data, token)` chỉ stringify nguyên payload nhận được.
- API client không chặn `advisor_class_ids`; lỗi chính nằm ở page không truyền field.

### Backend

Các file chính:

- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/controllers/auth.controller.ts`
- `backend/src/auth/services/auth.service.ts`

Backend đã có sẵn phần cần thiết:

- `UpdateUserDto` có `advisor_class_ids?: string[]`.
- `CreateUserDto` và bulk create item cũng có `advisor_class_ids`.
- `PATCH /auth/users/:id` gọi `authService.updateUser`.
- `authService.updateUser` chỉ chạy logic cập nhật GVCN khi `dto.advisor_class_ids !== undefined`.
- Logic update hiện tại validate role Teacher/Giảng viên/GVCN, kiểm tra lớp tồn tại, chặn lớp đã có GVCN khác, gỡ lớp cũ của user rồi gán lớp mới.

Vì vậy scope backend chủ yếu là regression test. Chưa cần đổi schema/service nếu không phát hiện lỗi khi chạy test.

## 3. Phạm vi sửa đề xuất

### 3.1. Sửa nhận diện Teacher/GVCN trong `UserModal.tsx`

Tạo helper local để tránh lặp regex và xét đủ `role_code`:

```ts
const isTeacherRole = (role: any) =>
  role?.role_code === "TEACHER" || /Teacher|Giáo viên|Giảng viên|GVCN/i.test(role?.name || "");
```

Áp dụng helper cho:

- Select role single mode.
- Disabled state của `GVCN lớp` single mode.
- Select role bulk mode.
- Disabled state của `GVCN lớp` bulk mode.

### 3.2. Sửa payload ở `frontend/src/app/permissions/page.tsx`

Trong `handleUserSave`, thêm `advisor_class_ids: userData.advisor_class_ids || []` vào payload của cả edit và create.

Gợi ý hướng sửa edit:

```ts
await authApi.updateUser(editingUser._id, {
  user_name: userData.username,
  email: userData.email,
  status: userData.status,
  advisor_class_ids: userData.advisor_class_ids || [],
  ...(userData.password ? { password: userData.password } : {})
}, token);
```

Gợi ý hướng sửa create:

```ts
await authApi.createUser({
  user_name: userData.username,
  email: userData.email,
  password: userData.password,
  role_id: userData.role,
  status: userData.status,
  advisor_class_ids: userData.advisor_class_ids || []
}, token);
```

Lưu ý:

- Gửi mảng rỗng khi user bỏ chọn tất cả lớp là bắt buộc, vì backend chỉ gỡ GVCN khi field `advisor_class_ids` được gửi lên.
- Có thể gom edit thành một call `updateUser` có cả `role_id` và `advisor_class_ids`, vì backend `UpdateUserDto` đã hỗ trợ `role_id`. Nếu giữ `assignRole` riêng, cần bảo đảm `updateUser` chạy sau khi role mới đã được gán.

### 3.3. Sửa hydrate lớp trong `UserModal.tsx`

Ưu tiên lấy class ids từ `initialData.advisor_class_ids` trước, sau đó mới fallback sang filter `classes`.

Gợi ý:

```ts
let userClassIds: string[] = [];
if (Array.isArray(initialData?.advisor_class_ids)) {
  userClassIds = initialData.advisor_class_ids
    .map((c: any) => typeof c === "string" ? c : c?._id || c?.id)
    .filter(Boolean);
} else if (initialData) {
  // fallback: derive from classes by advisor_id
}
```

Lưu ý tránh ghi đè lựa chọn người dùng:

- Chỉ hydrate lại khi modal vừa mở hoặc khi `initialData` đổi.
- Nếu thêm `classes` vào dependency, cần guard để không reset form trong lúc user đang thao tác.
- Cách an toàn hơn: dùng `initialData.advisor_class_ids` do `handleOpenEditModal` đã tính sẵn.

## 4. Ngoài phạm vi

- Không thay đổi rule phân quyền truy cập trang `/permissions`.
- Không đổi schema `Class` hoặc `User`.
- Không đổi business rule "một lớp chỉ có một GVCN".
- Không thay đổi UI layout của modal, ngoài việc đảm bảo field `GVCN lớp` enable và lưu đúng.
- Không đụng logic bulk create trừ khi muốn test đồng bộ, vì bulk hiện đã gửi `advisor_class_ids`.

## 5. Acceptance criteria

- Mở `/permissions`, tab `Người dùng`, edit một user có vai trò Teacher/Giảng viên/Giáo viên/GVCN.
- Nếu role có `role_code === 'TEACHER'`, field `GVCN lớp` phải enable dù tên role không match chính xác chuỗi `Teacher|Giảng viên|GVCN`.
- Chọn một hoặc nhiều lớp ở `GVCN lớp`, bấm `Lưu thông tin`, reload data xong lớp đó có `advisor_id` là user vừa sửa.
- Mở lại modal user đó, các lớp đã chọn phải được hiển thị đúng.
- Bỏ chọn toàn bộ lớp rồi lưu, các lớp cũ không còn `advisor_id` là user đó.
- Nếu đổi role sang role không phải Teacher/Giảng viên/Giáo viên/GVCN, field `GVCN lớp` bị disabled và danh sách gửi lên phải là mảng rỗng.
- Nếu chọn lớp đã có GVCN khác, backend trả lỗi `Lớp đã có GVCN khác` và frontend hiển thị toast lỗi.
- Tạo mới user Teacher/Giảng viên/Giáo viên/GVCN kèm `GVCN lớp` phải gán lớp thành công.
- Tạo/sửa user không phải Teacher/Giảng viên/Giáo viên/GVCN không được gán lớp làm GVCN.

## 6. Test plan

### Manual test

1. Login bằng tài khoản có `ADMIN_FULL`.
2. Vào `/permissions`, tab `Người dùng`.
3. Chọn một user Teacher/Giảng viên/Giáo viên/GVCN, mở modal sửa.
4. Kiểm tra field `GVCN lớp` không bị disable.
5. Chọn 1 lớp chưa có GVCN, lưu.
6. Refresh trang, mở lại modal và kiểm tra lớp vẫn được chọn.
7. Vào trang chi tiết lớp hoặc API classes để xác nhận `advisor_id` đúng user.
8. Bỏ chọn lớp đó, lưu, refresh và xác nhận lớp đã mất GVCN.
9. Thử chọn lớp đã có GVCN khác để xác nhận lỗi backend được hiển thị.

### Automated test đề xuất

Frontend:

- Test helper `isTeacherRole` với role `{ role_code: 'TEACHER', name: 'Giáo viên' }`.
- Test `handleUserSave` hoặc component page bằng mock `authApi.updateUser` để đảm bảo payload edit có `advisor_class_ids`.
- Test create user payload có `advisor_class_ids`.
- Test `UserModal` edit mode nhận `initialData.advisor_class_ids` và render selected count đúng.

Backend:

- Bổ sung/kiểm tra test cho `authService.updateUser`:
  - Gán danh sách lớp mới cho teacher.
  - Gửi `advisor_class_ids: []` để gỡ các lớp cũ.
  - Reject user không phải teacher khi gửi lớp.
  - Reject class đã có GVCN khác.

## 7. Rủi ro và lưu ý

- Nếu tiếp tục gọi `assignRole` riêng trước `updateUser`, role đã đổi nhưng update user có thể fail do lớp đã có GVCN khác. Khi đó role vẫn bị đổi nhưng lớp không đổi. Cân nhắc dùng một call `updateUser` duy nhất có `role_id` + `advisor_class_ids` để backend xử lý gần hơn với một thao tác.
- `updateUser` hiện không bọc transaction MongoDB cho phần đổi user và đổi class advisor. Nếu cần đảm bảo atomic hoàn toàn, cần scope riêng cho transaction/session.
- File trong repo có một số chuỗi tiếng Việt hiển thị lỗi encoding khi đọc qua terminal, nên khi sửa cần giữ UTF-8 và kiểm tra lại UI thực tế.

## 8. Trạng thái

Scope này đã xác định root cause và phạm vi sửa. Chưa sửa implementation trong `frontend/src/app/permissions/page.tsx` hoặc `frontend/src/components/modals/UserModal.tsx`.