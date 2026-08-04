# Task Identity and Pipeline

- Task: `api-request-protection`
- Pipeline: `feature_development`
- Profile: Full
- Repository: `D:\PROJECT\manager_points`
- Branch/base: `main` at `c87e9c585399ddfed38c3ad57b66b4fe32b2648e`; worktree clean at planning time.
- Rule manifest: canonical rules `3.2.0`; SHA-256: `safety.md 6A3F283B...06A772`, `global.md 67806F70...46A43F`, contract `51F3677C...B51790`, orchestrator `B782109E...38D716`, pipeline `0419C072...3F41F3`.

# Risk Level

- Risk: high.
- Evidence: global request rejection changes API availability; auth/account recovery, proxy-derived client identity, Redis availability, uploads, and long-lived SSE connections are security-sensitive and cross-module.
- Environment: development implementation and verification only. Changes are reversible in Git; production rollout has a Human Gate.
- Blast radius: all Nest HTTP routes. Static `/uploads/*` bypasses Nest guards and remains outside this application limiter.

# Objective

Protect every Nest API route against abusive request volume with deterministic HTTP 429 behavior, distributed counters across backend instances, stricter controls for authentication/uploads, safe proxy identity, and bounded SSE connections, without breaking health checks, Prometheus scraping, valid authentication flows, or normal realtime reconnection.

# Scope Boundaries

- Approved: backend request throttling, Redis-backed counter storage, proxy-IP handling, auth keyed limits, SSE handshake/concurrency controls, focused upload/import limits, tests, and operator documentation.
- Write:
  - `backend/package.json`, `backend/package-lock.json`
  - `backend/src/app.module.ts`, `backend/src/main.ts`
  - new `backend/src/core/rate-limit/**`
  - `backend/src/system/system.module.ts`, `backend/src/system/system.controller.ts`
  - `backend/src/auth/controllers/auth.controller.ts`, `backend/src/auth/services/password.service.ts`, `backend/src/auth/test/password.service.spec.ts`, `backend/src/auth/test/auth-security.spec.ts`
  - SSE controllers/services and focused tests under `backend/src/{activities,notifications,attendance-sessions,summaries-point,system}/**`
  - upload/import controllers and focused tests under `backend/src/{activities,classes,students,system}/**`
  - new `backend/test/rate-limit.e2e-spec.ts`
  - `README.md` or new `docs/api-rate-limiting.md` for configuration and operations.
- Read/reference: `docker-compose.yml`, `docker-compose.prod.yml`, `infra/caddy/Caddyfile`, `infra/prometheus*.yml`.
- Additional files may enter the manifest only inside these module boundaries and only for tests or existing controller ownership; otherwise amend scope.

# Out of Scope

- Deployment, production configuration mutation, firewall/CDN/WAF/DDoS protection, Caddy custom-module installation, database migration, auth semantics, permissions, frontend retry UX, WebSocket limits, and rate limiting static `/uploads/*` assets.
- Arbitrary API performance tuning. Initial thresholds may be tuned only from measured test/telemetry evidence without weakening the mandatory auth ceilings below.

# Context and Dependencies

- `@nestjs/throttler ^6.5.0` exists, but no root `APP_GUARD`; the only guarded route is system performance telemetry at 10 requests/60 seconds. Its module-local configuration must be consolidated without losing that ceiling.
- The built-in throttler store is process-local. Redis already exists in both Compose topologies and production already supplies `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`, but backend source has no Redis client.
- Add and pin a Nest 11/Throttler 6-compatible Node Redis client/storage set after peer-dependency verification. Preferred baseline is the Nest Throttler-listed `@nestjs-redis/throttler-storage` with `@nestjs-redis/client` and `redis`; do not introduce an unmaintained adapter or custom non-atomic `INCR`/`EXPIRE` sequence.
- Production must never silently downgrade to per-process counters. Redis connection/config failure must fail startup/readiness; test/development may explicitly select the in-memory store.
- `main.ts` currently trusts every proxy. Production Caddy is one hop and backend is internal-only; development publishes the backend directly. Use topology-aware trust (`1` trusted hop in the Caddy production topology, disabled by default for direct development) and test spoofed `X-Forwarded-For`.
- Exempt `/health` and `/metrics` from quotas: Compose probes `/health`, Prometheus scrapes `/metrics`, and Caddy already blocks public `/metrics*`.
- Rate-limit keys must contain no raw email, student code, token, or reset identifier; normalize then hash sensitive identifiers. Preserve neutral account-recovery responses.
- Official design references: `https://github.com/nestjs/throttler` and `https://github.com/CSenshi/nestjs-redis/tree/main/packages/throttler-storage`.

# Steps

1. Capture baseline auth/system/realtime tests and inventory every public, upload/import, health/metrics, and SSE route; publish a policy table before mutation.
2. Add a central global rate-limit module using `ThrottlerModule.forRootAsync`, a global `APP_GUARD`, typed constants/config, standardized 429 response/`Retry-After`, and an atomic shared Redis store in production. Use named `burst` and `sustained` policies with initial per-route defaults of 30/10 seconds and 300/60 seconds per trusted client IP.
3. Replace unconditional `trust proxy=true` with topology-aware trusted-hop configuration. Make tracker keys stable for IPv4/IPv6, reject/ignore spoofed forwarding headers from untrusted direct peers, and skip only `/health` and `/metrics`.
4. Remove SystemModule-local throttler registration/guard duplication and retain `POST /api/system/performance/metrics` at 10/60 seconds through the global policy.
5. Apply explicit auth policies: register 3/hour/IP; login 10/minute/IP plus 5/15 minutes per normalized account; forgot/reset request 5/15 minutes/IP and 3/15 minutes/account; OTP resend 1/minute/request and 5/hour/request; OTP verification keeps the existing 5-attempt invalidation; refresh and session fork 30/minute/IP/session. Replace the in-memory password-reset `Map` with shared atomic keyed counters, raise HTTP 429 with retry metadata, and preserve generic/non-enumerating responses.
6. Apply upload/import handshake policies (10/10 minutes/IP) and explicit Multer file-count/file-size limits no weaker than existing activity/branding limits and safely bounded for class/student/system imports. Reject before parsing or expensive processing where Nest ordering permits.
7. Give each SSE route a reconnect-handshake ceiling (30/minute/IP; authenticated streams additionally keyed by user after JWT validation) and a concurrent connection cap (5/user for authenticated streams, 3/IP for public branding). Release counters on complete, error, abort, and disconnect; do not apply ordinary sustained request quotas to an established stream.
8. Add deterministic unit/integration/e2e coverage for policy selection, 429 body and headers, window reset, independent keys, proxy identity, Redis cross-instance atomicity/outage behavior, health/metrics exemptions, telemetry compatibility, auth privacy, upload rejection, and SSE cleanup/reconnect.
9. Document defaults, configuration, Redis dependency/failure policy, trusted-proxy topology, monitoring signals, safe tuning, and rollback. Run independent security review, affected tests, build, full backend regression, and final diff/status review.

# Acceptance Criteria

- AC1: Every Nest HTTP route is governed by the global burst and sustained policies unless it has an explicit, reviewed override or the exact health/metrics exemption.
- AC2: The `(route, policy, trusted client)` counter is atomic and shared by two backend instances; restart or replica switching cannot reset/bypass production limits.
- AC3: Exceeding a limit returns HTTP 429 with deterministic JSON and a positive `Retry-After`; the request handler, password hashing, mail send, upload processing, or SSE allocation does not execute.
- AC4: Auth routes enforce both network and hashed subject/reset-flow ceilings, do not reveal whether an account exists, and retain account lock and OTP-attempt invalidation behavior.
- AC5: Production refuses to run ready without its configured Redis limiter; development/test in-memory mode is explicit and logged, never an implicit production fallback.
- AC6: Direct requests cannot select an arbitrary client identity through `X-Forwarded-For`; a request through the one-hop Caddy topology resolves the original client consistently for IPv4 and IPv6.
- AC7: `/health` and `/metrics` remain continuously callable; telemetry remains 10/60 seconds; static uploads remain reachable and explicitly documented as edge/out-of-scope protection.
- AC8: Upload/import routes reject excessive frequency, file size, or file count before business processing, with no weakening of current 5 MB activity or 2 MB branding constraints.
- AC9: SSE reconnect storms receive 429, concurrent caps are enforced, and all termination paths release capacity without leaking counters or disrupting ordinary reconnect behavior.
- AC10: Focused, e2e, build, and full backend tests pass; an independent reviewer finds no high/critical auth bypass, proxy-spoof, Redis-fallback, key-privacy, or availability defect; final diff contains only approved paths.

# Verification

- Baseline and focused: `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/core/rate-limit src/auth/test/password.service.spec.ts src/auth/test/auth-security.spec.ts` => unit policies, keyed auth limits, proxy tracking, Redis failure policy, and SSE connection accounting pass.
- E2E: `D:\PROJECT\manager_points\backend :: npm run test:e2e -- --runInBand test/rate-limit.e2e-spec.ts test/auth.e2e-spec.ts test/app.e2e-spec.ts` => 429/headers/reset, exemptions, auth privacy, upload, and realtime handshakes pass through a bootstrap matching `main.ts`.
- Cross-instance Redis integration: start two test app instances against one isolated Redis database and alternate identical requests => a single shared threshold is enforced atomically and keys expire; Redis interruption produces the documented production failure behavior.
- Build: `D:\PROJECT\manager_points\backend :: npm run build` => Nest compiles with pinned dependencies.
- Regression: `D:\PROJECT\manager_points\backend :: npm test -- --runInBand` => existing backend suite passes.
- Static review: use ESLint in non-fixing mode (repository `npm run lint` uses `--fix` and must not be used as a read-only check) => no errors in changed TypeScript.
- Final: `D:\PROJECT\manager_points :: git diff --check`, `git diff --stat`, and `git status --short` => no whitespace defects or unintended paths.
- Load/security evidence: bounded local load verifies expected accepted/rejected counts, response latency does not collapse at the ceiling, forwarded-header spoofing fails, and no raw sensitive identifiers appear in Redis keys/logs.

# Safety Gates

- G0 — Planning-only: this taskscope does not authorize implementation. Resume only after an explicit implement/fix request.
- G1 — Dependency/storage decision before mutation: verify pinned adapter peer compatibility with Nest 11, Throttler 6.5, Node 22, and Redis 7.2. If incompatible, stop and amend the dependency/storage design; do not improvise a non-atomic store.
- G2 — Production deployment: explicit approval required after code review, passing verification/load evidence, documented Redis readiness, dashboards/alerts, rollback image/config, and staged canary. Resume at deploy only after approval.
- G3 — Infrastructure expansion: any Caddy/CDN/WAF/firewall or Compose topology mutation requires a scope amendment and applicable infrastructure/security review before change.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md` at base commit above.
- Implementation checkpoint C1: reviewed policy table, resolved dependency versions, target manifest, and baseline results before code mutation.
- C2: hash of rate-limit module/tests plus focused results after global/Redis/auth behavior passes.
- C3: final commit/hash, independent security-review report, full verification summary, load evidence, and rollback instructions before G2.

# Execution Budgets

- Step deadline: 600 seconds default, 1,800 seconds maximum for dependency install/full test/load steps.
- Idempotent retries: 2 total per failing command/API; engineering mutation loops: 3; review-remediation cycles: 2.
- Concurrency: at most 3 independent read-only/test workers; one writer per path; serialize root module, auth, lockfile, and shared rate-limit files.
- Stop on auth bypass, proxy identity ambiguity, non-atomic/shared-store failure, Redis production fallback, secrets exposure, overlapping dirty changes, scope expansion, or any Human Gate.
