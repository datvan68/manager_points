# Task Scope: Fix PDF Export Unauthorized On Grading Page

## Target Area

- Page: `/grading`
- Preview modal: `frontend/src/components/grading/GradingPdfTemplate.tsx`
- API client: `frontend/src/api/summaries-point-api.ts`
- Shared auth fetch wrapper: `frontend/src/api/http-client.ts`
- Backend endpoint: `backend/src/summaries-point/summaries-point.controller.ts`

## User Report

Modal `Xem truoc ban in PDF` on `/grading` shows:

```txt
Loi khi tai PDF: Unauthorized
```

when using the PDF download/export action.

## Current Finding

- `SummariesPointController` has class-level `@UseGuards(JwtAuthGuard)`.
- Therefore `POST /api/summaries-points/export-pdf` requires a valid access token.
- `GradingPdfTemplate.handleDownloadPdf()` currently calls `fetch()` directly.
- That direct request only sends:
  - `Content-Type: application/json`
- It does not send:
  - `Authorization: Bearer <access_token>`
  - the shared `httpClient` refresh-token retry behavior
- Other `summaries-points` requests use `httpClient`, which automatically attaches the token from `tokenStorage.getAccessToken()`.
- Most likely root cause: PDF export bypasses the authenticated API client, so backend returns `401 Unauthorized`.

## Required Fix

1. Move PDF export request into the authenticated API layer.
2. Add a method such as `summariesPointApi.exportPdf(payload)` in `frontend/src/api/summaries-point-api.ts`.
3. The method must call `httpClient()` instead of raw `fetch()`.
4. Keep `Content-Type: application/json`.
5. Return a `Blob` when the response is successful.
6. Preserve refresh-token retry behavior from `httpClient`.
7. Update `GradingPdfTemplate.handleDownloadPdf()` to call the new API method.
8. Remove duplicated `API_BASE` construction from the component if the new API method owns the endpoint URL.
9. Keep backend `JwtAuthGuard`; do not make `export-pdf` public.
10. Keep the existing downloaded filename behavior:
    - one student: `phieu_diem_ren_luyen_<studentId>.pdf`
    - multiple students: `phieu_diem_ren_luyen_hang_loat.pdf`

## Error Handling Requirements

1. If response status is `401`, show a clear auth/session message instead of generic `Unauthorized`.
2. If backend returns JSON error, display `message` or `error`.
3. If backend returns plain text error, display that text.
4. If backend returns PDF successfully, parse it with `response.blob()`.
5. Avoid calling `response.json()` blindly for all error cases because PDF success response is binary.
6. Keep existing loading/progress toast behavior.
7. Always clear the progress interval and reset `isDownloading` in `finally`.

## Suggested Implementation Shape

```ts
async exportPdf(payload: ExportPdfPayload): Promise<Blob> {
  const res = await httpClient(`${API_BASE}/summaries-points/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || 'Khong the ket xuat PDF tu Server';
    try {
      const data = text ? JSON.parse(text) : {};
      message = data.message || data.error || message;
    } catch {
      // Keep plain text message.
    }
    throw new Error(message);
  }

  return res.blob();
}
```

## UI/UX Notes

- Modal title `Xem truoc ban in PDF` should remain unchanged.
- Button `Tai xuong PDF` should keep disabled/loading state while exporting.
- If token refresh fails, redirect/session-expired behavior should be handled by `httpClient`.
- Show toast wording friendly to the user, for example:
  - `Phien dang nhap da het han, vui long dang nhap lai.`
  - `Khong the xuat PDF, vui long thu lai.`

## Safety Rules

- Do not expose PDF export without authentication.
- Do not put token values into logs, toast, console, or task output.
- Do not pass tokens through URL query params.
- Do not change PDF payload shape unless required by backend.
- Do not change score calculation or selected student data while fixing auth.
- Do not break browser print action `In / Luu PDF`.

## Acceptance Criteria

- Opening `Xem truoc ban in PDF` still works.
- Clicking `Tai xuong PDF` sends `Authorization: Bearer <token>`.
- Authenticated user can download PDF successfully.
- Expired access token is refreshed through existing `httpClient` logic before retrying the PDF request.
- If the session is invalid, the user sees a session-related message instead of raw `Unauthorized`.
- Backend endpoint remains protected by `JwtAuthGuard`.
- Existing preview layout, config panel, and print action still work.

## Suggested Verification

- Manual test PDF download with a valid logged-in user.
- Manual test PDF download after access token expiry but with valid refresh cookie/session.
- Manual test after logout/session invalidation.
- Confirm browser Network tab includes `Authorization` header on `POST /api/summaries-points/export-pdf`.
- Confirm downloaded file opens as a valid PDF.
- Run relevant frontend checks/tests if available.
