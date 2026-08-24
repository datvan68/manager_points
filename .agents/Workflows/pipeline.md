---
description: Defines proportional Quick and Full software workflows.
version: 3.3.1
managed_by: orchestrator
---

# Pipelines

## 1. Pipeline IDs

```text
feature_development
bug_fix
refactor
test_only
explain_or_document
devops_infra
pr_review
```

Route by requested outcome and primary mutation. Split tasks only when
boundaries, risk, environments, or approvals differ materially.

## 2. Profile selection

Read-only explanation and PR review do not persist taskscope by default. An
explicit user request to write, create, generate, or update a taskscope is the
exception: replace `docs/task/taskscope.md` with the complete new result. A bug
diagnosis that is immediately followed by an authorized fix shares one
taskscope and one execution loop. DevOps/infrastructure mutation always uses
Full. Other pipelines may use Quick only when every `safety.md` Quick condition
passes.

When a Quick trigger appears during execution—additional module/service,
fourth changed file with meaningful scope impact, public contract, dependency,
migration, persistent data, infrastructure, external effect, security-sensitive
behavior, gate, or need for independent workers—stop mutation and promote to
Full with the smallest scope amendment.

## 3. Quick pipeline

One actor (normally the orchestrator) performs one bounded capsule:

```yaml
profile: Quick
steps:
  - inspect_or_baseline
  - mutate
  - focused_verify
  - self_review_diff
actors: 1
checkpoints: 0
independent_review: conditional
```

Pipeline-specific requirements:

| Pipeline | Quick requirement |
| --- | --- |
| `feature_development` | Verify changed behavior; update focused tests when behavior changes. |
| `bug_fix` | Establish root cause; add the smallest regression protection when technically useful; verify the failure is fixed. |
| `refactor` | Capture a passing focused baseline and prove observable behavior is preserved. |
| `test_only` | Follow existing test conventions and run the changed test target. |
| `explain_or_document` | Explanation stays read-only; requested docs use focused style/build checks. |

Independent review becomes mandatory and the task promotes to Full when the
change touches authentication/authorization, sensitive data, concurrency,
public compatibility, money, persistence, or another material risk boundary.

## 4. Full pipelines

Use only applicable steps; do not create no-op agents or artifacts.

### Feature development

```text
discover -> implement -> tests when behavior changes
         -> docs when public/developer usage changes
         -> independent review -> final affected verification
```

### Bug fix

```text
diagnose -> regression baseline or exact manual evidence -> fix
         -> regression/affected verification -> independent review
```

### Refactor

```text
baseline invariants -> transform -> affected verification -> independent review
```

### Test-only

```text
discover behavior/risk -> write tests -> run affected tests -> review test quality
```

### Explanation or documentation

```text
focused inspect -> synthesize or scoped documentation write -> relevant check
```

### DevOps and infrastructure

```text
discover environment/state -> generate change -> validate/plan
-> architecture/security review -> Human Gate when triggered -> apply if authorized
-> post-apply verification and rollback evidence
```

### Pull-request review

```text
pin base/head and scope -> review affected boundaries, sharded when useful
-> deduplicate evidence -> prioritized verdict
```

## 5. Verification, loops, and artifacts

- For Quick, inspect only the target, nearest representative implementation/test,
  and direct dependencies needed to prove the change. Do not inventory the repo.
- Start mutation once root cause/desired behavior, write paths, binary criteria,
  and a focused verification command are known. More analysis needs a named
  evidence gap or risk.
- Run focused checks first, affected-package checks second, and broader
  regression only when impact, repository policy, or risk requires it.
- Required tests, security checks, acceptance criteria, and gated review use
  stop-on-failure.
- ENG loop is `0..3`; review remediation is `0..2`; idempotent retries are
  `0..2`. These budgets are separate and shared across delegation.
- Full checkpoints and hashes occur only at material synchronization/resume
  points, not after every read-only step.
- Store long output as an artifact only when it must be handed off, audited, or
  resumed; otherwise retain the concise command result.
- Track every task-created Markdown artifact by exact path. Before successful
  completion, remove temporary taskscopes, raw benchmark reports, temporary
  plans, and handoff/checkpoint notes that are no longer required. Retain only
  explicit durable deliverables, canonical documentation updates, or evidence
  required by an active audit/resume flow. The rolling
  `docs/task/taskscope.md` written for an explicit taskscope request is a
  retained deliverable, not a cleanup target.
- Include artifact cleanup in final diff/status review; a leftover temporary
  Markdown file is an incomplete cleanup obligation, not a deliverable.
- Never parallelize overlapping writes; shard only independent read-only work or
  disjoint mutations with proven dependencies.
