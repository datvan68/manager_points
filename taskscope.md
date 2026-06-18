# Production Stability Task Scope

## Context

The production system is deployed with Docker Compose using `docker-compose.prod.yml`.
The active production concerns are:

- Users are being logged out too quickly.
- Student accounts must continue to log in with student code/MSSV and the original date-of-birth password pattern.
- VPS memory usage is above 80%.
- MongoDB production data location must be clearly identified and protected.

This scope is limited to analysis, code/config changes, documentation, and verification steps. Any production deploy, database mutation, volume deletion, restore, secret rotation, or infrastructure change requires explicit human approval before execution.

## Current Findings From Repository Review

### Authentication and Logout Timing

- Backend access tokens are signed with `expiresIn: "15m"` in `backend/src/auth/auth.module.ts`.
- Frontend refreshes the session every 5 minutes in `frontend/src/providers/auth-provider.tsx`.
- `frontend/src/api/http-client.ts` also refreshes automatically when a protected API request returns `401`, and it already queues concurrent refresh attempts through `isRefreshing` and `refreshSubscribers`.
- Refresh tokens are stored as HTTP-only cookies named `refresh_token`.
- Backend refresh token duration is currently:
  - Admin: `1 / 6` day, approximately 4 hours.
  - Non-admin with `remember=true`: 30 days.
  - Non-admin without remember: 1 day.
- Login sets a persistent cookie only when `remember=true`; otherwise it uses a browser session cookie.
- Current repository state: admin login with `remember=true` now sets the refresh cookie to approximately 4 hours, matching the backend admin refresh-token duration. This should still be verified in the deployed production build because the issue report may come from an older deployed revision.
- Refresh response now derives cookie `maxAge` from the rotated refresh token `expires_at` only when `remember=true`.
- Previous risk to verify: older code may have allowed admin users with `remember=true` to receive a 30-day browser cookie while the backend token expired after about 4 hours. The current repository no longer shows that mismatch, but production must confirm it is running this version.
- Policy decision still needed: non-admin users without remember get a browser session cookie while the backend refresh token lasts 1 day. This is acceptable only if "no remember" intentionally means "until browser closes or backend token expires, whichever comes first."
- `AuthProvider` no longer logs out on every silent refresh exception; it logs out only when the error has status `400`, `401`, or `403`.
- `loadUserPermissions()` still clears local auth state on `/api/auth/me` `401`, and `/api/students/me` `401` for student users. This is correct for confirmed unauthorized responses, but it should not be triggered by transient network errors.
- Token rotation includes a 10-second grace period for a just-revoked refresh token when it has a valid `replaced_by` token. Outside that grace path, reuse of a revoked refresh token is treated as a security event and revokes all refresh tokens for that user. This is intentional, but overlapping refresh flows or multiple tabs still need regression coverage.
- `frontend/src/api/http-client.ts` exposes `synchronizedRefreshToken()` and `AuthProvider` uses it, so periodic refresh and 401-triggered refresh now share the same in-tab refresh promise. This reduces duplicate refresh calls inside one tab, but it does not coordinate refresh calls across different browser tabs.

### Student Login Compatibility

- Student login supports numeric login identifiers by mapping MSSV/student code to the generated student email form.
- Student user accounts are generated with `user_name = student.student_code`.
- Student passwords are generated from date of birth using `ddMMyyyy`.
- Legacy student account sync updates name-based usernames back to `student_code`.
- Student account activation and password reset flows also use the DOB password pattern.
- The task must preserve this behavior unless a separate security migration is explicitly approved.
- Current repository state: `backend/src/auth/test/auth-security.spec.ts` includes focused backend coverage for active student login using MSSV plus `ddMMyyyy` password, and also covers inactive student rejection. These tests should be kept in CI and re-run before production rollout.
- Remaining review item: add or keep higher-level coverage only if needed for the full HTTP/login-form flow, because the current focused backend test does not prove browser cookie handling or the visible login form behavior.

### MongoDB Production Data Location

- MongoDB service uses the official `mongo:7.0` image.
- MongoDB is started with `mongod --wiredTigerCacheSizeGB 0.25`, so WiredTiger cache is already capped at about 256 MB in the Compose file.
- MongoDB data is stored inside the container at `/data/db`.
- The container path `/data/db` is backed by the Docker named volume `mongo-data` from `docker-compose.prod.yml`.
- On a typical rootful Linux Docker host, the physical host path is under:

```text
/var/lib/docker/volumes/<compose-project>_mongo-data/_data
```

- The exact production host path must be confirmed with Docker inspection, because the Compose project prefix depends on how production is launched.

Safe verification commands for the production server:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps mongodb
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb mongosh --quiet --eval "db.adminCommand('ping').ok"
docker volume ls | grep mongo-data
docker volume inspect <actual_mongo_data_volume_name>
```

Do not delete or recreate the MongoDB volume unless there is an approved restore plan and a verified backup.

Related documentation exists in `docs/production-mongodb-safety.md`, but it should be reviewed for encoding/readability and kept aligned with this scope. Markdown output for project docs should be English by default unless a Vietnamese operator runbook is explicitly requested.

### VPS Memory Pressure

- Production Compose already defines `deploy.resources` memory limits and reservations:
  - Caddy: 128 MB limit, 64 MB reservation.
  - Frontend: 512 MB limit, 256 MB reservation.
  - Backend: 512 MB limit, 256 MB reservation.
  - MongoDB: 1024 MB limit, 512 MB reservation.
  - Redis: 128 MB limit, 64 MB reservation.
  - Prometheus: 256 MB limit, 128 MB reservation.
  - Grafana: 256 MB limit, 128 MB reservation.
- Compose `deploy.resources` is always enforced in Docker Swarm, but may not be enforced by every standalone Docker Compose/runtime combination. Production must verify whether these limits are active with `docker inspect` or `docker stats`.
- MongoDB WiredTiger is already capped to `0.25` GB in `docker-compose.prod.yml`; the remaining MongoDB memory can still include connections, indexes, journal, filesystem cache behavior, and process overhead.
- Next.js, NestJS, MongoDB, Redis, Caddy, and optional monitoring services can collectively push a small VPS above 80% memory.
- Monitoring services are behind the `monitoring` profile, but if enabled they add Prometheus and Grafana memory load.
- Container logging is capped through the shared `json-file` logging config (`max-size: 10m`, `max-file: 3`), so log growth is less likely to be the main memory issue, but disk usage should still be checked separately.
- Because Linux may count filesystem cache as used memory, production memory review must distinguish true container/process pressure from reclaimable cache. The first report should include both `free -h` and `docker stats --no-stream`.

## Goals

1. Make normal users and students remain logged in for the expected duration.
2. Keep admin sessions intentionally shorter than normal users, unless product owner approves otherwise.
3. Preserve MSSV plus date-of-birth student login compatibility.
4. Identify the exact production MongoDB volume and document backup-safe handling.
5. Reduce or control VPS memory pressure without risking production data.

## Non-Goals

- Do not change the student credential format in this task.
- Do not rotate production secrets in this task unless separately approved.
- Do not delete Docker volumes, containers, backups, or database files.
- Do not run database restore/migration commands without human approval.
- Do not expose MongoDB or Redis ports publicly.

## Proposed Work Plan

### 1. Session Lifetime Audit and Fix

Review and align the following files:

- `backend/src/auth/auth.module.ts`
- `backend/src/auth/controllers/auth.controller.ts`
- `backend/src/auth/services/auth.service.ts`
- `backend/src/auth/services/token.service.ts`
- `frontend/src/providers/auth-provider.tsx`
- `frontend/src/api/auth-api.ts`

Tasks:

- Confirm intended session policy:
  - Access token: short-lived, currently 15 minutes.
  - Normal user refresh token: 1 day without remember, 30 days with remember.
  - Admin refresh token: currently 4 hours.
- Decide the correct admin cookie behavior:
  - Option A: keep the current repository behavior: `remember=true` for admins creates a persistent cookie with a lifetime matching the 4-hour backend token.
  - Option B: allow longer admin sessions by changing backend refresh token duration, with explicit approval because it changes security posture.
- Preserve refresh token rotation and revoked-token reuse detection.
- Keep refresh cookie rotation aligned with the stored refresh token expiration.
- Confirm whether access token storage in `sessionStorage` is intentional. Because the access token is not persisted across browser restarts, startup depends on the refresh cookie and stored user data.
- Review overlap between periodic `AuthProvider` refresh and `httpClient` 401-triggered refresh so two refresh flows do not race each other.
- Confirm that `synchronizedRefreshToken()` is the only refresh path used by frontend auth/session code. If new code calls `authApi.refreshToken()` directly, it can bypass the in-tab refresh lock.
- Decide whether cross-tab refresh coordination is required. If users commonly keep multiple tabs open, consider a browser-level coordination mechanism such as `BroadcastChannel`, localStorage locking, or a less aggressive revoked-token reuse policy.
- Keep frontend silent refresh failure handling less abrupt for transient network/server errors, while still logging out on confirmed `400`, `401`, or `403`.
- Add clear comments/tests around remember-me behavior.

Acceptance criteria:

- A normal non-admin user with remember enabled stays logged in across refresh cycles and browser restarts within the configured lifetime.
- A normal non-admin user without remember stays logged in during the browser session and can refresh until the backend refresh token expires.
- An admin session expires according to the configured admin policy, and the cookie lifetime does not imply a longer usable session than the backend token allows.
- Production response headers confirm admin `remember=true` no longer receives a 30-day refresh cookie unless that policy is explicitly approved.
- A failed network request to `/api/auth/refresh` does not instantly destroy a valid user session unless the backend confirms unauthorized status.
- Concurrent tab/API refresh tests do not accidentally revoke all user tokens during normal usage.

### 2. Student Login Regression Protection

Tasks:

- Verify that numeric MSSV login still maps to the generated student account.
- Verify that student account generation still uses:
  - `user_name = student_code`
  - generated email fallback based on `student_code`
  - date-of-birth password format `ddMMyyyy`
- Verify legacy account sync, activation, and reset password flows keep the same student login contract.
- Verify that the login form label/copy still allows MSSV, not only email, so the preserved backend behavior remains discoverable to students. Current repository copy uses "Email hoặc mã sinh viên".
- Keep the existing backend regression tests for MSSV plus DOB login and inactive student rejection. Add HTTP/E2E coverage if the production issue appears only through the deployed login form.

Acceptance criteria:

- Existing student users can log in with MSSV and date of birth.
- Newly created/imported students receive compatible linked login accounts.
- Reset/reactivation flows preserve MSSV login behavior.
- Focused backend auth tests for active and inactive student login pass in CI.

### 3. Production Memory Investigation

Use read-only production diagnostics first:

```bash
free -h
docker stats --no-stream
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 mongodb
```

Tasks:

- Identify which container is consuming the most memory.
- Record VPS total RAM, swap status, and available memory, not only the used percentage.
- Check whether monitoring profile is running unnecessarily.
- Confirm whether the configured `deploy.resources` memory limits are actually enforced by the production Docker runtime.
- Confirm whether Compose is launched through standalone Docker Compose or Swarm, because that changes the reliability of `deploy.resources` enforcement.
- Check MongoDB memory behavior with the existing `--wiredTigerCacheSizeGB 0.25` setting before changing it.
- Check backend/frontend for memory leak indicators, repeated errors, or uncontrolled polling.
- Consider adding Compose resource limits after measurement:
  - Convert `deploy.resources` to runtime-enforced memory settings if production Compose does not enforce them.
  - Adjust MongoDB WiredTiger cache only if measurement shows it is still appropriate.
  - Add Node.js `--max-old-space-size` for backend/frontend if needed.
  - Temporarily disable monitoring profile if Prometheus/Grafana are not required on a small VPS.

Acceptance criteria:

- A before/after memory report exists.
- The top memory consumers are identified.
- Recommended production changes are listed by risk level.
- Any applied config change has rollback instructions.

### 4. MongoDB Data Location and Backup Safety

Tasks:

- Confirm the actual named volume on the VPS using `docker volume inspect`.
- Document the host mountpoint without exposing credentials.
- Confirm that MongoDB uses internal Docker networking only.
- Confirm that backups are stored outside the MongoDB container volume and are not the only copy.
- Add a short runbook section for checking volume, backup, and restore prerequisites.
- Ensure backup commands use the correct Compose file and environment file, and that any command output containing credentials is redacted before being pasted into docs or tickets.

Acceptance criteria:

- The exact production MongoDB volume name and mountpoint are known.
- Operators know that production data is in Docker volume `mongo-data` mounted to `/data/db`.
- No one relies on source repo files for production MongoDB data.
- A backup exists before any deploy or risky auth/session change.
- Backup artifacts are stored outside the MongoDB Docker volume and at least one copy exists outside the VPS.

## Risk Notes

- Short access tokens are normal; the likely issue is refresh token/cookie behavior or failed refresh handling.
- The refresh endpoint rotates tokens. Current code has an in-tab refresh promise and a backend 10-second grace path, but cross-tab refresh behavior still needs testing.
- The current refresh controller preserves `maxAge` on rotated remember-me cookies, and the current login controller aligns admin remember cookies with the 4-hour admin token. Production must verify the deployed revision has this behavior.
- Student DOB passwords are convenient but weak. Preserve behavior for compatibility in this task, but plan a future migration toward first-login password change or one-time activation.
- MongoDB volume deletion is destructive. Never run `docker compose down -v` on production unless a full restore plan is approved.
- Memory fixes should be measurement-driven. Hard memory limits can cause container restarts if set too low.
- `deploy.resources` may give a false sense of protection if the production runtime does not enforce it. Verify enforcement before assuming memory is capped.
- Do not publish `.env.production`, raw MongoDB URIs, JWT secrets, cookie values, or backup files in task reports.

## Verification Checklist

- [ ] Login as a normal staff/user account without remember.
- [ ] Login as a normal staff/user account with remember.
- [ ] Login as a student account using MSSV and DOB password.
- [ ] Run the focused backend auth tests that cover MSSV/DOB login and admin remember-cookie duration.
- [ ] Keep sessions active through at least two silent refresh intervals.
- [ ] Restart browser and verify remember-me behavior.
- [ ] Verify admin session expiration policy.
- [ ] Confirm `/api/auth/refresh` sets cookie attributes consistently after rotation.
- [ ] Confirm admin login with `remember=true` creates a cookie that expires with the configured admin policy, currently about 4 hours in the repository.
- [ ] Test two tabs or overlapping API requests through access-token expiry to confirm refresh rotation does not force logout in normal use.
- [ ] Confirm frontend session refresh uses `synchronizedRefreshToken()` and does not contain direct duplicate refresh paths.
- [ ] Confirm deployed production commit/version matches the reviewed repository behavior.
- [ ] Confirm MongoDB volume name and mountpoint on the VPS.
- [ ] Confirm a valid MongoDB backup exists before production changes.
- [ ] Confirm at least one MongoDB backup copy exists outside the VPS.
- [ ] Confirm whether Docker enforces `deploy.resources` limits on the production host.
- [ ] Capture `docker stats --no-stream` before and after memory-related changes.

## Deliverables

- Code/config patch for session lifetime and refresh behavior, if approved.
- Regression tests for auth refresh and student login compatibility.
- Production memory diagnosis report.
- MongoDB production data location note with exact volume inspect output, redacted where needed.
- Updated production runbook section if any operational steps change.
