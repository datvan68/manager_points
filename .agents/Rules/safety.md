---
trigger: always_on
priority: highest
applies_to: all_agents
override: none
version: 3.0.0
---

# Safety Rules

These rules are mandatory. No agent or pipeline may override them.

## 1. Path and repository boundaries

### Read access

Agents may read files under the active repository root when required by the assigned task, including source, tests, package manifests, lockfiles, build configuration, deployment configuration, migration definitions, documentation, and agent rules.

The following remain forbidden unless a platform-level capability explicitly provides a safe read abstraction:

```yaml
forbidden_read:
  - /etc/**
  - /root/** outside the active repository root
  - ~/.ssh/**
  - /proc/**
  - /sys/**
  - /boot/**
  - files outside the active repository and approved temporary workspace
```

Secret files such as runtime `.env*` files, credential stores, private keys, and cloud profiles may be read only when the task explicitly requires configuration-name discovery and the environment grants access. Versioned templates such as `.env.example` are ordinary repository configuration unless they contain detected secrets. Never copy raw secret values into prompts, logs, artifacts, patches, or messages.

### Write access

Agents may write only to:

- Paths inside the task's `write_boundaries`.
- `output/tasks/<task_id>/**` for reports and artifacts.
- `logs/tasks/<task_id>/**` for redacted logs.
- An isolated task worktree or approved temporary workspace.

Writing is always forbidden for `.env*`, private-key files, credential stores, files outside the active repository, and protected system paths. A path discovered inside an `approved_boundary` may be added to the discovery manifest without user approval; crossing the boundary requires a scope amendment.

## 2. Command policy

Commands are permitted by capability and arguments, not by executable name alone.

### Allowed capabilities

- Read-only repository inspection and search.
- Git inspection and diff operations.
- Git mutation only within the isolated task branch/worktree and approved scope.
- Repository-native format, lint, type-check, test, build, and validation scripts discovered from project configuration.
- Language/package-manager commands matching the repository's lockfile and documented toolchain.
- Docker, Kubernetes, Terraform, and cloud read/validate/plan commands inside the task scope.
- Dependency installation in an isolated development/build environment only when the dependency change is explicitly in scope and the lockfile is updated. Never install directly into a target production runtime through this permission.

### Always forbidden

```text
Recursive deletion of a repository, workspace root, home directory, or system path
Privilege escalation or ownership changes on broad paths
Piping downloaded or dynamically generated content into a shell or interpreter
Arbitrary disk, kernel, firewall, persistence, reverse-shell, or credential-exfiltration operations
Unreviewed force push, destructive history rewrite, or deletion of a shared remote branch
Commands containing unresolved variables, globs, or substitutions as destructive targets
Printing, exporting, or transmitting raw secrets
Bypassing a denied command through an equivalent shell construct
```

Before any material deletion, resolve exact targets with a read-only check and prefer a recoverable operation. Destructive operations listed in Section 7 require a Human Gate even when technically available.

## 3. Resource budgets

```yaml
max_output_tokens_per_call: 8192
max_retry_attempts: 2
max_loop_iterations: 3
max_review_remediation_cycles: 2
max_concurrent_subagents_default: 5
max_concurrent_subagents_hard: 12
max_concurrent_writers_per_path: 1
default_step_deadline_seconds: 600
max_step_deadline_seconds: 1800
default_pipeline_deadline_seconds: 3600
checkpoint_ttl_seconds: 604800
max_single_artifact_size: 50MB
```

- The orchestrator selects a lower concurrency value when repository resources, rate limits, or write overlap require it.
- A deadline may be chosen within the maximum using repository evidence. Long-running commands must emit heartbeat/progress information when supported.
- A timeout stops the process safely and saves an artifact/checkpoint when possible. Retry follows `global.md` and never exceeds the shared retry budget.
- Large outputs must be stored as artifacts and summarized; never truncate a finding silently.

## 4. Sensitive information

Redact sensitive values at the ingestion-to-log/output boundary. Agents may reason about an authorized secret-dependent configuration without reproducing the value.

Always redact:

- Passwords, tokens, API keys, private keys, connection-string credentials, cookies, and authorization headers.
- Payment-card data, government identifiers, and private personal data not required for the task.
- User or customer email addresses in general-purpose logs; preserve only when the user explicitly requires the address as task data and access is authorized.

Use stable placeholders such as `[REDACTED_API_KEY]` or `[REDACTED_EMAIL]` so related events remain correlatable without revealing values. Secret detection must not prevent reading normal source code that contains variable names such as `API_KEY`.

## 5. Environment policy

| Environment | Allowed without Human Gate | Requires Human Gate |
|---|---|---|
| Development | Read, analyze, scoped code generation, scoped tests/builds, local ephemeral resources | Destructive shared-resource operations, secret operations, shared-history changes |
| Staging | Read, analyze, generate, validate, plan; deploy after required automated review | Deploy, database/schema mutation, resource deletion, secret/IAM changes |
| Production | Read, analyze, generate artifacts, security scan, dry-run/plan | Any mutation, deployment, database change, resource deletion, secret/IAM change |

Environment approval does not authorize paths or behavior outside the approved task scope.

## 6. Isolation and concurrency

- Every mutating task uses an isolated branch/worktree when Git is available.
- Record `base_commit_sha` before mutation and `current_commit_sha` in every checkpoint.
- Two workers must not write overlapping paths concurrently.
- Before applying a worker artifact, verify that its base hash still matches. A mismatch is `CONFLICT` or `STALE_CHECKPOINT`, not an automatic merge.
- Never overwrite unrelated dirty-worktree changes. Preserve them and request direction if isolation is impossible.

## 7. Human-in-the-Loop gates

Approval is mandatory before:

- Any production mutation or deployment.
- Staging deployment, resource deletion, or database/schema mutation.
- Database migrations that can affect persistent data.
- Creating, rotating, revoking, exposing, or deleting secrets or credentials.
- Creating, deleting, or broadening IAM roles, policies, or permissions.
- Merging into `main`, `master`, or `release/*`.
- Deleting a remote branch or rewriting shared history.
- Changing production-affecting CI/CD behavior.
- Material destructive actions or an expansion beyond the approved task boundary.

Request schema:

```json
{
  "type": "approval_required",
  "task_id": "uuid-v4",
  "pipeline_id": "devops_infra",
  "step_id": "apply.production",
  "environment": "production",
  "action_summary": "Apply the reviewed deployment artifact.",
  "artifacts_to_review": [
    {"type": "plan", "uri": "output/tasks/<task_id>/deployment-plan.txt", "sha256": "..."}
  ],
  "risk_level": "high",
  "triggered_by": "production_mutation",
  "rollback_artifact": {"uri": "output/tasks/<task_id>/rollback.md", "sha256": "..."},
  "message": "Vui lòng xem các artifact và xác nhận trước khi tiếp tục."
}
```

Valid risk levels are `medium`, `high`, and `critical`.

## 8. Safety violation response

On a safety violation:

1. Stop the unsafe action and any dependent pipeline steps.
2. Do not retry, refine, delegate around, or partially execute it.
3. Preserve safe evidence with sensitive values redacted.
4. Return `SAFETY_VIOLATION` and notify the orchestrator.
5. Save a checkpoint only if doing so does not repeat the violation.

```json
{
  "timestamp": "ISO-8601",
  "agent_id": "agent-id",
  "task_id": "uuid-v4",
  "pipeline_id": "pipeline-id",
  "step_id": "step-id",
  "violation_type": "COMMAND | PATH | ENVIRONMENT | SECRET | RESOURCE | SCOPE",
  "action_summary": "Redacted description of the blocked action.",
  "blocked": true,
  "artifact_refs": []
}
```
