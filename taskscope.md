# Taskscope: Them Nhieu Nguoi Dung Trong Modal `/permissions`

## 1. Muc tieu

Bo sung chuc nang them nhieu nguoi dung cung luc trong modal **"Them nguoi dung"** tai page `/permissions`.

Chuc nang can ho tro 2 cach dat mat khau:

- **Dung chung mat khau**: admin nhap 1 mat khau, ap dung cho tat ca user trong dot tao.
- **Mat khau rieng tung user**: moi dong/user co truong mat khau rieng.

Sau khi tao, he thong can hien thi ket qua tong hop: so user tao thanh cong, so user that bai, va ly do that bai theo tung user.

## 2. Hien trang da kiem tra

### Frontend

- Page `/permissions` dang dung modal:
  - `frontend/src/components/modals/UserModal.tsx`
  - Goi tai `frontend/src/app/permissions/page.tsx`
- Modal hien tai chi ho tro them/sua **1 nguoi dung**.
- Khi them moi, `handleUserSave` dang goi:
  - `authApi.register(user_name, email, password)`
- Han che hien tai:
  - `register` la API dang ky tai khoan, khong phai API admin-create user rieng.
  - Role/status chon tren modal chua duoc dung khi tao moi user.
  - Khi sua user, luong hien tai chu yeu assign role, chua xu ly day du cac truong trong modal nhu email, status, password.
  - Da co bulk delete user, nhung chua co bulk create user.

### Backend

- Controller hien co:
  - `GET /api/auth/users`
  - `PATCH /api/auth/users/:id`
  - `DELETE /api/auth/users/:id`
  - `POST /api/auth/users/bulk-delete`
- Chua co endpoint tao user noi bo danh cho admin, va chua co endpoint tao nhieu user.
- `register` hien tai:
  - Validate username/email/password qua `RegisterDto`.
  - Luon gan role mac dinh `User` hoac `Student`.
  - Luon gan status `active`.
- Schema `User` co cac truong can dung:
  - `user_name`
  - `email`
  - `pw_hash`
  - `status`
  - `role`
  - `phone_number`
  - `department`
  - `date_birth`

## 3. Pham vi can lam

### 3.1 Frontend - UI modal

Cap nhat `UserModal.tsx` de ho tro 2 mode:

- **Them 1 nguoi dung**
  - Giu trai nghiem hien tai, nhung save can goi API admin-create user moi thay vi public register.
- **Them nhieu nguoi dung**
  - Hien bang nhap nhieu dong user.
  - Moi dong toi thieu gom:
    - Ten nguoi dung / username
    - Email
    - Vai tro
    - Trang thai
    - Mat khau, neu khong bat che do dung chung mat khau
  - Co nut them dong, xoa dong, xoa tat ca dong loi.
  - Co toggle/segmented control:
    - `Dung chung mat khau`
    - `Mat khau rieng tung user`
  - Khi dung chung mat khau:
    - Hien 1 o mat khau chung.
    - An/disable cot mat khau tung dong.
  - Khi dung mat khau rieng:
    - Hien cot mat khau tung dong.
    - Khong bat buoc mat khau chung.

### 3.2 Frontend - API client

Cap nhat `frontend/src/api/auth-api.ts`:

- Them `createUser(data, accessToken)`.
- Them `createUsersBulk(data, accessToken)`.
- De xuat endpoint:
  - `POST /api/auth/users`
  - `POST /api/auth/users/bulk-create`

Payload goi y cho bulk:

```ts
{
  commonPassword?: string;
  users: Array<{
    user_name: string;
    email: string;
    password?: string;
    role_id: string;
    status?: "active" | "inactive" | "locked";
  }>;
}
```

Response goi y:

```ts
{
  total: number;
  successCount: number;
  failedCount: number;
  successes: Array<{
    index: number;
    user_id: string;
    user_name: string;
    email: string;
  }>;
  errors: Array<{
    index: number;
    user_name?: string;
    email?: string;
    reason: string;
  }>;
}
```

### 3.3 Backend - DTO

Cap nhat `backend/src/auth/dto/auth.dto.ts`:

- Them `CreateUserDto` cho admin tao 1 user.
- Them `BulkCreateUserItemDto`.
- Them `BulkCreateUsersDto`.

Validation can co:

- `user_name`: required, string, trim, khong rong.
- `email`: required, email hop le.
- `password`:
  - Required trong create single.
  - Required tung item neu khong co `commonPassword`.
  - Toi thieu 8 ky tu va nen dung cung policy voi `RegisterDto`.
- `commonPassword`:
  - Optional, nhung neu co thi phai dat policy password.
- `role_id`: required, MongoId hop le.
- `status`: optional, chi nhan `active`, `inactive`, `locked`.
- Gioi han so luong bulk, de xuat 1-500 user/request.

### 3.4 Backend - Controller

Cap nhat `backend/src/auth/controllers/auth.controller.ts`:

- Them endpoint admin-only:
  - `POST /api/auth/users`
  - `POST /api/auth/users/bulk-create`
- Bao ve bang:
  - `JwtAuthGuard`
  - `PermissionsGuard`
  - `@Permissions('ADMIN_FULL')`

### 3.5 Backend - Service

Cap nhat `backend/src/auth/services/auth.service.ts`:

- Them `createUser(dto, ip?)`.
- Them `createUsersBulk(dto, ip?)`.
- Khong reuse truc tiep `register` neu lam mat role/status admin chon.
- Validate truoc khi ghi:
  - Duplicate `user_name` trong payload.
  - Duplicate `email` trong payload.
  - `user_name` da ton tai trong DB.
  - `email` da ton tai trong DB.
  - `role_id` ton tai trong DB.
  - Password hop le theo policy.
- Hash password bang `passwordService.hashPassword`.
- Nen xu ly theo batch/chunk nho khi so luong lon, de tranh qua tai CPU khi hash password.
- Ket qua bulk nen la partial success:
  - Dong hop le thi tao.
  - Dong loi thi tra ve `errors[]` co ly do.
  - Khong lam fail toan bo request chi vi 1 dong loi, tru truong hop payload sai schema nghiem trong.
- Ghi log admin action neu he thong dang can audit:
  - `admin_create_user`
  - `admin_bulk_create_users`

## 4. Validate va UX ket qua

### Validate tren frontend

- Khong cho submit neu danh sach rong.
- Bao loi tai dong neu thieu username/email/role/password.
- Bao loi email sai dinh dang.
- Bao loi duplicate username/email trong danh sach dang nhap.
- Bao loi mat khau chung/rieng khong dat do manh.

### Validate tren backend

- Backend la nguon validate cuoi cung, khong phu thuoc frontend.
- Kiem tra ton tai role.
- Kiem tra duplicate voi DB bang truy van gom nhom:
  - `$in` theo danh sach username.
  - `$in` theo danh sach email lowercase.
- Email can lowercase/trim truoc khi so sanh va luu.

### Dialog ket qua

Sau khi bulk create:

- Hien modal/toast ket qua:
  - Tong so user.
  - So tao thanh cong.
  - So that bai.
  - Bang loi gom dong, username/email, ly do.
- Co nut dong va refresh danh sach user.
- Nen co nut "Sua cac dong loi" de giu lai nhung dong that bai trong modal.

## 5. Tieu chi nghiem thu

- Admin vao `/permissions`, bam **Them nguoi dung** va co the chon them 1 user hoac them nhieu user.
- Them nhieu user voi **mat khau chung** tao thanh cong tat ca dong hop le.
- Them nhieu user voi **mat khau rieng** tao thanh cong tung dong co password hop le.
- Neu 1 dong trung email/username da ton tai, dong do that bai va hien ly do, cac dong hop le van duoc tao.
- Neu 2 dong trong cung payload trung email/username, frontend va backend deu bao loi ro rang.
- Role duoc gan dung theo `role_id` admin chon, khong bi roi ve role mac dinh.
- Status duoc luu dung theo lua chon.
- Password duoc hash, khong tra ve `pw_hash` cho frontend.
- API bulk create chi user co `ADMIN_FULL` moi goi duoc.
- Sau khi tao xong, danh sach user tren `/permissions` duoc refresh.

## 6. File du kien can sua

- `frontend/src/components/modals/UserModal.tsx`
- `frontend/src/app/permissions/page.tsx`
- `frontend/src/api/auth-api.ts`
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/controllers/auth.controller.ts`
- `backend/src/auth/services/auth.service.ts`
- Co the can bo sung test:
  - `backend/src/auth/test/auth.service.spec.ts`
  - `backend/test/auth.e2e-spec.ts`
  - Test frontend cho modal neu project da co pattern tuong ung.

## 7. Ngoai pham vi

- Import user tu Excel/CSV.
- Tao ho so sinh vien/giang vien tu dong kem theo user.
- Gui email kich hoat/reset password sau khi tao user.
- Phan quyen moi ngoai `ADMIN_FULL`.

## 8. Ghi chu rui ro

- Dang dung `authApi.register` trong page admin la chua dung ngu canh. Nen tach API admin-create user de tranh mat role/status va tranh nham voi luong public register.
- Can can nhac unique index cho `email` da co, nhung `user_name` hien schema khong unique. Neu nghiep vu yeu cau username duy nhat, service phai check duplicate ro rang nhu hien tai.
- Hash nhieu password cung luc co the ton CPU; nen gioi han size payload va xu ly chunk/concurrency thap.
