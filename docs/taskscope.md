# Task Identity and Pipeline

Task: `confirm-unclassified-student-link-and-profile-sync` | Pipeline: `feature_development` | Profile: Full | Rules: Fast and Accurate Coding Instructions v3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `7592c10678c35ddd37ca178f6155ec6d1651e8b5` | Planning state: taskscope only; implementation is not authorized by this planning request.

# Risk Level

Risk: high. The feature spans student and dormitory modules, links previously separate records, creates/uses a formal dormitory registration, and can persist email/sex changes to a canonical student profile. Changes are transactional and logically reversible through audited values, but production use affects personal and persistent data.

# Objective

Allow an authorized manager to review an unlinked KTX applicant, select the correct enrolled student suggested by normalized full name plus exact date of birth, explicitly confirm optional reverse synchronization of email and gender, and atomically link the records without creating a duplicate student or active KTX registration.

# Scope Boundaries

Approved/read: student profile schema/service behavior, public/formal dormitory registration schemas and linking behavior, permissions, API contracts, and the Students > Chưa phân lớp UI.

Write:

- `backend/src/dormitory/controllers/registrations.controller.ts`
- `backend/src/dormitory/services/registrations.service.ts`
- `backend/src/dormitory/services/registrations.service.spec.ts`
- `backend/src/dormitory/services/public-registration-link.service.ts`
- `backend/src/dormitory/services/public-registration-link.service.spec.ts`
- `backend/src/dormitory/schemas/public-registration.schema.ts`
- a focused confirmation DTO under `backend/src/dormitory/dto/`
- `frontend/src/api/dormitory-api.ts`
- `frontend/src/app/(dashboard)/students/unclassified/page.tsx`
- a focused UI test beside the unclassified page

Additional files may enter the manifest only when they are owned by these two modules, required for compilation/testing, and do not expand behavior.

# Out of Scope

Creating, deleting, or merging student records; generating/changing student codes or classes; changing authenticated `User.email`, login identifiers, passwords, or account linking; fuzzy-name auto-linking; bulk auto-confirmation by name/date of birth; historical backfill/migration; room assignment changes; deployment; and production-data execution.

# Context and Dependencies

- The unclassified UI is currently read-only and loads `GET /dormitory/registrations/unclassified`.
- That query currently includes only unlinked public registrations with a blank `student_code`, so unlinked records containing an invalid/unmatched code are omitted.
- Existing auto-link logic matches student code or email and requires a class, but does not match full name plus date of birth.
- Existing manual link accepts a public registration ID and student ID but does not revalidate identity evidence, student status/class, or an operator-selected reverse-sync policy.
- `Student` owns canonical `student_code`, `class_id`, `full_name`, `date_bir`, `sex`, and profile `email`. Dormitory registration owns phone, room/bed, preferences, priority, and applicant-family data.
- Existing link creation is transactional when MongoDB transactions are available and the formal-registration schema prevents more than one active registration per student.

# Steps

1. Broaden the unclassified roster to all public/admin registrations without typed link references. Return classification/match states that distinguish blank code, unmatched code, one suggested candidate, multiple candidates, conflict, and already linked records; keep linked records excluded.
2. Add focused candidate resolution for one unclassified record. Require exact calendar date of birth and an exact normalized full name (Unicode normalization, trimmed/collapsed whitespace, case-insensitive). Use exact email and gender only as supporting/mismatch evidence. Never auto-confirm a name/date-of-birth match.
3. Return only necessary candidate fields: student ID, official name, date of birth, student code, class, status, email, gender, match evidence, and conflict flags. Enforce existing read permission and avoid exposing unrelated student data.
4. Add a validated confirmation DTO containing the selected student ID, expected public/student update timestamps, and explicit `sync_email` / `sync_gender` booleans. Reject unknown fields and invalid email/gender values.
5. On confirmation, re-read and revalidate both records: unlinked source, one authorized target, exact name/date match, target status `Studying`, nonblank student code, assigned class, and no conflicting active registration. Reject stale timestamps and ambiguous or mismatched selections.
6. Apply reverse-sync rules atomically with linking:
   - Source email absent: never change `Student.email`.
   - Source email equals normalized target email: no write.
   - Target email blank: UI defaults `sync_email` on, but the submitted flag remains explicit.
   - Both emails present and different: show a conflict; default off; overwrite only when the operator explicitly selects it.
   - Gender follows the same rules using only `Male`, `Female`, or `Other`.
   - Never update authenticated `User.email` in this task.
7. Reuse the existing formal-registration mapping for dormitory-owned fields. Persist an audit snapshot on the public registration containing confirmer ID/time, match method/evidence, selected student ID, before/after email and gender, and which sync flags were applied. Make retries idempotent for the same target and reject a different target after linking.
8. Update the unclassified UI with status badges and a review dialog showing source versus canonical data, candidate selection when ambiguous, conflict warnings, per-field email/gender checkboxes, and a final confirmation summary. Refresh the row, total, and parent count after success.
9. Add backend tests for matching normalization, ambiguous identities, omitted/invalid codes, permission/revalidation, stale updates, field-level sync policies, transaction rollback, duplicate-active-registration protection, audit data, and idempotent retry. Add UI tests for comparison, defaults, conflict opt-in, ambiguous selection, success refresh, and error preservation.
10. Perform independent privacy/security review, affected tests/build/typecheck, and final scoped diff review.

# Acceptance Criteria

- AC-01: “Chưa phân lớp” includes every unlinked supported public/admin KTX registration, including records with blank, invalid, or unmatched student codes, and excludes linked records.
- AC-02: A candidate is suggested only when normalized full name and exact date of birth match; name/date matches are never confirmed automatically.
- AC-03: Multiple candidates require an explicit selection and unresolved identity conflicts cannot be confirmed.
- AC-04: Confirmation succeeds only for an existing `Studying` student with a nonblank student code and assigned class, under `DORM_REG_UPDATE` permission and fresh source/target versions.
- AC-05: Email and gender are each written to `Student` only when the source value is valid/present and the corresponding submitted sync flag is true; differing existing values are never overwritten by default.
- AC-06: Confirmation never changes `student_code`, `class_id`, official name, date of birth, authenticated `User.email`, login behavior, or account credentials.
- AC-07: Linking, optional student-field updates, formal-registration reuse/creation, public-link markers, and audit snapshot succeed atomically; a failure leaves all records unchanged.
- AC-08: Repeating the same confirmed request does not create a second formal registration or repeat side effects; attempting to relink to another student is rejected.
- AC-09: The UI clearly shows both records, discrepancies, selected sync fields, and success/error outcome, then refreshes the unclassified row and count.
- AC-10: Existing code/email auto-link behavior, registration editing policy, and unrelated student/KTX behavior remain intact.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/registrations.service.spec.ts dormitory/services/public-registration-link.service.spec.ts` => AC-01 through AC-08 and AC-10 pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => DTO, controller, schema, and services compile.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/students/unclassified/page.test.tsx"` => AC-02, AC-03, AC-05, AC-06, and AC-09 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => API and UI contracts compile.
- Manual development check with disposable test records only: blank canonical fields default selected; conflicting fields default unselected; selected fields and link are committed together; stale/ambiguous attempts are rejected.
- `D:\PROJECT\manager_points` :: `git diff --check` plus scoped status/diff review => no unintended changes or personal data in logs/fixtures.

# Safety Gates

Gate 1 — Execution authority: this request authorizes taskscope creation only. A separate implementation request is required before code changes.

Gate 2 — Persistent personal data: tests and manual verification must use fixtures/disposable development records. Any staging/production deployment, historical backfill, or use against real records requires explicit approval with environment, affected records, review artifact, rollback procedure, and resume point.

Gate 3 — Scope expansion: stop if implementation requires authenticated-user email synchronization, schema migration/backfill, student merge/delete, class/code mutation, or broader permission changes.

Rollback design: because audit stores before/after values, a separately authorized recovery operation can restore the prior student email/gender and remove only the newly created link/formal record when no downstream references exist. Do not implement or execute rollback against persistent data under this task without approval.

# Artifacts and Checkpoints

Required: approved taskscope, backend/frontend test evidence, scoped diff, independent privacy/security review, and manual disposable-data evidence. Record base/current commit and hash the review/test artifacts before the persistent-data gate. Do not store raw personal data in artifacts.

# Execution Budgets

Deadline per step: 600 seconds, maximum 1800 seconds. One writer per path. Use dependency order backend contract/service/tests -> frontend contract/UI/tests -> independent review -> final affected verification. Idempotent retries: 0..2; engineering mutation/verification loop: 0..3; review remediation: 0..2. Stop on gate, stale state, permission regression, transaction failure, or scope expansion.
