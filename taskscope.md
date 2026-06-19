# Taskscope: Loi "Phien lam viec da ket thuc" khi refresh token

## 1. Muc tieu

Kiem tra va xu ly loi frontend nem `AuthApiError` tai `frontend/src/api/auth-api.ts` khi goi API refresh token:

```ts
throw new AuthApiError(
  data.message || data.error || 'Da xay ra loi',
  res.status,
);
```

Thong diep nguoi dung gap: **"Phien lam viec da ket thuc"**.

## 2. Ket luan nhanh

Dong `throw new AuthApiError(...)` khong phai root cause. Day la diem frontend boc tach response loi tu backend va nem exception.

Root cause truc tiep nam o backend endpoint `POST /api/auth/refresh`: backend tra `401 Unauthorized` voi message **"Phien lam viec da ket thuc"** khi request khong co cookie `refresh_token`.

Kha nang cao nhat: browser khong luu hoac khong gui cookie `refresh_token` trong request refresh do cau hinh hostname/cookie/CORS khong dong nhat.

## 3. Bang chung da kiem tra

### Frontend

- `frontend/src/api/auth-api.ts`
  - `API_BASE` dang fallback ve `http://127.0.0.1:8001`.
  - `login()` co `credentials: 'include'` de nhan cookie.
  - `refreshToken()` co `credentials: 'include'` de gui cookie.
  - `handleResponse()` doc JSON va nem `AuthApiError` khi `res.ok === false`.
- `frontend/src/api/http-client.ts`
  - Khi API bat ky tra `401`, client goi `synchronizedRefreshToken()`.
  - Neu refresh fail voi `400/401/403`, client clear token va redirect `/login`.
- `frontend/src/providers/auth-provider.tsx`
  - Khi khong co access token trong `sessionStorage`, provider thu silent refresh.
  - Silent refresh fail voi `401` se clear token va coi user la chua dang nhap.

### Backend

- `backend/src/auth/controllers/auth.controller.ts`
  - Login set cookie `refresh_token` voi:
    - `httpOnly: true`
    - `secure: process.env.NODE_ENV === 'production'`
    - `sameSite: 'strict'`
    - `path: '/api/auth'`
  - Refresh doc cookie bang `req.cookies?.['refresh_token']`.
  - Neu khong co cookie thi nem `UnauthorizedException('Phien lam viec da ket thuc')`.
- `backend/src/main.ts`
  - Da bat `cookieParser()`.
  - Da bat CORS `credentials: true`.
  - Production yeu cau `FRONTEND_URL` hoac `CORS_ORIGINS`.

## 4. Gia thuyet root cause uu tien

### 4.1 Hostname khong dong nhat giua frontend va API

Frontend fallback API hien tai la `http://127.0.0.1:8001`, nhung nguoi dung thuong mo UI bang `http://localhost:3000`.

Cookie dang de `sameSite: 'strict'`. Neu UI dung `localhost` nhung API dung `127.0.0.1`, browser co the xem day la cross-site/cross-origin context va khong gui cookie refresh token trong request `/api/auth/refresh`.

He qua:

1. Login co the tra `access_token` thanh cong.
2. Refresh cookie co the khong duoc luu hoac khong duoc gui lai.
3. Khi access token mat/het han, frontend goi refresh.
4. Backend khong thay `refresh_token`.
5. Backend tra `401 "Phien lam viec da ket thuc"`.
6. Frontend nem `AuthApiError` tai `auth-api.ts:32`.

### 4.2 Cookie `SameSite=Strict` khong phu hop neu FE/BE khac site trong production

Neu production frontend va backend khac domain/subdomain, `sameSite: 'strict'` se rat de lam refresh cookie khong duoc gui. Truong hop can cross-site cookie thi phai thiet ke lai chinh sach cookie, thuong la:

- `sameSite: 'none'`
- `secure: true`
- HTTPS bat buoc
- CORS origin cu the, khong dung wildcard

### 4.3 Session cookie voi "Ghi nho dang nhap" tat

Khi `remember=false`, backend khong set `maxAge` cho cookie. Day la session cookie, se mat khi dong browser/tab tuy hanh vi trinh duyet. Neu user mo lai app sau khi browser session ket thuc, frontend con co user trong `localStorage` nhung khong con refresh cookie, silent refresh se fail.

## 5. Pham vi sua de xuat

### 5.1 Dong nhat API origin o development

Chon mot trong hai huong, uu tien huong A:

- Huong A: dung cung hostname `localhost`
  - Doi fallback `NEXT_PUBLIC_API_URL` ve `http://localhost:8001` neu UI chay o `http://localhost:3000`.
  - Dam bao tat ca API client dung chung helper build base URL, tranh file nay `localhost`, file kia `127.0.0.1`.
- Huong B: dung cung hostname `127.0.0.1`
  - Mo UI bang `http://127.0.0.1:3000`.
  - Giu API `http://127.0.0.1:8001`.

### 5.2 Tap trung hoa cau hinh API base URL

Tao helper chung, vi hien nhieu file frontend lap lai fallback:

- `frontend/src/api/auth-api.ts`
- `frontend/src/providers/auth-provider.tsx`
- Cac file `frontend/src/api/*-api.ts`

De xuat tao `frontend/src/api/config.ts`:

```ts
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001').replace(/\/api\/?$/, '');
export const API_BASE = `${API_ORIGIN}/api`;
```

Sau do auth dung `API_ORIGIN`, cac API resource dung `API_BASE`.

### 5.3 Dieu chinh cookie theo moi truong

Backend nen co helper cau hinh refresh cookie dung cho ca login, refresh va logout.

Pham vi can xem:

- `backend/src/auth/controllers/auth.controller.ts`

Goi y:

- Development same-site local: `sameSite: 'lax'` hoac giu `strict` neu dam bao cung hostname.
- Production cung domain: co the `lax`/`strict` tuy flow.
- Production cross-site: `sameSite: 'none'`, `secure: true`, bat buoc HTTPS va CORS origin cu the.

### 5.4 Cai thien error handling cua `auth-api.ts`

`handleResponse()` trong `auth-api.ts` dang goi `await res.json()` truc tiep. Neu backend tra body rong/html/text, code co the nem loi parse khac va che mat status that.

Nen dong bo voi `frontend/src/api/http-client.ts`: doc `res.text()`, parse JSON neu co, fallback message text.

### 5.5 UX khi refresh het phien

Neu refresh fail vi thieu cookie/het han:

- Clear `access_token` trong `sessionStorage`.
- Clear user trong `localStorage`.
- Redirect `/login`.
- Hien toast ro rang: "Phien dang nhap da het han, vui long dang nhap lai."
- Khong hien stack trace tu `AuthApiError` cho nguoi dung cuoi.

## 6. File du kien can sua

### Bat buoc

- `frontend/src/api/auth-api.ts`
- `frontend/src/api/http-client.ts`
- `frontend/src/providers/auth-provider.tsx`
- `backend/src/auth/controllers/auth.controller.ts`

### Nen sua de tranh lap lai loi

- `frontend/src/api/config.ts` (tao moi)
- Cac file `frontend/src/api/*-api.ts` dang tu build `API_BASE`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `README.md` hoac tai lieu setup local

### Test nen bo sung/cap nhat

- Backend e2e:
  - Login phai set cookie `refresh_token`.
  - Refresh khong co cookie tra `401` voi message dung.
  - Refresh co cookie hop le tra access token moi va rotate cookie.
- Frontend unit:
  - `authApi.refreshToken()` nem error co `status=401` va message backend.
  - `httpClient()` khi gap 401 chi redirect login sau khi refresh fail.
  - `handleResponse()` xu ly duoc JSON, text va empty body.

## 7. Cach verify thu cong

1. Mo app bang cung hostname voi API config, vi du:
   - UI: `http://localhost:3000`
   - API: `http://localhost:8001`
2. Dang nhap thanh cong.
3. Mo DevTools -> Application -> Cookies.
4. Kiem tra co cookie `refresh_token` o API origin.
5. Mo Network, goi/cho goi `POST /api/auth/refresh`.
6. Request phai co header `Cookie: refresh_token=...`.
7. Response refresh phai la `200` va co `access_token`.
8. Neu xoa cookie roi refresh, response dung la `401 "Phien lam viec da ket thuc"` va UI redirect login co thong bao than thien.

## 8. Tieu chi nghiem thu

- Khong con gap stack trace `AuthApiError` bat ngo khi access token can refresh trong cung mot phien dang nhap hop le.
- Refresh token cookie duoc luu sau login va duoc gui trong request `/api/auth/refresh`.
- API origin dung thong nhat, khong tron `localhost` va `127.0.0.1`.
- Khi refresh cookie that su mat/het han, UI xu ly nhu het phien: clear token, redirect login, hien thong bao ro rang.
- Production co cau hinh cookie/CORS phu hop voi domain deploy thuc te.
- Test backend/frontend lien quan refresh token pass.

## 9. Ngoai pham vi

- Doi co che xac thuc sang luu refresh token trong localStorage.
- Thay doi policy thoi gian song token ngoai yeu cau fix loi.
- Thay doi RBAC/permission.
- Sua cac API nghiep vu khac khong lien quan auth/session.

## 10. Ghi chu an toan

- Khong log gia tri `access_token`, `refresh_token` hoac noi dung cookie.
- Khong ghi token vao file log/taskscope.
- Khong thay doi `.env*` trong scope nay; chi cap nhat tai lieu bien moi truong neu can.
