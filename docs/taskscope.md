# Task Identity and Pipeline

- Task: `align-student-dormitory-card-and-registration-modals`
- Pipeline: `feature_development`
- Profile: Full
- Repository: `D:\PROJECT\manager_points`
- Base commit: `92ae11618f9aa796f969b35f25671d62735a14aa`
- Base state: `docs/taskscope.md` is already modified by the preceding planning request and is intentionally replaced by this scope.

# Risk Level

- Risk: medium
- Environment: development
- Evidence: frontend-only UI/form behavior across the student profile and dormitory registrations page; changes are reversible and do not mutate persisted data outside existing user-triggered update APIs.
- Blast radius: student KTX summary/detail UI and the admin create-registration dialog.

# Objective

Always show the student KTX card with an explicit non-resident state, align its detail/edit modal with the complete registration information form, and omit optional applicant-profile inputs only from the initial registration dialog while keeping them editable later.

# Scope Boundaries

- Approved boundary: `frontend/src/components/students/**`, `frontend/src/app/(dashboard)/students/[classId]/[id]/**`, and `frontend/src/app/(dashboard)/dormitory/registrations/**`.
- Write paths:
  - `frontend/src/components/students/StudentDormitoryCard.tsx`
  - `frontend/src/components/students/StudentDormitoryCard.test.tsx`
  - `frontend/src/app/(dashboard)/students/[classId]/[id]/page.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`
- Reused dependency: `ApplicantProfileFields`, `emptyApplicantProfile`, and `compactApplicantProfile` from `frontend/src/components/dormitory/PublicDormitoryRegistrationModal.tsx`.

# Out of Scope

- Backend endpoints, database models, dormitory assignment logic, public KTX registration, and authorization rules.
- Changes to room/bed/price calculations or the registrations edit dialog outside applicant-profile continuity.

# Context and Dependencies

- `StudentDormitoryCard` currently returns `null` when `has_dormitory_registration` is false, and the student page always mounts the component.
- The card detail modal has a bespoke partial form; `UpdateDormRegistrationInput` and `updateMine` already support `applicant_profile`.
- The registrations create dialog currently renders `ApplicantProfileFields` and submits its compacted value; the existing edit dialog already exposes those fields for later entry.

# Steps

1. Replace the no-registration early return with the same KTX card shell showing `Không ở trong KTX`, without room/price detail actions.
2. Restructure the card detail/edit modal to follow the create-registration modal's sections and complete field set, reuse `ApplicantProfileFields`, initialize it from the registration, and include its compacted value in authorized updates.
3. Remove `ApplicantProfileFields` from only the `Thêm sinh viên đăng ký KTX` dialog and ensure create/temporary-create payloads omit empty `applicant_profile`; retain applicant-profile editing in later edit flows.
4. Update focused component/page tests for the empty card, complete detail/edit fields and payload, and hidden create-only profile section.

# Acceptance Criteria

- AC1: A student without a linked KTX registration sees the `Thông tin KTX` card with `Không ở trong KTX` and no advance/detail action.
- AC2: A linked registration opens `Chi tiết đăng ký Ký túc xá` with the complete registration information layout; authorized updates preserve and submit applicant-profile data.
- AC3: `Thêm sinh viên đăng ký KTX` does not render `Thông tin hồ sơ (không bắt buộc)` and does not send an empty applicant profile.
- AC4: Existing edit-later flows still expose applicant-profile fields and existing staff/self-service permissions remain unchanged.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/components/students/StudentDormitoryCard.test.tsx" "src/app/(dashboard)/students/[classId]/[id]/page.test.tsx" "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => all focused UI and payload regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no introduced TypeScript errors.
- `D:\PROJECT\manager_points` :: `git diff --check` => patch formatting is valid.

# Safety Gates

None.

# Artifacts and Checkpoints

- Artifact: `docs/taskscope.md`
- Checkpoints and hashes: None required for this development-only UI change.

# Execution Budgets

- One writer per path; serialize overlapping edits.
- Maximum 3 implementation/verification iterations and 2 review remediation cycles.
- Stop and amend scope if backend/API contracts, authorization behavior, persistence, or additional modules must change.
