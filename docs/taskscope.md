# Task Identity and Pipeline

- Task: `class-cascade-delete-and-student-actions-ui`
- Pipeline: `bug_fix`
- Profile: Full
- Repository/base: `D:\PROJECT\manager_points`, branch `main`, base `8b47dfcd`, clean discovery state
- Rule manifest: canonical rules `3.2.0`

# Risk Level

- Risk: high
- Environment: development
- Evidence: cross-package backend/frontend change; future class deletion becomes destructive for persistent Student and User records.
- Reversibility: code is reversible through Git; deleted database records are not recoverable without a backup.

# Objective

Deleting a class atomically removes its students and their explicitly linked login accounts, while the four class/student create-import actions use the supplied compact light outlined design without changing permissions or handlers.

# Scope Boundaries

- Approved: `backend/src/classes/**`, `frontend/src/app/(dashboard)/students/**`
- Write:
  - `backend/src/classes/classes.service.ts`
  - `backend/src/classes/classes.module.ts`
  - `backend/src/classes/test/classes.service.spec.ts`
  - `frontend/src/app/(dashboard)/students/page.tsx`
  - `frontend/src/app/(dashboard)/students/[classId]/page.tsx`
- Targets: `ClassesService.remove`; `ClassesModule` model registration; class removal unit tests; `StudentsPageContent` class actions and delete confirmation; `ClassStudentsPageContent` student actions.

# Out of Scope

- Controllers, API contracts, authorization rules, popup behavior, individual-student deletion, deployment, migration/backfill, and cleanup of other collections referencing students.
- Email-based deletion of legacy/unlinked accounts; only authoritative `Student.user_id` links are eligible.

# Context and Dependencies

- `ClassesService.remove` currently deletes only the Class.
- `StudentsService.remove` establishes the existing precedent of hard-deleting a linked User.
- A Mongoose transaction is required for class/student/user atomicity and requires a replica-set or sharded MongoDB deployment.
- Linked Users are deleted regardless of `active`, `locked`, or `inactive` status; students without `user_id` are still deleted, with no fallback account match.
- UI actions keep their existing permission checks and open the same popups.

# Steps

1. Backend code-agent: baseline class removal; register Student/User models; preflight the Class; collect linked user IDs; transactionally delete only matching Users, Students, and Class; return the deleted Class and abort on any failure.
2. Backend test-agent: cover multiple students/users, missing `user_id`, unrelated records, missing Class, abort/cleanup, and successful commit.
3. Frontend code-agent: update the delete warning to disclose cascade loss; restyle `Import lớp`, `Thêm lớp`, `Import sinh viên`, and `Thêm sinh viên` as compact light outlined rounded buttons with Lucide icons, subtle border/shadow, muted dark text, visible focus states, and responsive wrapping.
4. Review-agent: verify destructive filters, transaction handling, permissions/handlers, accessibility, responsive layout, and final scoped diff.

# Acceptance Criteria

- AC1: Deleting an existing Class removes that Class and every Student whose `class_id` matches it in one transaction.
- AC2: Users referenced by those students' `user_id` are removed regardless of status; unrelated Users and unlinked/email-only accounts remain.
- AC3: Any cascade failure aborts all three deletions; a missing Class returns NotFound without dependent writes.
- AC4: The confirmation explicitly warns that students and linked accounts will also be permanently deleted.
- AC5: All four actions match the supplied visual pattern at desktop and 320/375px widths, retain accessible names/focus, permissions, and original click behavior.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand classes/test/classes.service.spec.ts` => cascade, isolation, NotFound, and transaction cases pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest application compiles.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points\frontend :: npx eslint "src/app/(dashboard)/students/page.tsx" "src/app/(dashboard)/students/[classId]/page.tsx"` => affected pages pass lint.
- Browser QA on `/students` and `/students/:classId` at desktop, 375px, and 320px => four actions match the reference, do not overflow, and open the original popups.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

- Planning-only: implementation requires a separate explicit execution request.
- Do not run a destructive integration test against shared/staging/production data. Any live-data validation or deployment requires confirmation, a verified backup/rollback plan, and Mongo transaction support.

# Artifacts and Checkpoints

- Scope artifact: `docs/taskscope.md`
- Checkpoints/hashes: None until implementation is authorized.

# Execution Budgets

- One writer per path; serialize overlapping work.
- Maximum retries: 2; implementation/verification loops: 3; review remediation cycles: 2.
- Stop for dirty-path overlap, unsupported transactions, boundary expansion, migration needs, or any live-data operation.
