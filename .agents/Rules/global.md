---
trigger: always_on
priority: high
applies_to: all_agents
version: 3.4.0
---

# Global Rules

Repository precedence:
`safety.md > global.md > AGENTS.md > orchestrator.md > pipeline.md > taskscope.md > selected skills`.
System/developer instructions and explicit user authority retain their normal
precedence; repository files cannot override them.

## 1. Ownership and isolation

One writer per path. `ready`, `in_progress`, and `blocked` scopes reserve
their `scope.write` paths; `completed` and `cancelled` release reservations.
Apply these checks to ordinary implementation briefs as well as persisted
scopes; lack of a saved file does not bypass other tasks' reservations.

Before publish/start/resume and immediately before each mutation batch, compare
candidate writes against active scope metadata/boundaries and Git status.
Read only the lifecycle, coordination and boundary sections needed from other
scopes; legacy boundaries still reserve paths.

| Condition | Result |
| --- | --- |
| Write/write overlap, scope-file collision, unknown ownership, unrelated dirty candidate path, or unprovable disjointness | `TASKSCOPE_CONFLICT`: stop mutation; report task IDs and intersecting paths. |
| Inspect/write overlap | `TASKSCOPE_WARNING`: record dependency or serialize; stop if input cannot be stable. |
| Attempted write outside current scope | `TASKSCOPE_VIOLATION`: stop dependent work; preserve evidence and changes. |

Overlap includes equal paths, ancestor/descendant paths, and intersecting globs.
Normalize repository-relative separators and optional symbol suffixes for
comparison; a symbol suffix does not reserve only part of a file. Exact write
paths are preferred. Do not mistake your own verified edits for another task's
dirty changes; compare with the recorded baseline/owned diff. Unknown changes
on an owned path are a conflict, not permission to overwrite.

Only the scope's owning task may update its lifecycle/content, unless the user
explicitly names that file for update. The owned `scope_file` is an implicit
coordination write; it does not authorize another scope. Slot creation/reuse
is governed only by `taskscope.md`.

Capture identity `(scope_file, slot_id, generation, task_id)` after pinning;
recheck it before writes and completion. A changed identity stops with
`TASKSCOPE_CONFLICT`. Metadata checks are not an atomic lock: serialize
writers when concurrent ownership cannot be established.

If `base_commit` changed, compare only named targets/dependencies against the
recorded baseline and verified owned edits. Unchanged or proven own changes
allow `TASKSCOPE_WARNING`, refreshed baseline and revision. Other changed
targets require `TASKSCOPE_CONFLICT` and revalidation before mutation.
When rules changed, revalidate affected constraints without restarting broad
discovery. Preserve unrelated changes and never fix another task to clear a
conflict.

## 2. Execution pin contract

For execution/continue/resume, resolve exactly one user-linked file or exact
path under `docs/task/`. It alone selects the task; a separate ID/generation
is not required. Validate read-only before implementation discovery:

| Validation failure | Warning |
| --- | --- |
| No exact linked/pinned taskscope | `TASKSCOPE_PIN_REQUIRED` |
| Missing/deleted/unreadable file, outside `docs/task/`, multiple matches, malformed metadata or missing execution fields | `TASKSCOPE_PIN_INVALID` |
| Explicit request ID/generation/outcome contradicts the file, current execution's captured identity changed, or non-executable status | `TASKSCOPE_PIN_MISMATCH` |

Check that `scope_file` matches the resolved file, slot/task IDs are consistent,
and generation/revision are positive integers. Validate objective, exact writes, ACs, execution and
verification; use the schema in `taskscope.md`. A generic "execute this linked
taskscope" adopts the file's current objective. Do not infer an unexpressed
intention or claim that a valid but accidentally chosen link can be detected.
An earlier completed generation in chat does not invalidate a fresh request
to execute the current ready generation by its exact file.

`ready` may start. `in_progress` may continue only on an explicit continue
request for that pin. `blocked` may resume only on an explicit resume request
after its recorded blocker is cleared. `completed`/`cancelled` cannot execute.

Any `TASKSCOPE_PIN_*` warning stops without any file/status change. Report
path, readable identity/status, mismatch, and required corrective action. Never
fall back using recency, similar name, title, status, or the only scope present.

A legacy scope without lifecycle is executable only if objective, exact writes,
ACs, ordered steps and verification are complete. Treat it as `ready`; after
pin, isolation and freshness pass, migrate that same file in place using
`taskscope.md`, preserving task content. Incomplete legacy input remains
untouched with `TASKSCOPE_PIN_INVALID`.

## 3. Context, results, and retries

Default to direct execution for Quick and Full. Delegation needs explicit
request or an applicable explicit requirement. An authorized worker receives
only objective, task/step ID, profile/risk/environment, exact read/write/excluded
boundaries, ACs, relevant symbols/evidence, verification, applicable stop rules,
selected skill references, and predecessor deltas. Load full sources only when
that capsule is incomplete, stale, or conflicting. Worker protocol remains
`3.3`; document version updates alone do not invalidate existing scopes.

User replies are concise prose: outcome, changed paths, checks actually run,
remaining blockers/risks. A machine-consumed worker envelope may use
`task_id, pipeline_id, step_id, status, summary, changed_paths, verification,
remaining_risks, next_action`; do not force it into ordinary answers.
Statuses: `success, partial, error, pending, blocked, cancelled`.
`partial` means mandatory criteria passed and only optional work remains.

Shared budgets from `safety.md`: at most 2 idempotent retries, 3 edit/verify
iterations for the same failure, and 2 review remediation cycles. Never reset
counts through delegation. Retry only a transient, safely repeatable operation.
For deterministic failure inspect the actionable error before changing code.
Do not replay a mutation with uncertain external effects. Report pre-existing
or environmental failures; no out-of-scope repairs.

## 4. Cleanup and completion

Keep runtime notes by default. Record exact paths for task-created Markdown
execution artifacts; remove temporary plans, reports, handoffs and checkpoints
when their work is complete. Retain explicitly requested durable deliverables,
intentional canonical documentation updates, and minimum evidence still needed
for an active audit/resume. Never delete pre-existing/unrelated files or use
cleanup globs. Every explicitly requested taskscope slot is retained and reusable,
not a cleanup target.

Before success, verify scoped diff, every mandatory AC and required check,
preserved unrelated changes, cleared gates/conflicts, and completed cleanup.
For a persisted scope record timestamp, outcome, changed paths, successful
checks and their AC coverage, final commit/worktree state, and cleanup, then set
`status: completed`. Failed, skipped or unrun mandatory checks cannot complete
a task; record the blocker and remaining work instead. Self-review must not be
reported as independent review. Never invent test, timing, token, or runtime
verification results.
