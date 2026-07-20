Task: realtime-notifications-and-student-activity-module | feature_development | Risk: MEDIUM
Objective: Deliver newly created notifications to signed-in accounts without a manual refresh and expose the existing Activity module to student accounts in the system-module picker.
Scope:
- `backend/src/system/notification-event-emitter.ts` :: notification creation signal :: add a typed process-local event emitted only when a notification is newly persisted, following the repository's existing SSE emitter convention.
- `backend/src/notifications/notifications.service.ts` :: `create` and `createOnce` persistence paths :: publish the creation signal after a successful insert while preventing duplicate `createOnce` calls from generating false realtime updates.
- `backend/src/notifications/notifications-realtime.service.ts` :: authenticated notification stream :: add an SSE observable with connected/heartbeat events and notification-created refresh signals; do not include notification content in the signal.
- `backend/src/notifications/notifications.controller.ts` :: `GET /notifications/realtime` :: expose the authenticated SSE stream for every signed-in account.
- `backend/src/notifications/notifications.module.ts` :: realtime provider registration :: register the notification realtime service without changing the existing notification API contract.
- `backend/src/notifications/notifications.service.spec.ts` :: notification creation regression coverage :: verify successful creates emit once, failed creates emit nothing, and deduplicated `createOnce` calls do not emit repeated updates.
- `backend/src/notifications/notifications-realtime.service.spec.ts` :: SSE lifecycle coverage :: verify connection, creation signal, heartbeat-compatible payload shape, and listener cleanup.
- `frontend/src/hooks/useNotificationRealtime.ts` :: authenticated SSE client :: connect with the stored bearer token, parse refresh signals, reconnect with bounded backoff, clean up on logout/unmount, and dispatch the existing `notifications-updated` browser event.
- `frontend/src/hooks/useNotificationRealtime.test.ts` :: client stream regression coverage :: verify event parsing, refresh dispatch, retry behavior, and abort cleanup.
- `frontend/src/components/layout/Header.tsx` :: account-level notification synchronization :: mount one realtime subscription for the authenticated layout so the bell list and unread count refetch immediately through the existing update event.
- `frontend/src/app/(dashboard)/page.tsx` :: dashboard notification metrics synchronization :: reload dashboard metrics when `notifications-updated` fires so non-student dashboard counters do not remain stale.
- `frontend/src/components/popups/SubsystemPopup.tsx` :: student module visibility :: allow authenticated students to see and open the existing `Hoạt động` card, consistently with the sidebar and the student-aware `/activities` page, while retaining maintenance-state enforcement.
- `frontend/src/components/popups/SubsystemPopup.test.tsx` :: module visibility regression coverage :: verify a student sees `Hoạt động`, cannot see restricted system cards, and can still be blocked by maintenance mode.
Out: Notification database schema changes, notification payload delivery over SSE, push notifications outside an active browser session, cross-instance message brokers, changes to Activity CRUD permissions, role seeding, route-permission administration, and unrelated files and behavior.
Context: Notification records are persisted immediately and recipient/role filtering is already applied when accounts query them. The current UI fetches once and reacts only to same-window `notifications-updated` events, so notifications created by backend jobs or another account are not shown until another refresh trigger or page reload. The Activity card already targets `/activities`, and that page plus the sidebar explicitly support students; only `SubsystemPopup` excludes the card because its fallback admits students to modules in group `Học sinh` while Activity is in group `Club`. The repository already uses authenticated SSE with bearer-token `fetch`, heartbeat events, and process-local emitters for grading and attendance.
Steps:
1. Add the notification creation event and authenticated SSE stream, ensuring persistence failures and deduplication hits do not produce creation signals.
2. Add the reusable frontend realtime hook and mount it once in the authenticated header to refresh existing notification consumers.
3. Refresh dashboard metrics on the shared update event and correct the student Activity-card permission branch without broadening restricted system access.
4. Add focused backend and frontend tests for emission, stream cleanup, client reconnect/cleanup, and student module visibility.
5. Run targeted tests, backend build, frontend type checking, and final diff/status inspection.
Verify:
- `backend` :: `npm test -- notifications/notifications.service.spec.ts notifications/notifications-realtime.service.spec.ts --runInBand` => creation emission, deduplication, SSE delivery, and cleanup tests pass.
- `backend` :: `npm run build` => NestJS compiles with the realtime endpoint and provider.
- `frontend` :: `npm test -- src/hooks/useNotificationRealtime.test.ts src/components/popups/SubsystemPopup.test.tsx` => realtime refresh lifecycle and student Activity-card tests pass.
- `frontend` :: `npm run typecheck` => notification and module-picker changes have no TypeScript errors.
- repository root :: `git diff --check` and `git status --short` => no whitespace errors and only scoped implementation/tests plus this taskscope are changed by the task.
Done:
- A notification newly created through either `create` or `createOnce` causes every active authenticated browser session to refetch its own filtered list and unread count without a manual reload.
- A deduplicated scheduler pass, failed database write, heartbeat, logout, or component unmount does not cause duplicate refreshes or leak listeners/connections.
- The notification center and non-student dashboard metrics react to the same realtime update signal where mounted.
- A student account sees the `Hoạt động` card in `Quản lý Phân hệ Hệ thống`, opens `/activities`, remains subject to maintenance mode, and gains no restricted system module.
- All listed targeted tests, build/type check, and diff inspections pass.
Gate/Stop: Stop if deployment requires realtime propagation across multiple backend replicas; the existing process-local emitter convention cannot cross instances and adding Redis or another broker requires an infrastructure scope decision.
Rollback: Revert the scoped backend SSE/emitter, frontend subscription, popup permission, and test changes; no migration or stored-data rollback is required.
Dependencies: Existing NestJS/RxJS SSE support, browser streaming `fetch`, JWT bearer authentication, and the repository's current in-process event-emitter deployment model.
Artifacts: Final scoped diff, targeted test/build/type-check output, and manual confirmation using two signed-in accounts plus one student account.
