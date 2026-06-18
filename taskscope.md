# Task Scope: Student Login Works Locally but Fails in Production

## Problem Statement

Student accounts can log in successfully in the local environment, but the same student credentials fail in production with the generic message: "Incorrect account or password."

This task is scoped as an investigation and remediation plan for the production student login flow. Do not expose, print, or commit real passwords, password hashes, tokens, or `.env` values while debugging.

## Relevant Code Paths

- `frontend/src/api/auth-api.ts`
  - Builds `API_BASE` from `NEXT_PUBLIC_API_URL`.
  - Sends login requests to `POST /api/auth/login` with `{ email, password, remember }`.
- `backend/src/auth/services/auth.service.ts`
  - `login()` accepts either email or student code.
  - Numeric student code input is mapped to `<student_code>@school.edu.vn`.
  - User lookup checks both `email` and `user_name`.
  - The same generic error is returned when the user is not found or when password comparison fails.
- `backend/src/students/students.service.ts`
  - Student login accounts are generated from `student_code`, email fallback, and DOB password format `ddmmyyyy`.
  - New or legacy student accounts may initially be `inactive`.
  - Account activation and password reset regenerate the DOB-based password hash.
- `docker-compose.prod.yml`
  - Frontend depends on `NEXT_PUBLIC_API_URL`.
  - Backend depends on `MONGO_URI`.
  - Mongo initialization depends on `MONGO_DATABASE`, `MONGO_APP_USERNAME`, and `MONGO_APP_PASSWORD`.

## Current Observations

- The backend code should allow a student to enter the student code in the login field.
- Production showing the generic "incorrect account or password" message most likely means one of these cases:
  - The production user document does not exist for that student code/email.
  - The production user exists, but `pw_hash` was generated from a different DOB value than expected.
  - Production frontend is calling the wrong backend API URL.
  - Production backend is connected to a different Mongo database than expected.
  - Production data has a legacy or mismatched user record where `user_name`, `email`, `student.user_id`, or `pw_hash` is inconsistent.
- If the account were simply inactive or manually locked, the backend is expected to return a different forbidden-account message, not the generic incorrect credential message.
- The current working tree already contains a timezone-oriented student password change in `backend/src/students/students.service.ts`:
  - Student DOB passwords are now generated through `getDefaultPasswordFromDob()`.
  - The helper converts dates to GMT+7 before deriving the `ddmmyyyy` password.
  - `remediateStalePasswords()` attempts to identify or migrate accounts that were hashed with the production UTC-derived DOB password.
  - Remediation is currently gated by `PASSWORD_REMEDIATION_MODE`, defaulting to `off`; `dry-run` reports affected accounts, while `apply` updates hashes.
  - `auth.service.ts` now masks login keys in the `User not found` and `Inactive user login attempt` audit messages through `maskLoginKey()`.
  - New tests have been added for `getDefaultPasswordFromDob()`, `remediateStalePasswords()`, and `maskLoginKey()`.

## Review Findings

1. The task scope is directionally correct and covers the main production-only failure classes: wrong frontend API target, wrong backend database, missing/legacy user record, stale password hash, and DOB timezone mismatch.

2. The strongest likely root cause is DOB password generation drift between environments. The existing code history used timezone-sensitive `new Date(...).getDate()/getMonth()/getFullYear()`. If production runs in UTC while local runs in Asia/Saigon, a DOB stored as Vietnam local midnight can produce a different `ddmmyyyy` password in production.

3. The remediation code is safer than the original draft because it defaults to `off`, supports dry-run, and no longer logs the old or new DOB-derived password values. This should remain a hard requirement.

4. Production use of remediation still needs an explicit operator checklist:
   - Confirm `PASSWORD_REMEDIATION_MODE=dry-run` first and review only counts/masked identifiers.
   - Switch to `PASSWORD_REMEDIATION_MODE=apply` only after human approval.
   - Revert the mode to `off` after the remediation window.
   - Capture audit evidence without printing passwords, hashes, raw emails, or full student identifiers.

5. The remediation now searches users by both student email fallback and `user_name == student_code`, which covers the main legacy lookup paths. It still only fixes accounts whose existing hash matches the UTC-derived wrong DOB password. It will not fix:
   - Missing user records.
   - Missing or broken `student.user_id` links unless the email fallback or `user_name` match.
   - Users with hashes from another legacy algorithm or manual password.
   - Users whose email is not equal to the student email fallback.

6. The frontend `NEXT_PUBLIC_API_URL` behavior is still a necessary verification step because Next.js public env values are baked into the frontend build. A correct runtime container env does not guarantee the deployed static bundle points to the intended backend unless it was built with the correct value.

7. The backend login logs now mask the login key for the `User not found` and `Inactive user login attempt` branches. The `Wrong password` branch does not include the submitted login key, which is acceptable.

8. The new `maskLoginKey()` helper masks the email local part but leaves the email domain visible. That is usually acceptable for school-domain diagnostics, but if the project treats full email domains as sensitive, the masking policy should be tightened.

9. The remediation tests now cover key mode behavior and include a log-safety assertion that remediation logs do not contain computed wrong/correct DOB password values, hashes, raw DOB, or raw email.

10. The test cleanup for `PASSWORD_REMEDIATION_MODE` now restores the environment precisely by deleting the variable when it was originally unset.

11. Focused local verification passed with:
   - `npm test -- students/test/students.service.spec.ts auth/test/mask.util.spec.ts --runInBand`
   - Result: 2 test suites passed, 59 tests passed.

## Production Readiness Verdict

The implementation is close to production-ready for the student login issue, but it should not be treated as fully ready to roll out until the production checklist below is completed.

Production rollout is acceptable only if all of these gates are satisfied:

- The reviewed commit is the exact code that will be built and deployed.
- `NEXT_PUBLIC_API_URL` is verified in the built frontend image and points to the intended production backend.
- Backend `MONGO_URI` is verified to point to the intended production database, with secrets masked.
- A current MongoDB backup exists and at least one copy is outside the VPS or outside the Docker volume.
- `PASSWORD_REMEDIATION_MODE` remains `off` for a normal deploy.
- If remediation is needed, run `dry-run` first and review only counts/masked identifiers.
- Use `PASSWORD_REMEDIATION_MODE=apply` only in an approved remediation window, then revert it to `off`.
- Confirm one affected student login through the production frontend after deployment.
- Monitor backend logs for user-not-found, wrong-password, inactive, and lockout branches without exposing sensitive data.

Do not enable automatic production hash mutation during the initial deploy unless the dry-run result has been reviewed and explicitly approved.

## Investigation Checklist

1. Confirm the production frontend API target.
   - Verify `NEXT_PUBLIC_API_URL` used at build/runtime points to the intended production backend.
   - In the browser Network tab, confirm the login request goes to the expected `/api/auth/login` endpoint.

2. Confirm the production backend database target.
   - Verify `MONGO_URI` points to the intended production database.
   - Verify `MONGO_DATABASE` used by Mongo initialization matches the database name in `MONGO_URI`.
   - Do not print the raw URI; only compare host/database names in a masked form.

3. Inspect one affected student record in production.
   - Check `students.student_code`.
   - Check `students.email` or expected fallback email `<student_code>@school.edu.vn`.
   - Check `students.date_bir` and the expected default password format `ddmmyyyy`.
   - Check whether `students.user_id` exists and points to a real user.

4. Inspect the linked production user record without exposing secrets.
   - Confirm user exists by `user_name == student_code` or `email == <student_code>@school.edu.vn`.
   - Confirm `status` is `active`.
   - Confirm `role` points to the Student role.
   - Confirm `pw_hash` exists, but do not print it.
   - Confirm `failed_login_attempts` and `locked_until` are not blocking login.

5. Differentiate "user not found" vs "wrong password".
   - Use backend login logs or safe temporary diagnostic logging that records only a masked student code and branch result.
   - Do not log raw password, password hash, email, token, or full identifiers.

6. Validate DOB password generation consistency.
   - Compare how production stores `date_bir` versus local.
   - Watch for timezone/date parsing differences from `new Date(student.date_bir)` and local-time `getDate()/getMonth()/getFullYear()`.
   - Confirm whether the current GMT+7 helper returns the expected `ddmmyyyy` value for real production DOB shapes such as `YYYY-MM-DD`, `YYYY-MM-DDT00:00:00.000Z`, and Vietnam-local-midnight timestamps stored as UTC.
   - Add or update unit tests for `getDefaultPasswordFromDob()` before relying on the change.

7. Test the admin remediation path.
   - Use the existing student account activation flow if the user does not exist or is inactive.
   - Use the existing student password reset flow to regenerate `pw_hash` from DOB.
   - Retest login with student code and the expected DOB password.

8. Review the automatic remediation implementation before production.
   - Keep plain-text password values out of logs.
   - Keep remediation behind the explicit `PASSWORD_REMEDIATION_MODE` gate or move it to an admin action/one-off script if startup-time remediation is not desired.
   - Use dry-run mode before mutating production hashes.
   - Ensure the remediation reports only counts and masked identifiers.
   - Confirm both lookup paths remain covered: email fallback and `user_name == student_code`.
   - Add an operational rollback/checkpoint note before using `apply` in production.

## Likely Fix Options

- If production user records are missing:
  - Run or trigger the existing legacy student account sync safely, or activate affected student accounts from the admin UI.
- If hashes are stale or generated from an unexpected DOB:
  - Reset affected student account passwords through the existing reset endpoint/action.
  - Consider normalizing DOB password generation to use a date-only parser instead of timezone-sensitive `new Date(...).getDate()`.
  - If using automatic remediation, run `PASSWORD_REMEDIATION_MODE=dry-run` first, get approval, then use `apply` only for the approved remediation window.
- If frontend points to the wrong backend:
  - Correct `NEXT_PUBLIC_API_URL`, rebuild the frontend image, and redeploy.
- If backend points to the wrong database:
  - Correct `MONGO_URI`/database configuration and restart the backend after approval.
- If legacy user links are inconsistent:
  - Backfill `student.user_id` and ensure user `user_name` equals `student_code`.

## Required Code Review Items Before Merge

- Ensure no production log prints DOB-derived passwords, raw login credentials, password hashes, tokens, or full emails.
- Add tests for DOB password generation across timezone-sensitive inputs.
- Keep tests and documented dry-run behavior for stale password remediation.
- Confirm `remediateStalePasswords()` stays disabled by default and cannot mutate production data unless `PASSWORD_REMEDIATION_MODE=apply` is explicitly configured.
- Keep assertions that remediation logs never include `wrongPassword`, `correctPassword`, raw DOB values, raw hashes, or full student identifiers.
- Keep safe `PASSWORD_REMEDIATION_MODE` restoration in tests; delete it when it was originally unset.
- Keep remediation matching users by both email fallback and `user_name == student_code`.
- Confirm existing account activation/reset flows still behave correctly for inactive, locked, missing-link, and missing-user students.

## Acceptance Criteria

- An affected production student can log in with student code and the expected DOB password.
- The same account works through the production frontend, not only direct API calls.
- Backend login logs distinguish the resolved cause without exposing sensitive data.
- The fix path is documented for future imported or legacy students.
- DOB password generation has regression tests for production and local timezone cases.
- Any password remediation is approved, auditable, and does not expose the old or new default password in logs.
- No secrets, raw passwords, password hashes, tokens, or full production `.env` values are committed or shared.

## Safety Notes

- Production changes require human approval before deployment, database mutation, or account bulk updates.
- Prefer account activation/reset flows already implemented in the backend over direct database writes.
- When direct production checks are necessary, mask identifiers and never print secret fields.
