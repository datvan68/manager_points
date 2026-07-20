# Skill: Review Code

> Produce a deterministic, evidence-linked verdict for a pinned diff or file set. Review is read-only and does not authorize fixes or merge actions.

## Metadata

```yaml
skill_id: review_code
version: 2.0.0
supported_agents: [review-agent]
capabilities: [search, summarize, security_scan]
supported_stacks: repository_defined
```

## Input

```json
{
  "protocol_version": "3.0",
  "task_id": "uuid-v4",
  "pipeline_id": "feature_development | bug_fix | refactor | test_only | devops_infra | pr_review",
  "step_id": "review.parallel.module-a",
  "target": {
    "type": "files | git_diff | pull_request | artifact",
    "base_commit_sha": "...",
    "head_commit_sha": "...",
    "paths": ["packages/api/src/orders/service.ts"],
    "diff_ref": {"uri": "output/tasks/<task_id>/change.diff", "sha256": "..."}
  },
  "acceptance_criteria_ids": [],
  "test_result_refs": [],
  "review_profile": "standard | strict | security_focus | architecture",
  "assigned_boundary": "packages/api/**"
}
```

Reject a review target whose base/head or artifact hash cannot be verified.

## Output

Return the common result envelope with:

```json
{
  "verdict": "approved | changes_requested | blocked",
  "verdict_reason": "Concise evidence-based reason.",
  "findings": [
    {
      "id": "R-001",
      "severity": "critical | warning | suggestion",
      "category": "security | correctness | data | concurrency | performance | compatibility | test | operability | maintainability",
      "path": "packages/api/src/orders/service.ts",
      "symbol": "createOrder",
      "line": null,
      "description": "Observable problem.",
      "impact": "Concrete failure or risk.",
      "evidence": "Execution path, test, contract, or source fact.",
      "recommendation": "Smallest actionable correction.",
      "must_fix": true,
      "fingerprint": "stable-deduplication-hash"
    }
  ],
  "criteria_check": [],
  "test_impact": {
    "adequate": true,
    "missing_behaviors": [],
    "evidence_refs": []
  },
  "artifact_refs": []
}
```

Do not include large code blocks. Use the smallest snippet necessary or reference the path, symbol, commit, and artifact.

## Review order

1. Acceptance criteria and user-visible behavior.
2. Authorization, data exposure, injection, secret handling, and trust boundaries.
3. Data integrity, transactions, migrations, backward compatibility, and rollback.
4. Control flow, error paths, async ordering, retries, idempotency, and races.
5. Test adequacy for changed risk and behavior.
6. Performance and resource use on demonstrable execution paths.
7. Operability, observability, maintainability, and repository conventions.

Style-only preferences never override established project convention.

## Severity

### Critical

Use when the change can cause exploitation, unauthorized access, secret exposure, persistent data loss/corruption, materially incorrect core behavior, unsafe deployment, or an unmitigated breaking contract. Any critical finding produces `blocked`.

### Warning

Use for a reproducible or strongly evidenced defect, missing required test, reliability/concurrency risk, meaningful performance regression, or violation of an acceptance criterion. A must-fix warning produces `changes_requested`.

### Suggestion

Use for optional readability, consistency, or design improvement without a demonstrated correctness or risk impact. Suggestions do not block approval.

## Verdict

```yaml
approved:
  - no critical findings
  - no must-fix warnings
  - all applicable acceptance criteria supported by evidence
  - required verification and test impact are adequate

changes_requested:
  - one or more must-fix warnings
  - missing required verification or regression protection
  - acceptance criterion not demonstrated

blocked:
  - any critical finding
  - unreviewable, stale, incomplete, or tampered target
  - safety or Human Gate violation
```

Do not approve based on a warning-count threshold. One warning can block when its impact is material.

## Review quality

- Trace the changed execution path; do not review only isolated lines.
- Verify whether an apparent issue is already handled by a caller, framework, database constraint, or shared middleware.
- Avoid speculative findings. State missing evidence as a question or verification gap.
- Do not demand a new abstraction, dependency, framework, or pattern unless required by correctness or accepted convention.
- Separate pre-existing issues from regressions introduced by the target.
- Deduplicate findings by root cause/fingerprint across sharded reviewers.

## Large-diff strategy

- First classify generated, vendored, source, test, migration, and infrastructure paths.
- Review public contracts and high-risk entry points before internal helpers.
- Shard by independent module with pinned base/head commits.
- Synthesize findings only after all required shards finish; if a shard fails, the target is incomplete rather than silently approved.
- Store inventories and scan output as artifacts; keep the verdict concise.
