# Taskscope: Align Schedule Time Blocks Between Hour Lines

## Objective

Adjust the `/club/schedules` timetable layout so each hour block is visually centered between its upper and lower separator lines, and club schedule cards fit completely inside their selected time range.

For example, if a club activity is scheduled from `07:00` to `09:00`, the card must start at the `07:00` boundary and end at the `09:00` boundary. All visible card content, including action buttons, must remain inside that `07:00 - 09:00` block.

## Target Page

- Page: `frontend/src/app/(dashboard)/club/schedules/page.tsx`
- Route: `/club/schedules`
- Affected UI:
  - left time column
  - hour labels
  - horizontal hour separator lines
  - schedule grid rows
  - draft and saved club schedule cards
  - card footer actions inside schedule cards

## Problem Statement

The current schedule grid makes the hour labels and schedule cards feel misaligned with the horizontal hour boundaries.

In the current visual state, a card scheduled for `07:00 - 09:00` can visually extend its footer buttons toward or past the `09:00` boundary. This makes the card appear taller than its intended time range and weakens the user's ability to trust the schedule grid.

The timetable should communicate time ranges precisely:

- hour labels should sit visually between the two surrounding separator lines
- card top and bottom edges should align with the selected start and end time boundaries
- card content must be constrained inside the card height

## Required Behavior

### 1. Center Hour Labels Between Separators

- Each hour label must appear centered within its hour row.
- The `07:00` label should sit between the `07:00` row's top line and the `08:00` line.
- The `08:00` label should sit between the `08:00` and `09:00` lines.
- The `09:00` label should sit between the `09:00` and `10:00` lines.
- Do not place hour labels directly on top of separator lines.

Recommended layout direction:

```tsx
<div className="relative h-[var(--hour-height)] border-t border-slate-200/50">
  <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2">
    07:00
  </span>
</div>
```

Use the project's existing layout approach if it already has a cleaner pattern.

### 2. Align Card Boundaries With Time Boundaries

- A card scheduled from `07:00` to `09:00` must have:
  - top edge aligned with the `07:00` boundary
  - bottom edge aligned with the `09:00` boundary
- Card height must be calculated from the exact time duration.
- The card's visual border must not extend beyond the calculated time block.
- Existing snap behavior should continue to place card edges on valid time increments.

Expected formula direction:

```ts
const top = minutesFromScheduleStart * PIXELS_PER_MINUTE;
const height = durationMinutes * PIXELS_PER_MINUTE;
```

Do not add visual padding outside the card that changes the perceived time range.

### 3. Keep Card Footer Buttons Inside The Time Range

- Card action buttons must stay fully inside the card body.
- Buttons must not overlap or cross the card's bottom border.
- Buttons must not visually fall into the next hour row.
- For short cards, reduce internal spacing or use compact button layout instead of allowing overflow.
- If content is too tall for the card duration, apply an internal scroll, compact mode, or hide lower-priority metadata according to the existing UX pattern.

For the example `07:00 - 09:00`, all card elements must remain above the `09:00` boundary.

### 4. Preserve Existing Schedule Interactions

- Keep drag behavior unchanged.
- Keep vertical resize behavior unchanged.
- Keep horizontal movement or span behavior unchanged if already implemented.
- Keep recurrence configuration behavior unchanged.
- Keep draft confirmation and cancel actions unchanged.
- Only adjust layout and overflow behavior needed for precise visual alignment.

### 5. Maintain Subtle Grid Lines

- Keep hour separator lines visually soft.
- Do not make the separator lines stronger while fixing alignment.
- The grid should remain a background guide, while club cards remain the primary visual element.

## Implementation Plan

### Phase 1: Inspect Current Grid Geometry

- Review the timetable body in `frontend/src/app/(dashboard)/club/schedules/page.tsx`.
- Identify:
  - the constant used for hour row height
  - how hour labels are positioned
  - how separator lines are rendered
  - how card `top` and `height` are calculated
  - whether card margins, gaps, borders, or padding add visual overflow

### Phase 2: Normalize Hour Row Rendering

- Ensure each hour row has a stable fixed height.
- Position the hour label at the vertical center of the hour row.
- Keep separator lines at row boundaries.
- Make sure the first visible row starts at the correct schedule start time.

### Phase 3: Normalize Card Position And Height

- Calculate card `top` from the start time boundary.
- Calculate card `height` from the duration only.
- Keep the card absolutely positioned inside the day column.
- Avoid external vertical margins that shift the card away from the grid boundaries.
- Use `box-border` so borders are included inside the calculated height.

Recommended card container direction:

```tsx
style={{
  top,
  height,
}}
className="absolute box-border overflow-hidden"
```

### Phase 4: Constrain Card Internal Layout

- Review draft and saved schedule card content.
- Ensure title, metadata, recurrence tag, time label, and action buttons fit inside the available height.
- Use compact spacing for short duration cards.
- Keep action buttons anchored inside the bottom area without overflowing.
- Prefer `min-h-0`, `overflow-hidden`, and flexible internal layout where needed.

Example direction:

```tsx
<div className="flex h-full min-h-0 flex-col overflow-hidden">
  <div className="min-h-0 flex-1 overflow-hidden">
    ...
  </div>
  <div className="shrink-0">
    ...
  </div>
</div>
```

### Phase 5: Visual QA

Manually verify `/club/schedules` with at least these cases:

- `07:00 - 09:00`
- `07:00 - 10:00`
- `08:00 - 09:00`
- a draft card with action buttons
- a saved card without draft buttons
- a card near the top of the visible timetable
- a card near the bottom of the visible timetable

## Acceptance Criteria

- Hour labels are centered between their upper and lower separator lines.
- A `07:00 - 09:00` club card starts at the `07:00` boundary and ends at the `09:00` boundary.
- The card border is horizontally aligned with the start and end time grid lines.
- All card action buttons remain inside the selected time range.
- No card content visually spills below the end-time boundary.
- The fix does not alter schedule data, recurrence logic, or backend APIs.
- Dragging and resizing still snap to the expected time increments.
- Hour separator lines remain subtle and consistent across the time column and grid.

## Out Of Scope

- Redesigning the full schedule page.
- Changing club creation flow.
- Changing recurrence configuration logic.
- Changing backend schedule schema.
- Changing membership or favorite club behavior.
- Adding new schedule card actions.
- Reworking the entire calendar library or data model.

## Notes

- This is a visual alignment and containment task.
- The core requirement is geometric accuracy: the visible card must match the selected time range.
- Treat the grid lines as time boundaries and hour labels as centered row labels.
- Prefer layout fixes over hardcoded one-off offsets.