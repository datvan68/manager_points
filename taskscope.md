# Task Scope: Khắc phục lỗi phiên làm việc kết thúc sớm

## Bối cảnh

Ứng dụng vẫn gặp tình trạng tự logout / báo `Phiên làm việc đã kết thúc` dù thời gian đăng nhập còn ngắn. Log thường gặp:

```text
[browser] Silent refresh failed (attempt 1/2): AuthApiError: Phiên làm việc đã kết thúc
at handleResponse (src/api/auth-api.ts)
at AuthProvider interval attemptRefresh (src/providers/auth-provider.tsx)
```

Điểm quan trọng: lỗi không xuất phát từ dòng `throw new AuthApiError(...)` ở frontend. Dòng đó chỉ ném lỗi vì backend trả HTTP 401/403. Root cause cần xử lý là vì sao request `POST /api/auth/refresh` không refresh được session.

## Kết luận hiện tại

Khả năng cao nhất: trình duyệt không gửi được cookie `refresh_token` khi silent refresh.

Các dấu hiệu trong repo:

- Frontend gọi refresh bằng `fetch(..., credentials: 'include')` trong `frontend/src/api/auth-api.ts`, đúng hướng.
- Backend đọc cookie ở `backend/src/auth/controllers/auth.controller.ts`:
  `req.cookies?.refresh_token`. Nếu không có cookie thì trả `UnauthorizedException('Phiên làm việc đã kết thúc')`.
- Backend đã đổi cookie local sang `secure=false`, `sameSite='lax'` khi không phải production hoặc `AUTH_COOKIE_SECURE=false`.
- Nhưng cấu hình dev hiện có nguy cơ lệch host:
  - `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8001`
  - `backend/.env`: `FRONTEND_URL=http://localhost:3000`
- Trên local HTTP, cookie `SameSite=Lax` chỉ ổn khi frontend và backend cùng site. `localhost` và `127.0.0.1` là khác site, nên trình duyệt có thể không gửi `refresh_token` trong request fetch/XHR.

## Mục tiêu sửa

Không để người dùng bị logout sớm khi refresh token còn hạn hợp lệ.

Sau khi hoàn thành:

- Login phải set được cookie `refresh_token`.
- Refresh request phải gửi kèm cookie `refresh_token`.
- Access token hết hạn 15 phút vẫn tự refresh được bằng refresh token.
- Lỗi mạng/server tạm thời không được xóa session ngay.
- Multi-tab không làm token rotation bị xem là token reuse bất hợp lệ.
- Test phản ánh đúng khác biệt giữa local HTTP và production HTTPS.

## Phạm vi cần thực hiện

### 1. Chuẩn hóa URL local/dev

Cần thống nhất host giữa frontend và backend trong môi trường local.

Khuyến nghị dùng một trong hai cặp sau, không trộn lẫn:

```env
# Option A - khuyến nghị
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8001
AUTH_COOKIE_SECURE=false
```

hoặc:

```env
# Option B
FRONTEND_URL=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
AUTH_COOKIE_SECURE=false
```

Việc cần làm:

- Cập nhật `.env.local` phía frontend và `.env` phía backend theo cùng host.
- Restart cả backend và frontend.
- Xóa cookie cũ trong browser cho cả `localhost` và `127.0.0.1`.
- Đăng nhập lại để backend set cookie mới.

### 2. Backend cookie policy

File chính: `backend/src/auth/controllers/auth.controller.ts`

Yêu cầu:

- Giữ helper cookie dùng chung cho login, refresh, logout.
- Local HTTP:
  - `secure: false`
  - `sameSite: 'lax'`
  - `httpOnly: true`
  - `path: '/api/auth'`
- Production HTTPS:
  - `secure: true`
  - `sameSite: 'none'`
  - `httpOnly: true`
  - `path: '/api/auth'`
- Cho phép override bằng `AUTH_COOKIE_SECURE=true|false`.
- Không set `domain=localhost`; để host-only cookie.
- `clearCookie` phải dùng cùng `path`, `secure`, `sameSite` với lúc set cookie.

Cần kiểm tra thêm:

- Nếu deploy sau reverse proxy HTTPS, backend đã có `trust proxy`; vẫn cần đảm bảo `FRONTEND_URL`/`CORS_ORIGINS` đúng origin thật.
- CORS production không được dùng wildcard khi `credentials: true`.

### 3. Frontend refresh flow

Files chính:

- `frontend/src/api/auth-api.ts`
- `frontend/src/api/http-client.ts`
- `frontend/src/providers/auth-provider.tsx`

Yêu cầu:

- Tất cả request refresh/login/logout phải có `credentials: 'include'`.
- Khi `auth/me` hoặc `students/me` trả 401, thử `synchronizedRefreshToken()` một lần trước khi clear session.
- Trong `loadUserPermissions`, case `students/me` 401 hiện đang clear token ngay. Cần đổi thành:
  1. thử refresh access token,
  2. gọi lại `students/me`,
  3. chỉ clear session nếu refresh trả 400/401/403 thật sự.
- Interval silent refresh không nên `logout()` ngay khi lỗi không phải auth failure, ví dụ timeout, network error, server 500.
- Khi refresh fail do tab khác timeout hoặc `REFRESH_FAILED`, tab hiện tại nên thử tự acquire lock/refresh lại trước khi kết luận session hết hạn.
- Chỉ broadcast `TOKEN_CLEARED` khi refresh bị backend xác nhận 400/401/403, không broadcast khi lỗi mạng/timeout.

### 4. Token rotation và multi-tab

Files chính:

- `frontend/src/api/http-client.ts`
- `backend/src/auth/services/token.service.ts`

Hiện backend có grace period 60 giây cho refresh token đã bị rotate. Cần giữ hoặc test rõ hành vi này.

Yêu cầu:

- Nếu hai tab refresh gần đồng thời, tab thứ hai không làm toàn bộ token user bị revoke nhầm.
- `synchronizedRefreshToken()` cần đảm bảo tab chờ không logout chỉ vì bỏ lỡ BroadcastChannel event.
- Nếu timeout chờ tab khác, thử tự refresh một lần rồi mới fail.

### 5. Test cần bổ sung/cập nhật

Backend:

- Cập nhật test cookie trong `backend/test/auth.e2e-spec.ts` và `backend/src/auth/test/auth-security.spec.ts`.
- Không còn assert cứng rằng cookie luôn `Secure` và `SameSite=None` trong mọi môi trường.
- Thêm test cho:
  - local/dev: `AUTH_COOKIE_SECURE=false` -> không `Secure`, `SameSite=Lax`.
  - production/secure: `AUTH_COOKIE_SECURE=true` hoặc `NODE_ENV=production` -> có `Secure`, `SameSite=None`.
  - `refresh` không có cookie -> 401 `Phiên làm việc đã kết thúc`.
  - `refresh` có cookie hợp lệ -> 200 và set cookie rotation mới.
  - refresh token đã rotate trong grace period -> vẫn trả token mới hợp lệ.

Frontend:

- Unit test hoặc integration test cho `synchronizedRefreshToken()`:
  - một tab refresh thành công, tab khác nhận token mới.
  - tab chờ timeout thì tự retry refresh thay vì logout ngay.
  - network error không clear local session.
  - auth failure 401 mới clear session.
- Test `AuthProvider.loadUserPermissions` với `students/me` 401: phải refresh trước khi clear session.

### 6. Checklist debug bằng browser

Sau khi sửa cấu hình và code, kiểm tra trong DevTools:

1. Login request `POST /api/auth/login`
   - Response có `Set-Cookie: refresh_token=...`.
   - Cookie không bị browser block.
   - Local HTTP cùng host: cookie nên là `HttpOnly; SameSite=Lax; Path=/api/auth` và không có `Secure`.

2. Application tab -> Cookies
   - Cookie nằm ở đúng host API đang gọi, ví dụ `localhost`, không lẫn `127.0.0.1`.

3. Refresh request `POST /api/auth/refresh`
   - Request Headers có `Cookie: refresh_token=...`.
   - Response 200 và trả `access_token`.
   - Response set lại cookie refresh token mới.

4. Backend log
   - Không còn log `[Auth/Refresh] Missing refresh_token cookie` sau khi login lại.
   - Nếu còn log này, kiểm tra lại host, SameSite, Secure, path, CORS credentials.

## Acceptance Criteria

- Đăng nhập xong chờ quá thời gian access token 15 phút vẫn không bị logout nếu refresh token còn hạn.
- User thường không tick remember vẫn giữ session khoảng 24 giờ.
- User tick remember giữ session khoảng 30 ngày.
- Admin giữ session khoảng 4 giờ theo logic hiện tại.
- Refresh hoạt động khi mở nhiều tab cùng lúc.
- Lỗi mạng/backend 500 không tự xóa user khỏi localStorage/sessionStorage.
- Chỉ logout khi backend xác nhận refresh token không hợp lệ, hết hạn, bị revoke, user bị khóa/inactive, hoặc người dùng chủ động logout.
- Backend build pass.
- Frontend lint/test liên quan pass.
- Không còn log silent refresh failed lặp lại trong trường hợp cookie hợp lệ.

## Thứ tự triển khai đề xuất

1. Chuẩn hóa `.env` local về cùng host, restart app, xóa cookie cũ, test lại refresh bằng DevTools.
2. Sửa frontend để không clear session ngay ở `students/me` 401 và cross-tab timeout.
3. Cập nhật backend tests theo cookie policy mới.
4. Bổ sung frontend tests cho refresh flow và AuthProvider.
5. Chạy build/test backend + frontend.
6. Test thủ công: login, chờ access token hết hạn, refresh, multi-tab, logout.

## Ghi chú rủi ro

- Không tăng `JWT_EXPIRE` để che lỗi. Access token 15 phút là hợp lý; lỗi nằm ở refresh flow/cookie/session handling.
- Không lưu refresh token vào localStorage vì tăng rủi ro XSS. Tiếp tục dùng HttpOnly cookie.
- Không dùng `SameSite=None` trên local HTTP trừ khi chạy HTTPS, vì trình duyệt yêu cầu `Secure` cho `SameSite=None`.
- Không clear toàn bộ session chỉ vì lỗi network hoặc timeout chờ tab khác.
