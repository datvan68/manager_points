# Taskscope: Sidebar Collapse Control Realignment

## Objective

Adjust the sidebar collapse control so it behaves like a modern shell navigation toggle and aligns with the system branding area.

The requested outcome is:

- The collapse icon sits immediately to the right of the system name in the expanded sidebar header.
- The icon must not use a chevron or arrow-style visual.
- When the sidebar is collapsed, the control overlays the logo area instead of occupying a separate external position.

This document defines the implementation scope, UI behavior, constraints, and acceptance criteria for that change.

## Requested UX Change

### 1. Reposition the collapse control next to the system name

In the expanded sidebar state, move the collapse control into the same branding row as the system identity.

Expected layout:

- Logo and system name remain the primary branding block.
- The collapse control is placed flush on the right side of that same header row.
- The spacing should feel intentional and compact, not detached like a floating utility button.

This control should read as part of the sidebar header, not as a separate navigation affordance.

### 2. Replace the old arrow metaphor

Do not use a left/right arrow or chevron icon.

The icon should follow a more current UI pattern, such as a compact panel, sidebar, layout, or dock-style metaphor that communicates sidebar state without relying on directional arrows.

The final icon should:

- Feel contemporary
- Match the application visual language
- Remain understandable in both expanded and collapsed states
- Preserve a clean silhouette at small sizes

### 3. Overlay the logo area when collapsed

When the sidebar collapses, the collapse control should visually sit on top of the logo area.

Expected behavior:

- The control remains accessible in the collapsed state.
- It no longer depends on the full system-name row being visible.
- It overlays or anchors within the compact logo zone.
- It should look deliberate, not like a misplaced absolute-positioned patch.

This is specifically intended to make the collapsed sidebar feel tighter and more modern.

## Functional Interpretation

The sidebar now needs two coordinated header states.

### Expanded state

- Logo is visible.
- System name is visible.
- Collapse control is aligned immediately to the right of the system name.
- Control styling integrates with the header instead of sitting away from branding.

### Collapsed state

- Full system name is hidden.
- Logo remains visible in compact form, if the current design already supports that.
- Collapse control is still visible and clickable.
- Control overlays the logo region so the collapsed header does not allocate extra width or awkward empty space.

## Visual Direction

The change should follow a modern admin-dashboard pattern rather than an older drawer-toggle pattern.

Preferred characteristics:

- Compact header composition
- Icon-first control with subtle container styling
- Strong alignment with branding
- Clean collapsed silhouette
- No arrow-based directional cue

Avoid:

- Chevron-left / chevron-right icons
- A control placed far away from the system title
- A collapsed button that appears disconnected from the logo block
- Layout jitter between expanded and collapsed states

## In Scope

- Update sidebar header structure to place the toggle next to the system name
- Replace the current toggle icon if it is arrow-based
- Adjust collapsed-state positioning so the toggle overlays the logo area
- Update styling, spacing, alignment, and positioning rules required for both states
- Preserve clickability, hover states, and accessibility of the toggle control
- Ensure responsive behavior remains stable across desktop and common laptop widths

## Out of Scope

- Full sidebar redesign beyond the header/toggle area
- Changes to sidebar navigation items unrelated to collapse behavior
- Changes to application branding assets such as logo artwork or product name
- Rework of mobile navigation unless the same component is shared and requires compatibility fixes
- Broader design-system icon refresh outside this specific control

## Implementation Notes

The implementation should verify the following before coding:

1. Whether the sidebar header currently uses a single flex row or separate stacked blocks.
2. Whether the existing toggle button is positioned inside or outside the branding container.
3. Whether collapsed mode already uses absolute positioning around the logo area.
4. Whether the current icon source comes from an icon library that already includes a suitable panel/sidebar glyph.

Recommended implementation direction:

- Keep one shared toggle component for both states.
- Change placement logic through layout and state-based styling rather than duplicating controls.
- Use absolute positioning in collapsed mode only if needed to create a deliberate overlay effect.
- Ensure the clickable area remains large enough for usability even if the visible icon is compact.

## Acceptance Criteria

A follow-up implementation is complete only if all conditions below are satisfied:

1. In expanded state, the collapse icon appears immediately to the right of the system name in the sidebar header.
2. The icon is not an arrow or chevron.
3. The icon visually matches a modern sidebar/layout control pattern.
4. In collapsed state, the control overlays the logo area instead of sitting outside it.
5. The control remains clearly visible and clickable in both states.
6. The header does not feel misaligned or leave awkward spacing during state transitions.
7. Collapsing and expanding the sidebar does not introduce layout jump, overlap bugs, or broken branding alignment.
8. The updated control continues to support hover, focus, and accessible interaction states.

## Deliverable

Implement the sidebar header adjustment so the collapse control feels embedded in the branding area when expanded and intentionally overlaid on the logo zone when collapsed.

The final result should look contemporary, compact, and visually cleaner than the current arrow-based sidebar toggle.
