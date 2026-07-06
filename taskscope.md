# Taskscope: Club Schedule Recurrence Configuration Refinement

## Objective

Refine the club schedule recurrence configuration so recurrence is managed only from the toolbar configuration modal, scheduled club items only manage activity operating time, the recurrence date range is selected through one combined `customCalendar` range field, and users can revoke all repeated sessions while preserving the original arranged schedule.

## Core Product Decisions

1. A scheduled club item only configures the operating time of that specific club session.
2. Recurrence configuration is a board-level action opened from the toolbar configuration icon.
3. Recurrence configuration must not appear inside each scheduled club item.
4. Clubs can be scheduled on any valid date as one-time sessions.
5. Recurrence starts only after the user configures recurrence for an existing arranged schedule.
6. Recurrence must not generate sessions before the week or date of the original arranged schedule.
7. Recurrence must only target future weeks or future dates from the original arrangement.
8. The recurrence modal must provide a destructive red button to cancel all repeated sessions while keeping the original schedule.

## Scheduled Club Item Scope

When a club is placed on the schedule, the scheduled item editor only manages normal session information and operating time.

The scheduled club item can include:

1. Club identity display.
2. Date or weekday from the board context.
3. Start time.
4. End time.
5. Shift reference if the existing flow uses shifts.
6. Location or room if already supported.
7. Basic operating time validation.

The scheduled club item must not include:

1. Repeat mode.
2. Repeat date range.
3. Repeat start date as a separate field.
4. Repeat end date as a separate field.
5. Number of repeated weeks.
6. Semester-end recurrence option.
7. Specific recurrence date picker.
8. Cancel all repeated sessions action.

## Toolbar Recurrence Configuration Scope

The toolbar configuration icon opens the recurrence modal. The modal controls all recurrence behavior for the current schedule board setup.

The recurrence modal must support:

1. Repeat mode selection.
2. A single combined recurrence date range field.
3. `customCalendar` range selection for both start date and end date in one control.
4. Existing shared select component for repeat mode.
5. Confirm action.
6. Normal cancel or close action.
7. A red destructive action button for cancelling all repeated sessions except the original schedule.

The modal must not show separate fields for:

1. `Repeat start date`.
2. `Repeat end date`.

Instead, both dates must be selected from the same `customCalendar` range control.

## Combined Date Range Field

The current separate fields:

1. `NGAY BAT DAU LAP`
2. `NGAY KET THUC LAP`

must be replaced by one combined range field, because `customCalendar` can select both the start date and the end date.

The combined range field behavior:

1. Opens the existing `customCalendar`.
2. Allows the user to select a recurrence start date.
3. Allows the user to select a recurrence end date in the same picker.
4. Displays the selected range in one field.
5. Stores the selected start and end dates as recurrence range data.
6. Keeps the UI compact and avoids duplicated calendar icons.

## Default End Date Rule

If the user selects a recurrence start date but does not select an end date, the system must automatically use the last day of the selected start date's month as the recurrence end date.

Example:

1. User selects start date `06/07/2026`.
2. User does not select an end date.
3. System defaults the recurrence end date to `31/07/2026`.

This default should be applied before validation and before generating recurrence preview sessions.

## Required Validation Message

When the selected or defaulted recurrence end date is earlier than the first scheduled club session start date, the UI must show this exact message:

`Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên`

This validation applies only to recurrence configuration. It must not block one-time schedule placement unless recurrence is being configured.

## Scheduling Rules

1. The user can place a club session on any valid schedule date.
2. A one-time club session does not require recurrence range data.
3. Recurrence can only be configured after there is at least one arranged club session.
4. The first arranged club session determines the earliest allowed recurrence boundary.
5. The selected recurrence range must not include dates or weeks before the original arranged schedule.
6. The recurrence start date must be on or after the original arranged schedule date or week.
7. The recurrence end date must be on or after the recurrence start date.
8. The recurrence end date must be on or after the first scheduled club session start date.
9. If the user attempts to select a recurrence range before the arranged schedule, the UI must reject it or disable those dates.
10. If the user leaves the end date empty, the default last-day-of-month end date must still pass all recurrence validations.

## Future-Only Recurrence Rules

1. Recurrence generation starts from the arranged schedule week or a later selected recurrence range.
2. Recurrence must only generate sessions in future weeks or future dates inside the selected range.
3. Recurrence must not create preview or saved sessions before the original arranged schedule.
4. If the recurrence range starts after the arranged week, generated sessions begin from that selected future range.
5. If the recurrence range ends before the first activity start date, show the required validation message and block confirmation.
6. If the recurrence range contains no valid future occurrence, show a clear validation message and block confirmation.

## Recurrence Preview Rules

1. After recurrence is confirmed, future-week preview sessions must appear when the user navigates to those weeks.
2. Preview sessions must preserve club, weekday, start time, end time, shift, location, schedule type, and related metadata from the original arranged session.
3. Preview sessions must only appear inside the selected or defaulted recurrence date range.
4. Preview sessions must not appear before the original arranged schedule.
5. Preview must update when the user changes repeat mode or recurrence date range.
6. Preview regeneration must prevent duplicate sessions.
7. After final save, backend data becomes the source of truth for saved recurrence sessions.
8. Pending preview sessions should be cleared or reconciled after saved backend recurrence data is loaded.

## Red Cancel-All-Repeated Action

The recurrence modal must include a red destructive button for cancelling all repeated club schedules except the original arranged schedule.

Button behavior:

1. The button must be visually red/destructive.
2. The button cancels the full recurrence configuration.
3. The button removes all generated repeated sessions.
4. The button preserves the original arranged schedule session.
5. The preserved original session becomes a normal one-time schedule unless recurrence is configured again.
6. The button must not delete the original arranged club session.
7. The button should be disabled or hidden when there is no active recurrence to revoke.

Suggested Vietnamese button label:

`Hủy toàn bộ lịch lặp`

## Cancel Recurrence Rules

1. Cancelling recurrence removes the board-level recurrence configuration.
2. Cancelling recurrence before save removes generated future preview sessions.
3. Cancelling recurrence before save keeps the original arranged club sessions.
4. Cancelling recurrence after save removes future repeated sessions while preserving the original arranged schedule sessions.
5. Future weeks must no longer show revoked repeated sessions after recurrence is cancelled.
6. The recurrence modal should refresh after cancellation so stale repeated data is not displayed.

## Data Handling Rules

1. Item-level schedule state stores operating time and normal schedule fields.
2. Board-level recurrence state stores repeat mode and one date range object.
3. The date range object contains `start_date` and `end_date`.
4. If `end_date` is not selected, compute it from the last day of the `start_date` month before validation.
5. Pending preview sessions reference the board-level recurrence configuration.
6. Saved recurrence sessions share the existing backend recurrence identifier, such as `recurrence_id`.
7. The frontend must distinguish:
   - One-time pending session.
   - Original arranged session included in recurrence.
   - Generated pending recurrence preview session.
   - Saved one-time session.
   - Saved recurring session.
8. Recurrence payload construction must exclude invalid ranges before submitting to the backend.
9. Backend validation should reject recurrence ranges that end before the first activity start date or generate sessions before the arranged schedule.
10. Backend cancellation should support removing repeated sessions while preserving the original arranged schedule.

## Proposed Implementation Plan

1. Keep recurrence controls out of the scheduled club item editor.
2. Keep the toolbar configuration icon as the entry point for recurrence.
3. Replace separate recurrence start and end date inputs with one combined `customCalendar` range field.
4. Use the existing shared select component for repeat mode.
5. Add default end date logic: if no end date is selected, use the last day of the selected start date's month.
6. Determine the first scheduled club session start date from the current arranged schedule setup.
7. Validate the selected or defaulted recurrence end date against the first scheduled club session start date.
8. Show `Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên` when the end date is invalid.
9. Disable or reject recurrence dates and weeks before the arranged schedule.
10. Generate recurrence preview sessions only inside the selected or defaulted future date range.
11. Add the red destructive button for cancelling all repeated schedules except the original.
12. Refresh preview after recurrence settings change.
13. Refresh saved schedule data after final save, delete, or cancellation.
14. Add backend guard validation for invalid recurrence ranges if it does not already exist.

## Acceptance Criteria

1. A club can be scheduled on any valid date as a one-time schedule.
2. The scheduled club item editor only configures operating time and normal item fields.
3. Recurrence is opened from the toolbar configuration icon.
4. The recurrence modal uses one combined `customCalendar` range field instead of two separate date inputs.
5. The repeat mode uses the existing select component.
6. If the user selects a start date and no end date, the end date defaults to the last day of that month.
7. The user cannot select recurrence dates or weeks before the arranged schedule.
8. If the selected or defaulted end date is before the first activity start date, the UI shows `Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên`.
9. Invalid recurrence range confirmation is blocked.
10. Valid recurrence creates preview sessions only inside the selected or defaulted future range.
11. The recurrence modal includes a red button to cancel all repeated schedules except the original.
12. Cancelling all repeated schedules removes future repeated sessions and keeps the original arranged schedule.
13. Backend validation rejects invalid recurrence ranges as a safety guard.

## Out Of Scope

1. Redesigning the full schedule board.
2. Changing club creation, registration, attendance, or advisor assignment logic.
3. Adding recurrence controls back into individual scheduled club items.
4. Supporting recurrence into weeks or dates before the arranged schedule.
5. Adding holiday exclusion or blackout-date logic.
6. Changing role permissions outside the schedule recurrence flow.

## Notes

- Keep task documentation and code comments in English.
- UI labels and validation messages may remain Vietnamese to match the existing application.
- Use existing shared components before adding new UI components.
- Treat recurrence as board-level configuration.
- Treat individual scheduled club editing as operating-time configuration only.
