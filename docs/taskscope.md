# Task Identity and Pipeline

- Task: `dormitory-registration-first-unclassified-students`
- Pipeline: `feature_development`
- Profile: Full; canonical rules version `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch `main`; base `e4b5ccab7b6ae7f61944621f373c6ea4d491a74b`; worktree clean at planning time.
- Rule manifest (Git blob): safety `a80986be`, global `029706f3`, contract `bb3ba10e`, orchestrator `4db1d471`, pipeline `ca63259a`.

# Risk Level

- Risk: medium; development-only, reversible in Git.
- Evidence: cross-module UI/API behavior and student-personal-data presentation require Full coordination, but no migration, deployment, destructive action, permission expansion, or external effect is requested.
- Blast radius: KTX registration navigation/listing and the student-list virtual grouping only.

# Objective

Make the KTX registration list the first/default workspace, present both linked and not-yet-classified registrants with the system's existing visual language, and expose KTX registrants who lack both student code and class through one global “Chưa phân loại” section containing one “Chưa phân lớp” card, without assigning them to a faculty.

# Scope Boundaries

- Approved: KTX navigation/default route, registration search/list UI, public-registration read model, an unclassified KTX roster endpoint, the student-list virtual group/detail view, focused tests, and API typings.
- Write:
  - `frontend/src/app/(dashboard)/dormitory/{layout.tsx,page.tsx,overview/page.tsx,registrations/page.tsx}`
  - `frontend/src/app/(dashboard)/students/page.tsx` and new `frontend/src/app/(dashboard)/students/unclassified/page.tsx`
  - `frontend/src/api/dormitory-api.ts`
  - focused frontend tests colocated with the changed pages/API
  - `backend/src/dormitory/{controllers/registrations.controller.ts,services/registrations.service.ts,services/public-registration-link.service.ts,schemas/public-registration.schema.ts}`
  - focused backend specs under `backend/src/dormitory/**`
- Read/reference: existing `TabNavigation`, `Research`, `Action`, control styles, student/class cards, permissions, and student/class schemas/services.
- Additional files require a scope amendment unless they are focused tests within the listed module boundaries.

# Out of Scope

- Creating placeholder `Student`, `Class`, or `Department` documents; relaxing required student fields; assigning the virtual group to a faculty; data migration/backfill; changing approval, room assignment, contract, invoice, or QR registration semantics; redesigning other KTX pages; deployment.

# Context and Dependencies

- `/dormitory` currently renders the overview and its tab order starts with “Tổng quan”; `/dormitory/registrations` is a separate table.
- Formal `Registration.student_id` is required and only its registration code is searchable; the UI displays only populated `student_code` and `full_name`.
- `PublicRegistration` already stores name, phone, email, optional student code, room preference, and link status, but its admin list is not represented in the current frontend API/list.
- `Student.student_code` is required, while `class_id` is optional. Therefore incomplete KTX identities remain public-registration records until normal enrollment/linking supplies a real student code and class.
- Define the unclassified set as public KTX registrations with blank `ma_sinh_vien` and no linked student/class. Persist typed `linked_student_id` and `linked_registration_id` fields for reliable exclusion after linking. Status affects display badges, not membership in the set, unless the product owner later explicitly excludes rejected records.
- The global virtual section must not participate in department selection, department class counts, or class CRUD.

# Steps

1. Add focused baseline tests for current KTX route/tab behavior, registration queries, public-link transitions, and student-page class grouping.
2. Move the existing overview presentation to `/dormitory/overview`, make `/dormitory` redirect to `/dormitory/registrations`, and order “Đăng ký” first while preserving a reachable “Tổng quan” tab.
3. Extend the registration read API with a normalized union/view model for formal and public registrations. Search case-insensitively by registration code, full name, student code, phone, and email; return explicit `classification_status`, nullable student/class fields, source, status, and stable IDs without changing write/approval flows.
4. Add a permission-protected, paginated unclassified-roster endpoint sourced from incomplete public KTX registrations. Ensure auto-linking records typed link references so linked/enrolled people disappear from this roster.
5. Refactor the registration page to the established system style: shared tab/search/action patterns, responsive table/card fallback, clear loading/empty/error states, status/source badges, and visible “Chưa có mã SV” / “Chưa phân lớp” placeholders. Preserve approve/reject/bulk actions only for eligible formal registrations.
6. Add a global “Chưa phân loại” section immediately below “Hệ trung cấp” on the student “Danh sách” tab. Render exactly one “Chưa phân lớp” virtual card with count/preview data, outside all faculty containers and filters.
7. Add `/students/unclassified` as a read-only roster using the same student-list styling and KTX fields. Do not expose class/faculty edit, import, activation, grading, or deletion actions for these records.
8. Add backend unit/controller coverage and frontend component/page coverage, then run focused tests, type checks/builds, and final diff/status review.

# Acceptance Criteria

- AC1: Opening `/dormitory` lands on the registration list; “Đăng ký” is the first KTX tab and “Tổng quan” remains reachable at `/dormitory/overview`.
- AC2: Registration search finds formal or public entries by registration code, name, student code, phone, or email, with deterministic pagination and no duplicate row for linked records.
- AC3: A public KTX registrant without student code/class appears with complete available contact/registration data and explicit missing-value labels; formal-only approval actions are not offered to that row.
- AC4: KTX UI uses the repository's existing tabs, controls, spacing, colors, cards, responsive behavior, and loading/empty/error conventions; no unrelated design system is introduced.
- AC5: Under “Hệ trung cấp”, “Chưa phân loại” renders exactly one “Chưa phân lớp” card whose count and detail roster contain exactly the unlinked public KTX registrations with blank student code.
- AC6: “Chưa phân loại” is visible independently of the selected faculty and does not change any faculty/class count or create/associate a Department or Class.
- AC7: After a real Student with a class is linked, the person is excluded from the unclassified roster and appears through the existing classified student flow without duplicate KTX registration display.
- AC8: Existing KTX approval, room assignment, QR registration, and ordinary student/class list behavior remain passing; final diff contains only approved paths.

# Verification

- Backend focused: `D:\PROJECT\manager_points\backend :: npm test -- --runInBand dormitory/services/registrations.service.spec.ts dormitory/services/public-registration-link.service.spec.ts dormitory/controllers/registrations.controller.spec.ts` => union search, unclassified filtering, link exclusion, permissions, pagination, and no duplicates pass.
- Frontend focused: `D:\PROJECT\manager_points\frontend :: npm test -- --run frontend/src/app/\(dashboard\)/dormitory frontend/src/app/\(dashboard\)/students` => default route/tab, responsive registration states/actions, virtual card placement/count, navigation, and read-only roster pass.
- Frontend static/build: `D:\PROJECT\manager_points\frontend :: npm run typecheck` and `npm run build` => TypeScript and Next production build pass.
- Backend build: `D:\PROJECT\manager_points\backend :: npm run build` => Nest compiles.
- Regression: run the affected existing dormitory/student/class tests; broaden to each package's full test command if focused failures reveal shared impact.
- Final: `D:\PROJECT\manager_points :: git diff --check`, `git diff --stat`, `git status --short` => no whitespace defects, unintended paths, or overwritten user work.
- Manual responsive inspection at desktop and narrow viewport: registration-first navigation and the unclassified card/roster remain usable and visually consistent.

# Safety Gates

- G0 — Planning-only: this file does not authorize implementation. Resume only after an explicit implement/fix request.
- G1 — Data-model expansion: any decision to create incomplete Student/Class/Department records or migrate existing data requires a scope amendment and explicit approval before mutation.
- G2 — Deployment or production data changes require separate explicit approval with reviewed verification and rollback evidence.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md` at the recorded base commit.
- C1: reviewed response contract, unclassified predicate, target manifest, and baseline results before mutation.
- C2: backend endpoint/link-model diff plus focused passing tests before frontend integration.
- C3: final diff, test/build summary, and responsive screenshots before implementation completion.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for package builds/full tests.
- Idempotent retries: 2 per command/API; engineering loops: 3; review-remediation cycles: 2.
- At most 3 independent read-only/test workers; one writer per path. Serialize registration controller/service/schema and shared frontend page/API edits.
- Stop on personal-data exposure beyond existing authorized fields, permission bypass, duplicate identity ambiguity, migration need, overlapping dirty edits, boundary expansion, or a Human Gate.
