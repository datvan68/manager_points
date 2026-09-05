---
description: Actionable scope and reusable task-file lifecycle.
version: 3.4.1
managed_by: orchestrator
---

# Taskscope

A scope tells the executor exactly what to edit and how to prove it.
For ordinary implementation keep only objective, evidence, boundaries/preserved
contracts, ACs, ordered edits, checks and concrete stops in runtime. Do not
create a file or duplicate a full plan in chat unless requested.

Quick actionable prose targets 220 words, roughly 350 maximum; fixed lifecycle
metadata, literal paths and commands must remain complete. Full adds only
evidenced dependencies, risks, gates or independently checkable work units.
Do not omit a required input to satisfy a word target.

## Allocate only for an explicit new taskscope request

1. Inspect lifecycle and boundaries in `docs/task/`, plus Git status. Treat
   migrated `taskscope.md` as slot `taskscope-00`, then `taskscope-<NN>.md`.
   Invalid/unknown states are not reusable; stop on an unresolved allocation
   collision instead of guessing.
2. Select the lowest numbered `completed` slot with valid completion evidence;
   if none, select the lowest numbered `cancelled` slot.
3. Only if no terminal slot exists and all existing lifecycle slots are
   `ready`, `in_progress`, or `blocked`, create the next unused numbered
   slot. With no files, create `docs/task/taskscope.md` as slot 00.
   Reserve an unmigrated legacy `taskscope.md`: skip slot 00 for allocation
   and check its boundaries; do not overwrite it.
4. Recheck the selected identity/status and reservations immediately before
   writing. For reuse replace the complete document, preserve `slot_id`,
   increment `generation`, assign a unique new `task_id`, reset
   `scope_revision: 1`, timestamps, completion, dependencies and all task data.
   Use a timestamp plus a descriptive slug for a new ID; check for collision.
5. Never overwrite `ready`, `in_progress`, or `blocked`. Amend an existing
   active scope only when its exact path is named for update or this task owns
   it, preserving generation/task ID and incrementing `scope_revision`.
6. Check new writes against reservations via `global.md`. A conflicting new
   scope may be saved only as `blocked` with the exact blocker; this never
   authorizes implementation or editing another scope.

When a dependency is required, verify its expected output before starting the
dependent step. A cancelled task releases paths but does not prove that output.

Allocation never chooses what to execute. Execution requires the user's exact
pin and all validation in `global.md`. Keep existing valid lifecycle documents
compatible; do not reformat active scopes merely to match a newer template.

## Persisted template

Emit concrete YAML values, no placeholders or enum lists. Prefer exact file
paths in `scope.write`; put symbols and change details in execution steps.
The fields below retain the existing lifecycle schema.

```yaml
slot_id: "taskscope-00"
generation: 1
task_id: "<unique timestamp-slug>"
scope_file: "docs/task/taskscope.md"
status: ready
scope_revision: 1
created_at: "<ISO-8601 with timezone>"
updated_at: "<ISO-8601 with timezone>"
base_commit: "<full discovery commit SHA>"
task: "<short action>"
pipeline: bug_fix
profile: Quick
objective: "<observable outcome>"
coordination:
  depends_on: []
  warnings: []
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "<path:symbol/test -> observed behavior>"
  expected_behavior: "<required difference>"
  root_cause: null
scope:
  inspect: []
  write: ["<exact file>"]
  preserve: ["<contract relevant to this change>"]
  out: []
acceptance_criteria:
  - "AC-01: <binary behavior, with relevant negative case>"
execution:
  - "E-01 [AC-01] <file:symbol> -> <specific edit; local pattern if needed>"
verification:
  - "V-01 [AC-01] <exact command/manual action> -> <expected pass signal>"
temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]
risks: []
stop_conditions: []
```

Use the actual assigned slot in both `scope_file` and `retain`. Non-persisted
briefs do not need these lifecycle fields. For Full, record only required
additional risk/environment, dependency, review/gate or resume evidence.

When runtime verification is needed, add one compact `runtime_test` block:
dev frontend/API and data-service identities with isolation evidence, scoped
records/resources and allowed operations, scenarios/pass signals, and cleanup
or restore action. Unknown connection facts may be verified read-only at test
start; stop dependent runtime actions until confirmed. Follow `safety.md`
section 6a without requesting approval for each authorized interaction.
Record code checks and actual runtime checks separately; do not mark a required
runtime AC passed based only on mocks. Existing explicit runtime-data exclusions
need a scope amendment before testing; never silently discard a pinned boundary.

## Make each step executable

Every write maps to an `E-*`, an `AC-*` and a `V-*`. Steps are ordered by
dependency and describe one checkable outcome, not generic "analyze/implement/
test" instructions. Name a nearest existing pattern when convention matters.
Checks identify expected results, not merely commands.

Resolve paths, symbols, scripts, current behavior and relevant error/permission
states before publication. New files must be marked as new with an existing
parent and a confirmed local convention. Unknown cause prevents a bug-fix
mutation; discovery-only work or a blocked scope may record explicit unknowns.

State a fact once; use `[]`/`null` when empty. Do not paste source, full logs,
rules, directory inventories, hypothetical alternatives, or the user request.
For example, prefer "E-01 [AC-01] file:handler -> retain acknowledged results
on request failure; V-01 deferred-response test -> prior results remain visible"
over "improve robustness". Replace illustrative targets with inspected ones.

Before publication, one readiness pass verifies: observed baseline, exact
boundaries/preserved contracts, binary ACs, ordered changes, feasible checks,
concrete stops, and reservation outcome. Resolve missing facts with targeted
inspection; publish as blocked if a material prerequisite cannot be resolved.

## Execute and close

Follow pin/isolation/freshness rules in `global.md`. Normal lifecycle:
`ready -> in_progress -> completed`; an active scope may become `blocked`;
resume only after its blocker clears and the user requests it. Cancellation of
an active scope requires explicit authority. Update only the owned generation,
`updated_at` and `scope_revision` when amending content.

Treat legacy writes as reserved; ambiguous boundaries block candidates unable
to prove disjointness. After valid legacy execution checks, migrate in place,
preserve task content, and use slot 00 for `taskscope.md`.

For completion record AC/check evidence and cleanup per `global.md`; failures
must remain incomplete. Terminal slots are reusable only through allocation
above. Keep the requested slot; delete only exact recorded temporary artifacts.

After scope creation/update, reply only with task ID, slot/generation, status,
path, concise outcome and warnings/blockers. Do not repeat the scope body.
