# Taskscope - Sửa lỗi type-check reset password

## 1. Bối cảnh lỗi

Build frontend đang fail tại:

```text
./src/app/(auth)/reset-password/page.tsx:92:21
Type error: Property 'resetPassword' does not exist on type 'authApi'
```

Nguyên nhân trực tiếp: trang `frontend/src/app/(auth)/reset-password/page.tsx` vẫn gọi `authApi.resetPassword(token, data.password)`, nhưng object `authApi` trong `frontend/src/api/auth-api.ts` hiện không khai báo method `resetPassword`.

Trong code hiện tại đã có 2 luồng đặt lại mật khẩu:

- Legacy link token: backend còn endpoint `POST /auth/reset-password`, DTO nhận `{ token, new_password }`.
- OTP flow mới: frontend `/forgot-password` đang dùng `requestPasswordReset`, `verifyPasswordResetOtp`, `completePasswordReset`; backend có các endpoint `/auth/password-reset/request`, `/verify`, `/complete`.

## 2. Mục tiêu

Sửa lỗi type-check để Next.js build thành công, đồng thời giữ hành vi đặt lại mật khẩu nhất quán với luồng hiện tại.

Ưu tiên phạm vi nhỏ:

- Không đổi logic backend nếu endpoint legacy vẫn còn hoạt động.
- Không phá luồng OTP hiện có tại `/forgot-password`.
- Không đổi schema/database.
- Không can thiệp các thay đổi ngoài auth.

## 3. Phạm vi xử lý đề xuất

### 3.1. Frontend API client

File: `frontend/src/api/auth-api.ts`

Thêm lại method legacy:

```ts
async resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return handleResponse<MessageResponse>(res);
}
```

Lý do: trang `/reset-password?token=...` đang là form cho link token, trong khi DTO backend `ResetPasswordDto` yêu cầu field `new_password`, không phải `password` hay `newPassword`.

### 3.2. Trang reset password legacy

File: `frontend/src/app/(auth)/reset-password/page.tsx`

Giữ lời gọi:

```ts
await authApi.resetPassword(token, data.password);
```

Không cần đổi sang `completePasswordReset`, vì method đó dành cho OTP flow và nhận `resetToken`, `newPassword`, `confirmPassword`.

Nên rà thêm validation password ở trang này:

- Hiện UI chỉ yêu cầu tối thiểu 8 ký tự.
- Backend yêu cầu ít nhất 1 chữ thường, 1 chữ hoa, 1 số, 1 ký tự đặc biệt.
- Scope nên đồng bộ rule frontend với backend để tránh submit rồi mới báo lỗi từ API.

### 3.3. Điều hướng quên mật khẩu

File: `frontend/src/app/(auth)/forgot-password/page.tsx`

Không sửa nếu luồng OTP hiện đã hoạt động.

Chỉ kiểm tra các link điều hướng:

- Link "Quên mật khẩu" từ login nên đi tới `/forgot-password`.
- `/reset-password?token=...` chỉ dùng cho email reset link legacy, nếu hệ thống vẫn gửi link.

### 3.4. Backend

Các file tham chiếu:

- `backend/src/auth/controllers/auth.controller.ts`
- `backend/src/auth/dto/auth.dto.ts`
- `backend/src/auth/services/password.service.ts`
- `backend/src/auth/services/auth.service.ts`

Không cần sửa backend cho lỗi type-check này nếu `POST /auth/reset-password` vẫn tồn tại.

Chỉ cần xác nhận:

- Controller có `@Post('reset-password')`.
- DTO `ResetPasswordDto` nhận `token` và `new_password`.
- Service reset password vẫn xử lý token legacy đúng cách.

## 4. Ngoài phạm vi

- Không thay thế luồng OTP bằng legacy link token.
- Không xóa endpoint `POST /auth/reset-password` trong task này.
- Không đổi giao diện toàn bộ auth.
- Không sửa các lỗi build khác nếu phát sinh ngoài nhóm file auth nêu trên; ghi nhận riêng nếu có.

## 5. Test/Verify

Chạy trong `frontend`:

```bash
npm run build
```

Nếu muốn kiểm tra nhanh hơn trước khi build:

```bash
npx tsc --noEmit
```

Kịch bản thủ công:

1. Mở `/reset-password?token=dummy-token`.
2. Nhập mật khẩu không đủ rule, frontend phải báo lỗi trước khi gọi API.
3. Nhập mật khẩu hợp lệ, request gửi tới `POST /auth/reset-password` với body `{ token, new_password }`.
4. Mở `/forgot-password`, chạy qua các bước OTP để đảm bảo không bị ảnh hưởng.

## 6. Tiêu chí hoàn thành

- Next.js không còn lỗi `Property 'resetPassword' does not exist on type authApi`.
- `authApi.resetPassword` có type rõ ràng và payload đúng với `ResetPasswordDto`.
- `/forgot-password` OTP flow vẫn dùng `completePasswordReset` như hiện tại.
- `npm run build` frontend đi qua bước type-check hoặc lỗi còn lại không liên quan tới auth reset password.
