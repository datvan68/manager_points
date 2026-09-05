---
trigger: always_on
priority: highest
applies_to: all_agents
version: 3.4.0
---

# Safety Rules

No lower-priority rule may override this file.

## 1. Boundaries and secrets

Read only repository, approved temporary-workspace, and explicitly authorized
external resources required by the task. Write only inside `write_boundaries`
or approved task artifact directories in the current repository worktree.
Use the currently checked-out branch, including `main`, by default. Do not
create or switch to another branch/worktree unless the user explicitly asks.

Never read or write protected system paths, private keys, credential stores, or
runtime secret files unless a platform capability and the explicit task both
authorize the exact operation. Versioned templates such as `.env.example` are
ordinary repository files unless they contain detected secrets. Never copy raw
secrets into prompts, logs, artifacts, patches, or messages.

A path discovered inside `approved_boundaries` may be added to the manifest.
Crossing the boundary, changing excluded behavior, or materially increasing
risk requires a scope amendment.

## 2. Command safety

Allowed actions include focused repository inspection, Git inspection, scoped
edits, and repository-native format, lint, type-check, test, build, validation,
or dry-run commands supported by project configuration.

Always forbidden:

- Recursive deletion of a repository, workspace root, home, or system path.
- Destructive targets containing unresolved variables, globs, or substitutions.
- Broad privilege, ownership, kernel, firewall, persistence, or disk changes.
- Piping downloaded or generated content directly into a shell/interpreter.
- Secret exfiltration or bypassing a denied action with an equivalent command.
- Unreviewed force push, shared-history rewrite, or remote-branch deletion.

Resolve exact targets before material deletion and prefer recoverable actions.

## 3. Risk and profiles

Valid risk values are `medium`, `high`, and `critical`.

Quick is allowed only when all are true:

- Development environment and `medium` risk.
- One package/module and at most three expected changed files.
- One focused verification profile is available.
- No Human Gate, destructive action, persistent-data mutation, migration,
  deployment, production-affecting infrastructure, credential/IAM/billing work,
  external communication, or public breaking change.

Otherwise use Full. Uncertainty about any safety-sensitive condition promotes
the task to Full; it does not permit guessing.

## 4. Isolation, concurrency, and checkpoints

- One writer per path is mandatory.
- Quick and Full mutation use the current repository worktree after checking
  branch, status, and base commit. A protected branch or Full profile alone does
  not require another branch/worktree.
- Preserve unrelated dirty-worktree changes and serialize overlapping writes.
  Stop for unrelated or unknown dirty changes on requested paths; the current
  task's verified edits are allowed against its recorded baseline/owned diff.
  Do not create another worktree automatically to evade a conflict.
- Create or switch to an isolated branch/worktree only when the user explicitly
  requests it. Git history remains the recovery and review mechanism for direct
  work on the current branch.
- Record base/current commit identifiers for mutation. Full alone does not
  require a manifest, checkpoint, or artifact hash. Validate hashes of actual
  handoff/resume artifacts only at material synchronization points where those
  artifacts are needed to establish freshness or ownership.
- Quick work does not create checkpoints or artifact hashes unless needed for
  conflict detection, resume, review, or user-requested evidence.

## 5. Budgets

```yaml
max_retry_attempts: 2
max_loop_iterations: 3
max_review_remediation_cycles: 2
max_concurrent_writers_per_path: 1
quick_scope_discovery_passes: 1
quick_scope_soft_deadline_seconds: 120
quick_scope_target_words: 220
quick_scope_max_workers_before_publish: 0
quick_implementation_max_workers: 1
default_step_deadline_seconds: 600
max_step_deadline_seconds: 1800
```

Budgets are shared across delegation and do not reset when a task is reassigned.
Soft Quick targets never justify incomplete or invented evidence. Promote to
Full when safe completion cannot fit the Quick profile.

## 6. Human Gates

Approval is mandatory before:

- Any production mutation or deployment.
- Staging deployment, resource deletion, or database/schema mutation.
- Persistent-data migration or destructive/difficult-to-reverse action.
- Secret, credential, IAM, permission, or billing mutation.
- Merge to a protected branch, remote-branch deletion, or shared-history rewrite.
- Production-affecting CI/CD mutation.
- External communication/publication not explicitly authorized.
- Material personal-data handling or expansion beyond approved boundaries.

Request only the smallest approval needed. State the action, environment,
impact, risk, review artifact, rollback, and exact resume point. Do not partially
perform, retry, refine, or delegate around a gate.

## 7. Safety response

On a violation, stop the unsafe action and dependent steps, preserve redacted
evidence, return `SAFETY_VIOLATION`, and do not retry or substitute around the
rule.
