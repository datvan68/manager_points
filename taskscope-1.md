## Review Summary

The current working tree already contains the main fix for the class detail student table:

- `frontend/src/app/students/[classId]/page.tsx` now calls `studentApi.getStudents({ classId })`.
- `frontend/src/api/student-api.ts` builds `GET /students?classId=<classId>`.
- `backend/src/students/students.controller.ts` now reads `@Query('classId')`.
- `backend/src/students/students.service.ts` now applies `class_id` filtering and preserves requester role restrictions.
- `frontend/src/components/ui/Breadcrumb.tsx` no longer imports `frontend/src/lib/mock-data/students.ts`.
- `backend/src/students/test/students.service.spec.ts` already includes class filter, invalid classId, teacher assigned class, teacher unassigned class, and student class isolation tests.

Because of that, the class detail table path is no longer expected to load every student in the database before filtering.

## Important Finding

If opening any class still appears to load all students, verify the actual network request in the browser:

- Expected request: `GET /students?classId=<classId>`
- Problem request: `GET /students`

If the browser still sends `GET /students`, the frontend bundle being served is likely stale or the dev server was not restarted after the code change.

If the browser sends `GET /students?classId=<classId>` but the response still contains every student, the backend process is likely running an old build, or the backend route/service change has not been restarted/reloaded.

## Files Reviewed

- `frontend/src/app/students/[classId]/page.tsx`
- `frontend/src/api/student-api.ts`
- `frontend/src/components/ui/Breadcrumb.tsx`
- `backend/src/students/students.controller.ts`
- `backend/src/students/students.service.ts`
- `backend/src/students/test/students.service.spec.ts`

## Remaining Actions

1. Restart and verify runtime processes

- Restart the frontend dev server/build serving the app.
- Restart the backend NestJS process.
- Clear browser cache or hard refresh the class detail page.
- Reopen `/students/<classId>` and confirm the network request includes `classId`.

2. Confirm backend response scope

- Call `GET /students?classId=<classId>` with an authenticated user that can view that class.
- Confirm every returned row has `class_id._id === classId` or `class_id === classId`.
- Confirm teacher users only receive students from assigned classes.
- Confirm student users only receive their own linked student profile.

3. Do not confuse table loading with account activation loading

The class table fetch is class-scoped now, but the account activation flow still calls:

- `authApi.getUsers(token)` before activating selected accounts.
- `authApi.getUsers(token)` again after creating new accounts.

Those calls can load all users when the user clicks account activation. This is separate from initial table loading. If the observed heavy request happens only after pressing the activation action, create a separate optimization scope for account lookup by email or batch account activation on the backend.

4. Keep `/students` overview behavior separate

`frontend/src/app/students/page.tsx` still calls `studentApi.getStudents()` without `classId`. That is expected for the overall student management page, but it may need pagination/server-side filters if the database is large. Do not treat this as a class detail table bug unless the request comes from `/students/[classId]`.

## Code Review Notes

- `StudentsController.findAll` should type `classId` as optional: `classId?: string`.
- `StudentsService.findAll` currently supports both old and new call signatures. This compatibility branch is useful for existing tests, but the project should eventually standardize on `findAll(query, requester)` to reduce ambiguity.
- Invalid `classId` currently returns `[]`. This is acceptable if chosen intentionally, but a `BadRequestException` may be clearer for API consumers. Keep tests aligned with the chosen behavior.
- The table still filters search/status client-side over the class-scoped result. That is fine for moderate class sizes. If classes can contain many hundreds or thousands of students, add backend pagination/search/status filters later.

## Acceptance Criteria

- Opening `/students/<classId>` sends exactly `GET /students?classId=<classId>` for the table data.
- The backend Mongo query includes `{ class_id: ObjectId(classId) }` for admin/supervisor requests when `classId` is provided.
- Teacher requests with `classId` return data only when the class is assigned to that teacher.
- Student requests cannot enumerate classmates through `classId`.
- No `mockStudents` or mock `classes` are used by the class detail table or breadcrumb.
- Any remaining "load all" request is identified as either `/students` overview behavior or account activation user lookup, not the class detail table fetch.

## Handoff

```json
{
  "from": "orchestrator",
  "to": "review-agent",
  "task_id": "class-students-load-scope-review",
  "instruction": "Verify runtime behavior for /students/[classId]. Confirm the network request is GET /students?classId=<classId>, backend response is class-scoped, and any remaining load-all request is isolated to the overview page or account activation flow.",
  "skill": "search + summarize",
  "input": {
    "primary_files": [
      "frontend/src/app/students/[classId]/page.tsx",
      "frontend/src/api/student-api.ts",
      "backend/src/students/students.controller.ts",
      "backend/src/students/students.service.ts",
      "backend/src/students/test/students.service.spec.ts"
    ],
    "manual_checks": [
      "Open /students/<classId>",
      "Inspect Network request URL",
      "Confirm returned students belong to the selected class",
      "Repeat as admin, teacher, and student where possible"
    ]
  },
  "deadline": "120s",
  "on_failure": "stop"
}
```
