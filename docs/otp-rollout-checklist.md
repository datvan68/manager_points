# Rollout Checklist & Environment Config: Quên Mật Khẩu OTP

Tài liệu này ghi lại các cấu hình biến môi trường (Environment Variables) mới và các bước cần thiết để triển khai tính năng Quên mật khẩu qua OTP lên môi trường staging/production.

## 1. Cấu hình Biến Môi Trường (Environment Variables) mới

Cần bổ sung các biến sau vào file `.env` (hoặc cấu hình tương đương trên server) trước khi deploy backend:

```env
# Mật khẩu/Secret key dùng để hash OTP (cần tạo chuỗi bảo mật ngẫu nhiên, VD: 32 ký tự hex hoặc base64)
OTP_SECRET=your_secure_otp_secret_here

# Thời gian sống của OTP (giây) - Mặc định: 300s (5 phút)
OTP_EXPIRES_IN_SECONDS=300

# Số lần nhập sai OTP tối đa cho phép trên mỗi request
OTP_MAX_ATTEMPTS=5

# Thời gian sống của Reset Token (giây) - Mặc định: 600s (10 phút)
PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS=600

# Thời gian chờ trước khi cho phép gửi lại OTP (giây) - Mặc định: 60s
PASSWORD_RESET_RESEND_COOLDOWN_SECONDS=60

# Số lần cho phép gửi lại (resend) OTP tối đa cho mỗi request
PASSWORD_RESET_MAX_RESENDS=3

# Giới hạn Rate-Limit request OTP theo IP (số request / 15 phút)
PASSWORD_RESET_IP_LIMIT=10

# Giới hạn Rate-Limit request OTP theo Email (số request / 15 phút)
PASSWORD_RESET_EMAIL_LIMIT=3
```

> **Lưu ý Security:** `OTP_SECRET` là key dùng để mã hoá/giải mã hoặc băm (hash) mã OTP. Tuyệt đối không để lộ key này và nên sử dụng chuỗi ngẫu nhiên đủ mạnh trong môi trường production.

## 2. Checklist Triển khai (Rollout Checklist)

Thực hiện các bước sau để đảm bảo tính năng OTP lên production thành công:

- [ ] **1. Sinh `OTP_SECRET` an toàn**: Khởi tạo một chuỗi ngẫu nhiên mật mã cao cho môi trường Production (vd: `openssl rand -base64 32`).
- [ ] **2. Cập nhật `.env` Production**: Bổ sung tất cả các biến môi trường cấu hình như danh sách trên vào `.env.production` hoặc AWS Parameter Store/Secret Manager tương ứng.
- [ ] **3. Kiểm tra SMTP/Mailer**: Đảm bảo dịch vụ email đang hoạt động ổn định và địa chỉ gửi có uy tín (reputation) tốt để OTP email không vào thư rác (Spam).
- [ ] **4. Tạo index cho DB (Nếu cần)**: Nếu backend đã có migration hoặc script chạy thủ công, đảm bảo các chỉ mục (indexes) như TTL index (`expireAfterSeconds`) và chỉ mục cho `user_id`, `normalized_email`, `reset_token_hash` trong schema reset password mới được thiết lập thành công trên MongoDB.
- [ ] **5. Deploy Backend**: Triển khai mã nguồn Backend mới. Hãy theo dõi log để đảm bảo không có lỗi khởi động liên quan đến thiếu biến môi trường.
- [ ] **6. Deploy Frontend**: Triển khai mã nguồn Frontend tương ứng sau khi Backend đã lên.
- [ ] **7. Kiểm thử nhanh trên Production (Sanity Test)**:
  - Truy cập chức năng quên mật khẩu.
  - Gửi yêu cầu với 1 email có thực (dùng tài khoản test) và 1 email không tồn tại (xác nhận giao diện không hiển thị lỗi tiết lộ email, cùng 1 phản hồi thành công).
  - Nhận OTP qua email, nhập thử sai 1 lần, nhập đúng 1 lần.
  - Hoàn tất đổi mật khẩu và đăng nhập lại bằng mật khẩu mới.
- [ ] **8. Monitor Logs**: Theo dõi các audit logs như `password_reset_requested`, `password_reset_otp_verified`, `password_reset_rate_limited` trên các công cụ monitor (như Kibana/Datadog) để đảm bảo không có bất thường về lỗi dò quét hệ thống.
- [ ] **9. Thu dọn (Cleanup)**: Đóng/vô hiệu hoá an toàn các Endpoint "Reset link" cũ nếu có theo kế hoạch.
