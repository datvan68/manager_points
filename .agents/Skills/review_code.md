# Skill: Review Code

> Use for a read-only, evidence-linked verdict on a pinned diff, pull request,
> commit range, or exact file set. Review does not authorize fixes or merges.

## Metadata

```yaml
skill_id: review_code
version: 3.0.0
protocol_version: "3.3"
supported_agents: [review-agent]
capabilities: [search, summarize, security_scan]
default_mode: read_only
```

## Review target

Require the acceptance criteria and one reproducible target:

- For committed work, pin base and head commits.
- For uncommitted work, pin the current commit plus the exact staged/unstaged
  diff or file set being reviewed.
- Verify an artifact hash when an artifact reference is supplied; do not invent
  a hash requirement for an exact local file-set review.

If the target changes during review, report it as stale and stop the verdict.
Classify generated, vendored, source, test, migration, and infrastructure paths
before prioritizing inspection.

## Review order

1. Acceptance criteria and user-visible behavior.
2. Authorization, trust boundaries, validation, injection, secrets, and personal
   data exposure.
3. Data integrity, transactions, migrations, compatibility, and rollback.
4. Control flow, error paths, async ordering, retries, idempotency, and races.
5. Test adequacy for the changed behavior and risk.
6. Demonstrable performance/resource impact, then operability and maintainability.

Trace the changed execution path and check callers, shared middleware, framework
guarantees, database constraints, and existing tests before raising a finding.
Separate regressions from pre-existing issues.

## Findings

Each finding must include severity, category, path and stable symbol, concrete
impact, evidence, smallest actionable correction, and whether it must be fixed.
Use a line number only when the review snapshot makes it stable. Deduplicate by
root cause; do not split one defect across multiple symptoms.

| Severity | Threshold | Verdict effect |
| --- | --- | --- |
| `critical` | Exploitation, unauthorized access, secret exposure, persistent data loss/corruption, unsafe deployment, or materially broken core contract | `blocked` |
| `warning` | Reproducible defect, violated criterion, missing required verification, or evidenced reliability/concurrency/performance risk | `changes_requested` when must-fix |
| `suggestion` | Optional improvement without demonstrated correctness or risk impact | Non-blocking |

Missing evidence is a verification gap, not a speculative defect. Style
preferences never override established repository convention.

## Verdict

- `approved`: no critical or must-fix warning, all applicable criteria have
  evidence, and required verification is adequate.
- `changes_requested`: at least one must-fix warning, unsupported criterion, or
  missing required regression protection.
- `blocked`: critical finding, stale/incomplete/unreviewable target, safety
  violation, or unresolved Human Gate.

Return the common `global.md` envelope plus verdict/reason, prioritized findings,
criterion checks, and test-impact gaps. Return an empty findings list when no
actionable issue exists; never approve by counting findings or by assuming an
unreviewed shard passed.
