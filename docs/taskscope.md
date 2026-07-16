# 1. Task ID + Pipeline

- Task ID: `ACTIVITIES-MEMBERSHIP-BUTTON-20260716`
- Pipeline: `feature_development`

# 2. Risk Level

Low — the change is limited to the authenticated `/activities` read experience and its automated tests in the development codebase. It requires no elevated permissions, data mutation, migration, deployment, external communication, or irreversible action; all planned edits are reversible through version control.

# 3. Objective

Make each activity card on `/activities` show the current account's participation outcome instead of always presenting the registration action. The button must display `Đã tham gia` when the account participates in the activity, `Bị từ chối` when its participation request was rejected, and `Đăng ký` when neither condition applies.

# 4. Scope

- `frontend/src/api/activity-api.ts` — activity-list response types and request mapping: expose the authenticated account's activity membership/application status to the `/activities` UI without changing existing localized API values. New technical identifiers and type content must be in English.
- `frontend/src/app/(dashboard)/activities/page.tsx` — `/activities` page data flow: pass each activity's current-account participation status into the activity-card presentation. New technical content must be in English; the required Vietnamese button labels are an approved functional exception.
- `frontend/src/components/activities/ActivityCard.tsx` — registration button presentation: derive a deterministic display state with the precedence `rejected` → `Bị từ chối`, participating/accepted → `Đã tham gia`, otherwise → `Đăng ký`; prevent the existing registration action for non-registerable status displays. New technical content must be in English; the three Vietnamese labels are required user-facing content.
- `frontend/src/api/activity-api.test.ts` — API mapping tests: verify that membership/application status is retained and delivered in the normalized activity-list result. New test content must be in English except for existing or functionally significant localized fixtures.
- `frontend/src/app/(dashboard)/activities/page.test.tsx` — page integration tests: verify that the status associated with the authenticated account reaches the corresponding card and is not applied to other activities. New test content must be in English except for required localized UI assertions.
- `frontend/src/components/activities/ActivityCard.test.tsx` — component regression tests: cover `Đăng ký`, `Đã tham gia`, and `Bị từ chối`, including disabled/non-registering behavior for the latter two states. New test content must be in English; Vietnamese labels are required assertion values.
- `backend/src/activities/activities.controller.ts` — authenticated activity-list endpoint contract: include current-account participation status only if the existing endpoint does not already expose it after PLAN inspection. New technical content must be in English.
- `backend/src/activities/activities.service.ts` — activity-list query/result mapping: resolve the requesting account's matching `ActivityMember` status per activity only if the existing service result does not already provide it. New technical content must be in English.
- `backend/src/activities/activities.controller.spec.ts` and `backend/src/activities/activities.service.spec.ts` — backend contract and service tests: cover per-account status exposure if backend changes are required. New test content must be in English.

# 5. Out of Scope

- Activity registration, approval, rejection, transfer, attendance, completion-award, and scoring business rules.
- Changes to activity detail, schedule, management, or `/activities/my` behavior.
- Database schemas, indexes, migrations, seed data, and persisted status values.
- Authentication, authorization, roles, permissions, secrets, and environment files.
- Deployment, release, infrastructure, CI/CD, dependency upgrades, broad refactoring, and repository-wide formatting.
- Translation of existing localized content, localization-resource changes, bulk encoding conversion, and line-ending normalization.
- Any file not listed in Scope.

# 6. Context & Dependencies

- The system uses the unified Activity domain. `activity_members` stores membership records keyed by activity and student, with a membership `status` documented by the current project architecture.
- The displayed state must be derived for the currently authenticated account and independently for each activity; another account's membership must never affect the card.
- Existing backend and frontend status constants must be inspected before implementation. No new persisted status vocabulary may be invented when an existing accepted/active/rejected representation is available.
- Rejected status has explicit display precedence over the generic registration state. Participating includes the repository's verified status representing an accepted or active member.
- The button labels are deliberately Vietnamese because they are existing and required user-facing product text. This is the only approved non-English addition.
- Existing file encoding, BOM, and line endings must be preserved. The work runs on Windows with PowerShell, while verification must use repository-native npm scripts confirmed from the relevant package configuration during PLAN.

# 7. Steps

## PLAN

- Inspect the scoped frontend route, API mapper, card component, status utilities, and associated tests.
- Inspect the scoped backend controller, service, member DTO/schema references, and tests to determine whether the activity-list response already contains the requesting account's participation status.
- Confirm the exact accepted/active and rejected status values, the authenticated account identifier used by the endpoint, current button action behavior, package scripts, Scope, Out of Scope, risk, Safety Gates, and verification commands.
- Confirm that all new technical content will be English and that only the three required Vietnamese button labels and their assertions qualify as localized-content exceptions.
- If the existing API already supplies sufficient status data, omit the conditional backend changes while keeping all other work within Scope.

## EXECUTE

- In `frontend/src/api/activity-api.ts`, retain and type the verified current-account participation status in the normalized activity result.
- In `frontend/src/app/(dashboard)/activities/page.tsx`, pass the status for each activity to its corresponding card without cross-activity leakage.
- In `frontend/src/components/activities/ActivityCard.tsx`, render `Bị từ chối` for the verified rejected status, `Đã tham gia` for the verified participating status, and `Đăng ký` otherwise; block the registration callback for the two terminal display states.
- Update the three scoped frontend test files with isolated cases for default, participating, and rejected accounts, plus activity-specific mapping behavior.
- Only if the frontend cannot obtain the status from the existing contract, update the scoped backend controller/service to return the requesting account's status and add the scoped backend tests.
- Preserve existing localized content, encoding, BOM, and line endings; write technical identifiers, comments, and test descriptions in English.

## VERIFY

- Run the repository-native targeted frontend tests for the API mapper, `/activities` page, and `ActivityCard`.
- If backend files changed, run the repository-native targeted activities controller and service tests.
- Run the repository-native frontend type-check or build command verified during PLAN.
- Inspect the final diff and changed-file list to confirm that only Scope items changed, backend edits were made only when necessary, and no unrelated behavior, localization, encoding-only, or line-ending-only changes were introduced.
- Confirm every Acceptance Criterion, English-language compliance for technical content, preservation of existing localized content, and absence of newly introduced `U+FFFD` characters.

## REFINE

- Identify the exact failed criterion or test, apply the smallest correction within the listed Scope, and rerun the affected targeted verification first.
- Preserve the required English technical content and the documented Vietnamese UI-label exception during correction.
- Stop immediately on success, a Human Gate trigger, Scope expansion, increased risk, an unresolved status-contract ambiguity, or exhaustion of the iteration limit.

# 8. Acceptance Criteria

1. For an activity whose verified current-account status is participating/accepted, its card displays `Đã tham gia` and does not invoke registration.
2. For an activity whose verified current-account status is rejected, its card displays `Bị từ chối` and does not invoke registration.
3. For an activity with no current-account membership/application status, its card displays `Đăng ký` and preserves the existing registration action.
4. Status is matched by both the authenticated account and activity; it is not copied to unrelated activity cards or derived from another account.
5. Existing loading, error, empty-list, filtering, favorite, and activity navigation behavior remains unchanged, as confirmed by targeted regression tests and diff inspection.
6. The API contract reuses verified existing status values; no database migration or new persisted status vocabulary is introduced.
7. All targeted tests pass with exit status `0`, and the verified frontend type-check or build passes with exit status `0`.
8. Only listed Scope files change. Backend files change only if PLAN confirms the existing activity-list contract lacks current-account status.
9. Newly written technical content is in English. The required Vietnamese button labels and localized assertion values are the only approved non-English additions; existing localized content remains unchanged and no unintended translation occurs.
10. Existing encoding, BOM, and line endings are preserved; no `U+FFFD` character, mojibake, encoding-only diff, or line-ending-only diff is introduced.

# 9. Verification Commands

The exact npm script names and supported test-filter syntax must be confirmed from `frontend/package.json` and `backend/package.json` during PLAN before execution; they must not be invented. Use the following command forms after that confirmation:

- `D:\PROJECT\manager_points\frontend :: npm test -- <verified filters for activity-api.test.ts, activities/page.test.tsx, and ActivityCard.test.tsx> -> 0; all targeted frontend status and regression tests pass.`
- `D:\PROJECT\manager_points\backend :: npm test -- <verified filters for activities.controller.spec.ts and activities.service.spec.ts> -> 0; required only when backend files change, and all targeted backend tests pass.`
- `D:\PROJECT\manager_points\frontend :: npm run <verified type-check-or-build script> -> 0; frontend compilation and type validation complete without errors.`
- `D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported.`
- `D:\PROJECT\manager_points :: git diff -- docs/taskscope.md frontend/src/api/activity-api.ts frontend/src/app/(dashboard)/activities/page.tsx frontend/src/components/activities/ActivityCard.tsx frontend/src/api/activity-api.test.ts frontend/src/app/(dashboard)/activities/page.test.tsx frontend/src/components/activities/ActivityCard.test.tsx backend/src/activities/activities.controller.ts backend/src/activities/activities.service.ts backend/src/activities/activities.controller.spec.ts backend/src/activities/activities.service.spec.ts -> 0; diff inspection confirms Scope, language, localization, encoding, and line-ending compliance.`

# 10. Safety Gates

- Scope expansion or increased risk — pause before modifying any unlisted file, changing persisted statuses, altering authentication/authorization, or adding a migration; obtain explicit user approval for the expanded Scope and reassess risk.
- Production, deployment, release, merge, or publish action — pause before the action; obtain explicit user approval. No such action is planned.
- Destructive or irreversible action — pause before the action; obtain explicit user approval. No such action is planned.
- Database, infrastructure, secret, credential, permission, external communication, or paid-service action — pause before the action; obtain explicit user approval. No such action is planned.
- Bulk translation, localization change, or encoding conversion — pause before the action; obtain explicit user approval and an exact expanded Scope. No such action is planned.

# 11. Artifacts to Review

None — no Human Gate triggered.

# 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)
