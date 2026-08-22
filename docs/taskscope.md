# Task Identity and Pipeline

- Task ID: `stabilize-storage-admin-backend-and-safety-gates`
- Pipeline: `bug_fix`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `04c85ad3a417315c1124b69ac4a81ffe3ce77228`
- Effective Rules Manifest (SHA-256): `safety.md=6A3F283B835394B1AF1F6380D94CBA260ACBED8A60D3065DD5365BB15806A772`, `global.md=67806F70A5F89ADF42E3BE88413CC76CC27A02C90FAD0609AE71DE34D046A43F`, `antigravity-operating-contract.md=51F3677C7E44121529CC0A4B17E5667BCBD2147EE63C6F30207C10D5DEB51790`, `orchestrator.md=B782109E896B2FA48A6523358A788A9DB9B81B72F3D8FC66F70019395738D716`, `pipeline.md=0419C072380887F96B37FE4EB48DAE764306F46FB03190B176A43EBCEA3F41F3`.
- Base state: clean worktree before this planning artifact is written.

# Risk Level

- Risk: critical.
- Evidence: the current backend does not compile and exposes storage reconciliation, restore, and permanent purge operations over persistent payment-proof, QR, and activity media. Correctness depends on authorization, retention, fresh database references, filesystem confinement, concurrency, and auditable failure handling.
- Environment: development planning only. No database/schema mutation, filesystem reconciliation, quarantine, restore, purge, deployment, or production action is authorized by this taskscope.
- Reversibility: source fixes are Git-reversible. Execute/quarantine is recoverable only while manifests and bytes remain; purge is destructive and separately gated.
- Blast radius: `backend/src/core/storage/**`, five referenced Mongo collections, storage Admin API consumers, and files beneath `UPLOAD_STORAGE_ROOT`.

# Objective

Restore a passing backend build and make the storage administration backend conform to the approved lifecycle contract: preview is safe by default, persistent mutations are capability-gated, concurrency is cross-instance safe, purge cannot bypass retention/reference checks, and API/audit outputs do not expose sensitive storage details.

# Scope Boundaries

- Backend storage implementation and tests:
  - `backend/src/core/storage/storage-admin.controller.ts`
  - `backend/src/core/storage/storage-admin.controller.spec.ts` (new)
  - `backend/src/core/storage/storage-orphan-reconciliation.service.ts`
  - `backend/src/core/storage/storage-orphan-reconciliation.service.spec.ts`
  - `backend/src/core/storage/storage.service.ts`
  - `backend/src/core/storage/storage.service.spec.ts`
  - `backend/src/core/storage/storage.interface.ts`
  - `backend/src/core/storage/schemas/storage-audit.schema.ts`
  - `backend/src/core/storage/storage.module.ts`
- Typed configuration may be added under the existing backend configuration owner and versioned environment template only when verified during implementation.
- Frontend compatibility is limited to `frontend/src/api/system-api.ts` and `/system/storage` tests/UI if capability fields or protected-operation error contracts require adjustment. No visual redesign.
- Managed references remain the four Activity media fields, two invoice proof fields, and two transfer-QR fields across the five existing collections.
- Filesystem operations remain confined to allowlisted descendants of `UPLOAD_STORAGE_ROOT`; `/app/storage` siblings are excluded.
- Write boundary for this planning turn: `docs/taskscope.md` only.

# Out of Scope

- Running reconciliation, quarantine, restore, migration, or purge against development data, staging, or production.
- Deployment, schema/index application outside disposable tests, backup mutation, Git history rewrite, secrets, IAM, or permission-code changes.
- New storage providers, CDN, Drive, S3, or a generic filesystem manager.
- Changing invoice approval/accounting retention rules, making proofs public, or deleting activity media on soft delete.
- Reworking domain-owned replace/delete UI beyond compatibility with the corrected backend contract.

# Context and Dependencies

- Reproduced on commit `04c85ad3`: `backend :: npm run build` fails with two `TS1272` errors at `storage-admin.controller.ts:39` and `:41`. `AssetLifecycleState` and `StorageNamespace` are used in decorated signatures but imported as runtime values under `isolatedModules` plus `emitDecoratorMetadata`.
- The focused backend suite passes: 5 suites and 133 tests. It does not compile the failing controller path and has no focused controller regression test.
- `DELETE /api/system/storage/purge/:assetId` and `POST /api/system/storage/reconcile/execute` are currently registered and callable by any `SYSTEM_ADMIN`; there is no disabled-by-default capability gate matching the approved Human Gates.
- `purgeAsset` immediately unlinks a quarantined asset without enforcing the configured 30-day retention, fresh zero-reference verification, immutable eligibility/run approval, or backup evidence.
- Reconciliation uses an in-process boolean lock. It does not serialize multiple backend processes/hosts and can race after restart.
- Per-file quarantine failures are logged and the run is still recorded as `success`; `deleteFile` and purge convert filesystem errors to `false`. This violates observable failure/audit requirements.
- Reconciliation responses include logical storage keys in orphan/missing samples, and audit/run errors may persist raw exception messages. These values can reveal internal paths or sensitive identifiers.
- Query parameters are converted with `Number(...)` without DTO validation, bounds, or enum validation.
- Existing path confinement, atomic write/quarantine primitives, 24-hour managed-file grace classification, checksum restore, degraded `statfs`, reference catalog, and 133 passing focused tests should be preserved.

# Steps

1. **Compile regression — code/test:** change storage interface symbols used only as types to `import type` (or an equivalent decorator-safe DTO design), add a controller compile/route test, and establish `npm run build` as a mandatory regression check.
2. **Validated Admin contract — code/test:** introduce DTOs for inventory filters and mutation requests; validate/coerce bounded page/limit, enums, asset IDs, and optional confirmation tokens without accepting filesystem paths. Return controlled 400/409/423/503 responses.
3. **Capability gates — code/test:** expose read-only summary, inventory, audit, and preview by default. Register or reject execute, restore, and purge according to explicit typed configuration whose default is disabled. Return capability metadata so the UI never presents unavailable destructive actions. Configuration changes outside disposable development remain gated.
4. **Cross-instance reconciliation lock — code/test:** replace the process-local boolean as the authority with an atomic Mongo lease/run lock containing owner, expiry, and idempotent run ID. Support stale-lease recovery, reject concurrent execute/preview mutations deterministically, and retain the local guard only as an optimization.
5. **Safe reconciliation outcome — code/test:** recheck the asset reference immediately before each quarantine move, record every attempted item and sanitized error category, and mark a run `partial` or `failed` when any required item fails. Never report successful quarantine counts for failed moves.
6. **Restore protection — code/test:** validate opaque asset ID, manifest checksum, confined original key, target collision, and current reference state before restore. Record sanitized success and failure audit entries; do not return absolute paths or raw logical keys.
7. **Purge eligibility — code/test/review:** keep purge disabled by default. When explicitly enabled after Human Gate G-03, require quarantine age at or beyond configured retention (default 30 days), an immutable approved run/asset identifier, fresh zero-reference verification across all managed fields/collections, valid checksum/manifest, and an explicit confirmation contract. Reject otherwise without unlinking either bytes or manifest.
8. **Privacy-safe API and audit — code/test:** replace raw keys, filenames tied to people/payments, owner IDs, and exception strings with opaque IDs, domain/type, bounded counts, and allowlisted error categories. Sanitize logger/audit/run-record data while retaining correlation IDs useful for operations.
9. **Error propagation and atomicity — code/test:** stop swallowing deletion/purge/quarantine errors. Preserve bytes and manifest consistently on partial filesystem failure, expose a controlled failure, and audit it. Make repeated execute/restore/purge requests idempotent or conflict-safe.
10. **Frontend compatibility — frontend/test, conditional:** consume capability metadata, hide disabled execute/restore/purge controls, handle protected-operation errors, and preserve fail-closed `SYSTEM_ADMIN` access and privacy-safe inventory. Do not add proof/QR previews.
11. **Independent review and verification — review/test:** review authorization, persistence gates, lease behavior, TOCTOU reference checks, retention, path/symlink confinement, response/audit privacy, and final diff; run focused tests, backend build, conditional frontend checks, and disposable-root failure drills.

# Acceptance Criteria

- **AC-01:** `npm run build` succeeds, and a regression test covers the decorated controller signature/routes so the reproduced `TS1272` failure cannot recur unnoticed.
- **AC-02:** Read-only storage endpoints remain `SYSTEM_ADMIN`-guarded; execute, restore, and purge are disabled by default and return a controlled protected result when unavailable.
- **AC-03:** Admin query/mutation input is DTO-validated and bounded; no endpoint accepts an absolute/relative filesystem path or unknown namespace/status.
- **AC-04:** An atomic expiring lease prevents overlapping reconciliation across processes; stale leases recover safely and duplicate run IDs are idempotent/conflict-safe.
- **AC-05:** Every quarantine candidate receives a fresh reference check immediately before its move. Any item failure produces an accurate partial/failed run and sanitized audit rather than a success-only record.
- **AC-06:** Restore verifies ID, confined manifest/key, checksum, collision, and reference state and records both success and failure without exposing raw keys or paths.
- **AC-07:** Purge cannot unlink before the configured retention period, while referenced, without an approved immutable eligibility token/run, when disabled, or after a stale eligibility decision. Failed purge leaves recoverable bytes/manifest intact.
- **AC-08:** API responses, logs, audit records, and reconciliation run records contain no absolute paths, raw private URLs, logical storage keys, payment/person filenames, owner identifiers, or unclassified raw exceptions.
- **AC-09:** Filesystem failures are observable and categorized; code never converts a failed persistent mutation into a successful response or audit.
- **AC-10:** Existing path confinement, symlink rejection, 24-hour unattached-media grace, five-collection reference coverage, checksum behavior, degraded capacity reporting, and all existing focused tests remain passing.
- **AC-11:** If capability metadata changes the frontend contract, `/system/storage` hides disabled actions, remains fail-closed for non-Admins, and its focused tests/typecheck pass.
- **AC-12:** Final diff is scoped, contains no generated/uploaded media, and introduces no unrelated changes.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/core/storage/storage-admin.controller.spec.ts src/core/storage/storage.service.spec.ts src/core/storage/storage-orphan-reconciliation.service.spec.ts src/activities/activities.service.spec.ts src/dormitory/services/invoices.service.spec.ts src/dormitory/services/room-fee-invoices.service.spec.ts` => controller compile/guards/validation plus storage lifecycle and domain regressions pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => exits 0 with no `TS1272` or other TypeScript/Nest compilation error.
- Disposable Mongo/temp `UPLOAD_STORAGE_ROOT` tests => second process cannot acquire an active lease; stale lease recovers; fresh DB reference blocks quarantine/purge; retention blocks early purge; checksum/path/symlink/collision failures preserve recoverable state; partial moves produce partial/failed audit.
- Privacy inspection of API DTO fixtures, logs, audit documents, and run documents => no prohibited raw key/path/private/person/payment data.
- Conditional frontend: `D:\PROJECT\manager_points\frontend :: npm test -- --run "src/api/system-api.test.ts" "src/app/(dashboard)/system/storage/page.test.tsx"` and `npm run typecheck` => capability/error handling and fail-closed UI pass.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

- **G-01 — Persistent audit/lease schema:** before applying new or changed indexes/documents outside disposable tests, approve schema/index review, lease TTL/expiry behavior, compatibility, backup, rollback, and operator. Rollback: disable mutation capabilities and run preview/read-only only. Resume: Steps 4-5 enablement.
- **G-02 — Execute/restore enablement:** before enabling quarantine or restore in staging/production, approve redacted preview, capability configuration, reference coverage, backup/checksums, concurrency plan, and restore rehearsal. Rollback: disable capabilities and restore only from verified manifests under an approved operation. Resume: Steps 5-6 operational enablement.
- **G-03 — Permanent purge:** before enabling or invoking purge, approve exact immutable eligible IDs/counts/bytes, retention expiry, fresh zero-reference evidence, backup, audit artifact, operator, and the limitation that rollback requires backup restore. Resume: Step 7 operational enablement.
- **G-04 — Deployment:** before staging/production deployment, approve backend/frontend verification, access review, capability defaults, volume/capacity/backup evidence, and rollback version. Resume: deploy and post-deploy smoke checks.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`; record SHA-256 after validation.
- Required execution evidence: reproduced build log, controller regression result, capability contract, lease/schema review, retention/reference test report, privacy review, focused test/build output, and final scoped diff.
- Checkpoints: after compile/DTO fixes; after lease and reconciliation tests; after restore/purge security review; before any non-disposable capability enablement.
- Artifacts must not include image bytes, absolute paths, raw storage keys/private URLs, payment details, personal identifiers, or secrets.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for bounded build/test or disposable concurrency drills.
- Concurrency: up to three non-overlapping workers; one writer per path. Storage interface/controller contract precedes service and conditional frontend work.
- Retry: at most two safe idempotent tool/filesystem retries, three engineering loops, and two review remediation cycles.
- Stop on persistent-data mutation without a gate, reference ambiguity, lease/index uncertainty, path/symlink escape, private-data exposure, checksum mismatch, destructive purge eligibility failure, unrelated dirty-path conflict, or scope expansion.
