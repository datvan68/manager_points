# Task: dormitory-registration-existing-or-temporary

- Pipeline: `feature_development`
- Risk: high
- Profile: Full
- Repository: `D:\PROJECT\manager_points`
- Base: current working tree

## Objective

Adjust **“Thêm sinh viên đăng ký KTX”** so the generic message `Vui lòng chọn sinh viên và chờ học kỳ active được tải thành công.` no longer blocks valid input. The modal must support exactly two save paths:

1. An existing student with a class is selected from search: create a formal KTX registration linked by `student_id`.
2. The person has neither student code nor class: save only a temporary, unclassified registration for later reconciliation; do not create a Student, class membership, formal registration, contract, or room assignment.

## Boundary

### Frontend writes

- `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`
- `frontend/src/api/dormitory-api.ts`
- `frontend/src/api/dormitory-api.test.ts` only when the new request contract needs focused coverage

### Backend writes

- `backend/src/dormitory/controllers/registrations.controller.ts`
- `backend/src/dormitory/dto/` for a focused authenticated temporary-registration DTO
- `backend/src/dormitory/services/registrations.service.ts`
- Focused controller/service specs under `backend/src/dormitory/`
- `backend/src/dormitory/schemas/public-registration.schema.ts` only if an explicit admin-temporary source value cannot be persisted with the current schema

### Reference only / exclusions

- Reuse the existing `PublicRegistration` collection as temporary storage and the existing unclassified-list flow.
- Preserve the public QR registration route, active-semester source, modal design, requested fields, female-only room-type behavior, formal approval rules, and student/class data.
- Exclude creating/updating Student or Class documents, assigning a class/code automatically, migrations/backfills, contracts, rooms, deployment, and direct MongoDB writes.
- A partially classified case (for example, student code exists but class is absent) is outside this change unless already represented by a selected Student record; do not silently convert it into the no-code/no-class temporary path.

## Required changes

1. Replace the single combined precondition/error with independent state and messages:
   - while the active semester is loading, disable submission and show the existing loading state;
   - when active-semester resolution fails, show the specific semester error;
   - when neither an existing student nor a valid temporary profile is supplied, ask the user to select a search result or enter the required temporary information;
   - never show `Vui lòng chọn sinh viên và chờ học kỳ active được tải thành công.` for a valid temporary profile.
2. Keep student search as the primary path. Selecting a student with `student_code` and `class_id` fills the current personal fields and submits the existing formal payload to `POST /dormitory/registrations`.
3. Provide an explicit **temporary/unclassified** mode when no search result is selected. In this mode:
   - treat the entered text as the required full name;
   - do not request or synthesize `student_id`, student code, or class;
   - require the existing personal fields (date of birth, gender, phone) and apply the current room-type/note rules;
   - display a concise notice that the record will be saved temporarily and classified later.
4. Mode transitions must be deterministic: selecting a search result enters formal mode; editing/clearing that selection returns to search/manual input without retaining a stale `student_id`; reset all mode-specific state after close or successful save.
5. Add a permission-protected authenticated endpoint for temporary admin entry. Validate full name, date of birth, gender, phone, room type, note, and active semester server-side. Ignore client-supplied student/class identifiers and derive the active semester on the server.
6. Save temporary entries in `PublicRegistration` with empty `ma_sinh_vien`, no linked student/registration, pending status, no room/building, and an explicit admin-temporary origin such as `ADMIN_ENTRY`. Apply the existing pending duplicate-phone protection and generate the normal temporary registration code.
7. Normalize/display the saved row as unclassified in the registration table and **“Chưa phân loại / chưa phân lớp”** flow. Distinguish admin temporary entries from QR entries in the source label/filter so they are not falsely presented as QR submissions.
8. Return and display precise duplicate, validation, semester, and server errors. Prevent repeated submissions while saving. On success, close/reset the modal, show the appropriate success toast, and refresh the table.
9. Preserve existing behavior for formal registrations, QR registrations, sorting, pagination, approval restrictions, and linking temporary records after a Student is later created.

## Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run 'src/app/(dashboard)/dormitory/registrations/page.test.tsx' 'src/api/dormitory-api.test.ts'` => covers mode selection, stale-selection clearing, separate semester errors, formal payload, temporary payload, duplicate-submit prevention, and success/reset behavior.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand dormitory/controllers/registrations.controller.spec.ts dormitory/services/registrations.service.spec.ts` => covers permission protection, server-derived active semester, temporary persistence shape/source, duplicate phone, validation, and unchanged formal creation.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no introduced TypeScript errors.
- `D:\PROJECT\manager_points\backend :: npm run build` => NestJS build passes.
- Manual mocked/isolated verification:
  - selected student with code and class creates one formal registration;
  - no-code/no-class profile creates one temporary unclassified entry and no Student/Class/formal registration;
  - active-semester loading/error states are specific and neither valid path shows the removed generic message;
  - admin temporary source is not labeled QR.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => only intended changes and no whitespace errors.

## Done

- Both specified paths save to their correct storage model and appear correctly in the KTX registration list.
- A temporary entry cannot create or mutate student/class data and remains available in the unclassified workflow.
- The generic combined warning is removed from valid flows and replaced by actionable validation feedback.
- Focused frontend/backend tests, frontend typecheck, backend build, and final diff checks pass.

## Gate

Planning-only: this taskscope authorizes no implementation or persistent-data mutation. Implementation requires a separate explicit request. Automated tests must use mocks or an isolated test database. Any verification against the connected MongoDB that creates or changes records requires explicit persistent-data authority and the applicable Human Gate.
