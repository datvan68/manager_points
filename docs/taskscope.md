# Task Identity and Pipeline

- Task ID: `dormitory-room-specific-utility-tariffs`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `a389417d740214bda3bed2614202be3d8907976a`
- Base state: clean worktree before this task artifact is written.

# Risk Level

- Risk: high.
- Evidence: this changes persistent electricity/water configuration and both quota and unit-price inputs used to calculate financial invoices across backend, API, configuration UI, meter-entry preview, and manual invoice creation.
- Environment: development source planning. Source changes are Git-reversible; changing configuration or generating invoices in a shared/production database requires the applicable Human Gate.
- Blast radius: future utility previews and invoices for rooms with quota and/or unit-price overrides; rooms without overrides and historical invoice snapshots must remain unchanged.

# Objective

Extend `Cấu hình định mức & đơn giá điện - nước` so authorized staff can keep default per-person quotas and default unit prices for electricity and water while assigning different quota and/or unit-price values to selected rooms. Widen and reorganize the modal on desktop/tablet so the added controls use horizontal space and avoid unnecessary vertical scrolling. All future previews and invoice calculations must deterministically resolve each value from the selected room's override when present and its utility default otherwise.

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

- Do not change the meaning of quota: both default and room-specific values remain `quota_per_person`, and `quota_total = occupant_count × effective quota_per_person`.
- Do not recalculate previously created invoices. Their existing electricity/water quota, price, consumption, excess, and amount fields remain immutable snapshots unless separately edited through an already-supported workflow.
- Do not add a new collection or index. Store the optional overrides in the existing singleton utility configuration using backward-compatible defaults.
- Do not redesign unrelated invoice, payment, QR, or deadline modals. The width/layout change applies only to `Cấu hình định mức & đơn giá điện - nước` and any focused child editor it owns.
- Removing a room-specific quota or unit price only restores that field's default for future calculations; it must not delete the room, meter readings, or invoices.

# Context and Dependencies

- `UtilityTariff` already supports `room_quota_overrides`; the current resolver applies a room-specific quota but always uses the global `unit_price`. This task extends the same server-authoritative pattern to room-specific prices without breaking stored quota overrides.
- `InvoicesService.saveBulkMeterReadings`, `getMeterReadings`, and `getRoomInfo` already consume/return effective tariffs; their resolver and source metadata must now resolve quota and unit price independently.
- The advanced invoice modal already seeds new invoices from `effective_tariffs`; extending that contract must make the selected room's effective unit price flow through without changing edit behavior for historical snapshots.
- Invoice `UtilityDetail` already persists `quota_per_person` and `quota_total`, so no invoice schema or historical-data migration is needed.
- Assumption: a room may override quota, unit price, both, or neither independently for electricity and water. A room can appear at most once in each override list for a utility.
- Backward-compatible storage: retain `room_quota_overrides` and add `room_unit_price_overrides: [{ room_id, unit_price }]` to each utility tariff. Missing legacy arrays default to empty; do not rewrite existing quota overrides into a new shape.
- Canonical resolution rules: `effective quota = matching room quota override ?? default quota`; `effective unit price = matching room price override ?? default unit price`. Room identity is the Room ObjectId, not room name/code.
- Existing permissions remain authoritative: `DORM_INVOICE_READ` reads configuration/effective tariffs and `DORM_INVOICE_CREATE` updates configuration or creates invoices.

# Steps

1. Capture focused baselines for utility configuration read/update, room info, meter-reading list/save, configuration modal, per-card preview, and advanced invoice creation.
2. Retain the existing `room_quota_overrides` contract and add a backward-compatible `room_unit_price_overrides` array containing `{ room_id, unit_price }` to each utility tariff; default missing arrays to empty. Add nested DTO transformation and validation for a valid room id, a finite non-negative price, a bounded list size based on the current room count, and no duplicate room within the same price list.
3. In configuration update logic, normalize room ids, verify every room referenced by either override list exists, reject duplicate/unknown rooms with actionable validation messages, preserve electricity/water and quota/price independence, and save the complete normalized configuration with existing audit attribution. Do not accept client-owned room names/codes as authority.
4. Extend the existing server-side effective-tariff resolver so quota and unit price fall back independently. Use that single result in `getMeterReadings`, `saveBulkMeterReadings`, and the room-information/defaulting path used by manual invoice creation so preview and persistence cannot diverge.
5. Extend each effective tariff response with separate source metadata for quota and unit price, such as `quota_source` and `unit_price_source`, each `default | room_override`. Keep a temporary aggregate `source` only if required for backward compatibility, with a documented deterministic meaning; do not let clients infer financial precedence from populated configuration arrays.
6. In `Cấu hình định mức & đơn giá điện - nước`, keep the default quota and default unit-price fields. Under both `Thông số Điện` and `Thông số Nước`, provide compact room-specific editors for `Định mức` and `Đơn giá`, with searchable room selection, add-row action, editable non-negative value, room/building label, fallback explanation, and remove-override action. A room may be configured for one field without being forced to override the other.
7. Prevent duplicate room selection within each quota/price list, exclude already selected rooms from that list's suggestions, preserve unsaved rows while editing other sections, show inline validation, and disable repeated submit. On save success, replace local state with the normalized server response; on failure, keep user input and show the backend message.
8. Change only this configuration dialog from the current `max-w-lg` layout to a responsive wide layout (target desktop cap approximately `max-w-6xl`/1100-1200 px and viewport-safe width). Use two columns for electricity/water or equivalent horizontal grouping at sufficiently wide breakpoints, collapse to one column on narrow mobile, keep header/footer actions visible where practical, and allow internal vertical scrolling only when viewport height or content genuinely requires it. No page-level horizontal overflow.
9. Update the meter-entry page to calculate every card from that room's server-resolved electricity/water tariffs. Clearly show effective quota and unit price and whether each is default or room-specific; saving must persist the same quota/price snapshots and amount shown in the preview.
10. When a room is selected for a new advanced utility invoice, seed its electricity/water quota and unit price from the resolved room tariffs. Preserve existing behavior when editing an issued invoice by using its stored snapshots rather than a newly changed configuration.
11. Add regression tests for legacy empty price overrides, preservation of existing quota overrides, validation/normalization, independent electricity/water and quota/price fallback, unknown/duplicate room rejection, field-level source metadata, preview/persistence parity, update versus create behavior, wide/responsive modal states, and unchanged defaults/historical invoices.
12. Run focused tests, affected package type/build checks, manual responsive modal inspection, and final diff/status review.

# Acceptance Criteria

- AC-01: The configuration modal shows default quota and default unit price for electricity and water, plus room-specific quota and room-specific unit-price editors under each utility.
- AC-02: An authorized user can assign a finite non-negative `quota_per_person`, `unit_price`, or both to one or more existing rooms. The same room cannot occur twice in the same field's override list, while electricity, water, quota, and price remain independently configurable.
- AC-03: Unknown/malformed room ids, duplicate room rows, invalid numeric values, and unauthorized updates are rejected without partially changing the stored configuration. Valid configuration is normalized and returned after save.
- AC-04: A room uses each matching quota/price override and falls back only the missing field to its utility default. Electricity, water, quota, and price resolve independently through one server-authoritative rule.
- AC-05: Meter-entry cards display and calculate from resolved room tariffs, including field-level default/override indicators. The backend saves exactly the displayed effective `quota_per_person`, derived `quota_total`, excess consumption, `unit_price`, and amount into the invoice snapshot.
- AC-06: New advanced invoices seed the selected room's effective tariffs. Editing an existing invoice continues to use its stored quota/price snapshots and is not silently changed by later configuration updates.
- AC-07: Removing a quota or price override makes that field fall back to the default for future previews/invoices and does not remove or mutate rooms, prior meter readings, or historical invoices.
- AC-08: Existing documents with `room_quota_overrides` retain those values; documents without `room_unit_price_overrides` read it as empty and retain current global-price behavior. No migration or new collection/index is required.
- AC-09: On desktop/tablet, the configuration modal expands substantially beyond the current `max-w-lg` and uses the extra width to reduce vertical stacking. On mobile it collapses safely to one column; at all widths, controls remain accessible with no page-level horizontal overflow, and vertical scrolling appears only when content exceeds the available viewport.
- AC-10: Focused backend/frontend tests, frontend typecheck/build, backend build, whitespace check, and changed-path review pass before completion.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/services/invoices.service.spec.ts src/dormitory/controllers/invoices.controller.spec.ts` => configuration validation, effective tariff resolution, room-info/list response, meter-save snapshot parity, fallback, and historical behavior pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx"` => configuration editor and room-specific card/advanced-form calculations pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` and `npm run build` => TypeScript and Next.js production build pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS build passes.
- Manual development inspection at 375 px, 768 px, 1024 px, and 1440 px => the dialog is viewport-safe; wide layouts use horizontal space, mobile stacks cleanly, all quota/price editors and actions remain accessible, and unnecessary vertical scrolling is eliminated without page-level horizontal overflow.
- Manual calculation fixture: configure different electricity/water quota and unit-price overrides for one room, configure only price for a second room, and leave a third at defaults; record equal occupancy/readings and confirm preview plus stored invoice snapshots follow independent field fallback exactly.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

- Planning-only: implementation and automated verification require a later implementation request.
- Human Gate before saving room-specific quotas or prices in any shared/production database. Artifact: environment, old/new default tariffs, complete affected room/utility/field override diff, sample before/after calculations, and rollback value set. Resume only after approval of that exact configuration change.
- Human Gate before generating or updating invoices in a shared/production database to verify calculations. Use disposable development fixtures for implementation tests unless separately authorized.
- Stop and amend scope if product intent is a fixed quota per room rather than per person, tiered/unit price formulas instead of a single per-room price, time-versioned/effective-date tariffs, bulk import, new permissions, a new collection/index, legacy backfill, historical recalculation, deployment, or production mutation.

# Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Implementation evidence: normalized configuration example, effective-tariff response for fully/partially overridden and default rooms, focused test output, calculation parity evidence, wide/responsive modal evidence, and final scoped diff/status.
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
