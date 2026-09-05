# Manager Point — targeted navigation

Use this map only to find the owning code or verification entrypoint.
Paths were checked against the repository on 2026-09-05; confirm the selected
target and its current imports/scripts before use. This is a navigation index,
not a specification of business behavior. Do not load every listed path.

## Start from the symptom

| Request concerns | Start here | Follow only when needed |
| --- | --- | --- |
| Page or dashboard behavior | `frontend/src/app/` | Imported component in `frontend/src/components/`, then its API call. |
| API request/response | `frontend/src/api/` | Corresponding backend controller, DTO, service, and direct caller. |
| Shared request/auth behavior | `frontend/src/api/http-client.ts`, `frontend/src/providers/auth-provider.tsx` | `frontend/src/api/auth-api.ts`, `backend/src/auth/`. |
| Backend domain behavior | Matching domain under `backend/src/` | Controller → DTO/guard → service → schema; module for provider wiring. |
| Permission failure | Guard used by the actual controller | `backend/src/auth/guards/`; frontend visibility is not authorization. |
| Storage or PDF | `backend/src/core/storage/`, `backend/src/pdf-template/` | `frontend/src/api/pdf-template-api.ts`; no runtime uploads/templates without authority. |
| Repository workflow | `AGENTS.md`, `.agents/` | Only the referenced rule/template or selected skill. |

Domain starting points include `backend/src/students/`,
`backend/src/classes/`, `backend/src/activities/`,
`backend/src/attendance-sessions/`, `backend/src/summaries-point/`,
`backend/src/dormitory/`, `backend/src/notifications/`, and
`backend/src/system/`. API filenames need not match the plural backend name:
for example `frontend/src/api/student-api.ts` connects student-facing calls.
Locate the actual route/method before assuming ownership.

## Local patterns to preserve

- Frontend: App Router pages, domain components, existing typed API functions and
  shared HTTP client. Follow the target's client/server boundary and state/error
  conventions; do not introduce a second request or auth layer.
- Backend: Nest controller/DTO/service/schema/module conventions. Controllers
  can use different guards; inspect the actual endpoint, validation, and caller
  identity. Check provider registration when adding or injecting a service.
- A domain can reference another domain's schema/service; directory names alone
  do not prove isolation. Inspect imports for the changed symbol.
- Read source/tests as observed behavior. Use relevant `docs/` only to resolve
  domain intent; report a material contradiction instead of choosing silently.
- Use synthetic test data; do not query personal records to understand code.

## Verification entrypoints

Confirm the relevant script in the package's `package.json` before execution.
Run from repository root; replace placeholders with existing, quoted paths.

| Change | Narrow command / configuration |
| --- | --- |
| Frontend behavior | `npm --prefix frontend test -- "<src/path.test.tsx>"`; Vitest, `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`. |
| Frontend typing | `npm --prefix frontend run typecheck`. |
| Backend behavior | `npm --prefix backend test -- --runTestsByPath "src/<path.spec.ts>" --runInBand`; Jest config in `backend/package.json`. |
| Backend compilation | `npm --prefix backend run build`. |
| Next build impact | `npm --prefix frontend run build` only when required. |
| Instructions/docs only | Check referenced paths, conflicting rules and representative workflow cases; `git diff --check -- <changed-paths>`. |

Frontend tests use jsdom and the `@` alias to `frontend/src`; backend Jest
uses `src` as root and `*.spec.ts`. Find the nearest existing test before
creating one. A zero-test run or skipped required case is not a pass.

Backend lint includes `--fix` and is a mutation. Frontend lint is configured as
`next lint`; verify compatibility before using it as a gate. Avoid broad
format commands, coverage runs, watch mode, dependency installation, or runtime
migration/seed scripts as ordinary verification.
