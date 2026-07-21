Task: activity-member-leave-and-favorite-realtime | bug_fix | Risk: MEDIUM
Objective: Show each student's current self-service club leaves remaining in the Members tab and synchronize an activity's aggregate favorite count across signed-in accounts in real time.
Scope:
- backend/src/activities/activities.service.ts :: member leave policy and favorite projections/mutations :: attach `self_service_leaves_remaining` to each student membership from the semester-wide club leave total (maximum 3), include persisted `favorite_count` plus the requesting user's own `is_favorited` state in activity-list results, and publish the authoritative aggregate count after favorite/unfavorite succeeds.
- backend/src/activities/activities-realtime.service.ts :: activity SSE contract :: add a typed `activity.favorite_updated` event carrying `activity_id` and authoritative `favorite_count` to every connected account while retaining the existing created event and heartbeat behavior.
- backend/src/activities/activities.service.spec.ts :: leave/favorite service regressions :: cover semester-wide leave aggregation per member, zero-floor behavior, requester-specific favorite state, aggregate counts, idempotent favorite mutations, and emitted favorite-update payloads.
- backend/test/activities-favorite.e2e-spec.ts :: multi-account favorite contract :: verify the list/count state from separate accounts after favorite and unfavorite operations and confirm the SSE update exposes the same persisted aggregate count without leaking another user's `is_favorited` state.
- frontend/src/api/activity-api.ts :: member/list and realtime data types :: expose `self_service_leaves_remaining` on members and use the server's favorite response as the authoritative mutation result.
- frontend/src/components/activities/ActivityMemberTable.tsx :: `Lượt rời còn lại` column :: render the member's current leave allowance instead of the unrelated completion-rule `participation_count`, with a neutral fallback when the policy is not applicable.
- frontend/src/components/activities/ActivityMemberTable.test.tsx :: leave-column regressions :: prove the current remaining value, zero, and non-applicable fallback render correctly and participation progress is not used by this column.
- frontend/src/hooks/useActivitiesRealtime.ts :: SSE event handling :: parse both created and favorite-updated events, keep reconnect behavior, and deliver the favorite payload to the page without treating it as a full-list creation refresh.
- frontend/src/app/(dashboard)/activities/page.tsx :: cross-account favorite state :: update the clicked account from the mutation response and patch incoming realtime aggregate counts for other accounts while preserving each account's own `is_favorited` boolean.
- frontend/src/app/(dashboard)/activities/page.test.tsx :: favorite synchronization regressions :: verify mutation responses and simulated realtime events update counts without corrupting requester-specific favorite state or triggering an unnecessary full reload.
- docs/taskscope.md :: implementation contract :: record the inspected cause, exact correction scope, verification, and acceptance criteria.
Out: Changing the maximum of 3 self-service club leaves; resetting leave history; completion-rule participation counts; synchronizing whether another user personally favorited an activity; anonymous realtime access; unrelated activity/member UI and behavior.
Context: The Members table currently labels `participation_count` as `Lượt rời còn lại`, although leave usage is stored per membership and the existing policy totals `self_service_leave_count` across all club memberships for the same student and semester. Favorite mutations already return a persisted aggregate count, but the list service does not project favorite state and the activity SSE/hook only supports `activity.created`; `is_favorited` must remain account-specific while only `favorite_count` is broadcast.
Steps:
1. Reuse the existing semester-wide self-service leave policy to enrich member rows and type/render the returned value.
2. Make activity-list favorite fields authoritative from persisted favorites for both aggregate and requesting-user state.
3. Publish and consume a favorite-count SSE event, patching only the matching activity count in other sessions.
4. Use favorite/unfavorite responses for the initiating account and add backend, component, page, and multi-account regressions.
5. Run targeted tests, build/type checks, and inspect the final diff/status.
Verify:
- backend :: npm test -- --runInBand activities/activities.service.spec.ts => per-member leave calculations, favorite projections/mutations, and emitted realtime payload tests pass.
- backend :: npm run test:e2e -- --runInBand test/activities-favorite.e2e-spec.ts => separate accounts observe the same persisted favorite count while retaining independent personal favorite state.
- backend :: npm run build => the NestJS production build succeeds.
- frontend :: npm test -- "src/components/activities/ActivityMemberTable.test.tsx" "src/app/(dashboard)/activities/page.test.tsx" => member leave rendering and cross-account favorite state regressions pass.
- frontend :: npm run typecheck => TypeScript reports no errors.
- repository root :: git diff --check; git status --short => no whitespace errors and no unintended files.
Done:
- For every student shown in a club's Members tab, `Lượt rời còn lại` equals `max(0, 3 - total self-service club leaves by that student in the membership semester)` and never displays completion participation progress.
- After any account favorites or unfavorites an activity, all connected accounts display the same new aggregate favorite count without reload, while each account's heart/`is_favorited` state still represents only that account.
- Reloading or reconnecting yields favorite counts and personal favorite state consistent with persisted `activity_favorites` records.
Gate/Stop: Stop if `self_service_leave_count` is not the authoritative auditable leave source for historical memberships, or if deployment uses multiple backend instances without shared event fan-out; either requires a broader data/realtime architecture decision.
Rollback: Revert the scoped service, SSE, frontend, type, and test changes; persisted memberships and favorite records are not migrated or deleted.
Dependencies: Existing MongoDB `activity_members`/`activity_favorites` collections, authenticated activity SSE endpoint, and single-process in-memory SSE fan-out unless the deployment topology requires a shared broker.
Artifacts: Scoped diff plus targeted unit/e2e output, build/typecheck output, and final repository status.
