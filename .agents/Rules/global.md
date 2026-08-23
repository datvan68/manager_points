---
trigger: always_on
priority: high
applies_to: all_agents
version: 3.3.0
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

## 5. Completion

A step completes only when changed paths stay within boundaries, required
verification passes or a failed criterion is explicitly reported, unrelated
changes are preserved, and no unresolved gate/conflict remains. Full work also
validates required hashes and checkpoints. Never claim a check ran when it did
not.
