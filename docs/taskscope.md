# Task: public-dormitory-registration-qr

- Pipeline: `feature_development`
- Risk: high
- Profile: Full
- Repository: `D:\PROJECT\manager_points`
- Branch/base: `main` / `10c92dd8`

## Objective

Let any device scan the KTX QR code and open a public page that displays only the KTX registration modal, without authentication or access to the dashboard.

## Boundary

### Frontend writes

- `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`
- New public route and focused tests under `frontend/src/app/public/dormitory/register/`
- A shared KTX registration form component under `frontend/src/components/dormitory/` only if required to prevent duplicated form behavior
- `frontend/src/api/dormitory-api.ts`

### Backend writes

- `backend/src/dormitory/controllers/dormitory-qr.controller.ts` and its focused test
- `backend/src/dormitory/dto/public-register.dto.ts`
- `backend/src/dormitory/schemas/public-registration.schema.ts`
- `backend/src/dormitory/dormitory.module.ts` only if active-semester resolution requires the Semester model/service

### Reference only / exclusions

- Reference: the **“Phạm vi xuất file Excel”** surface, existing room QR implementation, `CustomCalendar`, and shared UI components.
- Exclude authentication changes, public room-page redesign, formal registration schema changes, student search/data exposure on the public page, new dependencies, migrations/backfills, direct MongoDB writes, and unrelated KTX behavior.

## Required changes

1. Add a permission-aware, accessible shared `Button` with the `QrCode` icon beside the create action in the registration menubar. It opens a QR dialog without changing the create form.
2. Generate a standards-compliant black-on-white QR using the installed `qrcode` package, quiet-zone margin, and error-correction level `H`. Encode the absolute same-origin URL `/public/dormitory/register`; show the URL and render errors in the QR dialog.
3. Create `/public/dormitory/register` as an unauthenticated route. It must render no dashboard shell, navigation, room details, login prompt, table, or other system content. On load it displays only a neutral page backdrop and the registration modal. Direct access and QR access behave identically on desktop and mobile.
4. Reuse the same visual language and field behavior as **“Thêm sinh viên đăng ký KTX”**, with the translucent blue gradient, white border, header/footer dividers, shared `Input`/`Select`/`Button`, and `CustomCalendar`. Do not expose the authenticated student lookup; use public inputs for full name and optional student code instead.
5. Public form fields: full name, optional student code, date of birth, gender, phone number, room type, and optional note. Do not show or submit priority object or building. Only `Female` enables room-type selection; every other gender forces and disables `Thường`.
6. Resolve the single active semester through a public-safe backend response or server-side submission logic; do not trust editable semester query parameters. Display its label beside the modal title. Block submission with clear feedback when no unique valid active semester exists.
7. Extend the unauthenticated public-registration contract to accept and validate the new general-registration fields without requiring `qr_room_id`. Preserve the existing room-specific QR registration contract and behavior. Persist public registrations with source `QR_SCAN`, pending status, no room/building, and the resolved active semester.
8. Keep duplicate-phone protection for pending public registrations. Return structured validation/duplicate/server errors; show inline feedback, prevent duplicate submits, and replace the form with a success state containing the public registration code after creation.
9. Public submissions must continue appearing in the admin registration list as source `PUBLIC`/QR and follow the existing unclassified/linking flow. No public endpoint may return student search results or privileged registration data.

## Verification

- Frontend focused tests: QR destination, QR dialog, public-only rendering, modal fields/style, female-only room type, loading/error/success states, payload, and duplicate-submit protection.
- Backend focused tests: unauthenticated general submission, DTO validation, active-semester resolution, duplicate phone, persisted source/status/fields, and unchanged room-specific QR behavior.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` and repository-native backend type/test commands => no introduced errors.
- Manual scan from a second unauthenticated device => only the public registration modal opens and a valid submission reaches the admin QR list.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => no unintended changes.

## Done

- Any device can scan the QR and immediately see only the public KTX registration modal without logging in.
- The submitted form follows the requested fields and room-gender rule and appears in the admin QR registration list.
- Existing authenticated create flow and room-specific public QR flow remain functional.
- Focused frontend/backend tests, static checks, manual responsive scan, and final diff checks pass.

## Gate

Planning-only: this taskscope authorizes no implementation or persistent-data mutation. Implementation requires a separate explicit request. End-to-end verification that creates a real public registration is a persistent-data write and requires the applicable Human Gate; automated verification must use mocks or an isolated test database unless separately approved.
