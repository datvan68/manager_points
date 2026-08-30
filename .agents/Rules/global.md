---
trigger: always_on
priority: high
applies_to: all_agents
version: 3.3.5
---

# Global Rules

Precedence:

```text
safety.md > global.md > AGENTS.md > orchestrator.md > pipeline.md > taskscope.md > selected skill files
```

## 1. Roles and authority

The orchestrator resolves intent, profile, risk, boundaries, and routing. For a
Quick task, it may perform focused discovery, create the Taskscope Brief, mutate
approved implementation paths, verify, and self-review in one bounded execution.
Delegation is optional in Quick and must not add coordination overhead. Full uses
specialized workers when available as defined by the pipeline.

Workers act only within their assigned capabilities and boundaries:

| Role | Capabilities |
| --- | --- |
| `code-agent` | search, code generation, focused verification |
| `test-agent` | search, test generation and execution |
| `review-agent` | search, summary, security review |
| `devops-agent` | search, scoped generation, validation, security review |
| `doc-agent` | search, summary, documentation generation |
| `orchestrator` | rule resolution, focused search/code generation/verification, scope writing, coordination |

One actor owns each write path. The orchestrator may be that actor in Quick.
A persisted taskscope reserves its declared write paths while its status is
`ready`, `in_progress`, or `blocked`; `completed` and `cancelled` release the
reservation. Before a taskscope is published, started, resumed, or mutated,
compare its writes with every active taskscope and current dirty-worktree paths.

- Proven write/write overlap, scope-file collision, ambiguous ownership, or a
  dirty candidate write path is `TASKSCOPE_CONFLICT`; stop before mutation and
  report the task IDs plus exact intersecting paths.
- Inspect/write overlap is `TASKSCOPE_WARNING`; serialize the tasks or record an
  explicit dependency, and stop when a stable input cannot be guaranteed.
- A write outside the current taskscope is `TASKSCOPE_VIOLATION`; stop dependent
  work immediately, preserve evidence and current changes, and do not repair or
  continue outside the declared boundary.

Overlap includes equal paths, ancestor/descendant containment, and intersecting
directory or glob boundaries. Inability to prove disjointness is a conflict,
not permission to proceed. Only the task identified by a scope's `task_id` may
change that scope's lifecycle or content, unless the user explicitly names the
exact taskscope for update. Its own `scope_file` is an implicit coordination
write and need not appear in `scope.write`; this exception never authorizes
writing another taskscope. When `base_commit` differs, revalidate only named
targets and dependencies: unchanged targets produce `TASKSCOPE_WARNING` plus a
refreshed baseline/revision; changed targets produce `TASKSCOPE_CONFLICT`.

`status: completed` is valid only after all mandatory acceptance criteria and
required checks pass and the completion block records the outcome, checks,
changed paths, cleanup, and final commit/state. A completed slot is reusable
only when `completion.outcome` is `success`, `completion.reuse_safe` is `true`,
no active scope depends on its task ID, no cleanup/gate remains, and its prior
write paths have no uncommitted task-owned changes. Otherwise reuse is
`TASKSCOPE_REUSE_BLOCKED`; skip the slot during automatic selection, or stop if
the user requested that exact slot.

For any request to execute, continue, or resume a persisted taskscope, exactly
one attached/clickable taskscope file or exact repository-relative path under
`docs/task/` is required. That file is the authoritative task selection; no
separate task ID or generation is required. Automatic slot selection is
creation-only and must never choose an execution target. Validate the pin
read-only before repository discovery or mutation:

- `TASKSCOPE_PIN_REQUIRED`: no exact taskscope file was linked/pinned.
- `TASKSCOPE_PIN_INVALID`: the pin is missing/deleted, outside `docs/task/`,
  unreadable/malformed, or resolves to multiple files.
- `TASKSCOPE_PIN_MISMATCH`: any task ID/generation/outcome explicitly stated in
  the request contradicts file metadata/objective/boundaries, or status is not
  executable. A generic request such as "execute the linked taskscope" does not
  create a mismatch; the linked file defines the intended task.

`ready` may start. `in_progress` may continue only when the user explicitly asks
to continue that pinned task. `blocked` may resume only after its recorded
blocker is cleared and the user explicitly asks to resume. `completed` and
`cancelled` are not executable. Any `TASKSCOPE_PIN_*` result is a warning that
stops the request without changing code, taskscope status/content, or any other
file. Report the pinned path, actual identity/status when readable, mismatch,
and the exact pin or action needed. Never guess from recency, title, status,
filename similarity, or the only available scope.

A pinned legacy taskscope without lifecycle metadata is valid only when it has
an actionable task/objective, exact `scope.write`, acceptance criteria,
execution steps, and verification. Treat it as `ready`; after pin, conflict, and
freshness validation succeed, migrate that same file in place to the lifecycle
schema before implementation, preserving its task content. Missing required
sections are `TASKSCOPE_PIN_INVALID` and cause no migration or mutation.

## 2. Effective Rules Capsule

Load canonical rules once per root task. Record versions/hashes only when Full,
resumable, delegated, or audit-required. When delegation is used, each worker
receives only:

```json
{
  "protocol_version": "3.3",
  "task_id": "stable-id",
  "profile": "Quick",
  "pipeline_id": "bug_fix",
  "step_id": "quick.execute",
  "objective": "Observable outcome",
  "environment": "development",
  "risk_level": "medium",
  "approved_boundaries": ["package/**"],
  "write_boundaries": ["package/src/**", "package/tests/**"],
  "excluded_boundaries": [],
  "acceptance_criteria": ["Binary criterion"],
  "verification": ["exact repository-native command"],
  "applicable_rules": ["concise safety and stop constraints"],
  "rule_manifest_version": "3.3",
  "selected_skill_refs": [],
  "on_failure": "stop"
}
```

Delegated workers must not reread the complete canonical set, orchestrator rules, full
conversation, unrelated pipelines, or unrelated skills. Reopen a canonical
source only if the capsule is missing, stale, incomplete, or conflicts with a
path-specific instruction. Source rules win conflicts.

## 3. Results

Quick actors return a compact envelope:

```json
{
  "task_id": "stable-id",
  "pipeline_id": "bug_fix",
  "step_id": "quick.execute",
  "status": "success",
  "summary": "Outcome",
  "changed_paths": [],
  "verification": [],
  "remaining_risks": [],
  "next_action": null
}
```

Full workers additionally include protocol/agent identity, attempts, artifact
references and hashes, commit identity, criterion IDs, duration, and structured
error details required for checkpointing or review. Store long output in an
artifact and pass only its reference and concise result.

Valid statuses are `success`, `partial`, `error`, `pending`, `blocked`, and
`cancelled`. `partial` is valid only when mandatory criteria pass and optional
work remains.

## 4. Retry and repair

- Idempotent tool/API retry: at most 2.
- ENG mutation/verification loop: at most 3 iterations.
- Pipeline review remediation: at most 2 cycles.
- Counts are shared across delegation and never reset.
- Repair only a concrete failure inside current boundaries.
- Stop for safety violations, gates, conflicts, stale state, scope expansion,
  higher risk, or an unapproved behavior/dependency/migration change.
- Report pre-existing and environmental failures without repairing them outside
  scope.

## 5. Artifact lifecycle and completion

Task-generated Markdown used only to execute, measure, coordinate, checkpoint,
or resume work is temporary. This includes temporary persisted taskscopes,
benchmark run reports, ad hoc plans, inventories, and handoff notes. Record
their exact paths when they are created and remove them before a task is
reported as successfully complete. Do not use globs for cleanup, and do not
remove pre-existing or unrelated files.

When the user explicitly requests a new taskscope, reuse the lowest eligible
slot: lifecycle-migrated `docs/task/taskscope.md` is `taskscope-00`, followed by
numbered `docs/task/taskscope-<NN>.md` slots. If none is reusable, create the
next unused numbered slot. Reuse atomically replaces the complete document,
preserves `slot_id`, increments `generation`, assigns a new `task_id`, and
resets `scope_revision`. Never overwrite an active or non-reusable slot.
Explicit slots are retained deliverables, not cleanup obligations. The legacy
file is reserved input and cannot become slot `taskscope-00` without an explicit
lifecycle migration.

Retain Markdown only when it is an explicitly requested durable deliverable, an
intentional update to an existing canonical repository document, or evidence
that must remain for an active audit/resume requirement. If temporary evidence
contains a durable conclusion, merge only that conclusion into the scoped
canonical document before removing the artifact. A blocked or interrupted task
may retain the minimum artifacts needed to resume, but they remain cleanup
obligations for the eventual successful completion.

A step completes only when changed paths stay within boundaries, required
verification passes or a failed criterion is explicitly reported, unrelated
changes are preserved, no unresolved gate/conflict remains, and all temporary
artifact cleanup obligations due at that step are satisfied. Full work also
validates required hashes and checkpoints. Never claim a check ran when it did
not.
