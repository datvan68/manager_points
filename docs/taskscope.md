# Task Identity and Pipeline

- Task ID: `fix-private-invoice-proof-preview`
- Pipeline: `bug_fix`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `11013ca0a84a42f8f2c9e2531a585582dcf47c6f`
- Effective Rules Manifest (SHA-256): `safety.md=6A3F283B...A772`, `global.md=67806F70...A43F`, `antigravity-operating-contract.md=51F3677C...1790`, `orchestrator.md=B782109E...D716`, `pipeline.md=0419C072...F41F3`.
- Base state: unrelated modification exists at `frontend/next-env.d.ts`; preserve it. This planning turn may write only `docs/taskscope.md`.

# Risk Level

- Risk: high.
- Evidence: payment proofs are private user data. The defect affects two invoice flows and their authenticated media contract; a fallback to the raw media URL could reintroduce unauthorized or broken access.
- Environment: development implementation only. No deployment, permission-model change, persistent-data mutation, or migration is authorized.
- Reversibility: frontend source and test changes are Git-reversible.
- Blast radius: the “Kiểm tra” modal for utility invoices and room-fee invoices, including preview, open/download, loading, failure, and modal lifecycle behavior.

# Objective

When an authorized user opens “Kiểm tra” for an invoice with a payment proof, both invoice modals load the protected image through the existing authenticated proof API and display it reliably without exposing or requesting the stored private media URL directly.

# Scope Boundaries

- Approved/write boundaries for implementation:
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`.
  - `frontend/src/components/dormitory/invoices/RoomFeeCollection.tsx`.
  - `frontend/src/api/dormitory-api.ts` only if the existing Blob API needs a minimal cancellation/error contract adjustment.
  - Focused tests in `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`, `frontend/src/components/dormitory/invoices/RoomFeeCollection.test.tsx`, and `frontend/src/api/dormitory-api.test.ts`.
  - One shared frontend hook/helper and its focused test may be added under the dormitory invoice owner when this avoids duplicating Blob URL lifecycle logic.
- Known backend contracts, read-only in this task:
  - `GET /api/dormitory/invoices/:id/proof`.
  - `GET /api/dormitory/room-fee-invoices/:id/proof`.
- Write boundary for this planning turn: `docs/taskscope.md` only.
- Excluded boundaries: backend controllers/services, authorization rules, storage layout, database records, Docker/deployment configuration, and unrelated UI.

# Out of Scope

- Changing how transfer QR images are stored or displayed.
- Changing upload, replacement, deletion, migration, retention, or compression behavior.
- Making payment proofs public, adding a generic private-media static route, or placing tokens in URLs.
- Redesigning either modal or changing invoice review/payment business rules.
- Deploying the fix to staging or production.

# Context and Dependencies

- Both modal implementations currently use `getImageUrl(payingInvoice.payment_proof.url)` as the `src` of an `<img>` and as the “Mở ảnh gốc” link.
- New proof metadata contains a private storage URL such as `/api/media/private/...`; that URL is not a public delivery endpoint and a normal `<img>` request cannot attach the Bearer token managed by `httpClient`.
- `dormitoryApi.invoices.getProofBlob(id)` and `dormitoryApi.roomFeeInvoices.getProofBlob(id)` already call the invoice-scoped authenticated endpoints through `httpClient`, but neither modal consumes them.
- The preview must use a browser-generated `blob:` URL, revoke it when replaced/closed/unmounted, and prevent a late response from an earlier invoice from overwriting the current modal state.
- Existing local upload preview behavior (`payProofPreview`) remains independent and must not regress.

# Steps

1. **Regression baseline — test agent:** add focused failing coverage showing that opening each “Kiểm tra” modal for an invoice with a proof calls the matching `getProofBlob(invoiceId)` and does not render the raw private URL.
2. **Authenticated preview lifecycle — code agent:** load the proof only while the modal is open and the selected invoice has proof metadata; create a Blob object URL, expose explicit loading/success/error state, ignore stale async completions, and revoke every superseded object URL on invoice change, modal close, and unmount.
3. **Modal integration — code agent:** use the object URL for the image and “Mở ảnh gốc” action in both invoice flows. Preserve existing upload preview, review buttons, delete/replace actions, and modal layout. Do not fall back to the raw private storage URL after an authenticated request failure.
4. **Error behavior — code/test agent:** show a stable Vietnamese failure message/action for 401/403, missing files, and network failures without leaking server paths; allow a bounded retry by reopening or an explicit retry control without request loops.
5. **Verification and independent review — test/review agents:** verify API routing, Blob URL cleanup, stale-response protection, authorized display, failure rendering, and absence of raw private URL requests; review token/privacy handling and final diff scope.

# Acceptance Criteria

- **AC-01:** Opening “Kiểm tra” with an existing proof calls exactly the correct invoice-scoped `getProofBlob` API and displays the returned Blob URL in both invoice flows.
- **AC-02:** Neither modal assigns `payment_proof.url` or `/api/media/private/...` directly to an image, anchor, `window.open`, or fetch request.
- **AC-03:** The preview presents a loading state, renders a controlled Vietnamese error for rejected/missing/network responses, and never loops requests automatically.
- **AC-04:** Every created object URL is revoked after replacement, invoice change, modal close, or component unmount; stale responses cannot replace the current invoice image.
- **AC-05:** Local file preview, upload, delete/replace proof, approve/reject/revoke actions, and public transfer-QR display retain existing behavior.
- **AC-06:** Focused frontend tests and typecheck pass, the final diff contains no backend/storage/deployment change, and the unrelated `frontend/next-env.d.ts` modification is preserved.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run "src/api/dormitory-api.test.ts" "src/components/dormitory/invoices/RoomFeeCollection.test.tsx" "src/app/(dashboard)/dormitory/invoices/page.test.tsx"` => AC-01 through AC-05 pass for both invoice types.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => affected API/component contracts compile.
- Focused test assertions => `URL.createObjectURL` receives the authenticated response Blob; `URL.revokeObjectURL` is called on cleanup; stale promises are ignored; raw private URLs are absent from rendered `src`/`href` values and direct fetch calls.
- `D:\PROJECT\manager_points :: git diff --check` => no whitespace errors.
- `D:\PROJECT\manager_points :: git status --short` and scoped `git diff` inspection => only approved implementation/test paths plus the pre-existing `frontend/next-env.d.ts` and planning artifact are present.

# Safety Gates

- None for development implementation and focused verification.
- Staging/production deployment remains outside this task and requires separate explicit authority.
- Stop and amend scope if the existing authenticated backend endpoint cannot serve a valid referenced proof, if authorization behavior must change, or if persistent data/storage must be modified.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Required execution evidence: focused test output, typecheck result, independent privacy/security review summary, and final scoped diff/status.
- Checkpoint: one reviewed implementation delta before final affected verification; no persistent-data checkpoint is needed.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for affected test/typecheck.
- Concurrency: one writer per path; overlapping component/test edits are serialized.
- Retry: at most two safe tool retries, three engineering loops, and two review remediation cycles.
- Stop on authorization regression, raw private URL exposure, unrevoked Blob URLs, stale-response overwrite, scope expansion, or conflict with unrelated user changes.
