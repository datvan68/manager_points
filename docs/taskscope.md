Task: `backend-startup-latency` | `bug_fix` | Risk: medium | Profile: Quick

Objective: Measure cold-start phases and reduce time-to-healthy by at least 30% on the same development stack without weakening RBAC readiness or changing persisted data semantics.

Boundary: NestJS backend bootstrap and authentication initialization only; preserve MongoDB/Redis configuration, migrations, seed outcomes, API contracts, and production fail-fast behavior. | Write: `backend/src/main.ts`, `backend/src/auth/services/auth.service.ts`, `backend/src/auth/test/auth.service.spec.ts`

Targets: `bootstrap()`, `AuthService.onModuleInit()`, and RBAC seed regression tests. Seven database-backed auth migration/seed operations are awaited serially before `app.listen()`; unrelated hooks remain observation-only unless timing proves material, requiring scope promotion.

Steps: Record cold-start and per-phase timings; identify redundant reads/writes and safe independent work in auth initialization; add idempotent fast paths or bounded concurrency only where dependencies permit; retain required initialization before readiness; add regression coverage for execution order, idempotency, and failure propagation; compare repeated cold starts and review the scoped diff.

Verify: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand auth/test/auth.service.spec.ts` => auth initialization and RBAC seed tests pass; `npm run build` => backend compiles; start `node dist/main.js` against the configured development stack and poll `http://127.0.0.1:8001/health` => median of three cold starts is at least 30% faster than baseline and returns `OK`.

Done: Timing evidence identifies the dominant phase; the same-environment median meets the target; health is unavailable until required auth initialization succeeds; seed/migration outcomes and API behavior remain unchanged.

Gate: None
