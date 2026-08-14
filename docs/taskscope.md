# Task Identity and Pipeline

- Task: `extend-dormitory-student-profile-and-application-pdf`; pipeline: `feature_development`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `2f30963dd15e737aa748cc777c25714faf20b2d3`; planning date: `2026-08-14`; environment: development.
- Planning-only authority: this file defines the implementation scope and does not authorize implementation, migration, deployment, or live-data mutation.
- Effective Rules Manifest (SHA-256): `safety.md` `6A3F283B835394B1AF1F6380D94CBA260ACBED8A60D3065DD5365BB15806A772`; `global.md` `67806F70A5F89ADF42E3BE88413CC76CC27A02C90FAD0609AE71DE34D046A43F`; operating contract `51F3677C7E44121529CC0A4B17E5667BCBD2147EE63C6F30207C10D5DEB51790`; orchestrator `B782109E896B2FA48A6523358A788A9DB9B81B72F3D8FC66F70019395738D716`; pipeline `0419C072380887F96B37FE4EB48DAE764306F46FB03190B176A43EBCEA3F41F3`.

# Risk Level

- Risk: high. The feature spans student identity, dormitory persistence, authorization, public-to-formal registration conversion, profile UI, and server-generated PDF containing personal data.
- Source changes are Git-revertible. New optional MongoDB fields are additive, but a historical backfill, index change, or production rollout is a persistent-data/schema action and requires the gate below.
- Blast radius is limited to student/KTX profile and registration flows. Existing room assignment, contract, billing, violation, maintenance, authentication, and unrelated student behavior must remain unchanged.

# Objective

Capture every student-provided field in the supplied dormitory application, expose a secure editable KTX section on the personal profile of a student who has registered, and let authorized users preview and export an A4 PDF that is populated from canonical server data and matches `D:\WORK - OFF\KTX\ĐƠN XIN VÀO KÝ TÚC XÁ (MỚI).docx`.

# Scope Boundaries

- Backend registration data and validation: `backend/src/dormitory/schemas/registration.schema.ts`, `public-registration.schema.ts`, `dto/create-registration.dto.ts`, `update-registration.dto.ts`, `public-register.dto.ts`, plus a new shared nested DTO/schema for applicant and parent information if that avoids duplication.
- Backend self-service, conversion, PDF generation, and tests: `backend/src/dormitory/controllers/registrations.controller.ts`, `services/registrations.service.ts`, `services/public-registration-link.service.ts`, `dormitory.module.ts`, existing focused specs, and new KTX application PDF template/service/spec files under `backend/src/dormitory/**`.
- Student lookup used by self-service: `backend/src/students/students.service.ts` and focused student tests only if the existing user-to-student lookup cannot be reused without change.
- Frontend typed API and tests: `frontend/src/api/dormitory-api.ts` and `dormitory-api.test.ts`.
- Personal profile: `frontend/src/app/(dashboard)/profile/page.tsx`, a new focused `frontend/src/components/profile/StudentDormitorySection.tsx` (or equivalent owned component), and focused tests. `normalize-profile.ts` changes only if required by the chosen fetch composition.
- KTX registration page and public form consistency: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, its test, `frontend/src/components/dormitory/PublicDormitoryRegistrationModal.tsx`, and its test.
- Supplied-form field inventory, stored as English `snake_case` under an applicant subdocument while preserving current top-level fields:
  - canonical read-only student values: full name, date of birth, gender, student code, class, and faculty/department;
  - current registration values: phone number, semester, academic year, room/building preference, room type, notes, priority group, registration status, assigned room/bed, and active-contract dates where available;
  - new student-editable application values: ethnicity, religion, citizen ID number, citizen ID issue date, citizen ID issue place, permanent address, father full name/age/permanent address/contact address/occupation/phone number, mother full name/age/permanent address/contact address/occupation/phone number, and priority-certificate details.
- PDF output: national header, title, recipient, all supplied-form fields, commitment paragraph, parent/guardian signature block for students under 18, applicant signature block, A4 portrait size, and margins matching the sample (top/right/bottom 20 mm; left 30 mm).

# Out of Scope

- Editing the supplied DOCX; uploading/scanning certificates; electronic or handwritten signature capture; approval workflow redesign; bulk PDF export; email delivery; PDF archival; multilingual templates; OCR; payment; room transfer/assignment changes; contract creation; billing; violations; maintenance; or redesigning unrelated profile/KTX pages.
- Allowing students to edit student identity keys, class/faculty, registration code, student ID, status/review metadata, rejection reason, assigned room/bed, contract dates/status, or other administrator-controlled fields.
- Adding parent/application fields directly to the global `Student` schema unless implementation evidence proves they are used outside KTX; otherwise they remain owned by the dormitory registration.
- Historical data cleanup/backfill, MongoDB index migration, deployment, production execution, or dependency upgrades. Existing incomplete records use nullable fields and progressive completion unless a separately approved migration is required.

# Context and Dependencies

- The DOCX structurally contains: full name; birth date; gender; class; faculty; ethnicity; religion; phone; citizen ID/date/place of issue; permanent address; complete father and mother contact/occupation blocks; priority certificates; commitment text; and two signature blocks. It contains no embedded images, headers, or footers. LibreOffice is unavailable in the current environment, so visual render QA of the source was not completed; structure and page geometry were inspected directly.
- `Registration` currently stores student/room/bed, semester/year, birth date, gender, phone, preference, priority, and review state. `PublicRegistration` additionally stores name/email/student code and link fields, but neither schema contains the new application/parent fields.
- `PublicRegistrationLinkService` has multiple public-to-formal conversion paths. Some paths currently omit birth date, gender, and phone; every conversion path must use one shared mapper and preserve all legacy and new form fields.
- The profile page currently reads `auth/me` and updates only user name, phone, and birth date. `studentApi.getMyStudent()` exists, but no self-scoped dormitory registration endpoint exists. Admin list/detail endpoints must not be exposed to students.
- The server already uses Puppeteer for another PDF flow. Reuse the installed dependency and its safe browser lifecycle; do not add a client-side PDF dependency. The preview must display the exact server-generated PDF blob that is later downloaded, avoiding separate preview/export templates.
- Self-service current-record selection is deterministic: active contract first; otherwise the newest non-rejected/non-cancelled formal registration; otherwise the newest historical formal registration. `has_dormitory_registration` is true when any formal registration is linked to the authenticated student. Historical/final records remain visible but are read-only.
- Student-editable fields are the student-provided application/contact/parent fields and, before assignment/active contract, room preference, notes, and priority details. Administrative state, assignment, and contract fields are always read-only. All writes are allow-listed and re-resolve the student from `req.user.userId`; client-supplied `student_id` is never trusted.

# Steps

1. Add regression fixtures and contract tests for the full field inventory, old records with missing fields, self authorization, editable-field allow-list, registration selection, conversion preservation, preview/download headers, Vietnamese glyphs, and A4 output.
2. Define one reusable applicant profile shape and nested validators. Add optional fields to formal and public registration storage without changing current field names or enum values. Normalize strings, validate dates/phone/age/ID length, reject future dates and unknown keys, and keep missing legacy fields nullable.
3. Extend create, update, temporary/public registration DTOs and the existing admin/public forms so all entry points can capture the same student-provided fields. Preserve canonical name/student/class/faculty data from Student when a linked student exists.
4. Replace every public-to-formal conversion object with a shared mapping function that copies birth date, gender, phone, preference, priority, room/bed references, and the complete applicant profile. Add idempotency and no-data-loss tests for auto-link, check/link, and manual link flows.
5. Add authenticated, route-order-safe self endpoints before `:id`: `GET /dormitory/registrations/me` for the selected current record plus history/status/assignment summary, and `PATCH /dormitory/registrations/me` for allow-listed student fields. Enforce the authenticated user-to-student link and reject arbitrary IDs, privileged fields, unlinked users, and updates to final historical records.
6. Build the profile KTX section. Fetch student and self-registration data only for Student users; hide the section when no formal registration exists; show loading/error/empty states; render all application and KTX fields; allow editing only where the API reports `editable_fields`; preserve unsaved values on validation failure; and refresh from the server after save.
7. Build a dedicated server PDF view model from canonical populated Student, Class, Department, Registration, Contract, Room, Bed, and applicant-profile data. Escape all values before HTML interpolation, embed a Vietnamese-capable font available to the runtime, render A4 with the sample margins/layout, leave signature areas blank, and never log form values.
8. Add an authorized PDF endpoint for a registration selected on the KTX registration page. It must load data by registration ID server-side, enforce the existing registration-view permission, return `application/pdf`, and support safe `inline` preview and `attachment` download filenames without accepting rendered personal fields from the client.
9. Add `Xem trước đơn` and `Xuất PDF` actions to the existing KTX registration page. The preview modal creates and revokes a blob URL, displays the same generated PDF, handles loading/error/retry/close, and downloads the same bytes with a sanitized filename. Disable the actions with an actionable message when mandatory data is incomplete.
10. Run focused tests, backend build, frontend typecheck, final diff/status review, and a manual render comparison of representative adult/under-18/long-text/Vietnamese records against the supplied DOCX.

# Acceptance Criteria

- AC1: Formal and public registrations accept, return, and preserve every field enumerated in Scope Boundaries; legacy records with absent new fields still load and can be completed without migration.
- AC2: All public-to-formal conversion paths produce the same mapped result and do not drop existing birth date, gender, phone, room/bed, preference, priority, notes, or new applicant/parent data.
- AC3: A Student with any linked formal registration sees a KTX section on the personal profile; a Student without one and non-Student roles do not. Current/historical selection follows the documented deterministic rule.
- AC4: The KTX section displays all student-provided fields and current KTX status/assignment information. Student-editable fields save and reload correctly; administrative fields are read-only in UI and rejected by the API if submitted.
- AC5: Self endpoints return only the authenticated student's records, reject unlinked/non-Student users, ignore no privileged field silently, and never accept a client-selected `student_id`.
- AC6: Existing admin and public registration forms expose the new fields with consistent labels, validation, nullable behavior, and responsive/loading/error states; existing registration behavior remains functional.
- AC7: `Xem trước đơn` displays the exact PDF bytes produced for export, supports close/retry without leaking blob URLs, and never sends canonical personal values back to the server for rendering.
- AC8: The downloaded file is a non-empty valid PDF with `application/pdf`, a sanitized deterministic filename, A4 portrait geometry, sample margins, Vietnamese text, all populated values, commitment text, and the correct parent/applicant signature blocks.
- AC9: Long names/addresses/occupations/certificate text wrap without clipping, overlap, missing glyphs, or accidental extra blank pages. Empty optional values render as blank lines/placeholders rather than `undefined`, `null`, or fabricated data.
- AC10: Unauthorized registration IDs return the repository-standard forbidden/not-found response without revealing whether another student's record exists. PDF and API logs contain no raw citizen ID, address, phone, or parent information.
- AC11: No room assignment, contract, billing, review status, or global Student identity behavior changes outside this scope, and the final diff contains no unrelated edits.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/registrations.service.spec.ts dormitory/controllers/registrations.controller.spec.ts dormitory/services/room-assignment.service.spec.ts students/test/students.service.spec.ts` plus new focused link/PDF specs => AC1-AC5, AC8, and AC10 pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS DTOs, schemas, controller ordering, providers, and Puppeteer service compile without circular dependencies.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run src/api/dormitory-api.test.ts "src/app/(dashboard)/dormitory/registrations/page.test.tsx" src/components/dormitory/PublicDormitoryRegistrationModal.test.tsx "src/app/(dashboard)/profile/_lib/normalize-profile.test.ts"` plus new profile KTX tests => AC3, AC4, AC6, and AC7 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => all changed API, profile, form, modal, and blob-lifecycle contracts compile.
- Manual PDF QA in a development/test database :: create fixtures for adult, under-18, missing optional values, and maximum practical Vietnamese text; preview/download each PDF; inspect every rendered page at 100%; compare header, field order, commitment, margins, wrapping, and signature blocks with the supplied DOCX => AC8 and AC9 pass.
- Repository root :: `git diff --check` and `git status --short` => only approved paths changed; no malformed whitespace or unrelated user changes.

# Safety Gates

- Gate G1 — required before any historical backfill, index/schema migration, staging/production database change, or deployment. Review artifact: dry-run counts with no personal values, affected collections/fields, backup reference, rollback procedure, environment, and exact command. Approval: explicit user authorization for that environment. Rollback: restore backup or run the separately reviewed idempotent rollback. Resume point: after G1 approval and immediately before the first persistent mutation.
- Normal implementation and tests against mocks/ephemeral development databases need no additional gate. Tests and manual QA must use synthetic personal data only.
- Stop and amend scope if implementation requires certificate uploads, digital signatures, a new dependency, global Student schema ownership, public unauthenticated PDF access, destructive migration, or exposure of additional personal data.

# Artifacts and Checkpoints

- Keep a field-mapping matrix: DOCX label -> API key -> formal/public schema path -> source of truth -> editable role -> PDF location -> validation -> test ID. Do not store real sample values.
- Required fixtures: adult, under 18, old record with missing fields, public-to-formal conversion through every path, active contract, assigned without contract, historical-only, unauthorized student, long Vietnamese values, incomplete mandatory PDF data, and preview URL cleanup.
- Checkpoint after shared schema/DTO/mapping tests pass; after self-service authorization/edit tests pass; and after the same PDF bytes pass both preview and download QA. Record commit identity and hashes only at these material synchronization points.
- Review must independently inspect authorization, field allow-listing, HTML escaping, filename sanitization, Puppeteer cleanup/timeouts, personal-data logging, conversion data preservation, and the final PDF render.

# Execution Budgets

- Dependency order: baseline/tests -> field model/DTOs -> shared conversion mapper -> self API -> profile UI -> PDF service/endpoint -> preview/export UI -> affected verification -> independent review -> final verification.
- One writer per path; disjoint frontend/backend writes may run concurrently only after shared API/field contracts are frozen. Step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2; no unapproved branch/worktree creation.
