# Taskscope: Validate Club Favorites and Student Self-Service Transfer Limits

## 1. Task ID + Pipeline

Task ID: `TSK-CLUB-FAVORITES-TRANSFER-20260710`

Pipeline: `pr_review`

## 2. Risk Level

Risk Level: `medium`

Reason: the task verifies authenticated-user interactions, per-user counters, and student membership transitions. A regression could expose an action to an unintended user or permit a student to exceed the self-service transfer limit.

## 3. Objective

Verify that every authenticated user who can open the club page can favorite and unfavorite a club exactly once, and that the displayed favorite total matches persisted records. Verify that the three self-service club-transfer attempts per active semester are enforced for a student in both the `/club/clubs` UI and backend API.

## 4. Scope

Change exactly these files if verification identifies a missing assertion or defect:

- `backend/src/clubs/clubs.service.ts`
- `backend/src/clubs/clubs.service.spec.ts`
- `backend/test/clubs-favorite.e2e-spec.ts`
- `frontend/src/app/(dashboard)/club/clubs/page.tsx`
- `frontend/src/app/(dashboard)/club/clubs/page.test.tsx`
- `frontend/src/app/(dashboard)/club/clubs/membership-policy.ts`
- `frontend/src/app/(dashboard)/club/clubs/membership-policy.test.ts`

## 5. Out of Scope

- Do not change MongoDB schema definitions, indexes, or run migrations in `backend/src/clubs/schemas/*.ts`.
- Do not alter login, JWT issuance, RBAC seed data, role assignments, or permission-guard implementation.
- Do not change club capacity, advisor approval, schedule, attendance, or point-calculation rules.
- Do not change API routes, response field names, production `.env*` files, Docker files, CI/CD files, or deployment configuration.
- Do not modify unrelated frontend routes or shared authentication storage.

## 6. Context & Dependencies

- `backend/src/clubs/clubs.controller.ts` protects favorite endpoints with `JwtAuthGuard`, not a role-specific permission guard.
- `backend/src/clubs/schemas/club-favorite.schema.ts` has a unique `{ club_id, user_id }` index; `ClubsService.getClubStats()` counts favorites by `club_id`.
- `frontend/src/app/(dashboard)/club/clubs/page.tsx` loads favorite IDs, fetches per-club statistics, optimistically updates a count, then applies the API-returned count.
- `ClubsService.countCompletedSelfServiceTransfers()` counts only `self_service` and `completed` transfer records for one student and semester. The current limit is three.
- `ClubsService.switchClub()` resolves the authenticated user to a student profile, rejects a fourth self-service transfer before mutating memberships, and creates the transfer record in a transaction.
- The frontend calls `GET /clubs/my/transfer-policy?semester_id=<activeSemesterId>` and uses `membership-policy.ts`; the backend remains the authority.
- Run backend commands from `backend` and frontend commands from `frontend`.

## 7. Steps

### PLAN

1. Inspect favorite endpoint decorators in `backend/src/clubs/clubs.controller.ts` and confirm that valid JWT authentication, rather than role code, controls access.
2. Trace `favoriteClub()`, `unfavoriteClub()`, and `getClubStats()` in `backend/src/clubs/clubs.service.ts` to verify persistence, duplicate handling, and returned totals.
3. Trace `countCompletedSelfServiceTransfers()`, `getMyTransferPolicy()`, `switchClub()`, `page.tsx`, and `membership-policy.ts` to map the student transfer rule from API to UI.

### EXECUTE

4. In `backend/test/clubs-favorite.e2e-spec.ts`, add authenticated `STUDENT`, `TEACHER`, and `ADMIN` cases proving each role can favorite and unfavorite the same club without changing another user's favorite.
5. In `backend/test/clubs-favorite.e2e-spec.ts`, assert repeated sequential POST requests create one favorite record and `GET /api/clubs/:id/stats` equals the number of persisted records.
6. In `backend/src/clubs/clubs.service.ts`, only if a concurrent duplicate request returns MongoDB error `11000`, treat it as an idempotent successful favorite and return the current count.
7. In `backend/src/clubs/clubs.service.spec.ts`, assert that only completed self-service transfers for the requested student and semester count toward the limit and that a fourth request mutates no membership or transfer record.
8. In `frontend/src/app/(dashboard)/club/clubs/membership-policy.test.ts`, cover zero, two, and three transfers; at three, assert `ADMIN_REQUIRED`, disabled UI, and no self-service request.
9. In `frontend/src/app/(dashboard)/club/clubs/page.test.tsx`, mock a Student session and policy response to assert the `used / 3` indicator, remaining-attempt text, and `clubApi.switchClub()` only while allowed.

### VERIFY

10. Run focused backend unit, favorite E2E, and focused frontend tests. Confirm the third Student transfer returns `self_service_changes_used: 3` and the fourth returns HTTP 403 without membership mutation.
11. Run backend and frontend builds to type-check the affected application bundles.

### REFINE

12. If testing finds a UI/API mismatch, change only scoped code, rerun the failed focused test, then rerun all verification commands. Stop and request direction if a correction requires RBAC changes, a database migration, or changing the three-transfer business rule.

## 8. Acceptance Criteria

- Any authenticated user with a valid JWT can favorite and unfavorite a club; unauthenticated requests remain rejected.
- One user contributes at most one persisted favorite to a club, including repeated sequential and concurrent duplicate requests.
- `favorite_count` equals the number of persisted favorite records for the club and the UI reconciles to the API response.
- A Student's policy counts only completed self-service transfers for that Student and semester; `teacher_approval` and `admin_direct` do not consume the allowance.
- The Student UI displays the used count and prevents a self-service request after three transfers.
- The backend returns HTTP 403 for a fourth self-service transfer before source or target membership mutation.
- Every command in Section 9 passes.

## 9. Verification Commands

```powershell
Set-Location backend; npm test -- clubs.service.spec.ts
Set-Location backend; npm run test:e2e -- clubs-favorite.e2e-spec.ts
Set-Location frontend; npm test -- "src/app/(dashboard)/club/clubs/membership-policy.test.ts" "src/app/(dashboard)/club/clubs/page.test.tsx"
Set-Location backend; npm run build
Set-Location frontend; npm run build
```

## 10. Safety Gates

- No Human Gate is required for local source/test changes in the scoped files.
- Trigger a Human Gate before any production deployment, database migration/index change, production database modification, RBAC/permission change, or alteration to the three-transfer rule.
- Request product-owner approval if the required limit is not exactly three transfers per student per semester.

## 11. Artifacts to Review

- `backend/test/clubs-favorite.e2e-spec.ts` output proving role coverage and favorite-count assertions.
- `backend/src/clubs/clubs.service.spec.ts` output proving semester/mode filtering and fourth-transfer rejection.
- `frontend/src/app/(dashboard)/club/clubs/membership-policy.test.ts` and `frontend/src/app/(dashboard)/club/clubs/page.test.tsx` outputs proving the Student UI limit.
- Backend and frontend build logs.
- Redacted third- and fourth-transfer HTTP responses if a Human Gate is triggered.

## 12. loop_iterations override

`2` iterations. The task is verification-focused; one concrete test-driven refinement pass is sufficient and remains below the safety maximum of three.
