# 1. Task ID + Pipeline

- Task ID: `ACTIVITY-DETAIL-20260716-01`
- Pipeline: `bug_fix`

# 2. Risk Level

Risk level: `low` — the change is limited to an authenticated frontend detail page and its tests in the development repository; it does not require elevated permissions, database or infrastructure changes, production access, sensitive-data handling, or external side effects, and it is fully reversible through the source diff.

# 3. Objective

Correct the Activities Detail logo so stored upload URLs render reliably, images remain centered and fully visible inside the logo frame, and authorized administrators or advisors can remove a custom logo to restore the existing activity-code fallback. Expand the "General Information" tab so administrators can see the complete operational and governance metadata already returned by the activity detail API.

# 4. Scope

- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` — `ActivityDetailPage`, `handleLogoChange`, the header logo block, and the `activeTab === 'info'` panel: normalize relative logo URLs with the existing `getImageUrl` helper; render logos centered with contain-style sizing; add an authorized, confirmed logo-removal action that persists an empty `logo_url`, reloads the activity, and restores the activity-code initials; preserve upload validation and feedback; and add an admin-only metadata section containing activity code, activity type, category, participation status, semester, classroom, advisor identity/contact, president, vice presidents, active-member count and capacity, founded/start/end dates, self-registration, approval requirement, attendance-scoring state, points per attendance, configured criterion, and completion-rule details when available. Newly written technical identifiers and comments must be English. Vietnamese user-facing labels and messages are an approved functional exception because this page and the surrounding application UI are Vietnamese.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx` — `ActivityDetailPage` regression tests: cover relative logo URL normalization, centered contain-style rendering, authorized logo removal and fallback restoration, failure feedback, full administrator metadata, administrator completion-rule visibility, and the absence of the restricted metadata section and logo controls for unauthorized users. Test names, fixtures, and assertion messages must be English; Vietnamese strings may appear only where assertions must match the existing Vietnamese interface.
- `docs/taskscope.md` — this task definition: keep the implementation boundary, evidence, acceptance criteria, and language exception current. All content must be English.

# 5. Out of Scope

- All backend files, API contracts, database schemas, migrations, seed data, permissions, authentication, and authorization rules.
- `frontend/src/api/activity-api.ts`, because `Activity`, `activityApi.getById`, `activityApi.update`, and `activityApi.uploadMedia` already expose the required data and operations.
- `frontend/src/components/activities/activity-view-policy.ts` and its tests, because the existing tested `getImageUrl` helper already normalizes absolute, data, and relative URLs and should only be reused.
- Activity list cards, the legacy `ActivityDetailWorkspace` component, activity create/edit forms, cover images, background configuration, card themes, attendance behavior, membership behavior, schedules, completion-rule mutation, and other routes.
- Adding new persisted fields or exposing data not already returned by `GET /activities/:id`.
- Deployment, release, merge, publish, dependency changes, generated build artifacts, unrelated refactoring, repository-wide formatting, translations, localization-resource changes, and encoding or line-ending conversion.

# 6. Context & Dependencies

- The active detail route is implemented by `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` and currently renders `activity.logo_url` directly in an `<img>` element. Backend uploads return relative paths, so direct rendering can resolve against the frontend origin and display a broken image.
- `frontend/src/components/activities/activity-view-policy.ts` exports `getImageUrl`, which preserves absolute and data URLs and prefixes relative URLs with the configured API origin. Its behavior is already covered by `activity-view-policy.test.ts`.
- The current logo uses `object-cover`, which can crop non-square logos. The requested behavior requires contain sizing and center alignment inside the existing `80 x 80` frame.
- The current default logo is the first two characters of `activity.code`; removal must return to this existing fallback rather than introduce a new default asset.
- `activityApi.update(activityId, { logo_url: '' })` uses the existing authenticated `PATCH /activities/:id` path. The backend update DTO accepts an optional string and the service already authorizes administrators, advisors, and activity presidents; no new delete-media endpoint is required.
- `ActivitiesService.findOne` already populates advisor, president, vice-president, and semester references. The frontend `Activity` model already includes the operational settings and dates required by this scope.
- The current page combines administrators and teachers in `isAdminOrAdvisor`. Logo mutation remains available to this existing authorized group. The expanded full-metadata section must be gated specifically by `isAdminUser(user)` so the user's requirement for complete administrator visibility does not silently broaden data presentation to other roles.
- Runtime and tools verified from `frontend/package.json`: Next.js 16.1.6, React 19.2.4, TypeScript 5.9.3, Vitest 3, `npm test`, and `npm run typecheck`.
- Environment: Windows with PowerShell; implementation and verification run in the local development repository.
- Language exception: new source identifiers, comments, test names, documentation, and execution artifacts are English. New user-facing labels, confirmations, and toast messages may be Vietnamese to match the existing functional UI. Existing localized content must otherwise remain unchanged.
- Preserve the existing UTF-8 file encoding and line endings. Terminal mojibake must not be treated as source-file corruption.

# 7. Steps

## PLAN

- Reconfirm the current logo render path, `getImageUrl` contract, update authorization, activity response fields, role helpers, and existing page tests.
- Confirm Scope, Out of Scope, low risk, absence of a Human Gate, and the targeted verification commands.
- Confirm that technical content is written in English and that only Vietnamese user-facing UI copy uses the documented language exception.
- Record the pre-change working-tree state and stop if overlapping user changes are present in either in-Scope source file.

## EXECUTE

- In `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`, import and apply `getImageUrl` to the logo source so both relative upload paths and existing absolute/data URLs render through the same verified policy.
- In the same logo block, replace crop-based sizing with centered contain sizing while preserving the current frame dimensions, rounded corners, loading state, keyboard accessibility, and activity-code fallback.
- In `ActivityDetailPage`, add an English-named removal handler that asks for confirmation, calls `activityApi.update(activityId, { logo_url: '' })`, prevents concurrent logo mutations, reports success or failure, reloads detail data on success, and exposes the control only when a custom logo exists and `isAdminOrAdvisor` is true.
- In the `activeTab === 'info'` panel, preserve the existing public information and add a clearly separated section gated by `isAdminUser(user)`. Render every field enumerated in Scope with stable fallbacks for missing optional values and use existing label maps and criterion-resolution data where available.
- In `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`, add focused English-named regression tests for URL normalization, fit/alignment, removal success and failure, default fallback, administrator metadata/completion-rule visibility, and unauthorized-role restrictions.
- Write all new identifiers, comments, tests, and documentation in English. Use Vietnamese only for user-visible text required by the documented UI exception, and do not rewrite unrelated existing localized strings.

## VERIFY

- Run the targeted Vitest files and TypeScript type-check commands listed below; record exit status and relevant output.
- Inspect the rendered assertions to confirm the relative URL is normalized, the logo is not cropped, removal restores initials, and administrator-only information is complete and correctly gated.
- Inspect the final diff for only the three in-Scope files, no unintended behavior, no accidental translation, and no encoding-only or line-ending-only changes.
- Confirm all newly written technical content is English and all Vietnamese additions are limited to functional UI copy or assertions against that copy.
- Confirm no `U+FFFD` replacement character was introduced.

## REFINE

- If a test, type check, or acceptance criterion fails, identify the exact failing criterion and apply the smallest correction in the affected in-Scope file.
- Re-run the targeted failing verification first, then the complete command set after it passes.
- Stop immediately on success, Scope expansion, increased risk, an applicable Human Gate, an encoding ambiguity, or after the configured iteration limit.

# 8. Acceptance Criteria

1. A relative stored logo path such as `/uploads/activities/logo.png` is rendered using the API-origin URL produced by the existing `getImageUrl` policy; absolute HTTP(S) and data URLs remain unchanged.
2. A custom logo is centered and fully visible within the existing logo frame using contain-style sizing, without stretching or crop-based clipping.
3. When a custom logo fails to load, the page presents the activity-code fallback rather than leaving a broken-image indicator.
4. An administrator, advisor, or other role already included by `isAdminOrAdvisor` can access a logo-removal control only when a custom logo exists; removal requires confirmation, persists `{ logo_url: '' }`, prevents duplicate mutation while pending, reports the result, reloads data, and restores the activity-code initials.
5. Unauthorized users cannot see or activate upload or removal controls, and existing upload validation for PNG, JPEG, WebP, and the 5 MB limit remains intact.
6. In the "General Information" tab, an administrator can see all fields explicitly enumerated in Scope, including completion-rule details when configured, with readable fallbacks for missing optional values.
7. Non-administrator roles continue to see the existing public general information but do not see the new administrator-only full-metadata section. Existing advisor capabilities outside that section remain unchanged.
8. Targeted Vitest regression tests pass and `npm run typecheck` exits successfully.
9. Only the files listed in Scope are modified; no backend, API contract, database, permission, dependency, or unrelated UI changes are present.
10. Newly written technical content is English. Vietnamese additions are limited to the documented user-facing UI exception, existing localized content is otherwise unchanged, and no unintended translation occurs.
11. Existing encoding, BOM state, and line endings are preserved; no `U+FFFD`, mojibake rewrite, encoding-only diff, or line-ending-only diff is introduced.

# 9. Verification Commands

`D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx" "src/components/activities/activity-view-policy.test.ts" -> 0; both targeted Vitest suites pass`

`D:\PROJECT\manager_points\frontend :: npm run typecheck -> 0; TypeScript reports no errors`

`D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported`

`D:\PROJECT\manager_points :: git diff -- docs/taskscope.md "frontend/src/app/(dashboard)/activities/[activityId]/page.tsx" "frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx" -> 0; diff output contains only the authorized taskscope, implementation, and regression-test changes and passes manual language, localization, encoding, and line-ending inspection`

# 10. Safety Gates

- Production, deployment, release, merge, or publish: pause before any such action and require explicit user approval. These actions are Out of Scope.
- Scope expansion: pause before modifying any path not listed in Scope, including backend, API, permission, localization-resource, or shared image-policy files, and require explicit user approval with an updated taskscope.
- Increased risk or sensitive data: pause before changing authorization, exposing additional API data, handling credentials, or introducing external side effects, and require explicit user approval.
- Destructive or irreversible action: pause before deleting stored media or adding a physical file-deletion endpoint and require explicit user approval. This task only clears the activity's logo reference and leaves media storage unchanged.
- Bulk translation, localization change, encoding conversion, or line-ending normalization: pause before the action and require explicit user approval plus exact paths and a rollback plan.

# 11. Artifacts to Review

None — no Human Gate triggered.

# 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)
