# Taskscope - Trang cài đặt cấu hình MAIL SMTP cho Admin

## Bối cảnh

Sidebar hiện có button `Cài đặt` ở footer nhưng button này chưa điều hướng hoặc mở trang cấu hình. Hệ thống đang dùng `MailService` để gửi email quên mật khẩu/OTP qua SMTP với các biến `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`. Người dùng cần một trang cài đặt để Admin nhập đầy đủ thông tin SMTP, lưu cấu hình và kiểm tra kết nối mail ngay trong hệ thống.

## Mục tiêu

Tạo trang cài đặt hệ thống dành riêng cho Admin, tập trung trước vào cấu hình MAIL SMTP. Trang này cho phép Admin xem trạng thái cấu hình mail, nhập/sửa thông tin SMTP, kiểm tra kết nối SMTP và gửi email thử để xác nhận OTP/quên mật khẩu có thể gửi được.

## Phạm vi chức năng

1. Sidebar
   - Biến button `Cài đặt` ở footer trong `frontend/src/components/layout/Sidebar.tsx` thành link/button điều hướng tới trang cài đặt.
   - Route đề xuất: `/system/settings` để nằm trong phân hệ quản trị hệ thống hiện có, tránh dùng lại `/settings` vì backend đang có logic dọn route mapping cũ này.
   - Chỉ hiển thị button này với Admin thật sự: `roleCode === 'ADMIN'`, `roleName === 'Admin'`, hoặc có `ADMIN_FULL`.
   - Trạng thái active phải nhận diện được khi đang ở `/system/settings`.

2. Trang UI cấu hình MAIL
   - Tạo trang `frontend/src/app/system/settings/page.tsx` hoặc tách component dưới `frontend/src/app/system/settings/_components` nếu form lớn.
   - Bọc trang bằng `RouteGuard` hoặc guard tương đương, fail-closed, admin-only.
   - Giao diện là màn hình công cụ cấu hình, không làm landing page.
   - Các trường cấu hình cần có:
     - `MAIL_HOST`: SMTP host, ví dụ `smtp.gmail.com`, `smtp.office365.com`.
     - `MAIL_PORT`: port số, thường `587` hoặc `465`.
     - `MAIL_SECURE`: toggle SSL/TLS trực tiếp; gợi ý `false` cho port `587`, `true` cho port `465`.
     - `MAIL_USER`: tài khoản SMTP.
     - `MAIL_PASS`: mật khẩu/app password/token SMTP, nhập dạng password và write-only.
     - `MAIL_FROM`: địa chỉ gửi đầy đủ, ví dụ `"Manager Point" <noreply@domain.edu.vn>`.
     - Tùy chọn bổ sung nếu backend hỗ trợ: `MAIL_REPLY_TO`, `MAIL_PROVIDER`, `MAIL_TIMEOUT_MS`, `MAIL_TLS_REJECT_UNAUTHORIZED`.
   - UI cần có trạng thái:
     - Đang tải cấu hình.
     - Chưa cấu hình.
     - Đã cấu hình nhưng thiếu trường bắt buộc.
     - Đã cấu hình đủ.
     - Kiểm tra kết nối thành công/thất bại.
     - Lưu thành công/thất bại.
   - `MAIL_PASS` không được hiển thị lại từ API. Nếu đã có mật khẩu, hiển thị trạng thái `Đã cấu hình` và ô nhập mới với mô tả nhập để thay đổi.

3. Backend API cấu hình MAIL
   - Thêm API admin-only dưới `backend/src/system/system.controller.ts`, đề xuất:
     - `GET /api/system/settings/mail`: lấy cấu hình mail đã mask secret.
     - `PATCH /api/system/settings/mail`: lưu/cập nhật cấu hình mail.
     - `POST /api/system/settings/mail/test-connection`: gọi `transporter.verify()` với cấu hình hiện tại hoặc payload draft.
     - `POST /api/system/settings/mail/send-test`: gửi email thử tới địa chỉ do Admin nhập.
   - Tất cả endpoint phải dùng `JwtAuthGuard`, `PermissionsGuard` và kiểm tra Admin thật sự, không chỉ `SYSTEM_ADMIN`, vì yêu cầu là chỉ Admin được thấy và tương tác.
   - Thêm permission mới nếu cần quản lý theo RBAC: `SYSTEM_MAIL_CONFIG_MANAGE`, nhưng vẫn nên bắt buộc Admin/`ADMIN_FULL` ở backend do đây là cấu hình secret.

4. Lưu trữ cấu hình
   - Không ghi trực tiếp vào `.env` từ UI.
   - Không trả raw `MAIL_PASS` về frontend.
   - Đề xuất tạo collection/schema mới, ví dụ `SystemSetting` hoặc `MailSetting`, lưu cấu hình runtime trong database.
   - Trường nhạy cảm như `MAIL_PASS` phải mã hóa trước khi lưu. Cần biến server-side riêng để mã hóa, ví dụ `SETTINGS_ENCRYPTION_KEY` hoặc dùng secret hiện có nếu phù hợp.
   - Khi update mà `MAIL_PASS` rỗng/không truyền lên, giữ nguyên mật khẩu SMTP cũ.
   - Cấu hình từ database nên override env khi tồn tại; nếu chưa có trong DB thì fallback về env hiện tại để không làm hỏng production đang chạy.

5. Tích hợp MailService
   - Refactor `backend/src/core/mail/mail.service.ts` để lấy SMTP config từ nguồn cấu hình tập trung: DB setting nếu có, fallback env.
   - Có cơ chế rebuild/reload Nodemailer transporter sau khi Admin lưu cấu hình mới.
   - Thêm method:
     - `getSafeMailConfig()` trả config đã mask.
     - `updateMailConfig(dto)` lưu config và refresh transporter.
     - `verifyConnection(config?)` kiểm tra kết nối SMTP.
     - `sendTestEmail(to)` gửi email thử.
   - Log lỗi SMTP phải an toàn: chỉ log metadata như `code`, `command`, `responseCode`, `address`, `port`; không log email thật, OTP, token, password hoặc raw config.

6. Frontend API client
   - Bổ sung hàm vào `frontend/src/api/system-api.ts`:
     - `getMailSettings()`.
     - `updateMailSettings(payload)`.
     - `testMailConnection(payload?)`.
     - `sendTestMail(payload)`.
   - TypeScript interface cho cấu hình mail phải tách rõ field secret write-only:
     - response: `hasPassword: boolean`, không có `MAIL_PASS`.
     - request: cho phép `mailPass?: string`.

7. Phân quyền và route mapping
   - Cập nhật registry/seed permission trong `backend/src/auth/permissions.registry.ts` và RBAC seed nếu dùng permission mới.
   - Thêm route permission mapping cho `/system/settings` nếu dùng dynamic route guard.
   - Cập nhật `getPagePermissionScopes()` để hiển thị quyền cấu hình mail trong màn phân quyền/tổng quan.
   - Không cấp quyền này mặc định cho `System Operator`, `Audit Viewer`, `Backup Operator`; chỉ Admin hoặc role có `ADMIN_FULL`.

## Ngoài phạm vi

- Không đổi luồng OTP/quên mật khẩu ngoài việc dùng SMTP config mới.
- Không ghi/sửa file `.env` từ UI.
- Không hiển thị hoặc export mật khẩu SMTP đã lưu.
- Không tích hợp OAuth Gmail/Microsoft trong scope này; chỉ SMTP username/password/app password.
- Không tạo màn hình cấu hình toàn bộ hệ thống ngoài MAIL nếu chưa được yêu cầu.

## File liên quan dự kiến

- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/app/system/settings/page.tsx`
- `frontend/src/api/system-api.ts`
- `frontend/src/components/guards/RouteGuard.tsx` nếu cần hỗ trợ admin-only rõ hơn
- `frontend/src/providers/auth-provider.tsx`
- `backend/src/system/system.controller.ts`
- `backend/src/system/system.service.ts`
- `backend/src/system/system.module.ts`
- `backend/src/system/dto/system.dto.ts`
- `backend/src/core/mail/mail.service.ts`
- `backend/src/core/mail/mail.module.ts`
- `backend/src/auth/permissions.registry.ts`
- `backend/src/auth/services/auth.service.ts`
- `docs/otp-rollout-checklist.md`
- `docker-compose.prod.yml` nếu cần bổ sung biến mã hóa setting như `SETTINGS_ENCRYPTION_KEY`

## Tiêu chí hoàn thành

- Admin thấy và bấm được button `Cài đặt` ở sidebar để vào `/system/settings`.
- User không phải Admin không thấy button này và không truy cập được trang/API dù gọi trực tiếp URL.
- Trang cấu hình MAIL hiển thị đủ field SMTP, validate port/secure hợp lý, lưu được cấu hình.
- `MAIL_PASS` chỉ nhập để tạo/cập nhật, không bao giờ trả ngược raw value về frontend.
- Admin có thể test connection và gửi email thử từ UI.
- Luồng quên mật khẩu OTP dùng cấu hình SMTP mới sau khi lưu.
- Nếu chưa có cấu hình DB, hệ thống vẫn fallback env hiện tại.
- Log lỗi mail đủ thông tin debug nhưng không lộ secret hoặc email thật.

## Kiểm thử đề xuất

- Backend unit test cho service lưu cấu hình mail, mask secret, giữ nguyên password khi không truyền password mới.
- Backend unit/integration test cho endpoint admin-only: Admin được truy cập, non-admin nhận 403.
- Test `MailService.verifyConnection()` với mock Nodemailer success/fail.
- Frontend test form validation: port không hợp lệ, thiếu host/user/from, password write-only.
- Chạy:
  - `cd backend && npm test -- system`
  - `cd backend && npm test -- mail`
  - `cd backend && npm run build`
  - `cd frontend && npm run build`
- Manual test với SMTP thật: lưu cấu hình, test connection, gửi mail thử, thực hiện quên mật khẩu nhận OTP.
