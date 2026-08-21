# Task Identity and Pipeline

- Task ID: `move-uploaded-images-to-persistent-local-storage`
- Pipeline: `devops_infra` with application migration
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Effective Rules Manifest (SHA-256): `safety.md=6A3F283B...A772`, `global.md=67806F70...A43F`, `antigravity-operating-contract.md=51F3677C...1790`, `orchestrator.md=B782109E...D716`, `pipeline.md=0419C072...F41F3`.
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `7e81c51c3e4297149330f16944259669916717c3`
- Base state: clean worktree before this task artifact is written.

# Risk Level

- Risk: critical.
- Evidence: uploaded payment images are persistent/user-provided data, 12 payment-related JPG files are tracked in the current Git tip, upload filenames exist in Git history, and `/uploads` is served without authorization. The solution crosses backend, frontend, database records, Docker volume/storage configuration, access control, and data migration.
- Environment: development planning only. No file migration, Git-history rewrite, deployment, or production mutation is authorized.
- Reversibility: source changes are reversible in Git. Database/filesystem migration and Git-history rewriting require separate rollback artifacts and Human Gates.
- Blast radius: activity logo/cover media, dormitory invoice proofs, transfer QR images, stored media metadata, production media delivery, and repositories/clones containing historical uploads.

# Objective

Stop the application from writing uploaded images into the source tree or Git, store them in the existing persistent local server volume with bounded image sizes and lifecycle cleanup, preserve working image flows, and require authenticated access for payment proofs without losing existing media or adding a paid storage service.

# Scope Boundaries

- Approved boundaries:
  - `.gitignore`, `backend/.dockerignore`, `backend/package.json`, `backend/package-lock.json`, and safe versioned configuration documentation/templates.
  - `backend/src/core/storage/**` and `backend/src/core/core.module.ts` for the local filesystem storage contract, path/key policy, image processing, capacity safeguards, reconciliation, and tests.
  - `backend/src/activities/**` and `backend/src/dormitory/**` for upload integration, media metadata/access contracts, lifecycle cleanup, and focused tests.
  - `backend/src/main.ts` only for removal or bounded compatibility handling of legacy `/uploads` serving.
  - `backend/scripts/**` and package scripts for inventory, dry-run, execute, verify, and rollback-assisted migration.
  - `frontend/src/api/**`, activity media consumers, and dormitory invoice/proof consumers plus focused tests.
  - `backend/Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, and `infra/caddy/Caddyfile` only as required for media routing/configuration.
- Known current upload writers:
  - `backend/src/activities/activities.controller.ts`.
  - `backend/src/dormitory/controllers/invoices.controller.ts`.
  - `backend/src/dormitory/controllers/room-fee-invoices.controller.ts`.
- Known persisted media owners: activity logo/cover fields; utility and room-fee invoice payment proofs; utility and room-fee transfer QR configuration.
- Write boundary for the task artifact in this planning turn: `docs/taskscope.md` only.
- Excluded boundaries: app-branding files under `backend/storage/app-branding`, PDF-template storage, unrelated static assets, unrelated database schemas, and Git remote/history mutation.

# Out of Scope

- S3, Cloudflare R2, Google Drive, MinIO, CDN, or any paid/external storage provider.
- Reading or embedding production credentials, user image contents, or payment data in logs/reports.
- Automatically deleting referenced invoice proofs or defining a legal/accounting retention period without a product/compliance decision.
- Purging Git history, force-pushing rewritten history, rotating secrets, deploying, or executing a production migration without the gates below.
- General CDN/image optimization or unrelated activity/invoice UI redesign.

# Context and Dependencies

- Five upload paths use Multer `diskStorage('./uploads')`, accept JPEG/PNG/WebP up to 5 MiB, and return `/uploads/<filename>`.
- `backend/src/main.ts` exposes the complete local folder through unauthenticated `express.static`. Payment proofs therefore become public-by-URL even though their upload operations require permissions.
- Twelve payment-related JPG files, totaling about 1.96 MB, are currently tracked under `backend/uploads`; removing them from the current tip does not remove copies from Git history.
- Production creates and persists `/app/storage`, but current uploads target `/app/uploads`. The production container does not persist that path, and its non-root user may be unable to create it. Caddy proxies `/api/*` but not `/uploads`.
- Upload and entity persistence are separate operations. Cancelled forms, failed saves, replacement, and deletion have no object cleanup lifecycle and can leave orphan files.
- Frontend URL helpers already support relative media URLs, but the transfer-QR DTO hard-codes a `/uploads/...` pattern. Stable relative file keys should be stored instead of absolute filesystem paths.
- Selected storage architecture: a local filesystem service rooted at `UPLOAD_STORAGE_ROOT`; development defaults to the ignored `backend/storage/uploads` owner, tests use isolated temporary directories, and production uses `/app/storage/uploads` backed by the existing `backend-storage:/app/storage` named volume. The service must reject absolute/traversal keys and never expose the physical root.
- Public activity/QR media uses a stable bounded media route. Invoice proofs are streamed/downloaded only through an authenticated controller after the existing invoice permission check; they are not served by global `express.static`.
- Image processing uses a vetted backend image library: auto-orient and strip metadata; bound activity/proof dimensions and encode JPEG/WebP at a documented quality target; preserve QR readability with lossless PNG/WebP and decode tests. Originals are not retained after a processed copy is verified unless an explicit audit requirement says otherwise.
- The existing server disk remains finite. Production requires capacity metrics/alerts, controlled upload rejection at a critical free-space threshold, a retention decision, and a verified backup/restore procedure using existing organization-owned storage.
- `backend-storage` also owns app-branding and other storage subtrees; every media read, cleanup, and migration must remain strictly below `/app/storage/uploads` and must never enumerate or delete sibling data. A Docker named volume provides persistence, not backup.
- Local volume is approved for a single host or backend replicas sharing that exact filesystem. Multi-host replicas require shared storage and a future architecture amendment.

# Steps

1. **Inventory and contract baseline — review/test agent:** enumerate filesystem objects and database references without reading image bodies; classify public activity/QR media versus private invoice proofs; record counts, bytes, missing/orphan references, current response shapes, and access behavior.
2. **Persistent local storage foundation — code/test agent:** add typed filesystem contracts for put/read/delete/stat, stable relative keys, metadata, visibility class, and checksums. Resolve every key under `UPLOAD_STORAGE_ROOT`, reject traversal/symlink escape, use isolated temporary roots in tests, initialize writable subdirectories without falling back to the source tree, and commit writes atomically through a staging file plus rename.
3. **Image processing and secure upload — code/test agent:** replace duplicated controller-level `diskStorage` with bounded memory/stream processing through the storage service; verify content signatures, auto-orient, strip EXIF, resize and encode using media-class policies, generate server-owned keys, and enforce existing domain permissions. QR processing must remain lossless and scannable.
4. **Persistence and compatibility — code/test agent:** persist `file_key`, visibility, MIME, processed size, dimensions, checksum, and timestamps; derive delivery URLs at response time. Update the hard-coded QR validator and preserve a bounded read-only compatibility path for legacy `/uploads/*` references during migration.
5. **Lifecycle correctness — code/test agent:** after database success, delete the proof belonging to each actually deleted invoice when no remaining record references its key. Apply the same reference-safe cleanup to replacements/deletions, quarantine unattached/staged files for a bounded grace period, remove a newly uploaded file after a failed entity save, make retries idempotent, and schedule an orphan reconciliation report/cleanup. Referenced invoice proofs are not automatically expired.
6. **Frontend contract update — code/test agent:** consume stable public media URLs and authorized private-proof endpoints while preserving upload previews, replacement, download, error, and retry behavior.
7. **Git/container/volume containment — devops agent:** ignore `backend/uploads/` and local media roots, exclude them from Docker build context, mount development/production storage at the configured root, and verify `/app/storage/uploads` persists through backend recreate/restart via `backend-storage`. Remove tracked upload blobs from the current Git tip while preserving a gated migration copy; treat history purge as a separate operation.
8. **Migration tooling — code/test agent:** add idempotent inventory, dry-run, execute, verify, and rollback-mapping modes. Copy each legacy file atomically, verify filesystem metadata/checksum, update database references safely, preserve originals until acceptance, and emit redacted machine-readable reports. Do not recompress historical payment evidence during migration; processing applies to new uploads unless a separately approved evidence-preserving conversion is proven.
9. **Capacity, backup, and independent validation — test/review/devops agents:** expose used/free bytes and orphan counts to existing monitoring, define 70/85/95-percent warning levels, reject new uploads safely at the approved critical threshold, verify backup/restore, restart persistence, public/private access, failure cleanup, migration resume/rollback, sensitive logging, path traversal, oversized/spoofed files, and the final scoped diff.
10. **Production and history operations — gated devops step:** only after explicit approvals, configure the persistent volume and backup target, run migration, monitor capacity/errors, retire legacy serving, and separately coordinate any Git-history rewrite with all clone/remote owners.

# Acceptance Criteria

- **AC-01:** No upload endpoint writes to `backend/uploads`, the repository root, or a container image layer; development uses an ignored configured root and production writes only below `/app/storage/uploads` on `backend-storage`.
- **AC-02:** Activity logo/cover, both invoice-proof flows, and both transfer-QR flows use one local storage service with server-generated keys, 5 MiB input bounds, allowed image types, content-signature validation, bounded output dimensions/size, metadata stripping, and deterministic errors; QR output remains scannable.
- **AC-03:** Database records persist stable relative file identifiers/metadata, never physical paths. Existing API consumers receive valid derived URLs and migrated records remain readable during the compatibility window.
- **AC-04:** Anonymous users cannot retrieve invoice proofs, and no private subtree is statically mounted. Authorized proof access uses the existing invoice-read/confirm policy appropriate to the operation; public delivery exposes only allowlisted activity/QR namespaces.
- **AC-05:** Failed entity writes do not leave newly uploaded files indefinitely. Deleting an unpaid invoice deletes its unshared proof only after database success; partial bulk deletion touches proofs only for returned deleted IDs; staging/grace cleanup and replacement cleanup are reference-safe and retryable.
- **AC-06:** Migration dry-run reports redacted filesystem/database counts, bytes, missing references, duplicates, and orphans without mutation. Execute is resumable/idempotent, atomically copies and verifies every file without recompressing historical payment evidence, records rollback mappings, and never deletes the only verified copy.
- **AC-07:** After approved staging migration and backend/container restart, every referenced image remains viewable by its intended audience and stored files remain present; unauthorized proof requests return 401/403 and disk/read errors return controlled responses without leaking physical paths.
- **AC-08:** `git ls-files backend/uploads` is empty at the post-change tip, new uploads remain ignored, and image binaries are absent from newly built source images. Historical blobs remain explicitly reported until a separately approved purge is completed.
- **AC-09:** Deployment supplies a validated `UPLOAD_STORAGE_ROOT`, starts only when that root is writable and inside the mounted storage boundary, reports capacity/orphan metrics, applies approved warning/critical thresholds, and has a documented successful backup/restore rehearsal.
- **AC-10:** Focused backend/frontend tests, backend build, frontend typecheck, Compose validation, container smoke tests, migration verification, `git diff --check`, and final status all pass with no unrelated change.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/activities/activities.controller.spec.ts src/dormitory/controllers/invoices.controller.spec.ts src/dormitory/controllers/room-fee-invoices.controller.spec.ts src/core/storage` => storage-path isolation, processing, authorization, delete-after-database-success, reference protection, and retry behavior pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => local storage, image processing, DTOs, migration-supporting code, monitoring, and access endpoints compile.
- `D:\PROJECT\manager_points\frontend :: npm test -- --run "src/components/activities/ActivityForm.test.tsx" "src/components/activities/activity-view-policy.test.ts" "src/components/dormitory/invoices/RoomFeeCollection.test.tsx" "src/app/(dashboard)/dormitory/invoices/page.test.tsx"` => public/private URL, upload, preview, replacement, download, and error flows pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => affected frontend contracts compile.
- `D:\PROJECT\manager_points :: docker compose -f docker-compose.prod.yml --env-file <approved-redacted-test-env> config` => storage configuration is valid without printing secret values.
- Approved staging smoke test => processed dimensions/size satisfy policy; sample QR remains scannable; authorized proof read succeeds; anonymous/unauthorized proof read fails; deleting an eligible invoice removes only its proof; replacement/failure cleanup works; backend/container recreation preserves all referenced files.
- Approved migration workflow => dry-run count/bytes match the inventory; execute and verify report every referenced file copied/processed and checksummed; rollback rehearsal restores reference mappings and legacy copies.
- Approved capacity/backup drill => 70/85/95-percent states expose the expected metric/alert/upload behavior without corrupting current files; backup restore recreates a verified sample set and database-to-file references.
- `D:\PROJECT\manager_points :: git check-ignore -v backend/uploads/probe.jpg backend/storage/uploads/probe.jpg` and `git ls-files backend/uploads backend/storage` => both runtime locations are ignored and current-tip tracked upload list is empty.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => no whitespace error or unintended change.

# Safety Gates

- **G-01 — Local storage policy:** before production configuration, approve the physical volume/host capacity owner, `UPLOAD_STORAGE_ROOT`, file permissions, warning/critical thresholds, retention rules, backup destination/schedule, restore owner, and behavior when disk space is critically low. Rollback: disable new writes and retain legacy read compatibility. Resume: Steps 2, 7, and 9 production configuration.
- **G-02 — Persistent-data migration/current-tip cleanup:** before staging or production execute mode, approve the redacted dry-run inventory, no-recompression rule for historical proofs, migration report, maintenance/concurrency plan, rollback mapping, backup, and verification thresholds. Remove current-tip tracked files only after the migrated copy, checksum verification, and backup are approved. Rollback: restore database references from mappings and retain original files. Resume: Steps 7-8 execute.
- **G-03 — Production deployment/legacy retirement:** before deployment or removal of legacy reads, approve staging evidence, access-control review, mounted-volume ownership, capacity alerts, backup/restore drill, rollback version, and proof that all referenced files are verified. Rollback: redeploy the prior version and re-enable legacy reads. Resume: Steps 9-10.
- **G-04 — Git-history purge:** current-tip cleanup does not authorize history rewriting. Before `filter-repo`/equivalent and force-push, approve the exact refs/remotes, backup bundle, collaborator coordination, protected-branch exception, and sensitive-data incident decision. Rollback: restore remote refs from the backup bundle. Resume: Step 10 history operation.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md` with SHA-256 recorded after validation.
- Required execution artifacts: redacted inventory/dry-run report, storage access/path-policy review, image-processing and QR-legibility results, migration verify report and rollback mapping, capacity/backup-restore evidence, staging smoke results, and current-tip Git scan.
- Checkpoints: after storage contract/tests; after application integration; after staging copy/verify; immediately before database reference switch; immediately before legacy-read retirement; before any Git-history rewrite.
- No image contents, physical storage paths tied to users, or personal/payment metadata may appear in artifacts.

# Execution Budgets

- Step deadline: 600 seconds by default, 1,800 seconds maximum for bounded test/build or migration verification.
- Concurrency: at most three non-overlapping workers; one writer per path; migration/reference switching and Git cleanup are serialized.
- Retry: at most two safe idempotent tool/filesystem retries; engineering loop at most three; review remediation at most two cycles.
- Stop on access-control failure, checksum mismatch, QR illegibility, path-boundary escape, missing rollback mapping, insufficient disk/backup evidence, sensitive-data exposure, unrelated dirty-path conflict, boundary expansion, or any unsatisfied gate.
