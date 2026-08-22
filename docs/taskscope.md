# Task Identity and Pipeline

- Task ID: `manage-uploaded-media-lifecycle-and-storage-ui`
- Pipeline: `feature_development` with persistent-storage lifecycle controls
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `4848298a3dde7830d7bc45060e0835bed643c3e3`
- Effective Rules Manifest (SHA-256): `safety.md=6A3F283B...A772`, `global.md=67806F70...A43F`, `antigravity-operating-contract.md=51F3677C...1790`, `orchestrator.md=B782109E...D716`, `pipeline.md=0419C072...F41F3`.
- Base state: clean worktree before this planning artifact is written.

# Risk Level

- Risk: critical.
- Evidence: the feature manages persistent payment proofs, banking QR images, and public activity media; introduces orphan detection, quarantine, restore, audit records, and eventual permanent deletion; and crosses backend storage, Mongo references, authorization, scheduled jobs, domain services, and Admin UI.
- Environment: development planning only. No database mutation, filesystem cleanup, migration, purge, deployment, permission change, or production action is authorized by this taskscope alone.
- Reversibility: source changes are Git-reversible. Quarantine is recoverable while its manifest and bytes remain. Permanent purge and production reconciliation require Human Gates.
- Blast radius: all files below the managed upload root, four media namespaces, five Mongo collections, activity and dormitory image workflows, and the `/system` administration area.

# Objective

Provide safe image management where users replace or remove images from their owning business screens, while System Admins monitor storage and reconcile only server-confirmed orphan files through a reversible quarantine workflow without exposing private proofs or arbitrary filesystem controls.

# Scope Boundaries

- Backend core storage:
  - `backend/src/core/storage/storage.interface.ts`, `storage.service.ts`, `storage-orphan-reconciliation.service.ts`, `storage.module.ts`, `media.controller.ts` or a new `storage-admin.controller.ts`, plus focused specs.
  - New storage audit/reconciliation schema and service under `backend/src/core/storage/**`; wire only the Mongo models and connection required for managed-reference discovery.
- Domain lifecycle owners:
  - `backend/src/activities/activities.service.ts`, controller/module only when required, and activity service/controller specs.
  - `backend/src/dormitory/services/invoices.service.ts`, `room-fee-invoices.service.ts`, relevant controllers/DTOs/schemas/module, and focused specs.
- Frontend domain screens and APIs:
  - Activity logo/cover/background image controls and focused tests.
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`, `frontend/src/components/dormitory/invoices/RoomFeeCollection.tsx`, `frontend/src/api/dormitory-api.ts`, and focused tests for proof/QR replacement and removal.
- Admin storage UI:
  - New `frontend/src/app/(dashboard)/system/storage/**`, typed APIs in `frontend/src/api/system-api.ts`, navigation/guard integration in `Sidebar.tsx`, `RouteGuard.tsx`, and focused tests.
- Existing authorization boundary: `SYSTEM_ADMIN` for storage inventory/reconciliation/quarantine actions; existing activity and dormitory permissions remain authoritative for domain changes.
- Managed database references:
  - Activity `logo_url`, `cover_url`, `settings.background.backgroundImageUrl`, and `settings.background.backgroundFrameUrl`.
  - Utility and room-fee `payment_proof.url`.
  - Utility and room-fee configuration `transfer_qr_image.url`.
- Managed filesystem boundary: only allowlisted descendants of `UPLOAD_STORAGE_ROOT`; never enumerate, move, or delete sibling `/app/storage` content.
- Write boundary for this planning turn: `docs/taskscope.md` only.

# Out of Scope

- A generic filesystem browser, arbitrary path input, direct file editing, folder creation, or shell-like file operations.
- Displaying payment-proof thumbnails, QR banking contents, absolute server paths, raw private URLs, or physical storage keys in the Admin inventory.
- Deleting media belonging to a soft-deleted activity; soft deletion retains its media until a separately defined hard-delete policy exists.
- Making proofs public, changing invoice approval/accounting retention rules, or allowing deletion of an approved proof without the existing revoke/business flow.
- Adding new storage providers, CDN, Google Drive, S3, or paid services.
- Adding granular storage permission codes in this iteration; `SYSTEM_ADMIN` is reused to avoid an IAM migration. A least-privilege permission split is a future amendment.
- Executing production reconciliation, backfill, purge, backup restore, or deployment.

# Context and Dependencies

- `StorageService` already provides root-confined path resolution, atomic writes, basic deletion, staging cleanup, and filesystem capacity. `deleteFile` currently swallows errors, and capacity fallback incorrectly reports an empty virtual 100 GB instead of degraded/unavailable telemetry.
- Nightly reconciliation currently deletes only staging files older than one hour and logs disk capacity; it does not inventory database references, identify orphans, quarantine, restore, lock concurrent runs, or persist audit results.
- Payment-proof replacement and invoice deletion already attempt post-database, reference-safe cleanup, but cleanup errors are unaudited and files are immediately unlinked rather than quarantined.
- Activity image replacement/removal updates URL fields without cleaning the old file. Both utility and room-fee QR configurations overwrite the old QR without cleanup; QR cleanup must cross-check both configuration collections because they share `public/dormitory-qr`.
- Upload and entity attachment are separate requests. An unreferenced new upload must receive a grace period and cannot be classified as orphan immediately.
- `GET /api/media/capacity` already requires `SYSTEM_ADMIN`. No typed frontend capacity/inventory API or Admin storage screen currently exists.
- `/system` uses fail-closed dynamic route permissions, but the sensitive-route check is exact-path based and Admin sidebar discovery has a shortcut that can omit `/system`. A new `/system/storage` route must be explicitly fail-closed and discoverable.
- Private invoice proofs are already read through authenticated invoice-scoped Blob endpoints; the storage inventory must preserve that boundary.

# Steps

1. **Reference and lifecycle contract — review/code agents:** define managed namespaces, the eight verified reference fields, local-versus-external URL normalization, states (`staged`, `active`, `orphan_candidate`, `quarantined`, `purged`), a 24-hour unattached-upload grace period, configurable quarantine retention defaulting to 30 days, and server-generated opaque asset/run identifiers. Reject absolute paths, traversal, symlink escape, unknown namespaces, and external URLs.
2. **Storage primitives and telemetry — code/test agents:** add bounded recursive inventory of allowlisted namespace roots, managed live/quarantine byte counts and file counts, atomic quarantine/restore operations with checksum and manifest, explicit deletion errors, and degraded capacity reporting when `statfs` is unavailable. Never use a fictitious fallback capacity.
3. **Reference catalog and reconciliation — code/test agents:** derive references from the five verified Mongo collections, compare them with managed files, mark missing references separately from orphan candidates, enforce grace age, serialize runs with a lock/idempotent run ID, and support preview-only reconciliation. Execute mode may move confirmed orphans to quarantine but must not permanently unlink them.
4. **Audit and recovery — code/test agents:** persist sanitized actor/system, action, run ID, mode, counts/bytes, status, reason, timestamps, and error category. Do not store image contents, absolute paths, private URLs, or personal/payment details. Restore only after a fresh reference/path/checksum check; a referenced file discovered in quarantine is restored deterministically.
5. **Domain-owned activity lifecycle — code/test agents:** after a successful activity update, compare old and new values across all four activity media fields and quarantine each replaced/removed local file only when no activity field still references it. Preserve media on soft delete and preserve external URLs.
6. **Domain-owned QR lifecycle — code/test agents:** support explicit “Xóa ảnh QR” and replacement in both utility and room-fee configuration flows. Save the new configuration first, then cross-check both config collections before quarantining the old local QR. A failed config save leaves the old QR active and records/cleans the unattached new upload through the grace workflow.
7. **Domain-owned proof lifecycle — code/test agents:** make the current “Xóa ảnh” control reflect persisted behavior for both invoice types, subject to existing payment/review permissions and status rules. Revoke/clear the database reference first, then quarantine the unshared file. Approved proofs cannot be removed until the existing revoke flow makes them eligible. Replacement, invoice deletion, retries, and partial bulk deletion remain reference-safe.
8. **Admin API — code/test agents:** add `SYSTEM_ADMIN`-guarded endpoints for summary/capacity, paginated metadata inventory, reconciliation preview, quarantine execution, and restore. Return opaque IDs, kind/status, size/MIME, timestamps, reference state, minimal owner navigation data, last-scan/run status, and bounded samples; never accept a client-provided filesystem path. Permanent purge is a separate gated endpoint/job disabled by default.
9. **Admin UI — frontend/test agents:** create `/system/storage` with usage/health cards, managed live/quarantine/orphan/missing counts, last-scan time, filters by domain/type/status/age/size, pagination, empty/loading/error/degraded states, and audit/reconciliation status. Referenced rows offer only “Mở hồ sơ sở hữu”; server-confirmed orphans may be quarantined after confirmation. No private proof or QR thumbnails are rendered.
10. **Navigation and authorization — frontend/test agents:** make `/system/storage` a fail-closed sensitive route, add discoverable Admin navigation without exposing it to other roles, preserve dynamic route mapping behavior, and verify direct URL access returns the existing unauthorized state for non-Admins.
11. **Permanent purge and operations — devops/review agents, gated:** after retention, backup, reconciliation, and restore evidence are approved, purge only eligible quarantined files by immutable run/asset ID, recheck references immediately before unlink, record an audit result, monitor capacity, and verify restore/rollback evidence before production enablement.
12. **Independent review and final verification — review/test agents:** review authorization, privacy, retention, race handling, cross-collection references, path confinement, audit sanitization, and final diff; run focused tests, builds/typecheck, and a disposable-root quarantine/restore drill.

# Acceptance Criteria

- **AC-01:** Users replace/remove activity images, QR images, and eligible payment proofs only from the owning business screen under existing domain permissions; Admin inventory does not edit referenced media.
- **AC-02:** Replacement/removal updates the database first and quarantines the previous local file only after a fresh cross-field/cross-collection reference count reaches zero. Failed database writes never remove the current file.
- **AC-03:** New unattached uploads younger than 24 hours are not quarantined. Reconciliation preview is read-only, reports referenced/orphan/missing counts separately, ignores external URLs, and is deterministic and idempotent.
- **AC-04:** Quarantine uses an atomic move within `UPLOAD_STORAGE_ROOT`, records checksum/original logical key/run/time, supports safe restoration, and retains files for the configured period. Permanent unlink is disabled by default and gated.
- **AC-05:** Activity cleanup checks all four activity fields; QR cleanup checks both utility and room-fee config collections; proof cleanup checks the correct invoice collection. Soft-deleted activity media and approved proofs are retained.
- **AC-06:** `/system/storage` and all Admin media APIs require `SYSTEM_ADMIN`, fail closed on mapping/API errors, and are discoverable only to authorized users. Non-Admins receive 401/403 or the existing unauthorized UI.
- **AC-07:** The Admin page exposes only opaque metadata and minimal owner links. It never renders absolute paths, storage keys, raw private URLs, payment-proof thumbnails, QR contents, or personal/payment data.
- **AC-08:** Capacity distinguishes filesystem total/free status from managed live/quarantine bytes and counts. Unsupported/failed `statfs` is reported as degraded/unavailable, and critical capacity continues to reject uploads with controlled errors.
- **AC-09:** Every preview, quarantine, restore, purge attempt, and domain-driven cleanup records a sanitized success/failure audit with actor/system and run correlation. Cleanup failures are observable and never silently treated as success.
- **AC-10:** Concurrent/retried reconciliation cannot process an asset twice; stale-reference races return a conflict/protected result and leave bytes intact.
- **AC-11:** Focused backend/frontend tests, backend build, frontend typecheck, disposable-root lifecycle drill, `git diff --check`, and final scoped diff/status pass without unrelated changes.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/core/storage/storage.service.spec.ts src/core/storage/storage-orphan-reconciliation.service.spec.ts src/activities/activities.service.spec.ts src/dormitory/services/invoices.service.spec.ts src/dormitory/services/room-fee-invoices.service.spec.ts` => path confinement, reference catalog, grace, quarantine/restore, audit, activity/QR/proof cleanup, retry, and race cases pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => storage Admin APIs, schemas, services, DTOs, and domain integrations compile.
- `D:\PROJECT\manager_points\frontend :: npm test -- --run "src/api/system-api.test.ts" "src/app/(dashboard)/system/storage/page.test.tsx" "src/components/layout/Sidebar.test.tsx" "src/components/guards/RouteGuard.test.tsx" "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/components/dormitory/invoices/RoomFeeCollection.test.tsx" "src/components/activities/ActivityForm.test.tsx" "src/app/(dashboard)/activities/[activityId]/page.test.tsx"` => Admin privacy/permissions/navigation and all domain media flows pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => new typed APIs, page, guards, and domain contracts compile.
- Disposable `UPLOAD_STORAGE_ROOT` drill => preview performs no mutation; execute quarantines only aged unreferenced fixtures; referenced/missing/external/symlink fixtures remain protected; restore reproduces original checksum; repeated run is idempotent.
- API/privacy inspection => inventory responses and UI contain no absolute root, private URL, raw storage key, proof thumbnail, QR content, or personal/payment metadata.
- Approved staging capacity drill => normal/warning/critical/degraded states are accurate; critical upload rejection is controlled; reconciliation never traverses outside the upload root.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => no whitespace error or unintended path.

# Safety Gates

- **G-01 — Persistent audit/schema and lifecycle enablement:** before applying new Mongo audit records or enabling quarantine outside disposable development tests, approve schema/index review, 24-hour grace, 30-day retention, existing `SYSTEM_ADMIN` access, concurrency lock, sanitized audit shape, backup, and rollback. Rollback: disable execute endpoints/cron and retain preview/capacity only. Resume: Steps 3-4 and 8 production enablement.
- **G-02 — Reconciliation/backfill:** before staging or production scanning that can move existing files, approve a redacted preview report, namespace/reference coverage, missing/orphan samples, backup/checksums, maintenance/concurrency plan, and restore rehearsal. Rollback: restore quarantine manifests to their logical keys and leave database references unchanged. Resume: Step 3 execute mode.
- **G-03 — Permanent purge:** before enabling or running unlink, approve exact eligible run IDs/counts/bytes, retention expiry, fresh zero-reference result, backup, audit artifact, operator, and rollback limitation that purged bytes require backup restore. Resume: Step 11.
- **G-04 — Deployment:** before staging/production deployment, approve backend/frontend verification, fail-closed access review, volume ownership/capacity evidence, alerting, backup/restore results, and rollback version. Resume: deploy and post-deploy smoke verification.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md` with SHA-256 recorded after validation.
- Required execution artifacts: managed-reference manifest, API/privacy review, focused test/build outputs, redacted reconciliation preview, quarantine/restore drill report, audit schema/index review, capacity report, backup evidence, and final scoped diff.
- Checkpoints: after storage primitives/reference catalog tests; after domain lifecycle integration; after Admin API/UI and security review; before any non-disposable reconciliation; before purge enablement.
- Never include image bytes, absolute paths, raw private URLs, payment details, or personal identifiers in artifacts.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for bounded test/build or disposable reconciliation verification.
- Concurrency: up to three non-overlapping workers; one writer per path. Storage core/reference catalog and schema wiring are serialized; domain/frontend work begins only after the contract checkpoint.
- Retry: at most two safe idempotent tool/filesystem retries, three engineering loops, and two review remediation cycles.
- Stop on path/symlink escape, authorization regression, private-data exposure, reference ambiguity, checksum mismatch, unbounded filesystem scan, missing lock/rollback manifest, unrelated dirty-path conflict, scope expansion, or any unsatisfied gate.
