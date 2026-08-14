# Task Identity and Pipeline

- Task: `remove-overview-approval-ui-and-classify-unclassified-students`; pipeline: `feature_development`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; planning date: `2026-08-14`.

# Risk Level

- Risk: high. The work spans dormitory and student modules and introduces identity merging during individual creation and bulk import.
- Source changes are Git-revertible. No deployment, schema migration, production-data rewrite, or destructive verification is authorized by this planning task.

# Objective

Remove approval-oriented content from the dormitory Overview, make the Unclassified page behave like a normal class student table, and allow individual creation or Excel import to convert an unclassified dormitory registration into a classified student without duplicating the person or losing dormitory information.

# Scope Boundaries

- Dormitory Overview UI and tests: `frontend/src/app/(dashboard)/dormitory/overview/page.tsx` and `page.test.tsx`.
- Normal-class and Unclassified student list UI, navigation state, and focused tests: `frontend/src/app/(dashboard)/students/[classId]/page.tsx`, `frontend/src/app/(dashboard)/students/unclassified/page.tsx`, and tests beside the changed pages.
- Individual student modal, import preview/result UI, and focused tests: `frontend/src/components/popups/StudentPopup.tsx`, `ImportStudentPopup.tsx`, `ImportResultPopup.tsx`, and colocated tests.
- Typed clients and tests: `frontend/src/api/student-api.ts`, `frontend/src/api/dormitory-api.ts`, and their focused test files.
- Student create/import endpoints, DTOs, merge orchestration, and tests: `backend/src/students/students.controller.ts`, `students.service.ts`, `students.module.ts`, `dto/create-student.dto.ts`, `dto/import-student.dto.ts`, and `test/students.service.spec.ts`.
- Explicit unclassified lookup/linking behavior and focused tests: `backend/src/dormitory/controllers/registrations.controller.ts`, `services/registrations.service.ts`, `services/public-registration-link.service.ts`, `dormitory.module.ts`, and directly related specs. Schema changes are excluded unless implementation evidence proves an idempotency field or index is necessary; that requires a scope amendment before writing it.

# Out of Scope

- Reintroducing registration approval/rejection, changing room assignment, altering invoices/contracts, redesigning unrelated dormitory tabs, changing the Excel template columns, account activation, training-point creation rules, schema migration, historical bulk cleanup, deployment, or running merges against real user data.
- Fuzzy or accent-insensitive identity merging, name-only matching, silent automatic merging when multiple candidates exist, deleting the source registration, or overwriting dormitory room/bed/preference/contact information with blank import fields.

# Context and Dependencies

- The Overview still renders `Xét duyệt đơn`, `Đơn chờ duyệt`, approval wording in activity/quick-link cards, and tests around `pending_registrations`, although registration approval is no longer part of the intended workflow.
- `/students/unclassified` reads unlinked `PublicRegistration` records. It already uses `ResponsiveDataView`, but its columns and available interactions differ from the normal class table.
- `StudentPopup` currently uses a plain text input for `fullName` and sends a normal `POST /students`; it does not retain the selected unclassified registration identity.
- `StudentsService.importPreview` currently validates student-code duplicates and stores valid rows in an in-memory import session. `importConfirm` inserts new students asynchronously, but preview/confirm contracts have no merge decisions.
- Unclassified records have `full_name`, `date_of_birth`, gender/contact/dormitory information and link fields. Formal `Student` records use `full_name`, `date_bir`, `student_code`, and `class_id`. Existing `PublicRegistrationLinkService` links primarily by student code/email and must gain an explicit source-record link path for records whose student code is blank.
- Matching for this feature is deterministic: normalize Unicode text, trim and collapse whitespace, compare names case-insensitively, and compare the calendar date exactly. Do not strip accents or use partial/fuzzy matching. Zero matches means create normally; one match may be proposed for merge; multiple matches are ambiguous and require an explicit user selection for individual creation and remain unresolved during import.

# Steps

1. Add regression coverage for approval-free Overview content, normal-class-equivalent Unclassified table states/actions, creatable student selection, deterministic match handling, idempotent linking, and import preview/confirm merge decisions.
2. Remove approval-specific Overview calculations, icons, labels, calls to action, activity wording, and KPI cards. Keep a neutral `Đăng ký KTX` navigation entry if useful, labelled as registration management rather than approval, and preserve the requested room/bed/student/fee/utility/monthly-trend dashboard content.
3. Align `/students/unclassified` with the normal class page container, header, search, responsive table/mobile cards, loading/empty/error states, pagination or infinite loading, selection behavior, and permission-aware actions. Use the same column names/order where the underlying data permits: `MÃ SV`, `HỌ VÀ TÊN`, `NGÀY SINH`, `GIỚI TÍNH`, `ĐRL`, `TRẠNG THÁI`, `TÀI KHOẢN`, and `HÀNH ĐỘNG`. Render `MÃ SV` as empty/`—`, `ĐRL` as `N/A`, status as `Chưa phân loại`, and account as `Chưa active`; never fabricate values.
4. Map Unclassified actions to registration semantics: view supported details, edit supported registration fields, delete only through the existing permission/confirmation policy, and open the classification flow. Do not call student detail/update/delete/account endpoints until a real `Student` exists. Preserve URL/search/scroll state and refresh the row in place after mutation.
5. Replace the create-mode `Họ và tên` input in `StudentPopup` with a searchable creatable combobox built from the paginated Unclassified API. Users can select an existing unclassified person or type a new name. Selecting a person stores its source registration ID and fills supported profile fields such as date of birth, gender, email, and phone without overriding the target class/student code; users can clear the selection and return to manual entry. Edit mode remains the existing student form.
6. Add a dedicated, permission-checked create-from-unclassified contract. Validate the source record is still unlinked, re-read it server-side, create the student with the supplied unique student code and target class, explicitly link/convert the selected registration, and return the created student. Make retries idempotent and ensure partial failure cannot leave two students or two formal registrations for one source; use a transaction where supported or a documented compensating/idempotent sequence otherwise.
7. Extend import preview to search unlinked candidates using the deterministic name-and-birth-date rule. Return row-level outcomes for `CREATE`, `MERGE_CANDIDATE`, `AMBIGUOUS`, and `INVALID`, including the source registration ID and safe display fields only. Update the preview UI to show merge candidates separately and let the user include/exclude each proposed merge before confirmation; ambiguous rows cannot be committed as merges.
8. Extend import confirmation/session data with server-validated merge decisions. For an accepted unique candidate, create the Student and link/convert that exact unclassified registration while preserving dormitory data; for declined/no-match rows, create normally; for stale/already-linked/ambiguous candidates, skip the row with an actionable result instead of creating a duplicate. Report created, merged, skipped, duplicate, and failed counts accurately in progress and result UI.
9. Reuse one backend linking implementation for individual and import flows. Preserve source registration audit/link fields, room/bed/preference/contact data, and existing formal-registration uniqueness rules. Remove the record from Unclassified results only after a successful link and ensure it appears in the target class after refresh.
10. Run focused frontend/backend tests, type/build checks, approval-copy searches, final diff inspection, and status review.

# Acceptance Criteria

- AC1: The Overview contains no approval/rejection action, `Xét duyệt`, `chờ duyệt`, approval badge, or approval-oriented activity copy. Its non-approval KPIs, monthly comparison, navigation, loading, error, and responsive states continue to work.
- AC2: Unclassified uses the normal class page's table/card structure, column names, search, loading/empty/error handling, pagination/infinite loading, row selection, and responsive behavior. Unsupported fields show honest empty values rather than fabricated data.
- AC3: Unclassified row actions obey permissions and operate on the registration contract. No student-only API receives a public-registration ID.
- AC4: In create mode, `Họ và tên` is a searchable creatable selector. It supports loading more candidates, selecting one candidate, clearing it, and entering a completely new name manually. Existing student edit behavior is unchanged.
- AC5: Selecting an unclassified person fills supported profile information, while the entered student code and target class remain authoritative. Submission creates exactly one Student and links exactly the selected source registration.
- AC6: A successful individual merge removes the source row from Unclassified, shows the Student in the target class, preserves dormitory registration/room/bed/preference data, and does not duplicate formal registrations. Cancel or validation failure makes no persistent change.
- AC7: Import preview proposes a merge only for exactly one deterministic full-name plus birth-date match, labels ambiguous matches separately, and requires visible user confirmation of proposed merges before commit.
- AC8: Import commit revalidates candidates and decisions server-side. Accepted matches are merged, declined/no-match rows are created normally, and stale, linked, ambiguous, duplicate-code, or invalid rows are skipped/reported without silently creating duplicate people.
- AC9: Import progress and result UI distinguish `created`, `merged`, `skipped`, `duplicated`, and `failed`; totals reconcile with processed rows and a retry does not repeat a completed merge.
- AC10: Manual and import paths use the same linking rules and permissions, and no source registration is deleted as part of classification.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/overview/page.test.tsx" "src/app/(dashboard)/students/unclassified/page.test.tsx" "src/components/popups/StudentPopup.test.tsx" "src/components/popups/ImportStudentPopup.test.tsx" src/api/student-api.test.ts src/api/dormitory-api.test.ts` => AC1-AC5 and AC7-AC9 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => changed pages, popups, and API contracts compile.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand students/test/students.service.spec.ts dormitory/services/registrations.service.spec.ts dormitory/services/public-registration-link.service.spec.ts dormitory/controllers/registrations.controller.spec.ts` => deterministic matching, authorization, idempotency, stale/ambiguous handling, preservation, and result counters pass. Create the focused link-service spec if absent.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS modules and extended DTOs compile without circular dependency errors.
- Repository root :: `rg -n -i "xét duyệt|chờ duyệt|approval|pending_registrations" "frontend/src/app/(dashboard)/dormitory/overview"` => no approval-oriented Overview runtime copy or obsolete test expectation remains.
- Repository root :: `git diff --check` and `git status --short` => only scoped changes exist and unrelated user work is preserved.

# Safety Gates

- Development implementation with mocks/test databases requires no additional gate. Tests must not call merge, delete, or import endpoints against persistent user data.
- Any schema/index migration, historical-data merge, production execution, deployment, or live-data repair requires a scope amendment and explicit approval before execution.

# Artifacts and Checkpoints

- Record fixtures for: zero/one/multiple matches, accents and whitespace, same name with different birth dates, stale link, existing formal registration, duplicate student code, partial link failure, retry, declined merge, pagination, and permission denial.
- Checkpoint after the backend individual merge is idempotent and tested; checkpoint again after import preview/confirm counters reconcile before wiring final UI refreshes.
- Stop for evidence that transactions are mandatory but unavailable, a safe compensating sequence cannot be guaranteed, public registrations lack a reliable birth date, permissions cannot authorize classification without broadening access, or unrelated edits conflict in scoped paths.

# Execution Budgets

- Order: regression baseline -> shared matching/linking contract -> individual classify flow -> import preview/commit flow -> Unclassified table alignment -> Overview cleanup -> affected verification -> final review.
- One writer per path; step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
