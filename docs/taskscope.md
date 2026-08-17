Task: `enhance-dormitory-overview-live-stats` | `feature_development` | Risk: medium | Profile: Quick

Objective: Extend the compact dormitory Overview with registration totals, free-bed counts by room type, right-aligned room status, and efficient near-real-time refresh.

Boundary: `frontend/src/app/(dashboard)/dormitory/overview/**` | Write: `frontend/src/app/(dashboard)/dormitory/overview/page.tsx`, `frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx`

Targets: quick-stat row; room-type capacity summaries; room-status table alignment; dashboard refresh lifecycle; focused UI tests.

Steps: preserve the existing dashboard API -> add `Tổng danh sách KTX` from `registration_summary.total` -> derive and show `Còn trống: <n> giường` inside both `Phòng Thường` and `Phòng Máy lạnh` cards from `room_rows.free_beds`, without extra requests -> keep quick statistics compact on one horizontal row with narrow-screen overflow -> right-align the `Trạng thái` header and cells -> automatically refresh the single dashboard request every 30 seconds while the page is visible, prevent overlapping requests, retain current data during background refresh, clean up on unmount, and keep manual refresh/error recovery -> update tests for totals, per-type free beds, alignment, polling, hidden-tab pause, and request deduplication.

Verify: `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/overview/page.test.tsx"` and `npm run typecheck` => focused behavior and TypeScript checks pass; `D:\PROJECT\manager_points` :: `git diff --check` => clean diff.

Done: the quick row includes total KTX registrations; both requested room-type cards show remaining beds; status is flush right; visible pages refresh within 30 seconds without flicker or concurrent duplicate requests; tests cover the new behavior.

Gate: None
