# Skill: Debug Issue

> Diagnose root cause from evidence, establish reproducibility, and produce a bounded fix handoff. Do not modify code unless the assigned pipeline step explicitly authorizes it.

## Metadata

```yaml
skill_id: debug_issue
version: 2.0.0
supported_agents: [code-agent, review-agent]
capabilities: [search]
supported_stacks: repository_defined
default_mode: read_only
```

## Input

```json
{
  "protocol_version": "3.0",
  "task_id": "uuid-v4",
  "pipeline_id": "bug_fix",
  "step_id": "diagnose",
  "error_type": "runtime | logic | performance | type | test | integration | operational | unknown",
  "evidence_refs": [
    {"type": "log", "uri": "output/tasks/<task_id>/error.log", "sha256": "..."}
  ],
  "reproduction": {
    "steps": [],
    "frequency": "always | intermittent | rare | unknown",
    "environment": "development | staging | production",
    "first_known_bad": "commit-or-time-or-null",
    "last_known_good": "commit-or-time-or-null"
  },
  "scope": {
    "approved_boundaries": ["packages/api/**"],
    "suspected_paths": []
  }
}
```

Do not require raw full logs when a focused, redacted slice and artifact reference are sufficient.

## Output

Return the common result envelope from `global.md` with:

```json
{
  "diagnosis_status": "root_cause_confirmed | probable_cause | more_evidence_required | not_reproduced",
  "root_cause": {
    "description": "Evidence-based cause.",
    "path": "repository-relative path or null",
    "symbol": "symbol or null",
    "line": 87,
    "confidence": "high | medium | low",
    "evidence_refs": []
  },
  "contributing_factors": [],
  "reproduction_artifact_ref": null,
  "fix_constraints": [],
  "regression_test": {
    "required": true,
    "proposed_level": "unit | integration | contract | e2e | manual",
    "observable_failure": "Exact pre-fix failure."
  },
  "similar_risks": []
}
```

Set the common envelope's top-level `next_action` to `regression_baseline`, `request_evidence`, or `null`.

Use `line: null` when source location is not stable. Prefer path plus symbol and commit SHA over stale line numbers.

## Investigation workflow

### 1. Establish the evidence boundary

- Record environment, base commit, affected version, request/job identifiers, and time window.
- Redact sensitive values before saving logs or payloads.
- Separate observed facts from user hypotheses and agent hypotheses.
- Confirm whether the task is diagnosis-only or includes implementation.

### 2. Reproduce or triangulate

Use the least expensive reliable method:

1. Existing focused failing test.
2. Minimal local reproduction.
3. Deterministic log/trace correlation.
4. Comparison with last-known-good behavior.
5. Controlled instrumentation in development/staging when authorized.

Production diagnosis is read-only unless a Human Gate explicitly authorizes mutation.

### 3. Trace causality

Trace from observable failure through call/data/dependency flow to the earliest incorrect state. Inspect:

- Input validation and serialization boundaries.
- Nullability, type narrowing, units, time zones, and numeric precision.
- Async ordering, cancellation, retries, idempotency, races, and backpressure.
- Database transactions, isolation, N+1 access, connection/resource leaks.
- Cache invalidation, stale reads, queues, external service partial failures.
- Configuration differences and recent dependency/deployment changes.
- Test non-determinism, shared state, time, randomness, and external services.

Do not label the crash site as root cause unless evidence shows that the incorrect state originated there.

### 4. Test hypotheses

For each plausible hypothesis, record:

```yaml
hypothesis: "Description"
expected_observation: "What should be true if correct"
check: "Repository-supported command or artifact inspection"
actual_observation: "Observed result"
verdict: confirmed | rejected | inconclusive
```

Investigate at most the smallest set needed to distinguish causes. Do not perform broad speculative edits.

### 5. Define the fix boundary

- State the behavior that must change and behavior that must remain unchanged.
- Identify compatibility, data, security, and operational constraints.
- Propose a regression test that fails for the confirmed cause, not merely the visible symptom.
- Search for the same faulty pattern only inside approved boundaries; record other occurrences as risks unless the scope authorizes fixing them.

## Performance and large-repository guidance

- Use profiles, query plans, traces, or heap evidence when available; do not infer a performance cause from style alone.
- Query the code index/module manifest before opening large dependency trees.
- Search progressively: failing symbol -> direct callers -> owning module -> dependent modules.
- Store long logs, profiles, and traces as artifacts; return only the relevant evidence references.

## Prohibited shortcuts

- Swallowing errors, weakening assertions, deleting failing tests, or adding bypass conditions.
- Combining unrelated refactoring with a bug fix.
- Claiming root cause without a reproducible observation or converging independent evidence.
- Mutating production or persistent data during diagnosis without approval.
