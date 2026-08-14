# Task Identity and Pipeline

- Task: `student-profile-virtual-records-and-dormitory-card`; pipeline: `feature_development`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `5d7b3f2c624ab855d8c3f6a3a8556eeba8abcf3f`; environment: development.
- Planning-only: this document does not authorize source implementation.

# Risk Level

- Risk: medium. The change spans Academic Record, Dormitory, student-profile UI, permissions, and update behavior; it is reversible in Git and requires no migration or deployment.
- Full profile is required because the work crosses backend and frontend modules and introduces an authenticated data-update path.

# Objective

On the student profile, `Ghi nhận rèn luyện` shows a viewport of approximately five rows and loads additional pages through infinite scrolling while virtualizing rendered rows. Students with a linked dormitory registration have a new `Thông tin KTX` card showing room number and price; its advance icon opens a complete detail modal, with updates available only under the existing applicable permissions.

# Scope Boundaries

- Approved backend writes:
  - `backend/src/academic-record/academic-record.controller.ts`
  - `backend/src/academic-record/academic-record.service.ts`
  - `backend/src/academic-record/academic-record.service.spec.ts`
  - `backend/src/dormitory/controllers/registrations.controller.ts`
  - `backend/src/dormitory/controllers/registrations.controller.spec.ts`
  - `backend/src/dormitory/services/registrations.service.ts`
  - `backend/src/dormitory/services/registrations.service.spec.ts`
- Approved frontend writes:
  - `frontend/src/api/academic-record-api.ts`
  - `frontend/src/api/dormitory-api.ts`
  - `frontend/src/app/(dashboard)/students/[classId]/[id]/page.tsx`
  - `frontend/src/app/(dashboard)/students/[classId]/[id]/page.test.tsx` (new)
  - `frontend/src/components/students/StudentDormitoryCard.tsx` (new)
  - `frontend/src/components/students/StudentDormitoryCard.test.tsx` (new)
- Reuse the installed `@tanstack/react-virtual`; do not add a dependency.
- The dormitory response may expose only the selected registration, assigned room/bed, room price, active contract, applicant profile, and editable-field metadata needed by this card/modal.

# Out of Scope

- Database/schema migrations, dormitory assignment, contract transfer, invoices, dormitory violations, maintenance, registration creation/deletion, and changes to the general `/profile` page.
- Redesigning the existing dormitory administration pages or changing academic-record scoring/filter semantics.
- Breaking the current unpaginated academic-record API callers; existing consumers must continue to work.

# Context and Dependencies

- `getAcademicRecordsByStudent` currently returns every active record as one array and is used by multiple pages.
- `@tanstack/react-virtual` and existing `IntersectionObserver` patterns are already available in the frontend.
- A formal dormitory registration links through `student_id`; room price is stored as `room_price` on the assigned room. The effective room can come from the active contract before the registration itself.
- Existing update routes enforce `DORM_REG_UPDATE`; self-service updates use `/dormitory/registrations/me` and `editable_fields`.

# Steps

1. Add a backward-compatible paginated academic-record read path for one student, preserving the current authorization checks, active/deleted filters, and existing array response for legacy callers. Return deterministic newest-first pages with `data`, `total`, `page`, `limit`, and `has_more`.
2. Extend the frontend API with a typed page method. On the student profile, request the first page initially, append one page per threshold crossing, prevent duplicate/concurrent requests, and handle retry, end-of-list, and student-route changes.
3. Render records with `useVirtualizer` in a fixed/maximum-height scroll viewport sized for approximately five record rows, including dynamic row measurement, overscan, accessible keyboard scrolling, loading sentinel, empty state, and error state.
4. Add a current-registration-by-student read endpoint that follows the same self/adviser/authorized-staff visibility boundary as the student profile, resolves the effective active room, and populates room code/name, `room_price`, bed, active contract, registration detail, and editable-field metadata without exposing unrelated dormitory records.
5. Add `StudentDormitoryCard`: render only when a linked registration exists; show `Phòng` and formatted `Giá tiền` with explicit unassigned/unavailable fallbacks; provide an accessible advance icon button that opens a responsive detail modal.
6. In the modal, display the complete in-scope registration/profile/room/bed/contract information. Enable editable controls only for self-service fields allowed by `editable_fields` or for users with `DORM_REG_UPDATE`; submit through the matching existing update API, show validation/loading/success/error states, refresh the card after success, and keep read-only users view-only.
7. Add focused backend and frontend regression tests for pagination, virtualization/infinite loading, dormitory selection/fallbacks, modal accessibility, permission-gated editing, successful refresh, and failed updates; then review the final diff.

# Acceptance Criteria

- AC1: At normal desktop sizing, the record area displays approximately five rows before internal scrolling; DOM row count remains bounded by virtualization rather than growing with every loaded record.
- AC2: Initial profile load does not fetch all records. Reaching the virtual list threshold loads exactly one next page, appends without duplicates, stops at `has_more = false`, and exposes loading/retry/end states.
- AC3: Existing callers of `getAcademicRecordsByStudent` retain their array behavior and current access restrictions.
- AC4: A student without a linked registration has no KTX card. A student with one has a `Thông tin KTX` card showing the effective room and VND price, with clear fallbacks when room or price is absent.
- AC5: The advance icon has an accessible name and opens a modal containing all in-scope dormitory details. Closing returns focus to the trigger.
- AC6: Update controls are absent or disabled for read-only users. Authorized staff and an eligible student can update only fields allowed by their existing endpoint; a successful save refreshes both modal and card, while failure preserves entered data and shows an error.
- AC7: No migration, permission broadening, or behavior change outside the declared scope is introduced.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/academic-record/academic-record.service.spec.ts src/dormitory/controllers/registrations.controller.spec.ts src/dormitory/services/registrations.service.spec.ts` => focused pagination, access, selection, and update tests pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/students/[classId]/[id]/page.test.tsx" "src/components/students/StudentDormitoryCard.test.tsx"` => AC1, AC2, and AC4-AC6 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors introduced.
- Repository root :: `git diff --check` and `git status --short` => clean patch formatting and no unintended paths.

# Safety Gates

- Gate: None for implementation within this scope.
- Stop for new authority if implementation requires schema migration, broader dormitory visibility, a new permission, or updates to room/bed/contract/invoice data from this modal.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`; no separate checkpoint or hash artifact.

# Execution Budgets

- One writer per path; up to 3 implementation/verification loops, 2 tool retries, and 2 focused remediation loops. Stop on repeated out-of-scope or environment failures.
