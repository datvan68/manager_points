## Task Identity and Pipeline

Task: `refocus-dormitory-overview-by-room` | Pipeline: `feature_development` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `4135dd9368e59c87b23d0e13eb00b63f3c109b01`

## Risk Level

Risk: high. The change is read-only at runtime but spans backend and frontend and presents financial debt data used for dormitory operations. Incorrect room classification, duplicate registration counts, or conflated unpaid/overdue invoices could lead staff to act on misleading information. No database, schema, deployment, credential, or external-system mutation is included.

## Objective

Make the KTX Overview answer, from one screen: how many rooms exist by type, which named rooms are empty/partially occupied/full/unavailable, each room's bed capacity and availability, and which named rooms still have uncollected invoices with accurate counts and amounts.

## Scope Boundaries

Approved boundary: `backend/src/dormitory/**`, `frontend/src/api/dormitory-api.ts`, `frontend/src/app/(dashboard)/dormitory/overview/**`, and `docs/taskscope.md`.

Write targets: `backend/src/dormitory/services/dormitory-reports.service.ts`, a focused report-service spec under the same service directory, `frontend/src/api/dormitory-api.ts`, `frontend/src/app/(dashboard)/dormitory/overview/page.tsx`, and `frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx`. Additional paths may enter the manifest only if they remain inside the approved boundary and are required for the same read-only dashboard contract.

## Out of Scope

Changing room, bed, contract, registration, or invoice records; migrations; changing invoice calculation or payment workflows; redesigning Buildings, Registrations, or Invoices pages; changing room-assignment policy; adding dependencies; deployment; and unrelated KTX reports or dashboard modules.

## Context and Dependencies

- Rooms already store the canonical type in `room_type` as `Thường` or `Máy lạnh`; the current dashboard incorrectly infers air-conditioned rooms from `amenities`.
- Room status alone cannot distinguish an entirely empty room from a partially occupied room. Operational status must use room administrative status plus actual bed counts.
- The current dashboard exposes only aggregate bed occupancy and does not identify individual empty, available, or full rooms.
- The current report counts only formal registrations, while the registration list also includes public/QR and admin-temporary records. Linked public records must not be counted twice.
- The current `unpaid_invoices` value combines `Chưa thanh toán` and `Quá hạn`, while the UI labels the result inconsistently as both unpaid and overdue.
- Invoice debt can be assigned to a room through `Invoice.contract_id -> Contract.room_id -> Room`. Outstanding money uses `Invoice.total_amount`, not the number of invoice items.
- The existing dashboard and occupancy report calls and `DORM_PAGE` access remain the authorization boundary. No new privilege is introduced.

## Steps

1. Add focused backend regression fixtures for room-type classification, derived room state, unified registration backlog, invoice status separation, room-level debt aggregation, and orphaned references.
2. Extend the dashboard report contract with `room_summary`, `room_rows`, `registration_summary`, and `invoice_summary` while preserving currently consumed fields during the transition.
3. Classify every room by canonical `room_type`; compute total/used/free beds; then derive `Trống`, `Còn chỗ`, `Đầy`, `Bảo trì`, `Khóa`, or `Chưa cấu hình` deterministically. Administrative `Bảo trì` and `Khóa` override bed-derived states.
4. Aggregate outstanding invoices by resolved room, separating `Chưa thanh toán` from `Quá hạn`, counting distinct debtor students, and summing `total_amount`. Report unresolved contract/room references as an explicit anomaly total rather than silently dropping them.
5. Aggregate registration workload across formal, public/QR, and admin-temporary sources. Exclude linked public records from totals and expose pending confirmation, pending approval, approved-but-unassigned, and requested `Thường`/`Máy lạnh` counts as a secondary operational summary.
6. Update the frontend TypeScript contract and refactor Overview so its primary content is: room totals by type/state, a searchable/sortable room-status table, and a room-debt table. Keep registration backlog visible but subordinate to the room and collection sections.
7. Ensure zero, loading, partial-response, and error states remain explicit; use Vietnamese labels consistently and never label all unpaid invoices as overdue.
8. Run focused backend/frontend tests, affected compilation checks, and final diff/status review.

## Acceptance Criteria

- AC1: Overview displays total rooms and exact counts for `Thường` and `Máy lạnh`; their sum plus explicitly reported unknown-type rooms equals the total room count.
- AC2: Every room row shows room code/name, building, canonical type, total beds, occupied beds, free beds, and one deterministic operational state.
- AC3: A non-blocked room with zero used beds is `Trống`; with used and free beds is `Còn chỗ`; with beds and zero free beds is `Đầy`; `Bảo trì` and `Khóa` override derived occupancy; a zero-bed room is `Chưa cấu hình`.
- AC4: Overview can identify each named room in every state and offers filtering/sorting by building, type, and operational state without changing persisted data.
- AC5: The debt section lists each room having at least one `Chưa thanh toán` or `Quá hạn` invoice and shows distinct debtor students, unpaid count, overdue count, and total outstanding amount.
- AC6: Paid invoices do not contribute to outstanding counts or amounts. `Chưa thanh toán` and `Quá hạn` remain separate, and displayed monetary totals equal the sum of matching invoice `total_amount` values.
- AC7: Outstanding invoices whose contract or room cannot be resolved are included in a visible anomaly count and do not inflate a named room's debt.
- AC8: Registration summary includes unlinked public/admin-temporary and formal workload without double-counting linked public records, and distinguishes pending confirmation, pending approval, approved-unassigned, and requested room type.
- AC9: Existing loading, refresh, partial-data warning, and total failure behavior remain functional, and room/debt sections provide clear empty states.
- AC10: Existing dashboard consumers compile, focused backend/frontend tests pass, and the final diff contains no mutation workflow, migration, unrelated redesign, or unintended path.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- dormitory/services/dormitory-reports.service.spec.ts --runInBand` => room, registration, and room-debt aggregation cases pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles with the extended report contract.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/overview/page.test.tsx"` => totals, room states, debt rows, registration summary, empty states, and error states render correctly.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend contract and Overview type-check.
- `D:\PROJECT\manager_points` :: inspect representative fixture arithmetic for room-type totals, bed-state totals, unpaid/overdue counts, distinct debtors, and outstanding amounts => all values reconcile exactly.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

None. Implementation is limited to read-only reporting, presentation, and tests. Any persistent-data repair, schema/index mutation, deployment, or production action requires a separate scope and applicable approval.

## Artifacts and Checkpoints

Record focused test output, backend build result, frontend type-check result, representative aggregation fixtures, final diff, and final status. No database snapshot, artifact hash, or resumable mutation checkpoint is required because the scoped runtime behavior is read-only.

## Execution Budgets

One writer per path. Use at most three engineering iterations, two idempotent command retries, and two review-remediation cycles. Stop for dirty overlap on a target path, a required write outside the approved boundary, a change to persisted data or billing rules, a new authorization requirement, unresolved financial arithmetic, or failed required verification.
