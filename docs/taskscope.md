# Task Identity and Pipeline

Task: `unify-dormitory-roster-fresh-cutover` | Pipeline: `feature_development` plus development-data reset | Profile: Full | Rules: Fast and Accurate Coding Instructions v3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `6aed8c2acaebac298d77d9e6aa5fb6a2c438c696` | Planning state: taskscope only; implementation, database reset, deployment, and production mutation are not authorized by this document update.

# Risk Level

Risk: medium for application code and high for any database reset. The feature is new and the legacy dormitory-registration data is disposable development test data, so no legacy-data migration or compatibility window is required. The change still affects student identity, room assignment, contracts, reports, PDFs, permissions, public submission, and frontend routes.

# Objective

Replace `registrations` and `publicregistrations` with one canonical `DormitoryRosterEntry` model stored in `dormitory_roster_entries`. Remove the legacy registration/public-registration runtime, approval lifecycle, compatibility branches, and migration machinery instead of preserving test data. Keep the established “Danh sách” UI unchanged in appearance and interaction; update only its business logic, API bindings, field semantics, and data flow.

# Scope Boundaries

Approved/read: dormitory and Student schemas/modules/services/controllers/DTOs/tests; room assignment, contracts, invoices, reports, PDFs, overview, and Student-profile consumers; permission descriptions; public/admin dormitory UI and API; active-semester lookup; existing migration/reset scripts; and development-only database metadata needed to verify a reset target.

Write boundaries:

- `backend/src/dormitory/**`
- `backend/src/students/students.module.ts`, `backend/src/students/students.service.ts`, and focused tests
- `backend/src/auth/permissions.registry.ts`
- a guarded development reset command under `backend/scripts/**`
- `backend/package.json`
- `frontend/src/api/dormitory-api.ts` and focused API tests
- `frontend/src/app/(dashboard)/dormitory/**`
- `frontend/src/app/public/**`
- `frontend/src/components/dormitory/**`
- focused Student/profile KTX display consumers and tests
- a short development reset note under `docs/` if required

Canonical English naming:

- model: `DormitoryRosterEntry`
- collection: `dormitory_roster_entries`
- code: `roster_entry_code`
- reference: `roster_entry_id`
- admin API and dashboard route: `/dormitory/roster`
- public submission route: `/dormitory/public/register`

# Out of Scope

- Preserving or migrating documents from `registrations` or `publicregistrations`.
- Keeping legacy admin API routes, DTO fields, response aliases, schemas, services, or UI routes for a deprecation window.
- Running a development reset, deployment, or any production database operation under this planning request.
- Resetting Student, semester, building, room, or bed master data.
- Redesigning the “Danh sách” tab or changing its visual hierarchy, responsive behavior, toolbar, dialogs, loading/empty/error presentation, pagination, selection, QR, room assignment, delete confirmation, PDF preview/export, or permission-aware actions.
- Exposing a raw MongoDB ObjectId input or unauthenticated Student PII/existence lookup.
- Changing Student account creation, authentication, credentials, billing rules, room capacity rules, or unrelated dormitory behavior.

# Assumptions and Stop Conditions

- All legacy registration/public-registration documents and their dependent dormitory contracts/invoices are disposable test data in a verified development database.
- No production or staging data requires preservation. Detecting a non-development target, meaningful legacy data, a contract/invoice that must be retained, or an unknown downstream reference stops the reset and requires a separate migration scope.
- `student_id` is the only durable Student link. `student_code` is optional lookup/display data and is never a foreign key or merge key.
- Existing `DORM_REG_*` permission codes remain to avoid an unrelated role/permission migration; only their display descriptions may change to “Danh sách KTX”.

# Implementation Steps

1. Record backend/frontend baselines and inventory every import, endpoint, DTO field, query, test, and downstream reference to the two legacy models. Confirm the intended final runtime graph has only `DormitoryRosterEntry`.
2. Define `DormitoryRosterEntry` with explicit collection `dormitory_roster_entries`: unique `roster_entry_code`; optional indexed `student_id`; required identity snapshot (`full_name`, `date_of_birth`, `gender`); required `phone_number`; required active `semester_id` plus semester/year snapshot; required `room_type`; optional `notes`, applicant profile, room/bed; identity state (`LINKED`, `UNLINKED`, `CONFLICT`); and timestamps. Do not add approval, rejection, reviewer, legacy source ID, legacy code, or compatibility fields.
3. Add a partial unique index on `{ student_id, semester_id }` only when `student_id` exists. This prevents duplicate linked Student membership per semester while allowing multiple valid unlinked people without fake/null Student IDs.
4. Implement one eligibility resolver for manager and public creation. The server resolves exactly one active semester and ignores client-supplied semester authority. It resolves:
   - full name from the selected Student or validated manual input;
   - date of birth from the selected Student or valid past-date input;
   - gender from the selected Student or `Male`, `Female`, or `Other` input;
   - validated phone number;
   - supported room type;
   - optional trimmed notes.
   Reject zero/multiple active semesters, incomplete authoritative Student data, invalid manual data, or duplicate linked Student/semester membership.
5. In the existing manager create/edit dialog, support exact Student-code search and a user-facing Student selector. Selecting a Student submits `student_id` internally and prefills authoritative identity fields. Manual entry remains available for a person without a usable Student record or code. Never render a raw ObjectId text input.
6. Keep the public QR form manual-first. An optional Student code may be used for internal exact matching, but the public API must not reveal Student existence or PII. A safe single match stores `student_id`; otherwise create an `UNLINKED` entry from validated manual identity. Every valid submission appears immediately in “Danh sách”; there is no approval or confirmation step.
7. Keep one idempotent roster identity service. Linked entries use current Student identity/code for display through `student_id` while retaining their intake snapshot. After Student creation/update/code assignment, auto-link an unlinked entry only when normalized full name plus exact date of birth yields exactly one Student and no Student/semester collision; otherwise keep it `UNLINKED` or mark it `CONFLICT` without guessing.
8. Expose only the canonical roster CRUD/list/identity-conflict, PDF, room suggestion/assignment/unassignment, and public-submission endpoints. Remove approval, rejection, bulk/auto-link, confirm-link, source discriminator, temporary, unclassified, `/dormitory/registrations`, legacy identifier parameters, and `registration_code` response aliases. Canonical PATCH must persist its DTO, and assignment/unassignment accepts only `roster_entry_id`.
9. Update room assignment, contracts, invoices, Student KTX status, profile views, PDFs, overview, and reports to use `DormitoryRosterEntry` and `roster_entry_id` only. Remove all `registration_id` fallbacks and dual-model injections. Contract creation no longer checks approval, but retains linked-Student, room/bed, active-contract, and capacity protections. Refuse deletion of a roster entry referenced by a protected downstream record.
10. Restore the task-base “Danh sách” page and render it at `/dormitory/roster`. Preserve its responsive table/cards, mobile incremental loading, desktop pagination, search, selection/floating actions, QR dialog, create/edit dialog, room assignment, delete confirmation, PDF preview/export, notifications, permission gates, and loading/empty/error states. Remove only approval/source-specific controls and labels. Update all internal dashboard links to `/dormitory/roster`, then remove the legacy `/dormitory/registrations` page rather than redirecting it or maintaining a duplicate UI.
11. Delete legacy runtime and test artifacts after their consumers have moved: `Registration` and `PublicRegistration` schemas/models, legacy registration service and link service, public-to-formal mapper, legacy DTOs/controllers/actions, source/edit policies, compatibility API methods/types, reconciliation/index-repair/migration scripts, migration runbook, and tests that assert removed behavior. Do not delete shared UI capabilities or unrelated dormitory code.
12. Add focused backend/frontend regression tests for canonical creation, exact active-semester resolution, linked/unlinked identity, privacy, Student-code changes, PATCH persistence, room assignment, protected deletion, contracts/reports/PDFs, and the restored “Danh sách” UI capability set. Add a static legacy-reference check that fails if runtime code still imports or queries `registrations`, `publicregistrations`, or `registration_id`.
13. Provide one explicit development-only reset command. It must refuse production/staging/unknown targets and require both a development environment marker and a typed confirmation value. In one guarded operation it must:
    - collect legacy and current roster entry IDs;
    - release beds assigned only through those disposable entries/contracts and resynchronize affected room availability;
    - delete invoices belonging to disposable dependent contracts, then those contracts;
    - drop `registrations`, `publicregistrations`, and any test `dormitory_roster_entries` collection with their stale indexes;
    - recreate the canonical collection/indexes through the application schema;
    - print counts and collection/index names only, never PII.
14. Run focused tests, affected package suites, typechecks/builds, the static legacy-reference check, and final diff/status review. Run the guarded reset only after separate confirmation of the exact development database, then smoke-test public submission, “Danh sách”, edit/delete, room assignment, contract creation, PDF, overview, report, and Student profile flows.

# Acceptance Criteria

- AC-01: All dormitory roster runtime flows use only `dormitory_roster_entries` and `DormitoryRosterEntry`; no runtime code reads or writes `registrations` or `publicregistrations`.
- AC-02: A valid manager or public submission immediately creates one roster entry against exactly one active semester with no approval/confirmation/rejection state or action.
- AC-03: Managers can select a Student by a user-facing lookup or enter manual identity; no raw ObjectId is displayed or required.
- AC-04: Student code remains optional and mutable. Existing links remain stable through `student_id`, and unlinked reconciliation never guesses between ambiguous candidates.
- AC-05: Public submission reveals no Student PII or existence and supports both safe internal linking and validated unlinked intake.
- AC-06: Room assignment, contracts, invoices, Student KTX status, profile, PDFs, overview, and reports use `roster_entry_id` only and retain existing capacity/referential protections.
- AC-07: The task-base “Danh sách” visual structure and interaction set are preserved. Only obsolete approval/source UI and data-bound terminology change.
- AC-08: `/dormitory/roster` is the only admin roster route; legacy routes, aliases, identifier fallbacks, model/service code, migration code, and legacy behavior tests are removed.
- AC-09: Focused and affected-package verification passes, and the static reference check finds no forbidden legacy runtime reference.
- AC-10: The reset command cannot run against production, staging, or an unverified target; an approved development run clears only disposable entry-related data, releases affected beds, preserves master data, and recreates canonical indexes.
- AC-11: No database reset, deployment, or production mutation occurs as part of taskscope authoring or implementation verification without the applicable explicit gate.

# Verification

- `D:\PROJECT\manager_points\backend` :: focused Jest targets for roster schema/service/identity/controller, room assignment, contracts, reports, Students integration, privacy, and reset guards => AC-01 through AC-06 and AC-10 pass.
- `D:\PROJECT\manager_points\backend` :: repository-native static search/test for forbidden runtime references => no `Registration`/`PublicRegistration` model import, `registrations`/`publicregistrations` query, `registration_id` fallback, approval action, or migration compatibility path remains outside the guarded reset script.
- `D:\PROJECT\manager_points\backend` :: `npm run build` and affected backend tests => canonical runtime compiles and passes.
- `D:\PROJECT\manager_points\frontend` :: focused Vitest targets for the restored “Danh sách” page, API, public form, edit dialog, Student/profile display, overview, and reports => preserved UI capabilities and canonical-only data flow pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck`, affected tests, and `npm run build` => canonical route and types compile.
- Separately approved disposable development MongoDB :: guarded reset plus smoke test => AC-10 passes with before/after counts and no retained-data requirement.
- `D:\PROJECT\manager_points` :: `git diff --check` plus scoped status/diff review => no unintended file, UI redesign, personal data, or unrelated change.

# Safety Gates

Gate 1 — Execution authority: this document update is planning-only. Implementing the code requires an implementation request.

Gate 2 — Privacy/API behavior: unauthenticated Student-code handling must not reveal PII or account existence.

Gate 3 — Development reset: before running the reset, show the exact redacted MongoDB host/database identity, environment classification, preflight counts, affected contract/invoice/bed counts, and reset command. Obtain explicit approval for that exact development target. The command must abort if the target is not positively identified as development.

Gate 4 — Deployment/production: pulling code, building, restarting services, changing production collections/indexes, or deleting production data requires separate environment-specific approval. The development-data assumption must never be reused as production deletion authority.

Rollback: code rollback restores the previous commit. Before a development reset, capture a short-lived database snapshot or export of only the affected test collections and dependency IDs. If smoke tests fail, restore that snapshot or reseed development data; never attempt heuristic reverse linking.

# Artifacts and Checkpoints

Required: approved taskscope; baseline results; legacy-reference inventory; canonical schema/API map; focused tests; backend/frontend build evidence; static legacy-reference result; final scoped diff/status; guarded development reset command and reset report when separately approved. Store no raw personal data.

# Execution Budgets

Deadline per step: 600 seconds, maximum 1800 seconds. One writer per path. Serialize schema/API changes before downstream/frontend cleanup. Idempotent retries: 0..2; implementation/verification loop: 0..3; review remediation: 0..2. Stop on PII exposure, ambiguous identity, active-semester ambiguity, unknown references, retained-data discovery, non-development database detection, scope expansion, or failed rollback/reset guard.
