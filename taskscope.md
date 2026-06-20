# Taskscope: Bổ sung chọn "GVCN lớp" khi thêm nhiều người dùng

## Mục tiêu

Bổ sung trong modal **Thêm người dùng > Thêm nhiều người dùng** một select mới tên **GVCN lớp**, nằm bên trái cột **Trạng thái**, để admin chọn lớp cần gán GVCN cho từng tài khoản được tạo hàng loạt.

Khi lưu hàng loạt, nếu một dòng có chọn GVCN lớp thì backend phải tạo user thành công và cập nhật lớp tương ứng với `advisor_id = user._id`.

## Hiện trạng đã kiểm tra

- Modal bulk nằm tại `frontend/src/components/modals/UserModal.tsx`.
- Bảng bulk hiện có các cột: `Username`, `Email`, `Vai trò`, `Trạng thái`, `Mật khẩu`.
- Payload bulk hiện chỉ gửi:
  - `user_name`
  - `email`
  - `password`
  - `role_id`
  - `status`
- Trang gọi modal là `frontend/src/app/permissions/page.tsx`, hàm `handleBulkUserSave` gọi `authApi.createUsersBulk`.
- API frontend `authApi.createUsersBulk` gọi `POST /auth/users/bulk-create`.
- Backend DTO `BulkCreateUserItemDto` trong `backend/src/auth/dto/auth.dto.ts` chưa có field lớp/GVCN.
- Backend `AuthService.createUsersBulk` trong `backend/src/auth/services/auth.service.ts` chỉ tạo user, chưa cập nhật `classes.advisor_id`.
- Schema lớp có field `advisor_id` tại `backend/src/classes/schemas/class.schema.ts`.
- API lấy danh sách lớp đã có: `classApi.getClasses()` gọi `GET /classes`.

## Phạm vi thay đổi

### 1. Frontend: nạp danh sách lớp cho modal

File: `frontend/src/app/permissions/page.tsx`

- Import `classApi` và type `Class` từ `frontend/src/api/class-api.ts`.
- Thêm state `classes`.
- Trong `fetchData`, gọi thêm `classApi.getClasses()`.
- Truyền `classes={classes}` vào `UserModal`.

Lưu ý hiệu năng:

- Có thể gọi song song trong `Promise.all`.
- Nếu tải lớp lỗi thì fallback `[]` và toast/log phù hợp, không làm hỏng toàn bộ trang phân quyền.

### 2. Frontend: thêm cột “GVCN lớp” trong bulk modal

File: `frontend/src/components/modals/UserModal.tsx`

- Mở rộng props:
  - `classes?: Class[]`
- Mỗi dòng `bulkUsers` thêm field:
  - `advisorClassId: ""`
- Thêm cột **GVCN lớp** nằm giữa **Vai trò** và **Trạng thái**.
- Select hiển thị:
  - Option mặc định: `Không gán`
  - Danh sách lớp: ưu tiên label `class_name`, có thể kèm khoa hoặc GVCN hiện tại nếu dữ liệu có sẵn.
- Khi thêm dòng mới hoặc reset modal, khởi tạo `advisorClassId: ""`.
- Khi bấm “Sửa các dòng lỗi”, giữ lại `advisorClassId` của dòng lỗi để người dùng sửa tiếp.
- Khi submit, payload mỗi user cần gửi thêm:
  - `advisor_class_id: u.advisorClassId || undefined`

Khuyến nghị UI:

- Vì thêm một cột mới, tăng nhẹ width modal bulk hoặc dùng `min-w` cho bảng và `overflow-x-auto` để tránh vỡ layout trên màn hình hẹp.
- Nếu vai trò đã chọn không phải `Teacher` thì có thể disable select hoặc tự clear `advisorClassId`. Nếu chưa chắc mapping role, ít nhất hiển thị cảnh báo/validation khi chọn lớp cho role không phải Teacher.

### 3. Backend DTO: nhận class id trong bulk create

File: `backend/src/auth/dto/auth.dto.ts`

Trong `BulkCreateUserItemDto`, thêm field optional:

```ts
@ApiProperty({ example: '65f1...', required: false })
@IsOptional()
@IsMongoId({ message: 'advisor_class_id không hợp lệ' })
advisor_class_id?: string;
```

Không bắt buộc field này để không phá luồng thêm user hàng loạt hiện tại.

### 4. Backend service: tạo user và gán GVCN lớp

File: `backend/src/auth/services/auth.service.ts`

Cần bổ sung khả năng cập nhật lớp sau khi tạo user:

- Inject model `Class` vào `AuthService`.
- Import `Class` schema nếu cần.
- Trong `createUsersBulk`:
  - Nếu `u.advisor_class_id` có giá trị, validate ObjectId.
  - Kiểm tra lớp tồn tại.
  - Nên kiểm tra role của user là Teacher trước khi cho gán GVCN.
  - Sau khi `userModel.create` thành công, cập nhật lớp:
    - `classModel.findByIdAndUpdate(u.advisor_class_id, { advisor_id: newUser._id })`
  - Trả thêm thông tin `advisor_class_id` trong `successes` để frontend biết dòng nào đã gán lớp.

Điểm cần quyết định rõ:

- Nếu lớp đã có `advisor_id`, có cho phép ghi đè không?
- Khuyến nghị an toàn: không tự ghi đè. Nếu lớp đã có GVCN khác, dòng đó trả lỗi: `Lớp đã có GVCN`.
- Nếu muốn cho phép ghi đè, cần hiển thị rõ trên UI label lớp đang có GVCN hiện tại.

### 5. Backend module: đăng ký Class model cho Auth module

File cần kiểm tra: `backend/src/auth/auth.module.ts`

- Nếu `Class` model chưa được đăng ký trong `MongooseModule.forFeature`, bổ sung:
  - `{ name: Class.name, schema: ClassSchema }`

## Validation đề xuất

Frontend:

- `username`, `email`, `role`, `password` giữ validation hiện tại.
- `advisorClassId` optional.
- Nếu chọn GVCN lớp nhưng role không phải Teacher:
  - Chặn submit dòng đó với lỗi: `Chỉ tài khoản Teacher mới được gán GVCN lớp`.

Backend:

- `advisor_class_id` phải là MongoId hợp lệ nếu có.
- Lớp phải tồn tại.
- Role phải là Teacher hoặc có `role_code === 'TEACHER'`.
- Không ghi đè GVCN lớp đã có nếu chưa có yêu cầu xác nhận rõ ràng.

## Acceptance criteria

- Modal bulk hiển thị cột **GVCN lớp** bên trái **Trạng thái**.
- Select GVCN lớp hiển thị được danh sách lớp từ API `/classes`.
- Có thể tạo nhiều user mà không chọn lớp như hiện tại.
- Khi chọn lớp cho một dòng Teacher và lưu thành công, document lớp được cập nhật `advisor_id` bằng `_id` user vừa tạo.
- Dòng lỗi trả về vẫn hiển thị được trong màn hình kết quả bulk.
- Dòng lỗi khi bấm “Sửa các dòng lỗi” vẫn giữ lại lựa chọn lớp để sửa tiếp.
- Không phát sinh lỗi layout khi bật/tắt “Dùng chung mật khẩu”.
- Không làm ảnh hưởng luồng thêm 1 người dùng.

## Test cần chạy

Backend:

```bash
npm test -- --runInBand --testPathPatterns=auth.service.spec.ts
```

Frontend:

```bash
npm test -- --runInBand
```

Kiểm thử thủ công:

- Vào `/permissions`.
- Mở modal **Thêm người dùng**.
- Chọn tab **Thêm nhiều người dùng**.
- Kiểm tra cột **GVCN lớp** nằm đúng vị trí.
- Tạo một Teacher có chọn lớp.
- Vào quản lý lớp hoặc gọi API `/classes`, xác nhận lớp đó có `advisor_id` là user vừa tạo.
- Thử tạo user không chọn lớp để chắc luồng cũ vẫn chạy.
