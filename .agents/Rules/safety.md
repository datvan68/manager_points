---
trigger: always_on
priority: highest
applies_to: all_agents
version: 3.4.1
---

# Safety Rules

No lower-priority rule may override this file.

## 1. Boundaries and secrets

Read only repository, approved temporary-workspace, verified dev resources under
section 6a, and explicitly authorized external resources required by the task.
File writes stay inside `write_boundaries` or approved task artifact directories;
dev UI/API/data operations follow the runtime boundary in section 6a.
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
- No Human Gate, destructive action, persistent-data mutation outside section
  6a's bounded reversible dev tests, migration,
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

Approval is mandatory before the following unless the exact action is already
authorized. Routine dev testing in section 6a is pre-authorized and does not
require repeated approval:

- Any production mutation or deployment.
- Staging deployment, infrastructure deletion, schema mutation, or data mutation
  outside the bounded dev-testing contract below.
- Persistent-data migration or destructive/difficult-to-reverse action.
- Secret, credential, IAM, permission, or billing mutation.
- Merge to a protected branch, remote-branch deletion, or shared-history rewrite.
- Production-affecting CI/CD mutation.
- External communication/publication not explicitly authorized.
- Personal-data export/disclosure or handling beyond task-scoped dev testing,
  or expansion beyond approved boundaries.

Request only the smallest approval needed. State the action, environment,
impact, risk, review artifact, rollback, and exact resume point. Do not partially
perform, retry, refine, or delegate around a gate.

## 6a. Pre-authorized dev testing and release boundary

The user authorizes normal development verification on this workspace's dev
environment, including existing real dev records. Apply this only to an
implementation/testing request; a read-only explanation does not authorize
test mutations. An explicit taskscope exclusion still applies.

- Before the first runtime test, verify the effective frontend/API destination,
  database identity and relevant storage/queue/integration targets are dev and
  separate from production. Use non-secret runtime metadata or narrowly filtered
  configuration; do not dump `.env`, connection strings, tokens or credentials.
  Localhost or `NODE_ENV=development` alone does not prove data isolation.
  Keep configured credentials inside the application. Reuse the evidence until
  a service, connection or environment changes; stop only dependent runtime
  actions if the destination cannot be established.
- Within the task's runtime boundary, proceed without another prompt: start
  repository-native dev services, use the existing dev login/session, browse,
  search, filter, submit forms, call APIs, inspect relevant dev records, and
  create/update/import/upload/download task-scoped test data. Use existing
  application validation/RBAC; no bypass. Prefer tagged test records for writes;
  existing dev records may be used when required to reproduce the behavior.
- Reversible edits to existing dev data require a minimal local before-state
  and restoration plan; check for intervening changes before restoring. Delete
  only positively identified task-created disposable records/files as ordinary
  cleanup. Deleting existing records, bulk resets, drops, schema/index changes,
  broad backfills or irreversible side effects require exact authorization.
  Do not make raw database writes to bypass application safeguards.
- Verify email/SMS/webhooks/payments and similar integrations are disabled or
  captured by dev sinks before actions that invoke them. Real external delivery
  remains separately authorized. Retained/shared logs, screenshots and reports
  use minimum redacted evidence. Keep local import/export fixtures limited to
  the tested fields, remove them after verification, and never commit real data.
- Record only dev target identity, affected records/resources, scenarios and
  pass signals, and cleanup/restore outcome in runtime or the owned scope. No
  separate report or full database backup for routine tests. Coordinate shared
  dev records with other tasks; never reset a shared database for a test.

The user reports that the VPS pulls committed code for production. Before an
authorized commit/push/merge, determine which action reaches that watched ref;
that action is a production-release boundary, not ordinary dev testing.
Prepare the scoped diff and required checks first. Existing explicit release
authority suffices; otherwise obtain it before the triggering action. Do not
commit test data, secrets, temporary RBAC bypasses or dev-only overrides.
`scripts/deploy.sh` defaults to production and is not a dev test command.
Passing dev checks is not evidence that VPS production was deployed or tested.

## 7. Safety response

On a violation, stop the unsafe action and dependent steps, preserve redacted
evidence, return `SAFETY_VIOLATION`, and do not retry or substitute around the
rule.
