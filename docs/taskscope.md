# Task Identity and Pipeline

- Task: `storage-garbage-purge-and-capacity-source`
- Pipeline: `feature_development`
- Profile: Full, protocol/rules `3.2.0`
- Repository: `D:\PROJECT\manager_points`
- Base/current commit at planning: `401217172b230f34e0cc61d25ee47621ad13c2cb`; relevant worktree was clean.
- Environment: development planning only. This taskscope does not authorize reconciliation execution, file quarantine/purge, persistent-data mutation, deployment, or production configuration changes.

# Risk Level

- Risk: critical.
- Evidence: permanent purge deletes persistent invoice proofs, QR images, or activity media; a stale reference, unsafe path, invalid confirmation, or partial filesystem failure can cause privacy exposure or irreversible data loss.
- Reversibility: source changes are Git-reversible. Quarantine is recoverable only while its binary and manifest remain valid. Permanent purge is not recoverable without a verified backup.
- Blast radius: local persistent media volume, five Mongo collections used for reference discovery, admin storage APIs, and `/system/storage`.

# Objective

Allow `SYSTEM_ADMIN` users to safely reclaim disk space from server-confirmed garbage files through a two-stage quarantine-then-purge workflow, while clearly explaining that disk capacity is measured from the filesystem containing the configured media root and is distinct from application-managed media usage.

# Scope Boundaries

- Approved/write boundaries:
  - `backend/src/core/storage/**`
  - `frontend/src/api/system-api.ts`
  - `frontend/src/api/system-api.test.ts`
  - `frontend/src/app/(dashboard)/system/storage/page.tsx`
  - `frontend/src/app/(dashboard)/system/storage/page.test.tsx`
  - versioned, non-secret storage configuration documentation only if required by the implemented contract.
- Known backend targets: `StorageService.getCapacityMetrics`, quarantine/restore/purge primitives, `StorageOrphanReconciliationService.runReconciliation`, `getSummary`, `getInventory`, `purgeAsset`, storage DTOs/controller, audit/run schemas and focused specs.
- Known frontend targets: storage summary/types/API methods, capacity banner, inventory actions, confirmation dialogs, action state/refetch, and focused tests.
- Access remains fail-closed and restricted to `SYSTEM_ADMIN` in both frontend route/page behavior and backend guards.

# Out of Scope

- Direct deletion of active, staged, merely suspected, externally hosted, or database-referenced media.
- One-click deletion directly from the managed live folders.
- Bulk purge, automatic permanent purge, invoice retention-policy changes, backup deletion, database migration, Git history rewrite, cloud/Drive/S3 integration, deployment, and capability enablement outside disposable development.
- Displaying private proof/QR thumbnails, raw storage keys, absolute filesystem paths, private URLs, or arbitrary audit payloads.

# Context and Dependencies

- `UPLOAD_STORAGE_ROOT` selects the managed media root; without configuration the backend uses `<backend cwd>/storage/uploads`.
- `getCapacityMetrics()` calls `fs.promises.statfs(storageRoot)`. Therefore `totalBytes`, `usedBytes`, and `freeBytes` describe the complete filesystem/volume containing that root, including unrelated files. Thresholds are warning at 85% and critical at 95%; unsupported/failed `statfs` returns explicit degraded telemetry with zero values.
- `getSummary()` separately sums managed live media and quarantined media bytes. These values are application-owned usage, not partition usage.
- A file is currently an orphan candidate only when it is under an allowlisted managed namespace, has no recognized database reference, and is older than the 24-hour unattached-file grace period.
- Execute moves candidates to `.quarantine` with SHA-256 metadata; it does not free meaningful filesystem space because the bytes remain on the same volume. Space is reclaimed only after retention-gated permanent purge.
- Execute/restore/purge capabilities default off. The purge API exists, but the page does not call it; its DTO confirmation is not currently enforced by the controller/service.
- The Vercel React guidance applies to client data flow: avoid duplicate requests, guard duplicate mutations, and refetch independent summary/inventory/audit data in parallel after a completed action.

# Steps

1. **Backend contract and capacity semantics — code/test:** return a typed capacity source such as `filesystem_containing_media_root`, `measuredAt`, thresholds, and explicit degraded state; keep partition totals separate from managed live, staging, quarantine, and server-calculated reclaimable bytes. Never return an absolute path or mount secret.
2. **Safe garbage eligibility — code/test/review:** preserve allowlisted namespaces and 24-hour grace; correct legacy/local URL normalization; reject external URLs; perform a targeted or bounded fresh reference check immediately before quarantine and purge across all verified activity, proof, and QR fields.
3. **Recoverable quarantine — code/test:** make binary plus manifest publication failure-atomic, validate asset/manifest schema and checksum, reject symlink/reparse/path escape, surface corrupt or manifestless quarantine artifacts, and keep execute disabled by default.
4. **Purge eligibility contract — code/test/review:** expose per-quarantined-item `purgeEligibleAt`, retention remaining, byte size, safe checksum suffix, and immutable eligibility/confirmation token bound to asset, checksum, actor/session, and expiry. Active, staged, and orphan-candidate rows must never receive a purge token.
5. **Permanent purge endpoint — code/test:** require `SYSTEM_ADMIN`, enabled purge capability, expired retention (default 30 days), valid asset-bound confirmation, fresh zero references, valid manifest/checksum, current operation lease, and explicit confirmation phrase/reason. Remove or keep internal-only every retention bypass. Persist sanitized immutable attempt and success/failure audit records around the unlink; repeated requests are idempotent or return a controlled conflict.
6. **Lock and error safety — code/test:** always release the local/distributed lock after setup failures, renew/verify lease ownership for long scans, report partial operations accurately, and leave a recoverable pair on filesystem/audit failure where possible.
7. **Admin UI — frontend/test:** distinguish “Dung lượng volume chứa media” from “Dung lượng media ứng dụng”; show loading, error, degraded, measurement time, managed/quarantine/reclaimable bytes, and explanatory help text. Missing capabilities must fail closed.
8. **Garbage interaction — frontend/test:** keep “Cách ly” bound to a fresh reviewed preview; add “Xóa vĩnh viễn” only on server-eligible quarantined rows. Show exact bytes reclaimed, retention/checksum suffix, irreversible warning, typed phrase plus reason, double-submit protection, 409/412 stale-reference handling, and parallel refresh of summary/inventory/audit after completion. Restore also requires confirmation.
9. **Privacy and regression review:** use explicit safe view models for inventory/audit. Verify the DOM and API responses never expose paths, raw keys/private URLs, proof/QR content, or unsanitized exceptions.

# Acceptance Criteria

- **AC-01:** Only `SYSTEM_ADMIN` can load storage data or invoke preview/quarantine/restore/purge; missing capability data disables every mutation control.
- **AC-02:** Capacity UI/API states that totals come from `statfs` on the filesystem containing `UPLOAD_STORAGE_ROOT`; partition totals and managed live/staging/quarantine/reclaimable media bytes are separately labeled and arithmetically consistent.
- **AC-03:** Loading/error/degraded telemetry never renders fabricated `0%` healthy/critical capacity, and no server path/mount identifier is exposed.
- **AC-04:** A live file is eligible for quarantine only after grace expiry and zero recognized references; a fresh reference or external/ambiguous origin blocks mutation.
- **AC-05:** Quarantine failure leaves either the original intact or a complete restorable binary/manifest pair; corrupt/manifestless artifacts are reported, not silently ignored.
- **AC-06:** Permanent purge is available only for an expired, valid quarantined asset and requires capability, fresh zero references, checksum, current lease, asset-bound confirmation, reason, and typed phrase. No HTTP retention bypass exists.
- **AC-07:** Successful purge removes only the exact quarantined binary and manifest, reports exact reclaimed bytes, creates sanitized attempt/outcome audit entries, and refreshes UI metrics. Failure does not falsely report reclaimed space.
- **AC-08:** Active/staged/orphan-candidate/referenced files never show a direct-delete action. Execute, restore, and purge prevent duplicate submission and handle stale/conflict responses without optimistic removal.
- **AC-09:** Inventory, confirmations, audit, logs, DOM, and API samples contain no absolute paths, raw private URLs/keys, proof or QR thumbnails, or arbitrary unsanitized details.
- **AC-10:** Existing 24-hour grace, 30-day default quarantine retention, four managed namespaces, five-collection reference coverage, capability defaults-off, and focused storage regressions remain passing.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/core/storage/storage.service.spec.ts src/core/storage/storage-orphan-reconciliation.service.spec.ts src/core/storage/storage-admin.controller.spec.ts` => capacity source, eligibility, atomic quarantine, lock, confirmation, retention, reference, purge, audit, privacy, and failure cases pass using temp storage and disposable mocked/test databases only.
- `D:\PROJECT\manager_points\backend :: npm exec eslint -- "src/core/storage/**/*.ts"` => affected backend files pass lint.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest backend compiles.
- `D:\PROJECT\manager_points\frontend :: npm exec vitest -- run "src/app/(dashboard)/system/storage/page.test.tsx" "src/api/system-api.test.ts"` => admin access, capacity source states, capability fail-closed, quarantine/restore/purge confirmations, conflicts, refresh, and redaction pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => frontend types compile.
- `D:\PROJECT\manager_points :: git diff --check; git status --short` => no whitespace errors; all changed paths are intentional and inside the approved boundary.
- No verification command may invoke live reconcile execute, restore, purge, migration, deployment, or a non-disposable database/volume.

# Safety Gates

- **G-01 — Capability/configuration enablement:** before enabling execute, restore, or purge outside disposable development, approve environment, exact capability values, retention, admin access review, backup/checksum evidence, monitoring, and rollback to disabled defaults. Resume: configuration-only enablement.
- **G-02 — Quarantine execution:** before executing against any persistent volume, approve a fresh redacted preview with immutable candidate IDs/count/bytes, reference coverage, backup, operator, and restore rehearsal. Rollback: restore from verified manifests. Resume: one bounded execute run.
- **G-03 — Permanent purge:** before any real purge, approve exact eligible asset IDs/count/bytes, retention expiry, fresh zero-reference evidence, confirmation-token design, backup, audit evidence, operator, and acknowledgement that rollback requires backup restore. Resume: one bounded purge operation.
- **G-04 — Deployment:** approve affected verification, independent security review, volume-capacity evidence, backup/restore result, configuration defaults, and rollback version before staging/production deployment.

# Artifacts and Checkpoints

- Effective Rules Manifest: versions `3.2.0`; canonical hashes recorded by the orchestrator for safety/global/contract/orchestrator/pipeline.
- Required review artifacts: capacity-contract sample; redacted eligibility/preview sample; purge threat-model and confirmation contract; focused test output; privacy scan; final diff/status.
- Material checkpoints: after backend capacity/eligibility contract; after atomic quarantine/lease tests; after purge security review; after frontend compatibility; before every gated persistent operation.

# Execution Budgets

- Step deadline: 600 seconds, maximum 1800 seconds where integration tests justify it.
- Concurrency: specialized Full workers may run only on disjoint paths; one writer per path; serialize shared DTO/API contract changes before frontend integration.
- Retries: at most 2 idempotent command retries; engineering loop `0..3`; independent-review remediation `0..2`.
- Stop on dirty-path overlap, reference ambiguity, path/symlink escape, checksum mismatch, lock ownership loss, unsanitized private data, destructive operation without gate, non-disposable test target, scope expansion, or changed dependency/migration requirement.
