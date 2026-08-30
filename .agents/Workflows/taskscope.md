---
description: Compact, evidence-based scope template for implementation tasks.
version: 3.3.6
managed_by: orchestrator
---

# Taskscope Brief

A taskscope is a compressed execution contract. It must contain the maximum
actionable detail needed for an agent to edit and verify without repeating
discovery, while excluding prose that does not affect execution. Target roughly
220 words and cap a Quick scope at roughly 350 words. A Full scope may be longer
only for evidenced dependencies, environments, risks, gates, or independent
work boundaries.

## Output contract

For a new persisted taskscope, scan reusable slots in order: migrated
`docs/task/taskscope.md` as `taskscope-00`, then numbered
`docs/task/taskscope-<NN>.md` files. Reuse the first completion block that passes
the `global.md` gate; if none qualifies, create the next unused numbered slot.
Reuse replaces the complete document, preserves `slot_id`, increments
`generation`, assigns a new `task_id`
(`YYYYMMDD-HHmmss-<kebab-slug>` unless supplied), and resets `scope_revision` to
`1`. Amend an active scope only when the user names its exact path or the current
task owns it. The legacy file cannot become slot `taskscope-00` until explicitly
migrated. Without a persisted-output request, keep the brief in runtime.

## Execution pin contract

Automatic slot selection is only for creating a new taskscope. To execute,
continue, or resume a persisted scope, require exactly one taskscope file linked
or pinned by the user. The file is the authoritative task selection; no separate
`task_id` or generation is required, and no scope may be inferred from recency,
name, status, or directory contents. Before reading implementation targets,
validate the path, structure, any explicitly stated task identity/outcome,
boundaries, and executable status using `global.md`.

Any `TASKSCOPE_PIN_REQUIRED`, `TASKSCOPE_PIN_INVALID`, or
`TASKSCOPE_PIN_MISMATCH` result is warning-only and stops before all mutation,
including lifecycle/status updates. Report the pinned and actual identity when
available plus the exact corrective pin/action. Do not fall back to another
scope. After a valid pin, continue with isolation and freshness checks.

A linked legacy file without lifecycle metadata may execute when it contains all
required implementation fields. After pin, isolation, and freshness validation,
migrate that same file in place to the lifecycle schema and preserve its task
body; malformed or incomplete legacy content is `TASKSCOPE_PIN_INVALID` and
must remain untouched.

## Required template

```yaml
slot_id: "Stable slot name: taskscope-00 for migrated taskscope.md, otherwise taskscope-NN"
generation: 1
task_id: "Unique ID for this generation"
scope_file: "docs/task/taskscope.md or docs/task/taskscope-<NN>.md"
status: ready | in_progress | blocked | completed | cancelled
scope_revision: 1
created_at: "ISO-8601 with timezone"
updated_at: "ISO-8601 with timezone"
base_commit: "Full Git commit SHA used for discovery"
task: "Short action-oriented name"
pipeline: bug_fix | feature_development | refactor | test_only | explain_or_document | devops_infra | pr_review
profile: Quick | Full
objective: "One observable or measurable outcome"

coordination:
  depends_on: ["Task IDs that must become terminal first, or []"]
  warnings: ["TASKSCOPE_WARNING with exact task/path, or []"]

completion:
  completed_at: null
  outcome: null # success only when every mandatory AC and check passes.
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
  reuse_safe: false

evidence:
  current_behavior: "path:symbol/test → observed behavior, not a hypothesis"
  expected_behavior: "Behavior that must be produced"
  root_cause: "Path + symbol + failure mechanism; null if not yet confirmed"

scope:
  inspect: ["Exact path:symbol and why execution needs it"]
  write: ["Exact path:symbol expected to change"]
  preserve: ["behavior or contract that must remain unchanged"]
  out: ["adjacent work that is explicitly outside this task"]

acceptance_criteria:
  - "AC-01: Binary observable result, including relevant error/permission state"

execution:
  - "E-01 [AC-01] path:symbol → exact smallest change"

temporary_artifacts:
  create: ["Exact task-generated Markdown paths, or []"]
  cleanup: ["Exact paths to remove before successful completion, or []"]
  retain: ["Explicit durable Markdown deliverables and reason, or []"]

verification:
  - "V-01 [AC-01] exact narrow command → expected pass signal"

risks: [] # Add only evidence-backed risks.
stop_conditions: ["Specific boundary, gate, or decision that requires a stop"]
```

## Multi-task isolation

- `ready`, `in_progress`, and `blocked` are active and reserve every declared
  `scope.write` path. `completed` and `cancelled` release reservations but do
  not by themselves authorize file deletion or reuse. A new conflict-free scope
  starts as `ready`; a scope with an unresolved conflict starts as `blocked`.
- Before create/start/resume and immediately before mutation, read only the
  lifecycle metadata, `coordination`, and boundaries needed from other files in
  `docs/task/`, then compare them with the candidate and current `git status`.
- Apply overlap semantics, `TASKSCOPE_WARNING`, `TASKSCOPE_CONFLICT`, and
  `TASKSCOPE_VIOLATION` exactly as defined in `global.md`. Record safe ordering
  in `coordination.depends_on`; a conflicting new scope may be saved only as
  `blocked`, and implementation stops before mutation.
- Only the assigned task may change its own status or content. Valid normal
  transitions are `ready → in_progress → completed`, any active status to
  `blocked`, `blocked → in_progress` after revalidation, and an active status to
  `cancelled` when explicitly authorized. Its own `scope_file` is an implicit
  coordination write and need not be listed in `scope.write`; no task may use
  this exception to edit another scope.
- Handle a changed `base_commit` with the targeted revalidation rule in
  `global.md`, then increment `scope_revision` only when continuation is safe.
- Mark `completed` only after the completion block proves every mandatory AC and
  required check. Set `reuse_safe: true` only when the global reuse gate passes.
  Slot reuse preserves `slot_id`, increments `generation`, resets task-specific
  metadata, and removes every stale field from the previous generation.
- Treat legacy scopes without lifecycle metadata as active for their declared
  writes. If their boundaries are missing or ambiguous, stop a candidate whose
  disjointness cannot be proven until the legacy scope is classified or
  migrated explicitly.

## Information-density rules

- State each fact once in the field that drives action. Use `[]` or `null` for
  genuinely empty values; do not explain their absence.
- Prefer `path:symbol`, contract names, test names, and exact commands over file
  summaries. Never paste source bodies, full logs, canonical rules, or the user
  request into the scope.
- Each write path must appear in an execution step, map to an `AC-*`, and have a
  `V-*` check. Each check must name the expected pass signal or observable
  result; avoid vague instructions such as "test thoroughly".
- Include preserved behavior and negative/error/permission states only when
  relevant to the change. Include alternatives, architecture, rollout, test
  matrices, or edge cases only when they alter an AC, risk, gate, or boundary.
- Use ordered, mutation-ready steps. Do not include generic verbs such as
  "analyze", "implement", "ensure quality", or "review code" without an exact
  target and result.
- Resolve paths, symbols, repository-native scripts, and nearest tests before
  publication. Leave an unknown only when the task is explicitly discovery-only
  or a stop condition prevents resolution.

## Execution-readiness gate

Publish only when a consuming agent can answer all of these from the brief:

1. What observable outcome is required and what evidence defines the baseline?
2. Which exact paths/symbols may change, and which contracts must remain stable?
3. What is explicitly out of scope?
4. Which ordered minimal edit proves each binary acceptance criterion?
5. Which narrow command or manual observation proves each criterion?
6. What concrete risk, gate, stale fact, or scope expansion requires stopping?
7. Which active taskscopes were checked, and are all write boundaries disjoint
   or explicitly blocked/serialized?

If any answer is missing, perform one targeted inspection and update the brief.
Do not compensate with broad repository discovery or additional narrative. An
agent receiving a current brief validates worktree freshness and named targets,
then starts execution; it repeats discovery only for stale evidence, an explicit
unknown, or a triggered boundary/gate.

## Pipeline-specific requirements

- **Bug fix:** require a reproduction or equivalent evidence, the root cause,
  preserved behavior, and a regression check. Do not patch a symptom while the
  cause remains unknown.
- **Feature:** define inputs, outputs, relevant error/permission states, and
  whether any contract changes. Map each AC to code plus a test or manual check.
- **Refactor:** record the baseline and invariants. Any behavioral change is out
  of scope.
- **Review:** pin the diff or file set. Produce evidence-backed findings, not a
  patch.
- **Docs/explanation:** define the audience, question, and code sources. Default
  to read-only behavior. A Markdown file is retained only when it is the
  requested durable output or an intentional canonical documentation update.

## Artifact cleanup

When execution creates Markdown for planning, measurements, handoff, checkpoint,
or resume, list each exact path in `temporary_artifacts.create` and mirror its
final disposition in `cleanup` or `retain`. Successful completion requires every
`cleanup` path to be removed and every `retain` path to have an explicit durable
reason. Never infer cleanup targets from a wildcard or directory-wide delete.
For an explicit taskscope request, list its exact
slot path under `retain` with the reason
`user-requested reusable taskscope slot`; never list it under `cleanup`.

## Anti-overthinking rule

Do not maximize length; maximize execution certainty per token. Do not add
architecture discussion, alternatives, edge cases, a test matrix, or a rollout
plan unless they affect an acceptance criterion or evidenced risk. If a path or
root cause is unknown, perform one targeted discovery step rather than guessing
or listing hypotheses. Start execution as soon as the objective, boundary,
acceptance criteria, ordered changes, and feasible verification are established.
