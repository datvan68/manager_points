---
trigger: always_on
priority: high
applies_to: all_agents
version: 3.0.0
---

# Global Rules

These rules define the common protocol for every agent. Conflict precedence is:

```text
safety.md > global.md > antigravity-operating-contract.md > orchestrator.md > pipeline.md > skill files
```

Apply precedence deterministically. Stop only when a conflict remains unresolved after applying this order.

## 1. Roles and authority

- Each agent performs only the role assigned by the orchestrator.
- Every agent output identifies `agent_id`, `task_id`, `pipeline_id`, `step_id`, and `protocol_version`.
- The orchestrator coordinates work and delegates repository inspection, mutation, testing, review, infrastructure, and documentation to an authorized worker.
- A worker may not expand its approved scope, capability set, or write boundary.
- Multiple instances of one role are allowed as `role-name.<instance>` when their module and write boundaries do not overlap.

| Role | Authorized capabilities |
|---|---|
| `code-agent` | `search`, `code_gen` |
| `review-agent` | `search`, `summarize`, `security_scan` |
| `test-agent` | `search`, `code_gen` |
| `devops-agent` | `search`, `code_gen`, `security_scan` |
| `doc-agent` | `search`, `summarize`, `code_gen` |
| `orchestrator` | Coordination only; no repository skill execution |

## 2. Language and communication

| Content | Language |
|---|---|
| User communication and user-facing `message` | Vietnamese unless requested otherwise |
| Agent instructions, structured payloads, logs, code, configuration, paths, comments, and repository artifacts | English |

- Keep agent payloads valid JSON without Markdown.
- Keep large content in artifacts. Exchange references, hashes, summaries, and changed ranges instead of embedding whole files or logs.
- Never expose chain-of-thought. Return decisions, evidence, verification results, and concise rationale.

## 3. Common task capsule

Every delegated step receives a bounded task capsule:

```json
{
  "protocol_version": "3.0",
  "task_id": "uuid-v4",
  "pipeline_id": "feature_development",
  "step_id": "implement.api",
  "instruction": "Implement the approved behavior within the assigned module.",
  "environment": "development",
  "risk_level": "medium",
  "base_commit_sha": "full-git-sha-or-null",
  "scope": {
    "approved_boundaries": ["packages/api/src/orders/**"],
    "write_boundaries": ["packages/api/src/orders/**"],
    "excluded_boundaries": ["packages/api/src/payments/**"]
  },
  "context_refs": [
    {"type": "task_scope", "uri": "taskscope.md", "sha256": "..."},
    {"type": "artifact", "uri": "output/discovery.json", "sha256": "..."}
  ],
  "acceptance_criteria_ids": ["AC-001"],
  "verification_profile": "focused",
  "deadline_seconds": 900,
  "on_failure": "stop"
}
```

Rules:

- `context_refs` are authoritative references, not duplicated content.
- Load only the referenced sections and repository files needed for the current step.
- Pass deltas from the previous step; do not resend the complete conversation or repository context.
- If discovered files remain inside `approved_boundaries`, record them in the discovery artifact. Ask for a scope amendment only when work must cross an approved boundary.

## 4. Common result envelope

Every worker returns:

```json
{
  "protocol_version": "3.0",
  "agent_id": "code-agent.1",
  "task_id": "uuid-v4",
  "pipeline_id": "feature_development",
  "step_id": "implement.api",
  "attempt": 1,
  "status": "success",
  "result": {
    "summary": "Implemented the approved order validation behavior.",
    "changed_paths": ["packages/api/src/orders/service.ts"],
    "artifact_refs": [
      {"type": "diff", "uri": "output/tasks/<task_id>/implement.diff", "sha256": "..."}
    ],
    "verification": [
      {"criterion_id": "AC-001", "status": "passed", "command": "npm run test:orders"}
    ]
  },
  "duration_ms": 3200,
  "next_action": null,
  "message": "Đã hoàn thành bước triển khai."
}
```

Valid `status` values are `success`, `partial`, `error`, `pending`, `blocked`, and `cancelled`. `partial` is valid only when all mandatory criteria pass and optional work is incomplete.

Error results add:

```json
{
  "error": {
    "error_code": "INPUT_INVALID | TOOL_TIMEOUT | API_ERROR | LOGIC_ERROR | SAFETY_VIOLATION | CONFLICT | STALE_CHECKPOINT | VERIFICATION_FAILED",
    "error_detail": "Concise technical evidence in English.",
    "retryable": false,
    "attempted_retries": 0,
    "artifact_refs": []
  }
}
```

## 5. Error and retry policy

| Error | Policy |
|---|---|
| `INPUT_INVALID` | No retry; request the exact missing or invalid field |
| `API_ERROR` | Retry only an idempotent call, at most `max_retry_attempts` |
| `TOOL_TIMEOUT` | Retry only when the step is idempotent and the remaining deadline is sufficient |
| `VERIFICATION_FAILED` | Use the ENG Loop within the current write boundary |
| `LOGIC_ERROR` | Stop after the ENG Loop is exhausted |
| `CONFLICT` | Stop mutation, preserve both artifacts, return conflict evidence |
| `STALE_CHECKPOINT` | Re-run discovery against the current commit; never resume stale mutations |
| `SAFETY_VIOLATION` | Stop the pipeline immediately; never retry or substitute around the rule |

Retry counts are total across worker and orchestrator. The orchestrator must not reset the counter by delegating the same operation to another agent.

## 6. ENG Loop

```text
PLAN -> EXECUTE -> VERIFY -> DONE
                    |
                    +-> REFINE -> EXECUTE -> VERIFY
```

- `max_loop_iterations` comes from `safety.md` and is a hard maximum.
- A pipeline may set `loop_iterations` from `0` through that maximum, never above it.
- Each iteration records the affected paths, verification command, result, and artifact reference.
- REFINE may address only a concrete verification failure inside the existing approved and write boundaries.
- Human gates, conflicts, stale checkpoints, scope expansion, and safety violations sit outside the loop.
- Exhaustion returns `VERIFICATION_FAILED` when evidence is conclusive, otherwise `LOGIC_ERROR`.

## 7. Repository-scale behavior

- Prefer repository-native scripts, conventions, test frameworks, and architecture.
- For a monorepo, discover package ownership and dependency edges before planning mutations.
- Shard read-only analysis by module when artifacts can be merged deterministically.
- Do not parallelize writes to overlapping paths.
- Use focused verification first, affected-package verification second, and full regression only when risk, policy, or the repository requires it.
- Treat generated files as outputs of their source generator; edit the source and regenerate instead of hand-editing generated output.

## 8. Completion

A step is complete only when:

- Its output matches the common envelope.
- Every changed path is within the write boundary.
- Required verification passed or an explicit failed criterion was reported.
- Artifact hashes and base/current commit identifiers are recorded when Git is available.
- No unresolved conflict, gate, or stale checkpoint remains.
