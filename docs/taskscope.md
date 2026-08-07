# Task Identity and Pipeline

- Task: `dormitory-schema-english-naming`
- Pipeline: `refactor`
- Risk: high
- Profile: Full
- Rule set: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base commit: `146b0ecd10a08499b85bf59fa3a6302b9aebd540`
- Base state: current worktree; preserve the pre-existing deleted files under `backend/uploads/`.

## Risk Level

This is a cross-layer public-contract and persistent-data rename affecting MongoDB documents, indexes/queries, DTOs, services, tests, frontend types, forms, filters, reports, and public QR registration. The change is reversible through a tested rollback migration, but executing either migration mutates persistent data and requires a Human Gate. Environment for implementation and automated verification is development/isolated test only.

## Objective

Replace Vietnamese transliterated field identifiers in the dormitory domain with consistent English `snake_case` identifiers, while keeping Vietnamese only in explicitly required enum values and rendering all user-facing text in correct, fully accented UTF-8 Vietnamese without mojibake.

## Scope Boundaries

### Approved/read boundary

- `backend/src/dormitory/**`
- `backend/test/**` only for affected dormitory e2e contracts
- `backend/scripts/**` and `backend/package.json` for migration commands
- `frontend/src/api/dormitory-api.ts`
- `frontend/src/app/(dashboard)/dormitory/**`
- `frontend/src/app/public/room/[qrId]/**`
- `frontend/src/app/(dashboard)/students/unclassified/**`
- Focused tests adjacent to those frontend paths
- `docs/**` for the migration/runbook documentation

### Expected write boundary

- The affected files inside the approved boundary that reference renamed fields
- New idempotent dry-run/execute and rollback scripts under `backend/scripts/`
- `backend/package.json` migration script entries
- Focused backend/frontend regression tests
- A migration field map/runbook under `docs/`

### Canonical field map

Use English `snake_case` for persisted fields, DTO/query keys, response bodies, aggregation projections, and frontend API models. Preserve already-English relationship keys such as `student_id`, `room_id`, `bed_id`, `building_id`, `contract_id`, and timestamps.

| Schema | Legacy fields → canonical English fields |
| --- | --- |
| Building | `ma_toa_nha→building_code`, `ten→name`, `dia_chi→address`, `so_tang→floor_count`, `trang_thai→status`, `mo_ta→description` |
| Bed | `ma_giuong→bed_code`, `vi_tri→position`, `trang_thai→status` |
| Room | `ma_phong→room_code`, `ten_phong→room_name`, `tang→floor`, `loai_phong→room_type`, `so_giuong→bed_count`, `so_giuong_trong→available_bed_count`, `gia_phong→room_price`, `trang_thai→status`, `tien_ich→amenities`, `ma_qr→qr_code`, `url_xem_nhanh→public_url`, `mo_ta→description` |
| Contract | `ma_hd→contract_code`, `ngay_bat_dau→start_date`, `ngay_ket_thuc→end_date`, `trang_thai→status`, `ly_do_huy→cancellation_reason`, `nguoi_tao_id→created_by_id` |
| Invoice/InvoiceItem | `loai→type`, `mo_ta→description`, `so_tien→amount`, `ma_hoa_don→invoice_code`, `ky_thu→billing_period`, `chi_tiet→items`, `tong_tien→total_amount`, `trang_thai→status`, `han_thanh_toan→due_date`, `ngay_thanh_toan→paid_at`, `phuong_thuc→payment_method`, `nguoi_xac_nhan_id→confirmed_by_id`, `ghi_chu→notes` |
| MaintenanceRequest | `ma_ycbt→request_code`, `loai_su_co→issue_type`, `mo_ta→description`, `hinh_anh→images`, `trang_thai→status`, `do_uu_tien→priority`, `ky_thuat_vien_id→technician_id`, `ghi_chu_xu_ly→resolution_notes`, `ngay_hoan_tat→completed_at` |
| Registration | `ma_dk→registration_code`, `ky_hoc→semester`, `nam_hoc→academic_year`, `ngay_sinh→date_of_birth`, `gioi_tinh→gender`, `so_dien_thoai→phone_number`, `nguyen_vong→preference`, nested `loai_phong→room_type` and `ghi_chu→notes`, `doi_tuong_uu_tien→priority_group`, `trang_thai→status`, `ly_do_tu_choi→rejection_reason`, `nguoi_duyet_id→reviewed_by_id`, `ngay_duyet→reviewed_at` |
| PublicRegistration | `ma_dk_public→public_registration_code`, `ho_ten→full_name`, `so_dien_thoai→phone_number`, `ma_sinh_vien→student_code`, `ngay_sinh→date_of_birth`, `gioi_tinh→gender`, `ma_phong→room_code`, `ten_toa_nha→building_name`, `loai_phong→room_type`, `ky_hoc→semester`, `nam_hoc→academic_year`, `doi_tuong_uu_tien→priority_group`, `ghi_chu→notes`, `trang_thai→status`, `ly_do_tu_choi→rejection_reason`, `nguon→source` |
| Violation | `ma_vp→violation_code`, `loai_vi_pham→violation_type`, `muc_do→severity`, `diem_tru→deducted_points`, `ngay_ghi_nhan→recorded_at`, `mo_ta→description`, `minh_chung→evidence`, `hinh_thuc_xu_ly→resolution_type`, `trang_thai→status`, `nguoi_ghi_nhan_id→recorded_by_id`, `nguoi_xu_ly_id→resolved_by_id`, `ghi_chu_xu_ly→resolution_notes` |

## Out of Scope

- Renaming already-English fields merely to switch between `snake_case` and `camelCase`.
- Changing collection names, route URLs, permission codes, ObjectId relationships, or Mongo timestamps.
- Redesigning dormitory UI or changing business behavior.
- Translating free-form user data.
- Production/staging migration, deployment, or deletion of legacy data during planning/implementation without separate approval.
- Non-dormitory schemas; the focused audit found Vietnamese-style schema identifiers only in the nine dormitory schema files listed above.

## Context and Dependencies

- `Building` currently persists `ma_toa_nha`, `ten`, `dia_chi`, `so_tang`, `trang_thai`, and `mo_ta`; the same pattern appears across the other eight dormitory schemas.
- Consumers include dormitory controllers/services/DTOs, populate projections and aggregation stages, QR/public registration, reports, `frontend/src/api/dormitory-api.ts`, all dormitory pages, the public room page, and the unclassified-students page.
- Replace identifiers end-to-end; do not leave mixed legacy/canonical request or response shapes after the migration cutover.
- Define typed enum constants. Prefer stable English enum codes; retain Vietnamese enum values only when an explicit business/data-compatibility requirement is documented. UI labels must come from centralized Vietnamese display maps, never from persisted field names or raw English enum codes.
- All edited source and fixtures must remain UTF-8. Mojibake detection must target broken byte-decoding sequences and must not flag valid Vietnamese uppercase text such as `NHÂN`.

## Steps

1. Inventory every legacy-field read/write, Mongo filter/update/projection/index, DTO/Swagger contract, frontend API type, UI form/filter/table, export/report, fixture, and test within the approved boundary; freeze the final mapping above before mutation.
2. Add canonical enum definitions and Vietnamese UI label maps. Document any enum intentionally retained in Vietnamese and why.
3. Update the nine schemas, compound indexes, DTOs/query DTOs, controllers, services, populate projections, aggregations, QR/public flows, and reports to the canonical English contract.
4. Update frontend API models/payloads and every affected dormitory/public consumer. Render labels, validation messages, statuses, options, headings, currency/date text, and accessibility text as fully accented Vietnamese through explicit mappings.
5. Add an idempotent migration with default dry-run, explicit `--execute`, collision detection when both old/new keys exist, count/checksum summaries, production blocking, and no logging of personal field values. Rename nested registration preference keys and every affected index/query key. Add a matching dry-run-first rollback.
6. Add focused schema/service/controller/API/UI/migration tests, including legacy fixtures, canonical output, index behavior, enum display mapping, Unicode round trips, and representative mojibake guards.
7. Run focused tests, builds/typecheck, migration dry-run against an isolated fixture database, then review the final diff/status for unintended legacy identifiers and unrelated changes.

## Acceptance Criteria

- `AC-01`: All nine dormitory schemas and their active consumers use only the canonical English field names in the table; approved enum values are the only persisted values that may contain Vietnamese.
- `AC-02`: Create/read/update/filter/search/report/QR/public-registration flows accept and return the canonical English contract with no mixed legacy keys.
- `AC-03`: The migration dry-run reports document/index changes without mutation; execute and rollback are idempotent, collision-safe, count-verified, and blocked for production by default.
- `AC-04`: Existing isolated legacy fixtures migrate without data loss, relationship breakage, duplicate-index failure, or semantic change; rollback restores the legacy shape.
- `AC-05`: Every affected UI surface displays fully accented Vietnamese labels and mapped enum text; representative Unicode values survive API round trips and no known mojibake sequence is rendered.
- `AC-06`: Focused backend/frontend tests, backend build, frontend typecheck, migration tests/dry-run, and final repository checks pass.

## Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand dormitory` => affected schema/service/controller behavior and canonical contracts pass.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand <new migration spec path>` => dry-run, execute, collision, nested-key, idempotency, and rollback cases pass against isolated fixtures.
- `D:\PROJECT\manager_points\backend :: npm run migration:dormitory-naming:dry-run` with an explicitly isolated test database => zero writes and an accurate proposed-change summary.
- `D:\PROJECT\manager_points\backend :: npm run build` => NestJS compilation passes.
- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/api/dormitory-api.test.ts 'src/app/(dashboard)/dormitory' src/components/dormitory` => canonical payload/response and Vietnamese display regressions pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points :: rg -n '<final legacy identifier alternation>' backend/src/dormitory frontend/src/api/dormitory-api.ts 'frontend/src/app/(dashboard)/dormitory' 'frontend/src/app/public/room/[qrId]' 'frontend/src/app/(dashboard)/students/unclassified'` => only migration compatibility maps/tests/documented enum values remain.
- `D:\PROJECT\manager_points :: rg -n '<targeted mojibake alternation>' backend/src/dormitory frontend/src` => no broken Vietnamese sequences in affected user-facing text.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => no whitespace errors; only scoped changes plus the preserved pre-existing upload deletions are present.

## Safety Gates

- Planning-only: this file authorizes no implementation.
- Human Gate: required before any migration `--execute` or rollback against a connected persistent database. Review artifact: dry-run counts, collision report, affected collections/indexes, backup reference, tested rollback, environment, and masked connection identity. Resume point: execute only after approval, then compare pre/post counts and sample canonical shapes without exposing personal data.
- Deployment remains separately gated and out of scope.

## Artifacts and Checkpoints

- Required for implementation: final mapping inventory, focused test results, dry-run report, rollback test result, and final diff/status.
- Before any approved persistent execution: database backup reference and pre-migration counts/checksums.
- Checkpoint hashes: migration/rollback scripts and approved dry-run report at the Human Gate.

## Execution Budgets

- Step deadline: 600 seconds; maximum 1800 seconds when migration tests/build require it.
- Concurrent writers per path: 1; serialize schema/API contract changes.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Stop on collision, data-count mismatch, index incompatibility, unexpected consumer outside the approved boundary, production connection detection, or need to change an undocumented enum/business meaning.
