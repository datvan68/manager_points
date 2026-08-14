# Task Identity and Pipeline

- Task: `registration-placeholders-and-mobile-profile-cards`
- Pipeline: `feature_development`
- Profile: Full
- Rules: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base commit: `9d8d778cd5688b31fd8b100a5dd7eacd483e73d6`
- Base state: clean working tree before this scope update.

# Risk Level

- Risk: medium.
- Environment: development.
- Evidence: frontend-only presentation and interaction changes spanning the shared KTX edit modal, shared applicant-profile fields, student detail page, KTX card, and focused tests.
- Reversibility: Git-revertible source changes.
- Blast radius: KTX registration edit UX and the three information cards on the student detail page.

# Objective

Make every editable input/select in `Sửa đơn đăng ký` self-explanatory through suitable placeholders, and keep `Thông tin cá nhân`, `Thông tin học tập`, and `Thông tin KTX` collapsed by default on mobile until the user expands each card.

# Scope Boundaries

- Approved: `frontend/src/components/dormitory/**`, `frontend/src/components/students/StudentDormitoryCard*`, and `frontend/src/app/(dashboard)/students/[classId]/[id]/**`.
- Write: shared edit-modal/applicant-profile components and tests; student detail page/test; student KTX card/test.
- Known targets: `DormitoryRegistrationEditModal`, `ApplicantProfileFields`, the personal and academic information sections in `students/[classId]/[id]/page.tsx`, and `StudentDormitoryCard` including its resident and non-resident states.
- Excluded: registrations create/public modal behavior outside shared applicant-profile rendering, API payloads, validation/business rules, permissions, backend, schemas, dependencies, and unrelated cards or pages.

# Out of Scope

- Redesigning desktop card layout or changing modal fields.
- Changing KTX edit authorization, active-semester behavior, update routes, or date controls.
- Introducing a new accordion/collapse dependency.

# Context and Dependencies

- `DormitoryRegistrationEditModal.tsx` already owns the reusable `Sửa đơn đăng ký` form; several text inputs and the `Ưu tiên`/`Loại phòng` selects currently have no placeholder.
- `ApplicantProfileFields` in `PublicDormitoryRegistrationModal.tsx` supplies the modal's optional applicant and parent fields, so placeholders added there must not alter public/create behavior or values.
- The personal and academic cards are inline in the student detail page; `StudentDormitoryCard.tsx` owns both KTX presence states and the edit-modal trigger.
- Existing responsive styling uses `sm` as the first non-mobile breakpoint.

# Steps

1. Add concise Vietnamese placeholders/examples to every editable text, telephone, numeric, textarea, and select control rendered by `Sửa đơn đăng ký`, including shared applicant/parent profile fields; preserve labels, current values, disabled states, validation, and payloads.
2. Add independent collapsed state for `Thông tin cá nhân` and `Thông tin học tập`; initialize them collapsed below `sm`, render only the card header while closed, and allow header/chevron activation to expand or collapse.
3. Apply the same mobile-only default-collapse behavior to `StudentDormitoryCard` for both resident and `Không ở trong KTX` states while keeping its detail/edit icon behavior available after expansion.
4. Keep all three cards expanded by default from `sm` upward and avoid discarding an explicit user toggle during ordinary rerenders.
5. Add accessible controls (`button`, `aria-expanded`, and `aria-controls`) with clear focus/keyboard behavior; do not make nested edit/detail actions toggle the card accidentally.
6. Update focused tests for placeholder coverage, mobile initial state, independent expand/collapse, non-resident KTX behavior, desktop default state, and existing modal/KTX actions.

# Acceptance Criteria

- AC1: Every editable input, textarea, and select in `Sửa đơn đăng ký`, including applicant and parent profile fields, exposes an informative placeholder without replacing an existing value or changing submitted data.
- AC2: At viewport widths below `sm`, the three cards are independently collapsed on first render and their bodies appear only after activating the corresponding header control.
- AC3: At `sm` and wider, all three cards remain expanded by default and retain their current desktop content/layout.
- AC4: Each collapse control is keyboard-operable and reports its state with `aria-expanded`/`aria-controls`; KTX detail/edit actions do not unintentionally collapse the card.
- AC5: The resident and non-resident KTX states, modal launch, permissions, update routing, validation, focus restoration, and all API payloads remain unchanged.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/components/dormitory/DormitoryRegistrationEditModal.test.tsx" "src/components/dormitory/PublicDormitoryRegistrationModal.test.tsx" "src/components/students/StudentDormitoryCard.test.tsx" "src/app/(dashboard)/students/[classId]/[id]/page.test.tsx"` => all focused placeholder, responsive-collapse, accessibility, and existing KTX regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no introduced TypeScript errors.
- `D:\PROJECT\manager_points` :: `git diff --check` => valid patch formatting.
- Final inspection: only approved paths and `docs/taskscope.md` changed; no API/payload, permission, or desktop-layout regression is introduced.

# Safety Gates

- None. Stop and amend scope if implementation requires a dependency, backend/schema change, permission-policy change, or persistent/external mutation.

# Artifacts and Checkpoints

- Artifact: `docs/taskscope.md`.
- Checkpoints/hashes: none required before implementation; Git diff is the review/recovery artifact.

# Execution Budgets

- One writer per path; serialize shared applicant-profile changes with modal tests.
- Maximum ENG iterations: 3; review remediation cycles: 2; idempotent retries: 2.
- Stop on boundary expansion, overlapping dirty changes, failed required criteria, or a newly triggered gate.
