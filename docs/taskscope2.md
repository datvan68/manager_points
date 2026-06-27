# Taskscope 2: `/grading/score` Score Badge and Role Routing Update

## Objective
Update the `/grading/score` screen so each criterion consistently exposes all three scoring lanes and routes score writes to the correct backend field based on the acting account.

## Requested Changes

### 1. Always show 3 score badges for every criterion
Each criterion row must display all of the following badges:
- `SV: ...`
- `GV: ...`
- `P.HSSV: ...`

This applies to both normal criteria and criteria configured with `is_locked = true`.

### 2. Route score writes by actor role
When a user performs grading, the submitted score must be written into the correct score field:
- Student account writes to `sv_score`
- Teacher/advisor account writes to `gv_score`
- Admin account writes to the supervisor lane (`P.HSSV`)
- Supervisor account writes to the supervisor lane (`P.HSSV`)

Implementation note:
- The current data model already has `sv_score`, `gv_score`, and `final_score`.
- For this scope, `P.HSSV` should map to `final_score`.
- Admin and supervisor must both be treated as the same destination lane for submission and display.

### 3. Reverse the current locked/non-locked display behavior
Current behavior in `/grading/score` is asymmetric:
- Locked criteria mainly show `P.HSSV`
- Non-locked criteria mainly show `SV` and `GV`

Required behavior:
- Locked criteria must still display `P.HSSV`, but they must also show `SV` and `GV`
- Non-locked criteria must also display `P.HSSV`

In short:
- All criteria show `SV`, `GV`, and `P.HSSV`
- The difference between locked and non-locked criteria should only affect editability and score source rules, not badge visibility
- The existing finalized badge `??t: ...` must be preserved after locking/finalization

## Functional Rules

### Display rules
- `SV` badge displays `detail.sv_score`
- `GV` badge displays `detail.gv_score`
- `P.HSSV` badge displays `detail.final_score`
- `??t` badge remains the finalized score badge and is shown when the detail/summary is locked under the existing finalize logic
- If a value does not exist, display the current empty-state label already used by the screen
- Existing violation-score formatting must remain unchanged

### Finalization rules
- When the grading record is finalized/locked, the UI must still keep the existing `??t: ...?` badge
- `??t` represents the final resolved score after approval/finalization
- Finalization must not hide the three source badges `SV`, `GV`, and `P.HSSV`
- After finalization, the row should show both:
  - source lanes: `SV`, `GV`, `P.HSSV`
  - final lane: `??t`

### Editability rules
- `is_locked = true` criteria remain non-editable through the normal student/teacher counting controls
- If the product flow allows admin/supervisor approval or override, that action must feed the `P.HSSV` lane
- Non-locked criteria continue using the existing edit controls, but role-based field routing must be respected

### Role mapping rules
- `student` -> `sv_score`
- `teacher` / `advisor` -> `gv_score`
- `admin` / `supervisor` -> `final_score`

## Expected UI Outcome
- A criterion row no longer hides one scoring lane based on lock state
- Users can compare student, teacher, and supervisor/admin values side by side
- The badge area becomes a stable 3-lane score summary across the entire page
- After finalization, users still see the existing `??t` badge as the final approved result

## Affected Areas
- Frontend page rendering in `frontend/src/app/grading/score/page.tsx`
- Any helper used to resolve displayed score priority in `frontend/src/app/grading/score/_utils/score-calculation.ts`
- Save/update payload construction for grading actions on `/grading/score`
- Backend handling only if current APIs do not yet accept admin/supervisor writes into `final_score`

## Acceptance Criteria
- Every criterion row shows `SV`, `GV`, and `P.HSSV`
- Admin grading writes to `final_score`
- Supervisor grading writes to `final_score`
- Teacher grading writes to `gv_score`
- Student grading writes to `sv_score`
- Locked criteria still display all three badges
- Non-locked criteria also display all three badges
- Finalized/locked criteria still display `??t: ...?` using the existing finalization logic
- Finalized/locked criteria display `??t` in addition to `SV`, `GV`, and `P.HSSV`
- Existing score formatting for reward/violation criteria remains correct
- Existing permission checks are not weakened

## Out of Scope
- Changing the database schema
- Renaming backend fields
- Redesigning the grading workflow outside `/grading/score`
- Reworking historical logs unless needed to reflect the new field routing
