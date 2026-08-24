---
description: Compact, evidence-based scope template for implementation tasks.
version: 3.3.2
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

When the user explicitly asks to write, create, generate, or update a
taskscope, write the complete Taskscope Brief to `docs/task/taskscope.md`.
Replace the file's entire previous contents on every request. Do not append,
merge, retain stale sections, or create a second task-specific taskscope. This
rolling file is the requested durable output and is excluded from temporary
artifact cleanup. When no explicit taskscope output is requested, keep the
brief in the response/runtime unless an authorized Full/resume flow requires a
separate temporary artifact.

## Required template

```yaml
task: "Short action-oriented name"
pipeline: bug_fix | feature_development | refactor | test_only | explain_or_document | devops_infra | pr_review
profile: Quick | Full
objective: "One observable or measurable outcome"

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
For an explicit taskscope request, list `docs/task/taskscope.md` under `retain`
with the reason `user-requested rolling taskscope`; never list it under
`cleanup`.

## Anti-overthinking rule

Do not maximize length; maximize execution certainty per token. Do not add
architecture discussion, alternatives, edge cases, a test matrix, or a rollout
plan unless they affect an acceptance criterion or evidenced risk. If a path or
root cause is unknown, perform one targeted discovery step rather than guessing
or listing hypotheses. Start execution as soon as the objective, boundary,
acceptance criteria, ordered changes, and feasible verification are established.
