# Implementation Plan: Replace save-based task completion with deadline-based access tracking

## 1. Backend Changes

### 1.1. Access Tracking Endpoint
**File:** `backend/src/student-task-progress/student-task-progress.controller.ts`
- Add `POST /access` endpoint that calls `progressService.markAccess(taskId, linkedPage, user)`.

**File:** `backend/src/student-task-progress/student-task-progress.service.ts`
- Implement `markAccess(taskId: string, linkedPage?: string, user: any)`:
  - Validate task exists, is not deleted, and `linkedPage` matches if provided.
  - Find active progress for `(taskId, user.userId)`.
  - If `now <= task.deadline`: update status to `in_progress`, set `startedAt` (if empty), `lastActivityAt = now`, `statusSource = 'system'`, `sourceType = 'task_access'`.
  - If `now > task.deadline`: only update `lastActivityAt`.
  - Recalculate parent task aggregate status.

### 1.2. Remove Save-Based Completion
**File:** `backend/src/student-task-progress/student-task-progress.service.ts`
- Update `updateProgressFromLinkedEvent(...)` and `bulkUpdateProgressFromLinkedEvent(...)`:
  - When processing grading score or record events, DO NOT set `status = completed` or update `completedAt`.
  - Keep logic to update `criteriaProgress` and `teacherProgress` but decouple them from the task's main `status` progression to `completed`.
  - Remove direct completion sets from `event === 'completed'` fallback logic unless specifically required, or explicitly document that save events shouldn't trigger `completed`.

### 1.3. Add Deadline Finalization
**File:** `backend/src/student-task-progress/student-task-progress.service.ts`
- Implement `finalizeExpiredTaskProgress(now = new Date())`:
  - Find tasks where `deadline <= now` and `deletedAt = null`.
  - Update progress rows:
    - If `startedAt <= deadline` -> `status = completed`, `completedAt = task.deadline` (or `now`), `statusSource = 'system'`, `sourceType = 'deadline_finalizer'`.
    - If no `startedAt` -> `status = not_started` (or incomplete equivalent).
  - Recalculate aggregate task status for affected tasks.
  - (Optional) add a Cron job or admin endpoint to trigger this manually.

### 1.4. Resolve Linked Workflow Deadlines
**File:** `backend/src/student-tasks/student-tasks.controller.ts`
- Add `GET /linked-deadline` endpoint.

**File:** `backend/src/student-tasks/student-tasks.service.ts`
- Implement `resolveLinkedTaskDeadline(linkedPage: string, context?: any)`:
  - Parse `linkedPage` for `/grading/score`.
  - Query grading/evaluation configurations (e.g., active evaluation period) to return the default deadline.
- Update `create(...)`:
  - Check if deadline is provided, if not or if we should default, call `resolveLinkedTaskDeadline`.

## 2. Frontend Changes

### 2.1. API and Hooks
**File:** `frontend/src/api/task-api.ts`
- Add `markTaskAccess(taskId: string, linkedPage?: string)` API call.
- Add `getLinkedDeadline(linkedPage: string)` API call.

**File:** `frontend/src/hooks/useLinkedTaskProgress.ts`
- Remove or modify `markCompleted`.
- Add `markAccess()` method which calls the new backend `markTaskAccess` endpoint.
- Automatically call `markAccess()` when `resolvedTaskId` is successfully set.

### 2.2. Page Components
**File:** `frontend/src/app/grading/score/page.tsx`
- Ensure `markAccess()` is called on load when a valid task is resolved.
- Remove calls to `markCompleted()` after save/autosave.

**File:** `frontend/src/components/grading/AddRecordView.tsx` (or equivalent records component)
- Remove `markCompleted()` on record save.
- Ensure `markAccess()` is invoked upon valid task load.

**File:** `frontend/src/components/students/tasks/StudentTasksTab.tsx`
- In task card click handler: call `markTaskAccess` endpoint before navigating to the `linkedPage`.
- Update local state to show `in_progress` if before deadline.
- Adjust status display logic to reflect `not_started` as "Incomplete" if past deadline.

**File:** `frontend/src/components/students/tasks/AddTaskModal.tsx`
- Add a listener when `linkedPage` is selected (e.g., `/grading/score`).
- Fetch default deadline via `getLinkedDeadline`.
- Populate the deadline date picker with the response.

## 3. Testing & Verification
- Manually create a task linked to `/grading/score`. Verify deadline auto-fills.
- Click task card -> Verify status changes to `In Progress` in DB and UI.
- Edit score/save -> Verify status stays `In Progress`.
- Run finalizer (or mock past deadline) -> Verify status becomes `Completed`.
