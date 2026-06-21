# Taskscope: Quyền của vai trò bị reset sau build/restart

## Vấn đề

Khi set quyền hạn cho một vai trò trên trang `/permissions` và dữ liệu đã được lưu vào database, sau khi build/chạy lại hệ thống thì các quyền đã set biến mất, chỉ còn lại các quyền mặc định.

## Kết luận kiểm tra

Nguyên nhân nằm ở backend, trong `AuthService.onModuleInit()`:

- `backend/src/auth/services/auth.service.ts:67` gọi `migrateLegacyRoleCodes()`.
- `backend/src/auth/services/auth.service.ts:69` gọi `seedDeclaredPermissions()`.
- `backend/src/auth/services/auth.service.ts:70` gọi `seedRbac()` mỗi lần module auth khởi động.
- `seedRbac()` tạo danh sách role mặc định tại `backend/src/auth/services/auth.service.ts:1038`.
- Mỗi role mặc định có trường `permissions`.
- Vòng lặp tại `backend/src/auth/services/auth.service.ts:1119` đang dùng:

```ts
await this.roleModel.findOneAndUpdate(
  { role_code: r.role_code },
  { $set: r },
  { upsert: true },
).exec();
```

Vì `$set: r` bao gồm `permissions`, nên mỗi lần backend start lại, database sẽ bị ghi đè `role.permissions` về cấu hình seed mặc định. Đây là lý do quyền đã chỉnh trên UI vẫn lưu được, nhưng sau build/restart lại quay về mặc định.

## Phạm vi ảnh hưởng

Các role mặc định bị ảnh hưởng:

- `ADMIN`
- `TEACHER`
- `SUPERVISOR`
- `STUDENT`
- `SECURITY_ADMIN`
- `SYSTEM_OPERATOR`
- `AUDIT_VIEWER`
- `BACKUP_OPERATOR`

Các role tự tạo không trùng `role_code` trên sẽ không bị vòng seed role mặc định ghi đè.

## File liên quan

- `backend/src/auth/services/auth.service.ts`
  - `onModuleInit()`
  - `seedRbac()`
  - khối seed roles mặc định
- `backend/src/auth/services/rbac.service.ts`
  - `updateRole()` đang lưu permissions đúng vào DB
- `backend/src/auth/schemas/role.schema.ts`
  - trường `permissions`
- `frontend/src/app/permissions/page.tsx`
  - UI gọi API cập nhật role
- `frontend/src/api/auth-api.ts`
  - client API cho role/permission

## Nguyên tắc sửa

Seed RBAC phải idempotent:

- Được phép tạo role mặc định khi role chưa tồn tại.
- Được phép cập nhật metadata an toàn như `name`, `description` nếu muốn giữ migration metadata.
- Không được ghi đè `permissions` của role đã tồn tại, vì đây là cấu hình người dùng đã chỉnh trên UI.
- Chỉ set `permissions` mặc định bằng `$setOnInsert` khi insert role mới.

## Hướng sửa đề xuất

Thay logic upsert role mặc định trong `seedRbac()` từ `$set: r` sang tách riêng metadata và default permissions:

```ts
for (const r of roles) {
  await this.roleModel.findOneAndUpdate(
    { role_code: r.role_code },
    {
      $set: {
        name: r.name,
        role_code: r.role_code,
        description: r.description,
      },
      $setOnInsert: {
        permissions: r.permissions,
      },
    },
    { upsert: true },
  ).exec();
}
```

Nếu muốn tuyệt đối không đổi tên/mô tả role đã tồn tại, có thể đưa cả `name`, `description` vào `$setOnInsert`. Tuy nhiên phương án trên vẫn cho phép migrate metadata role mặc định mà không làm mất quyền đã cấu hình.

## Cần cân nhắc thêm

`seedRbac()` hiện cũng đang `$set` lại:

- permission groups tại `backend/src/auth/services/auth.service.ts:1179`
- route permissions tại `backend/src/auth/services/auth.service.ts:1249`

Nếu UI cũng cho phép chỉnh permission group hoặc route mapping, hai phần này có nguy cơ reset tương tự sau restart. Nên áp dụng cùng nguyên tắc:

- default data chỉ set khi insert mới
- không ghi đè cấu hình runtime đã chỉnh trong DB

## Tiêu chí hoàn thành

- Sau khi cập nhật role permissions trên `/permissions`, restart/build lại backend không làm mất permissions đã lưu.
- Role mặc định vẫn được tạo đúng khi database rỗng.
- Permissions mới từ registry vẫn được tạo/bổ sung bình thường.
- Có regression test backend: existing role có custom permissions không bị `seedRbac()` ghi đè sau khi seed chạy lại.