# Walkthrough: Deadline-based Access Tracking

## Overview
The task completion mechanism has been completely refactored. We've replaced the old "save-based" task completion logic with "deadline-based access tracking". Task completion is no longer determined by saving data or autosaving on linked pages. Instead, tasks are completed by a background system process evaluating whether a user accessed the task before its deadline.

## Components & Changes

### 1. Auto-filling Deadline for Linked Tasks
When an administrator creates a task and selects a linked page (e.g., `/grading/score`), the frontend automatically calls `GET /student-tasks/linked-deadline`. The backend `StudentTasksService.resolveLinkedTaskDeadline` calculates the appropriate deadline. For example, it fetches the current evaluation period (`sv_phase` or `gv_phase`) and provides its end date. This reduces manual configuration errors.

### 2. Task Access Tracking (The `markAccess` Hook)
When an assigned student or teacher opens a task (via the `StudentTasksTab` or directly navigating to the linked page), the `useLinkedTaskProgress` hook automatically triggers `markTaskAccess()` (`POST /student-tasks/progress/access`). 
- This API checks if the current time is before the deadline.
- If true, it records `firstAccessedAt` (using `startedAt` field) and updates the task status to `in_progress`.
- Note: It does **not** complete the task, even if the user saves data on the page.

### 3. Removal of Save-based Completions
The frontend no longer calls `markCompleted()` after successfully saving scores or academic records. Additionally, the backend `StudentTaskProgressService.updateProgressFromLinkedEvent` has been purged of its old logic that automatically flipped task status to `completed`. The system relies exclusively on the deadline finalizer.

### 4. The Deadline Finalizer
A new backend method `finalizeExpiredTaskProgress` was introduced. This acts as a background system finalizer:
- It queries for tasks whose `deadline` has passed.
- It evaluates every `StudentTaskProgress` row.
- If `startedAt` was recorded (meaning the user accessed the task before the deadline), the row is marked `completed`.
- If `startedAt` is empty, it is marked `not_started`.
- The parent task aggregate status is then recalculated.

## Testing the Flow
1. Go to Tasks, create a new task linked to `/grading/score`. The deadline will auto-fill based on the current evaluation period.
2. Log in as an assigned student and navigate to the task. 
3. Verify that the task status changes to `Đang làm` (In Progress) and stays that way, even after making and saving grading changes.
4. Manually or via CRON, trigger `finalizeExpiredTaskProgress` when the deadline is past.
5. The task status should now securely transition to `Đã xong` (Completed) for the accessed student.
