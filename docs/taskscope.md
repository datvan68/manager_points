Task: notification-log-and-navigation | feature_development | Risk: MEDIUM
Objective: Reduce routine activity-schedule notification log noise and make notification clicks consistently navigate only when a link exists, otherwise opening notification details, with the destination visibly identified in the UI.
Scope:
- `backend/src/activity-schedules/activity-schedule-active-notification.service.ts` :: cron logging :: move routine per-minute polling, active-schedule, no-recipient, and processed-summary messages from info-level logging to debug-level logging while preserving error-level failures and the existing cron cadence/dispatch behavior.
- `backend/src/activity-schedules/activity-schedule-active-notification.service.spec.ts` :: cron logging regression coverage :: verify an empty poll produces no info-level log, routine diagnostics use debug level, and failures remain error-level without changing notification dispatch assertions.
- `frontend/src/components/notifications/NotificationDestination.tsx` :: shared destination indicator :: add a compact UI item that displays `Linked to: <routeUrl>` for linked notifications and `No linked destination` otherwise, using the existing optional `routeUrl` as the single link signal.
- `frontend/src/components/modals/NotificationDetailModal.tsx` :: read-only notification detail view :: add an accessible modal showing title, description, type, time, and destination status, with a close action and a separate go-to-destination action only when `routeUrl` exists.
- `frontend/src/components/popups/NotificationPopup.tsx` :: header notification click behavior and destination display :: mark the item read, navigate directly only when `routeUrl` is non-empty, otherwise open the detail modal; render the shared destination indicator for each item.
- `frontend/src/components/dashboard/NotificationPanel.tsx` :: dashboard notification click behavior and destination display :: navigate directly only for linked items and open the detail modal for unlinked items instead of falling back to `/notifications`; render the shared destination indicator.
- `frontend/src/app/(dashboard)/notifications/page.tsx` :: notification-center card behavior and destination display :: make a card click mark the notification read and then navigate when linked or open the detail modal when unlinked, retain explicit edit/delete/readers actions without click propagation, and replace the ambiguous link action text with the shared destination indicator.
- `frontend/src/components/notifications/notification-interaction.test.tsx` :: UI regression coverage :: cover linked and unlinked clicks across the shared interaction surfaces, detail-modal visibility/content, destination indicator states, and prevention of unintended navigation.
Out: Backend notification schema/API changes, cron frequency changes, notification generation/deduplication changes, route-name lookup or friendly-label mapping, unrelated files and behavior.
Context: `routeUrl` is already optional in the backend schema and frontend API. A trimmed non-empty `routeUrl` means the notification is linked; missing, empty, or whitespace-only values mean it is detail-only. Clicking either kind still marks it read. Routine cron diagnostics remain available when debug logging is enabled.
Steps:
1. Reclassify routine scheduler diagnostics as debug logs and add logger-level regression assertions while keeping error reporting and dispatch logic intact.
2. Add the reusable destination indicator and read-only detail modal using the existing notification data contract.
3. Apply the same linked-versus-unlinked click rule to the popup, dashboard panel, and notification-center cards without changing secondary action behavior.
4. Add focused UI interaction tests for destination display, navigation, detail opening, read marking, and event propagation.
5. Run targeted backend/frontend tests, frontend type checking, backend build, and review the final diff/status for scope or localization drift.
Verify:
- `backend` :: `npm test -- activity-schedules/activity-schedule-active-notification.service.spec.ts --runInBand` => scheduler dispatch and log-level tests pass.
- `backend` :: `npm run build` => NestJS backend compiles successfully.
- `frontend` :: `npm test -- src/components/notifications/notification-interaction.test.tsx` => linked navigation, unlinked detail, read-state, and destination-indicator tests pass.
- `frontend` :: `npm run typecheck` => updated notification UI compiles with no TypeScript errors.
- repository root :: `git diff --check` and `git status --short` => no whitespace errors and only scoped implementation/test files plus this taskscope are changed by the task.
Done:
- Default backend output no longer prints the activity-schedule polling/status lines every minute, while debug mode can show them and failures are still logged as errors.
- On all three notification surfaces, linked notifications navigate to their exact `routeUrl`; unlinked notifications open a read-only detail modal and do not navigate.
- Each displayed notification explicitly identifies its linked destination or states that no destination is linked.
- Clicking a notification marks it read, and edit/delete/readers/detail-modal controls do not trigger the card navigation handler.
- All listed targeted tests, builds/type checks, and diff inspections pass.
Gate/Stop: Stop if a stored `routeUrl` is found to represent anything other than the navigation destination, or if the requested “linked to” item requires a friendly business label rather than the persisted route; either case requires a product mapping decision before expanding the data contract.
Rollback: Revert only the scoped implementation/test changes; no migration or stored-data rollback is required because the existing notification contract is unchanged.
Dependencies: Existing NestJS/Jest and Next.js/Vitest/Testing Library dependencies already declared in `backend/package.json` and `frontend/package.json`.
Artifacts: Final scoped diff, targeted test/build/type-check outputs, and manual confirmation of linked and unlinked notification states at desktop and mobile widths.
