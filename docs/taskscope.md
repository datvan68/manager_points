# Task Identity and Pipeline

- Task ID: `dormitory-room-specific-utility-quotas`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `a389417d740214bda3bed2614202be3d8907976a`
- Base state: clean worktree before this task artifact is written.

# Risk Level

- Risk: high.
- Evidence: this changes persistent electricity/water configuration and the quota used to calculate financial invoices across backend, API, configuration UI, meter-entry preview, and manual invoice creation.
- Environment: development source planning. Source changes are Git-reversible; changing configuration or generating invoices in a shared/production database requires the applicable Human Gate.
- Blast radius: future utility previews and invoices for rooms with overrides; rooms without overrides and historical invoice snapshots must remain unchanged.

# Objective

Extend `Cấu hình định mức & đơn giá điện - nước` so authorized staff can keep a default per-person quota for electricity and water while assigning different per-person quota values to selected rooms. All future previews and invoice calculations must deterministically use the selected room's override when present and the default quota otherwise.

# Scope Boundaries

- Approved backend boundaries:
  - `backend/src/dormitory/schemas/utility-config.schema.ts`
  - `backend/src/dormitory/dto/utility-config.dto.ts`
  - `backend/src/dormitory/services/invoices.service.ts` and focused spec
  - `backend/src/dormitory/controllers/invoices.controller.ts` and focused spec only if response/API documentation needs adjustment
- Approved frontend boundaries:
  - `frontend/src/api/dormitory-api.ts` and focused test if present
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx` and focused test
  - `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.tsx` and focused test
  - an existing shared room selector component, or one new focused component under `frontend/src/components/dormitory/invoices/`, only if the current primitives cannot keep the configuration modal maintainable
  - `docs/taskscope.md`
- Excluded boundaries: room-fee configuration, meter-reading uniqueness/index repair, payment deadlines, QR behavior, payment/proof review, permission registry, reporting formulas, exports, notifications, deployment, production mutation, and historical invoice rewriting.

# Out of Scope

- Do not add room-specific unit prices; `unit_price` remains the shared electricity or water price already configured for all rooms.
- Do not change the meaning of quota: both default and room-specific values remain `quota_per_person`, and `quota_total = occupant_count × effective quota_per_person`.
- Do not recalculate previously created invoices. Their existing electricity/water quota, price, consumption, excess, and amount fields remain immutable snapshots unless separately edited through an already-supported workflow.
- Do not add a new collection or index. Store the optional overrides in the existing singleton utility configuration using backward-compatible defaults.
- Removing a room override only restores fallback to the default quota for future calculations; it must not delete the room, meter readings, or invoices.

# Context and Dependencies

- `UtilityTariff` currently contains only `quota_per_person`, `unit_price`, and `unit`; therefore one global quota is used for every room.
- `InvoicesService.saveBulkMeterReadings` reads the global configuration directly when it creates or updates each room invoice. `getMeterReadings` returns one global config, and the meter-entry page uses it for every card preview.
- The advanced invoice modal also seeds generic quotas and `getRoomInfo` currently returns occupancy and previous readings without an effective room tariff.
- Invoice `UtilityDetail` already persists `quota_per_person` and `quota_total`, so no invoice schema or historical-data migration is needed.
- Assumption: a room may have an electricity override, a water override, both, or neither. A room can appear at most once in each utility's override list, and the two values are independent.
- Canonical resolution rule: `effective quota = matching room override ?? utility default quota`. Room identity is the Room ObjectId, not room name/code.
- Existing permissions remain authoritative: `DORM_INVOICE_READ` reads configuration/effective tariffs and `DORM_INVOICE_CREATE` updates configuration or creates invoices.

# Steps

1. Capture focused baselines for utility configuration read/update, room info, meter-reading list/save, configuration modal, per-card preview, and advanced invoice creation.
2. Extend each utility tariff with a backward-compatible `room_quota_overrides` array containing `{ room_id, quota_per_person }`; default missing legacy arrays to empty. Add nested DTO transformation and validation for a valid room id, a finite non-negative quota, a bounded list size based on the current room count, and no duplicate room within the same utility.
3. In configuration update logic, normalize room ids, verify every referenced room exists, reject duplicate/unknown rooms with actionable validation messages, preserve electricity and water independence, and save the complete normalized configuration with existing audit attribution. Do not accept client-owned room names/codes as authority.
4. Add one server-side helper/resolution path for the effective electricity and water tariff of a room. Use it in `getMeterReadings`, `saveBulkMeterReadings`, and the room-information/defaulting path used by manual invoice creation so preview and persistence cannot diverge.
5. Extend each meter-reading room response (and room-info response where needed) with resolved effective tariffs plus enough source metadata to indicate `default` versus `room_override`. Continue returning the base configuration for the configuration modal; avoid making each client reimplement financial precedence rules.
6. In `Cấu hình định mức & đơn giá điện - nước`, keep the current default quota and shared unit-price fields. Under the `Định mức` area of both `Thông số Điện` and `Thông số Nước`, add a compact `Định mức riêng theo phòng` editor with searchable room selection, add-row action, editable non-negative quota, room/building label, source/fallback explanation, and remove-override action.
7. Prevent duplicate room selection within one utility, exclude already selected rooms from suggestions, preserve unsaved rows while editing the other utility, show inline validation, and disable repeated submit. On save success, replace local state with the normalized server response; on failure, keep user input and show the backend message.
8. Update the meter-entry page to calculate every card from that room's server-resolved electricity/water tariffs. Clearly show the effective per-person quota and whether it is a room-specific value; saving must persist the same quota snapshot and amount shown in the preview.
9. When a room is selected for a new advanced utility invoice, seed its electricity/water quota and shared prices from the resolved room tariffs. Preserve existing behavior when editing an issued invoice by using its stored snapshots rather than a newly changed configuration.
10. Add regression tests for legacy empty overrides, validation/normalization, independent electricity/water overrides, fallback, unknown/duplicate room rejection, effective response metadata, preview/persistence parity, update versus create behavior, configuration UI add/edit/remove/error states, and unchanged defaults/historical invoices.
11. Run focused tests, affected package type/build checks, manual responsive modal inspection, and final diff/status review.

# Acceptance Criteria

- AC-01: The configuration modal shows the existing default quota and unit price for both electricity and water, plus a room-specific quota editor under each utility; unit price remains global.
- AC-02: An authorized user can add one or more existing rooms to either utility and assign a finite non-negative `quota_per_person`. The same room cannot occur twice in one utility, while it may independently have one electricity and one water override.
- AC-03: Unknown/malformed room ids, duplicate room rows, invalid numeric values, and unauthorized updates are rejected without partially changing the stored configuration. Valid configuration is normalized and returned after save.
- AC-04: A room with an override uses that quota; a room without one uses the default. Electricity and water resolve independently through one server-authoritative rule.
- AC-05: Meter-entry cards display and calculate from their resolved room tariffs. The backend saves exactly the displayed effective `quota_per_person`, derived `quota_total`, excess consumption, unit price, and amount into the invoice snapshot.
- AC-06: New advanced invoices seed the selected room's effective tariffs. Editing an existing invoice continues to use its stored quota/price snapshots and is not silently changed by later configuration updates.
- AC-07: Removing an override makes future previews/invoices fall back to the default and does not remove or mutate rooms, prior meter readings, or historical invoices.
- AC-08: Legacy utility configuration documents without override arrays read as empty overrides and retain current global behavior; no migration or new collection/index is required.
- AC-09: Configuration remains usable on mobile/tablet: room search, rows, validation, and actions fit or scroll within the existing modal without page-level horizontal overflow.
- AC-10: Focused backend/frontend tests, frontend typecheck/build, backend build, whitespace check, and changed-path review pass before completion.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/services/invoices.service.spec.ts src/dormitory/controllers/invoices.controller.spec.ts` => configuration validation, effective tariff resolution, room-info/list response, meter-save snapshot parity, fallback, and historical behavior pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx"` => configuration editor and room-specific card/advanced-form calculations pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` and `npm run build` => TypeScript and Next.js production build pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS build passes.
- Manual development inspection at 375 px, 768 px, and desktop width => both utility override editors can search/add/edit/remove rooms, remain within the modal, and show effective/fallback values without horizontal page overflow.
- Manual calculation fixture: configure different electricity/water overrides for one room and leave another room at defaults; record equal occupancy/readings and confirm preview plus stored invoice snapshots differ only according to the configured effective quotas.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

- Planning-only: implementation and automated verification require a later implementation request.
- Human Gate before saving room-specific quotas in any shared/production database. Artifact: environment, old/new default tariffs, complete affected room/utility override diff, sample before/after calculations, and rollback value set. Resume only after approval of that exact configuration change.
- Human Gate before generating or updating invoices in a shared/production database to verify calculations. Use disposable development fixtures for implementation tests unless separately authorized.
- Stop and amend scope if product intent is a fixed quota per room rather than per person, room-specific unit prices, time-versioned/effective-date tariffs, bulk import, new permissions, a new collection/index, legacy backfill, historical recalculation, deployment, or production mutation.

# Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Implementation evidence: normalized configuration example, effective-tariff response for overridden/default rooms, focused test output, calculation parity evidence, responsive modal evidence, and final scoped diff/status.
- Checkpoints: base commit above; checkpoint after backend resolution/persistence tests pass and before frontend integration; final scoped diff. Validate the task artifact hash before execution handoff.
- Effective Rules Manifest (SHA-256):
  - `safety.md`: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - `global.md`: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - `antigravity-operating-contract.md`: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - `orchestrator.md`: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - `pipeline.md`: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for builds or responsive verification.
- Concurrency: one writer per path; serialize schema/DTO/service integration before frontend contract and view changes.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Independent review is mandatory for financial precedence/calculation, validation/authorization, persistence snapshots, and backward compatibility.
- Stop on gate, dirty overlap, new dependency, ambiguous per-room versus per-person semantics, historical rewrite, or unrelated failing baseline.
