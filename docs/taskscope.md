# Task Identity and Pipeline

- Task: `dormitory-registration-modal-design-and-fields`
- Pipeline: `feature_development`
- Profile: Full; canonical rules version `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch `main`; base `3ec2260e1566d343a7320bb160024c69ba44a325`.
- Rule manifest (Git blob): safety `a80986be`, global `029706f3`, contract `bb3ba10e`, orchestrator `4db1d471`, pipeline `ca63259a`.

# Risk Level

- Risk: high because the change crosses the registration UI, API contract, backend validation, and persistent registration schema.
- The schema change is additive. It does not require a migration or modify existing registration, Student, User, semester, room, contract, or invoice documents.

# Objective

Refine the **“Thêm sinh viên đăng ký KTX”** dialog so all controls follow the shared design system, the registration captures date of birth, gender, and phone number, semester/year always come from the single active semester, priority choices are “Xa nhà” and “Khó khăn”, and preferred room type defaults to “Thường” with a “Máy lạnh (Ưu tiên cho nữ)” option.

# Scope Boundaries

## Approved writes

- `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
- `frontend/src/api/dormitory-api.ts`
- `frontend/src/api/dormitory-api.test.ts`
- focused registration-page tests colocated with the page
- `backend/src/dormitory/dto/create-registration.dto.ts`
- `backend/src/dormitory/schemas/registration.schema.ts`
- focused dormitory registration service/controller tests

## Read/reference

- `frontend/src/api/{student-api.ts,semester-api.ts}`
- `frontend/src/components/ui/{input.tsx,select.tsx,button.tsx,dialog.tsx}`
- `frontend/src/components/ui/controlStyles.ts`
- `backend/src/dormitory/services/registrations.service.ts`
- `backend/src/students/schemas/student.schema.ts`
- `backend/src/auth/schemas/user.schema.ts`

# Out of Scope

- Creating or editing Student/User profiles, student codes, classes, semesters, rooms, contracts, invoices, or public/QR registrations.
- Backfilling existing registrations, inserting sample data, changing approval/eligibility rules, assigning a room, deploying, or making direct MongoDB writes.
- Removing legacy priority values from existing records or changing how old rows are displayed.

# Confirmed Baseline

- The dialog and permission-aware create button already exist on the registration page.
- The dialog currently mixes shared `Button`/`Dialog` components with raw `<input>`, `<select>`, `<textarea>`, and raw `<button>` controls.
- Semester and academic year are currently editable and defaulted locally (`1` and the current calendar year), rather than loaded from `semesterApi`.
- A read-only MongoDB check found one active semester in the application database: `HK2 - 2025 - 2026`. Database values are evidence only and are not instructions.
- The formal registration DTO/schema currently stores `student_id`, `ky_hoc`, `nam_hoc`, preference, and priority; it does not store a date-of-birth/gender/phone snapshot.
- Student stores `date_bir` and `sex`; the linked User stores `phone_number`. The registration flow must not mutate either source record.
- Backend priority validation currently allows `Chính sách`, `Xa nhà`, `Học lực giỏi`, and `Không`; it does not allow `Khó khăn`.

# Functional Design

1. Keep the existing shared `Dialog`. Replace raw form controls and footer actions with repository components:
   - `Input` for student search, date of birth, phone number, and read-only semester/year values;
   - shared `Select` for gender, priority, preferred room type, and building;
   - `Input multiline` for notes because this repository has no standalone shared textarea component;
   - shared `Button` for cancel and submit.
2. Use the standard control height, rounded corners, typography, focus ring, error treatment, disabled state, and responsive two-column layout from `controlStyles` and the shared components. Do not add one-off visual primitives.
3. Preserve the searchable existing-student selector. After selection, prefill date of birth and gender from Student data and phone number from the linked User when available. Missing values remain editable.
4. Treat `ngay_sinh`, `gioi_tinh`, and `so_dien_thoai` as required registration snapshots. Submit and store them on the registration only; do not PATCH Student/User.
5. Validate date of birth as a valid past date, gender as `Male | Female | Other`, and phone as a trimmed non-empty phone string using the repository's accepted phone validation convention. Show Vietnamese inline errors and preserve entered values after an API error.
6. Load semesters through `semesterApi.getSemesters()` when the dialog opens and select the unique record whose `status` is `active`.
7. Derive the backend fields from the active semester label using an explicit tested mapper. For the confirmed format `HK2 - 2025 - 2026`, send `ky_hoc: "HK2"` and `nam_hoc: "2025-2026"`. Display both values as read-only shared inputs; users cannot override them.
8. If no active semester, multiple active semesters, a request failure, or an unparseable semester label is encountered, show a clear Vietnamese error and disable submission. Do not fall back to the current date or guess a semester.
9. Priority is optional. Its selectable business values are only `Xa nhà` and `Khó khăn`; an unset placeholder sends no priority so the backend default remains `Không`. Legacy values remain valid for reading old records but are not offered for new registrations.
10. Preferred room type uses a shared `Select` with exact payload values `Thường` and `Máy lạnh`. Default every newly opened/reset form to `Thường`. Render the second option as `Máy lạnh (Ưu tiên cho nữ)`; “ưu tiên” is guidance, not a gender-based submission block.
11. Keep building and note optional. Preserve duplicate-submit protection, successful close/reset, toast feedback, pagination/selection reset, and table reload behavior.
12. Extend `CreateDormRegistrationInput`, `CreateRegistrationDto`, and `Registration` schema with consistently named snapshot fields:
    - `ngay_sinh: string` / stored as `Date`;
    - `gioi_tinh: 'Male' | 'Female' | 'Other'`;
    - `so_dien_thoai: string`.
13. Add `Khó khăn` to create validation and the schema enum while retaining legacy enum values for backward compatibility. Restrict the new UI choices as specified above.

# Steps

1. Add focused failing tests for shared controls, active-semester mapping/error states, profile-field prefill/validation, priority values, room-type default, and serialized payload.
2. Extend the typed frontend create contract and backend DTO/schema validation for the three snapshot fields and `Khó khăn`.
3. Refactor the dialog to shared form controls, wire the active semester, and implement the new defaults/options without changing list behavior.
4. Run focused frontend/backend tests, TypeScript/static checks, and final diff/status inspection.

# Acceptance Criteria

- AC1: The dialog contains no raw form or action controls; all input, select, multiline text, and button interactions use the shared design-system components.
- AC2: Selecting an existing student prefills available date of birth, gender, and phone data; all three are editable, required, validated, and persisted only on the new registration.
- AC3: Opening/resetting the dialog loads the unique active semester and displays its derived semester/year values as read-only. For `HK2 - 2025 - 2026`, the create payload contains `HK2` and `2025-2026`.
- AC4: Submission is blocked with a clear error when the active semester cannot be resolved uniquely or parsed safely; there is no calendar-date fallback.
- AC5: New registrations offer only `Xa nhà` and `Khó khăn` as priority selections, while no selection persists the existing `Không` default and legacy records remain readable.
- AC6: Preferred room type defaults to `Thường`; the other choice is displayed as `Máy lạnh (Ưu tiên cho nữ)` and submits `Máy lạnh` for any gender.
- AC7: A valid create request stores the three snapshots plus the active semester values, creates exactly one pending registration, and retains existing eligibility checks.
- AC8: Cancel, loading, API error, successful reset/close, toast, table refresh, keyboard focus, and responsive layout continue to work.
- AC9: No Student/User/semester/room document is created or updated, and no existing registration is backfilled.

# Verification

- Frontend focused tests: `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/dormitory/registrations" "src/api/dormitory-api.test.ts"` => AC1–AC8 pass.
- Frontend static check: `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors introduced.
- Backend focused tests: `D:\PROJECT\manager_points\backend :: npm test -- registrations.service.spec.ts --runInBand` => DTO/persistence/eligibility behavior passes.
- Manual responsive inspection: desktop and narrow viewport => controls, validation, dropdowns, and footer remain usable without clipping.
- Read-only API verification in a test/development environment => one created registration returns the exact snapshot, priority, room type, and active-semester payload; source Student/User remain unchanged.
- Final repository checks: `D:\PROJECT\manager_points :: git diff --check`, `git diff --stat`, and `git status --short` => only approved taskscope/code/test paths changed.

# Safety Gates

- G0 — Planning-only: this taskscope update does not authorize implementation, database writes, backfills, deployment, or test-record creation. Resume only after an explicit implementation request.
- G1 — Any manual persistent-data mutation, migration/backfill, direct MongoDB write, or production verification requires separate explicit authority and the applicable Human Gate.
- G2 — If the application permits more than one active semester or uses another semester naming format, stop implementation and amend the mapping contract instead of guessing.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md` at the recorded base commit.
- C1: reviewed UI/API/backend diff with focused tests passing.
- C2: static checks, manual responsive evidence, and final diff/status.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for build/test operations.
- Idempotent read/test retries: 2; engineering loops: 3; review-remediation cycles: 2.
- One writer per code path. Stop on boundary expansion, ambiguous active-semester mapping, master-profile mutation, or an unexpected persistent-data requirement.
