# Student Permissions Display Build Error and Login Impact Review

## Objective

Review the build error shown in the screenshot and document whether the recent `/permissions` student display-name changes can affect the dedicated student login flow:

- student login identifier: student code
- initial/default password: date of birth in `ddmmyyyy`
- admin activation required before login
- `/permissions` user-management display should show the student full name without changing login identity

## Screenshot Error

The screenshot shows a Next.js build/parsing error in:

```text
frontend/src/app/permissions/page.tsx
```

The error is:

```text
Expected ',', got 'const'
```

The failing area is around the import block for `preview-permissions`.

Current broken shape:

```ts
import {
  resolvePreviewSubject,
  getPreviewPermissions,
  buildSystemPreviewAccess,
  getPagePreviewScope,
  type PreviewSubject,
  type PreviewPermissionItem
const getUserDisplayName = (user: any) =>
  user?.student_profile?.full_name || user?.display_name || user?.user_name || user?.username || 'Unknown user';
```

The import block is missing:

- the closing `}`
- the `from './preview-permissions';` clause
- a blank separation before declaring `getUserDisplayName`

Correct shape:

```ts
import {
  resolvePreviewSubject,
  getPreviewPermissions,
  buildSystemPreviewAccess,
  getPagePreviewScope,
  type PreviewSubject,
  type PreviewPermissionItem,
} from './preview-permissions';

const getUserDisplayName = (user: any) =>
  user?.student_profile?.full_name ||
  user?.display_name ||
  user?.user_name ||
  user?.username ||
  'Unknown user';
```

## Current Implementation Review

### Backend Student Login Identity

- `StudentsService.generateStudentUser()` creates the linked user with `user_name = student.student_code`.
- The generated default password is derived from `student.date_bir` in `ddmmyyyy` format.
- Auto-created student users are created as `inactive`.
- `StudentsService.activateStudentAccount()` activates the linked account and creates the account with `user_name = student.student_code` if no linked user exists.
- `AuthService.login()` still supports numeric student-code login by resolving a numeric input to `<student_code>@school.edu.vn` and also checking `user_name = loginKey`.
- `AuthService.login()` rejects `inactive` users, so admin activation is still required before a student can sign in.

Conclusion:

- The display-name change should not affect student login as long as it only adds `display_name` and `student_profile`.
- Do not overwrite `user.user_name` with `student.full_name`.

### Backend `/permissions` User Enrichment

- `AuthModule` now registers `Student` and `StudentSchema`.
- `AuthService.getUsers()` now loads users, finds linked student profiles by `user_id`, and returns:
  - `display_name = student.full_name` for linked students
  - `student_profile.student_code`
  - `student_profile.full_name`
  - `student_profile.class_id`
- For non-student users, `display_name` falls back to `user.user_name`.

This is the correct backend direction because it avoids per-row frontend requests and keeps the login username untouched.

### Frontend `/permissions` Display

- The user table now intends to render `getUserDisplayName(user)` as the primary name.
- The user table search now includes:
  - `user_name`
  - `email`
  - `display_name`
  - `student_profile.full_name`
  - `student_profile.student_code`
- The preview user selector and preview identity card also intend to use `getUserDisplayName()`.

These changes are functionally correct, but the current syntax error prevents the page from compiling.

## Findings

### P0 - Build Is Broken By A Malformed Import Block

Impact:

- `/permissions` cannot compile.
- A production build can fail even though the backend login flow is unchanged.
- The app may show the build overlay before admins can verify the new student display-name behavior.

Required fix:

- Close the `preview-permissions` import block correctly.
- Add `from './preview-permissions';`.
- Declare `getUserDisplayName` after all import statements.

### P0 - Student Login Must Keep `user_name = student_code`

Impact if violated:

- Student-code login can break if `user_name` is changed to the student's full name.
- Default DOB password login after admin activation depends on the linked user remaining findable by student code/email fallback.

Required guardrail:

- Display full name through `display_name` or `student_profile.full_name`.
- Keep `user_name` as the student account identifier.
- Do not save student full name through `authApi.updateUser({ user_name: ... })`.

### P1 - `/permissions/[id]` Still Needs The Same Display Rule

The list page is being updated, but the detail page also needs review.

Required fix:

- Show `student_profile.full_name` as the primary header/name for student accounts.
- Show `student_profile.student_code` and `user_name` as account metadata.
- Keep student profile name editing separate from account username editing.

### P1 - Need Regression Tests For Student Login After Display Enrichment

Required coverage:

- A student user with `user_name = student_code` can log in using the student code after admin activation.
- An inactive student cannot log in even with the correct DOB password.
- Enriched `/api/auth/users` response includes `display_name` and `student_profile` without mutating `user_name`.
- `/permissions` renders full name for student accounts and still searches by student code.

### P2 - UI Labels Should Avoid Encoding Drift

Some visible Vietnamese labels in the file may appear corrupted depending on encoding/tooling.

Recommended check:

- Keep source files in UTF-8.
- Verify labels such as "Student code" or localized Vietnamese equivalents render correctly in the browser after the build error is fixed.

## Required Fix Plan

1. Fix the malformed import in `frontend/src/app/permissions/page.tsx`.
2. Keep `getUserDisplayName` at module scope after imports.
3. Confirm `getUserDisplayName` is used only for display and search, not for login or update payloads.
4. Confirm `AuthService.getUsers()` enrichment does not mutate `user_name`.
5. Update `/permissions/[id]` to use the same display-name rule for student accounts.
6. Add backend tests for student login by student code plus DOB password after admin activation.
7. Add backend tests proving inactive students remain blocked.
8. Add backend tests for enriched users API preserving `user_name`.
9. Add frontend coverage or manual verification for `/permissions` table, search, and preview selector.
10. Run a production build after the syntax fix.

## Verification Checklist

1. Start the frontend and confirm `/permissions` no longer shows `Expected ',', got 'const'`.
2. Run the frontend build and confirm parsing succeeds.
3. Create/import a student with `student_code = SV001` and a known `date_bir`.
4. Confirm the linked user has:
   - `user_name = SV001`
   - password hash generated from DOB `ddmmyyyy`
   - `status = inactive`
5. Attempt login with `SV001` and DOB password before activation; expect blocked.
6. Admin activates the account.
7. Attempt login with `SV001` and DOB password after activation; expect success.
8. Call `GET /api/auth/users`; confirm:
   - `user_name` is still `SV001`
   - `display_name` equals the student full name
   - `student_profile.student_code` equals `SV001`
9. Open `/permissions`; confirm the table shows the full name as primary text and student code as secondary text.
10. Search by full name and by student code; both should find the same student account.

## Acceptance Criteria

- The `/permissions` page compiles without the screenshot build error.
- Student display-name changes do not alter student login identity.
- Student login by student code and DOB password still works after admin activation.
- Inactive students still cannot log in before admin activation.
- `user_name` remains the account identifier for student accounts.
- `display_name` and `student_profile.full_name` are used only for display/search.
- `/permissions` and `/permissions/[id]` consistently show student full name as the primary identity and student code as metadata.
