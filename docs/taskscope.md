# Task Identity and Pipeline

Task: `fix-mojibake-user-messages` | Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Branch: `main` | Base: `746a6e4ed621068ce5eaa9f472ba6cadf4c54e91`

# Risk Level

Risk: medium. Development-only text corrections across frontend and backend; reversible in Git. No persistent data, public contract, deployment, or external effect.

# Objective

All user-visible Vietnamese source strings render as valid UTF-8, including the success toast after granting location permission, with regressions covered by focused tests.

# Scope Boundaries

Approved: `frontend/src/**`, `backend/src/**`.

Write:

- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Header.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `backend/src/auth/guards/check-permission.guard.ts`
- `backend/src/auth/guards/check-permission.guard.spec.ts` (new, if no equivalent focused test exists)

Known targets: location success toast at `Header.tsx:345`; malformed “Mở điểm danh” assertion; two `checkAnyPermission` exception messages.

# Out of Scope

Generated logs/caches such as `frontend/test-results.json` and `backend/src/node_modules/**`; copy changes unrelated to encoding; UI behavior, permission logic, APIs, dependencies, and deployment.

# Context and Dependencies

Source inspection found mojibake in the targets above. Matches such as “MÃ SV” and “Âm nhạc” are valid Vietnamese and must not be changed. Preserve existing encoding and line endings.

# Steps

1. Establish focused frontend/backend test baselines and rescan source-only paths.
2. Replace confirmed mojibake with intended Vietnamese without changing control flow.
3. Add/update focused assertions for the location toast and backend exception messages.
4. Run focused tests, source scan, type checks, and final diff/status review.

# Acceptance Criteria

- AC1: Granting location permission emits `Đã bật chia sẻ vị trí cho điểm danh.`
- AC2: `checkAnyPermission` returns readable Vietnamese for missing-user and missing-permission failures.
- AC3: The malformed activity test label is valid UTF-8.
- AC4: No confirmed mojibake remains under `frontend/src/**` or `backend/src/**`; generated artifacts and valid Vietnamese false positives are excluded.
- AC5: No permission, location, or attendance behavior changes.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/layout/Header.test.tsx "src/app/(dashboard)/activities/[activityId]/page.test.tsx"` => focused frontend tests pass.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/auth/guards/check-permission.guard.spec.ts` => focused backend tests pass.
- `D:\PROJECT\manager_points :: rg -n --glob "frontend/src/**" --glob "backend/src/**" --glob "!**/node_modules/**" "Ä|Ä‘|Ă£|Ă´|áº|á»|Æ°|Æ¡|â€™|â€œ|â€|ï¿½|�" .` => no confirmed mojibake; any match is manually classified.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` and `D:\PROJECT\manager_points\backend :: npm run build` => affected projects compile.
- `D:\PROJECT\manager_points :: git diff --check` => patch formatting is valid.

# Safety Gates

None.

# Artifacts and Checkpoints

Final diff, focused test output, compile results, and source-scan result. No checkpoint/hash required before implementation.

# Execution Budgets

One serialized writer per path; up to 3 implementation/verification iterations, 2 remediation cycles, and 2 idempotent retries. Stop for boundary expansion, generated-file mutation, new dependency, behavior change, or any Human Gate.
