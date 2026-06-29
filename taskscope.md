# Taskscope: Investigate FPS Drop When Opening the System Subsystem Management Popup

## Objective
Investigate and fix the frontend performance issue that causes FPS drops and visible stutter when the user opens the subsystem management popup.

## Current Problem
Opening the subsystem management popup currently feels heavy and visually unstable. Users observe a noticeable frame-rate drop during the open interaction, which makes the UI appear to lag or stutter before the popup becomes fully interactive.

The issue is in the popup open path itself, not in the later navigation to an individual module page unless profiling proves otherwise.

## Relevant Observations
The current implementation already shows several likely pressure points during popup open:
- `frontend/src/components/popups/SubsystemPopup.tsx` mounts a large fullscreen modal with `framer-motion`, translucent layers, `backdrop-blur`, hover transforms, and multiple module cards.
- On open, the popup fetches dynamic route-permission mappings from the backend.
- On open, it also reads maintenance-state data from `localStorage` and rebuilds module state.
- Permission checks and module filtering are recalculated in render for every visible module.
- The popup currently combines animation, layout work, permission evaluation, and visual effects in the same interaction window.

These factors make it plausible that the FPS drop is caused by a combination of mount-time scripting cost and expensive paint/compositing work.

## Requested Change
Improve the popup-open experience so the subsystem management overlay appears smooth and responsive, without visible stutter in normal usage.

The fix must preserve the current module list, permission behavior, maintenance toggles, and navigation flow.

## Investigation Direction
1. Profile the popup open interaction and separate scripting cost from paint/compositing cost.
2. Confirm whether the main bottleneck comes from modal mount, permission-fetch timing, `localStorage` sync, card rendering, blur effects, or animation.
3. Reduce unnecessary work performed exactly when `isOpen` changes to `true`.
4. Avoid recalculating permission and filtering logic more often than necessary.
5. Reduce visually expensive effects during the open transition if they are contributing to frame drops.
6. Re-check both first open and repeated open/close cycles after the fix.

## Affected Areas
- `frontend/src/components/popups/SubsystemPopup.tsx`
- Any shared route-permission fetch path used by the popup
- Any popup trigger path that causes redundant re-mounting or duplicate work during open

## In Scope
- Popup mount/open performance
- Initial permission-loading behavior for the popup
- Maintenance-state synchronization during popup open
- Render and filtering cost for the subsystem cards
- Animation and blur/compositing cost during the open transition

## Out of Scope
- Redesigning the subsystem catalog UI
- Changing permission rules or access-control policy
- Changing the set of available modules
- Optimizing the `/system` admin page after navigation unless profiling proves it is part of the same opening regression

## Acceptance Criteria
- Opening the subsystem management popup no longer causes obvious FPS drops or visible stutter in normal desktop usage.
- The popup remains visually correct and interactive during and immediately after opening.
- Permission-gated modules still appear correctly for each role.
- Maintenance toggles continue to work as before.
- Search and navigation behavior remain unchanged.
- No duplicate or unnecessary loading behavior is introduced during repeated open/close cycles.

## Deliverable
A focused frontend performance fix for the subsystem popup open path, plus validation that the popup opens smoothly while preserving existing permission, maintenance, and navigation behavior.
