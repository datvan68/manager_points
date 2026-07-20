---
description: Defines dependency-aware, resumable pipelines for software engineering and DevOps tasks.
version: 3.0.0
managed_by: orchestrator
---

# Pipeline — Processing Flows

## 1. Common syntax

```yaml
- step_id: discover
  agent: code-agent
  capability: search
  depends_on: []
  mode: read_only
  loop_iterations: 0
  on_failure: stop
  checkpoint: after

- step_id: verify.parallel
  parallel:
    - step_id: verify.tests
      agent: test-agent
      write_boundaries: ["tests/**"]
    - step_id: verify.docs
      agent: doc-agent
      write_boundaries: ["docs/**"]
  sync_at: review

- step_id: apply.production
  type: human_gate
  condition: "environment == production and apply_requested == true"
```

Rules:

- `loop_iterations` is `0..3`; it may never exceed `safety.md`.
- `remediation_cycles` are pipeline-level review/fix cycles, separate from the ENG Loop, and may never exceed `safety.md`.
- Every mutating step declares non-overlapping `write_boundaries`.
- Every synchronization point validates artifact hashes and repository base state.
- Required tests, review, security checks, and acceptance criteria use `on_failure: stop`.
- Read-only work may be sharded by package/module; mutation is parallel only when paths and dependencies do not overlap.

## 2. Feature development

```yaml
pipeline_id: feature_development
steps:
  - step_id: discover
    agent: code-agent
    capability: search
    action: "Build a module-scoped dependency, convention, and verification manifest."
    mode: read_only
    loop_iterations: 0
    on_failure: stop
    checkpoint: after

  - step_id: implement
    agent: code-agent
    capability: code_gen
    depends_on: [discover]
    action: "Implement only approved acceptance criteria inside the assigned write boundary."
    loop_iterations: 3
    on_failure: stop
    checkpoint: after

  - step_id: supporting.parallel
    depends_on: [implement]
    parallel:
      - step_id: tests
        agent: test-agent
        capability: code_gen
        action: "Add or update risk-based tests for changed behavior and run focused verification."
        on_failure: stop
      - step_id: docs
        agent: doc-agent
        capability: summarize
        action: "Update documentation only when public behavior or operator/developer usage changed."
        condition: "documentation_impact == true"
        on_failure: stop
    sync_at: review
    checkpoint: after

  - step_id: review
    agent: review-agent
    capability: [search, summarize, security_scan]
    depends_on: [supporting.parallel]
    action: "Review the diff against acceptance criteria, repository conventions, tests, security, and performance."
    mode: read_only
    loop_iterations: 0
    verdicts: [approved, changes_requested, blocked]
    on_changes_requested: implement
    remediation_cycles: 2
    on_failure: stop
    checkpoint: after

  - step_id: final_verify
    agent: test-agent
    capability: search
    depends_on: [review]
    condition: "review.verdict == approved"
    action: "Run the complete verification set selected by impact and risk."
    mode: read_only
    loop_iterations: 0
    on_failure: stop
```

## 3. Bug fix

```yaml
pipeline_id: bug_fix
steps:
  - step_id: diagnose
    agent: code-agent
    capability: search
    action: "Reproduce or establish evidence, trace the failure, and identify root cause and similar risks."
    mode: read_only
    loop_iterations: 0
    on_failure: stop
    checkpoint: after

  - step_id: regression_baseline
    agent: test-agent
    capability: code_gen
    depends_on: [diagnose]
    action: "Create the smallest deterministic failing regression test when technically feasible."
    loop_iterations: 2
    on_failure: stop
    checkpoint: after

  - step_id: fix
    agent: code-agent
    capability: code_gen
    depends_on: [regression_baseline]
    action: "Fix the verified root cause without unrelated refactoring."
    loop_iterations: 3
    on_failure: stop
    checkpoint: after

  - step_id: regression_verify
    agent: test-agent
    capability: search
    depends_on: [fix]
    action: "Run the regression test, affected-package tests, and required static checks."
    mode: read_only
    loop_iterations: 0
    on_failure: stop

  - step_id: review
    agent: review-agent
    capability: [search, summarize, security_scan]
    depends_on: [regression_verify]
    action: "Confirm root-cause coverage, absence of bypasses, regression protection, and security impact."
    mode: read_only
    loop_iterations: 0
    on_changes_requested: fix
    remediation_cycles: 2
    on_failure: stop
```

If a deterministic regression test is impossible, `regression_baseline` must produce a reproducible manual verification artifact approved by the reviewer. It may not silently warn and continue.

## 4. Refactoring

```yaml
pipeline_id: refactor
steps:
  - step_id: baseline
    agent: test-agent
    capability: search
    action: "Capture behavior invariants and a passing focused baseline."
    mode: read_only
    loop_iterations: 0
    on_failure: stop
  - step_id: refactor
    agent: code-agent
    capability: code_gen
    depends_on: [baseline]
    action: "Apply one approved structural transformation without changing observable behavior."
    loop_iterations: 3
    on_failure: stop
  - step_id: verify
    agent: test-agent
    capability: search
    depends_on: [refactor]
    action: "Re-run baseline and affected-package checks; compare public API and generated artifacts."
    mode: read_only
    loop_iterations: 0
    on_failure: stop
  - step_id: review
    agent: review-agent
    capability: [search, summarize]
    depends_on: [verify]
    action: "Confirm behavior preservation and absence of unapproved scope expansion."
    mode: read_only
    loop_iterations: 0
    on_changes_requested: refactor
    remediation_cycles: 2
    on_failure: stop
```

## 5. Test-only work

```yaml
pipeline_id: test_only
steps:
  - step_id: discover
    agent: test-agent
    capability: search
    mode: read_only
    action: "Identify changed behavior, existing test conventions, and the smallest useful test matrix."
    loop_iterations: 0
    on_failure: stop
  - step_id: write_tests
    agent: test-agent
    capability: code_gen
    depends_on: [discover]
    loop_iterations: 3
    on_failure: stop
  - step_id: review
    agent: review-agent
    capability: [search, summarize]
    depends_on: [write_tests]
    mode: read_only
    loop_iterations: 0
    on_failure: stop
```

## 6. Explanation and documentation

```yaml
pipeline_id: explain_or_document
steps:
  - step_id: inspect
    agent: review-agent
    capability: search
    mode: read_only
    loop_iterations: 0
    on_failure: stop
  - step_id: synthesize
    agent: doc-agent
    capability: [summarize, code_gen]
    depends_on: [inspect]
    action: "Produce evidence-linked explanation or documentation at the requested level."
    mode: "read_only for explanation; scoped write for a requested documentation artifact"
    loop_iterations: 2
    on_failure: stop
```

## 7. DevOps and infrastructure

```yaml
pipeline_id: devops_infra
steps:
  - step_id: discover
    agent: devops-agent
    capability: search
    mode: read_only
    loop_iterations: 0
    on_failure: stop
  - step_id: generate
    agent: devops-agent
    capability: code_gen
    depends_on: [discover]
    action: "Generate scoped infrastructure or delivery configuration and rollback instructions."
    loop_iterations: 3
    on_failure: stop
  - step_id: validate.parallel
    depends_on: [generate]
    parallel:
      - step_id: architecture_review
        agent: review-agent
        capability: [search, summarize]
        mode: read_only
        on_failure: stop
      - step_id: security_validate
        agent: devops-agent
        capability: [search, security_scan]
        mode: read_only
        on_failure: stop
    sync_at: approval
  - step_id: approval
    type: human_gate
    condition: "safety_gate_required == true"
  - step_id: apply
    agent: devops-agent
    capability: code_gen
    depends_on: [approval]
    condition: "apply_requested == true and (safety_gate_required == false or approval.granted == true)"
    loop_iterations: 0
    on_failure: stop
  - step_id: post_apply_verify
    agent: devops-agent
    capability: search
    depends_on: [apply]
    condition: "apply.executed == true"
    mode: read_only
    loop_iterations: 0
    on_failure: stop
```

## 8. Pull-request review

```yaml
pipeline_id: pr_review
steps:
  - step_id: classify
    agent: code-agent
    capability: search
    mode: read_only
    action: "Resolve the exact diff, base SHA, changed modules, generated files, and infrastructure impact."
    loop_iterations: 0
    on_failure: stop
  - step_id: review.parallel
    depends_on: [classify]
    parallel_strategy: "shard by non-overlapping module; limit concurrency through safety.md"
    workers:
      - agent: review-agent
        capability: [search, summarize, security_scan]
        condition: "source_changes == true"
      - agent: devops-agent
        capability: [search, summarize, security_scan]
        condition: "infrastructure_changes == true"
      - agent: test-agent
        capability: search
        condition: "test_impact_analysis_required == true"
    sync_at: synthesize
  - step_id: synthesize
    agent: doc-agent
    capability: summarize
    action: "Deduplicate evidence-linked findings and produce a prioritized verdict."
    mode: read_only
    loop_iterations: 0
    on_failure: stop
```

## 9. Routing

Route by requested outcome and primary artifact:

| Intent | Pipeline |
|---|---|
| Add or change product behavior | `feature_development` |
| Diagnose and fix incorrect behavior | `bug_fix` |
| Preserve behavior while changing structure | `refactor` |
| Add, repair, or improve tests only | `test_only` |
| Explain code or create documentation without implementation | `explain_or_document` |
| Change build, deployment, container, IaC, or operational configuration | `devops_infra` |
| Review an existing diff or PR without implementing fixes | `pr_review` |

When a request spans several outcomes, select the pipeline that owns the primary mutation and add conditional supporting steps. Split into separate tasks when write boundaries, risk, or approvals differ materially.

## 10. Large-repository rules

- Discovery produces a module dependency graph and verification profile before mutation.
- Shard only independent packages or services and cap concurrency using actual repository capacity.
- Exchange artifact references and deltas, not complete shared context.
- Full-repository tests are not automatic for every step; run them when impact analysis, merge policy, or risk requires them.
- A pipeline completes only after all required branches synchronize and hashes still match.
