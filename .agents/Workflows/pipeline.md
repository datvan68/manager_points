---
description: Defines the standard pipelines for each common task type in the Software Development / DevOps project. The orchestrator maps a task to the appropriate pipeline and executes it according to the declared order / parallel structure.
---

# Pipeline — Concrete Processing Flows

---

## Metadata

```yaml
version: 2.0.0
managed_by: orchestrator
trigger: orchestrator receives a task and maps it to the appropriate pipeline
max_pipeline_duration: 10m
checkpointing: enabled
checkpoint_store: redis
resume_from_last_success: true
```

---

## Syntax Conventions

```yaml
# Sequential: step runs after the previous step completes
- step: N
  agent: agent-id

# Parallel: all items in parallel[] run concurrently
- step: N
  parallel:
    - agent: agent-a
      skill: skill_a
      action: "..."
    - agent: agent-b
      skill: skill_b
      action: "..."
  sync_at: step_N+1   # wait for all branches to finish before continuing

# Conditional: only runs if the condition is true
- step: N
  agent: agent-id
  condition: "condition expression"

# Human gate
- step: N
  type: human_gate
  condition: "triggering expression"
  message: "Confirmation request content"

# Override the ENG Loop iteration count for a specific step (default 3, see global.md §8)
- step: N
  agent: agent-id
  skill: skill_id
  loop_iterations: 5        # high-risk step / needs heavy refinement (e.g. fixing a complex bug)
  # or
  loop_iterations: 0        # disables the loop; step is read/analysis only, nothing to refine
```

> **ENG Loop in the pipeline:** each step executed by a sub-agent internally runs `PLAN → EXECUTE → VERIFY → REFINE` (up to `loop_iterations`, default 3) before returning its result to the orchestrator — see `global.md §8`. A step's `on_failure` only triggers **after** the internal loop is exhausted, not per individual iteration. A step of `type: human_gate` or with a `gate:` always sits **outside** the loop — a sub-agent may not iterate on its own to bypass a gate.

---

## Pipeline 1: Feature Development

**When to use:** Developing a new feature from a requirement

```
┌─────────────┐     ┌──────────────────────────┐     ┌─────────────┐     ┌─────────────┐
│  code-agent │────▶│  PARALLEL:                │────▶│review-agent │────▶│  doc-agent  │
│ generate    │     │  test-agent (unit tests)  │     │ review +    │     │  update     │
│ code        │     │  doc-agent  (draft docs)  │     │ security    │     │ documentation│
└─────────────┘     └──────────────────────────┘     └─────────────┘     └─────────────┘
```

```yaml
pipeline_id: feature_development
steps:
  - step: 1
    agent: code-agent
    skill: code_gen
    action: "Generate code according to the requirement"
    input_from: user
    output_to: step_2
    on_failure: stop
    checkpoint: after

  - step: 2
    parallel:
      - agent: test-agent
        skill: code_gen (mode=test)
        action: "Write unit tests for the code just generated"
        input_from: step_1
        on_failure: retry_once
      - agent: doc-agent
        skill: summarize (mode=draft)
        action: "Create a draft docstring and README section"
        input_from: step_1
        on_failure: warn_only
    sync_at: step_3
    checkpoint: after

  - step: 3
    agent: review-agent
    skill: search + summarize + security_scan
    action: "Review code quality, security, performance; check test coverage"
    input_from: step_1, step_2
    output_to: step_4
    on_failure: stop
    gate: "review-agent must approve before continuing"
    checkpoint: after

  - step: 4
    agent: doc-agent
    skill: code_gen (mode=document)
    action: "Finalize README, docstring, changelog based on the draft (step_2) and the review result (step_3)"
    input_from: step_2, step_3
    output_to: orchestrator
    on_failure: warn_only
    notify_on_failure:
      type: warn
      message: "doc-agent không hoàn thiện được tài liệu, tiếp tục mà không có changelog."
      notify: [user]
      log_level: warn
```

---

## Pipeline 2: Bug Fix

**When to use:** Fixing a bug from a bug report or log

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  code-agent │────▶│  code-agent │────▶│  test-agent │────▶│review-agent │
│ analyze root│     │  fix bug    │     │ regression  │     │ confirm fix │
│ cause       │     │             │     │ test        │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

```yaml
pipeline_id: bug_fix
steps:
  - step: 1
    agent: code-agent          # ✅ code-agent is responsible for analysis, not the orchestrator
    skill: search
    action: "Analyze the log/error message, determine the root cause"
    input_from: user
    output_to: step_2
    on_failure: stop
    loop_iterations: 0        # step is analysis/read-only, nothing to self-refine
    checkpoint: after

  - step: 2
    agent: code-agent
    skill: code_gen (mode=fix)
    action: "Fix the bug based on the root cause from step_1"
    input_from: step_1
    output_to: step_3
    on_failure: stop
    loop_iterations: 5        # gives code-agent more room to self-refine the fix before escalating — bug fixes typically need more attempts than the default
    checkpoint: after

  - step: 3
    agent: test-agent
    skill: code_gen (mode=test)
    action: "Write a regression test to ensure the bug does not reoccur"
    input_from: step_2
    output_to: step_4
    on_failure: warn_only
    notify_on_failure:
      type: warn
      message: "test-agent không tạo được regression test."
      notify: [user]
      log_level: warn
    checkpoint: after

  - step: 4
    agent: review-agent
    skill: summarize + security_scan
    action: "Confirm the fix addresses the correct root cause, introduces no new bugs, and has no security regression"
    input_from: step_2, step_3
    output_to: orchestrator
    on_failure: stop
    gate: must_approve
```

---

## Pipeline 3: DevOps / Infrastructure

**When to use:** Creating/updating a Dockerfile, k8s manifest, CI/CD pipeline, Terraform

```
┌──────────────┐     ┌──────────────────────────────┐     ┌──────────────────┐
│ devops-agent │────▶│  PARALLEL:                    │────▶│ Human Approval   │
│ generate     │     │  review-agent (code quality)  │     │ (if production)  │
│ infra code   │     │  devops-agent (security IaC)  │     │                  │
└──────────────┘     └──────────────────────────────┘     └──────────────────┘
```

```yaml
pipeline_id: devops_infra
steps:
  - step: 1
    agent: devops-agent
    skill: code_gen (mode=infra)
    action: "Generate infrastructure code per the requirement (Dockerfile, k8s manifest, Terraform, CI/CD config)"
    input_from: user
    output_to: step_2
    on_failure: stop
    checkpoint: after

  - step: 2
    parallel:
      - agent: review-agent
        skill: search + summarize
        action: "Review code quality, best practices, IaC structure"
        input_from: step_1
        on_failure: stop
      - agent: devops-agent
        skill: security_scan
        action: "Scan for security issues: exposed secrets, overprivileged roles, insecure defaults in IaC"
        input_from: step_1
        on_failure: stop
    sync_at: step_3
    gate: "Both branches must approve before continuing"
    checkpoint: after

  - step: 3
    type: human_gate
    condition: "environment == production"
    message: "⚠️ Thay đổi infrastructure ảnh hưởng production. Vui lòng review artifact và xác nhận trước khi apply."
    output_to: orchestrator
```

---

## Pipeline 4: Code Review (PR Review)

**When to use:** Automatically reviewing a pull request

```
┌─────────────┐     ┌──────────────────────────────────┐     ┌─────────────┐
│ code-agent  │────▶│  PARALLEL:                        │────▶│  doc-agent  │
│ get git diff│     │  review-agent (logic/security)    │     │ synthesize  │
│             │     │  devops-agent (if infra files)    │     │ action items│
└─────────────┘     └──────────────────────────────────┘     └─────────────┘
```

```yaml
pipeline_id: pr_review
steps:
  - step: 1
    agent: code-agent
    skill: search (mode=code_search)
    action: "Fetch the PR's git diff, classify changed files (source code vs infra files)"
    input_from: user (PR link)
    output_to: step_2
    on_failure: stop
    checkpoint: after

  - step: 2
    parallel:
      - agent: review-agent
        skill: search + summarize + security_scan
        action: "Detect bugs, security issues, code smells, missing tests in source code changes"
        input_from: step_1
        on_failure: stop
      - agent: devops-agent
        skill: search + summarize + security_scan
        action: "Review IaC changes if the PR contains a Dockerfile, k8s, Terraform, or CI/CD config"
        input_from: step_1
        condition: "pr_contains_infra_files == true"
        on_failure: stop
    sync_at: step_3
    checkpoint: after

  - step: 3
    agent: doc-agent
    skill: summarize (mode=action_items)
    action: "Synthesize all comments from review-agent and devops-agent into a prioritized action items list"
    input_from: step_2
    output_to: orchestrator
    on_failure: warn_only
    notify_on_failure:
      type: warn
      message: "doc-agent không tổng hợp được action items."
      notify: [user]
      log_level: warn
```

---

## General Rules for All Pipelines

```
1. Every sub-agent receives full shared_context from the orchestrator (see orchestrator.md)
2. Every step must return output matching the orchestrator's schema
3. If a step fails and on_failure=stop → save a checkpoint, the entire pipeline stops
4. Gate steps: downstream agents do not run until the gate is approved
5. Maximum duration per pipeline: 10 minutes
6. Checkpoints are saved after every successful step — the pipeline can resume from the next step
7. Log every step, including successful ones, with duration_ms
8. The orchestrator notifies the user when a pipeline completes, is interrupted, or needs approval
9. on_failure=warn_only must include a notify_on_failure schema — silent warnings are not allowed
10. The orchestrator does NOT execute any skill in any pipeline
11. Each step may internally iterate per the ENG Loop (global.md §8, default 3 iterations, overridable via loop_iterations); on_failure only applies after the internal loop is exhausted — not per iteration
12. A step of type: human_gate or with a gate: always stands outside the ENG Loop — no sub-agent may self-iterate to bypass a gate
```

---

## Task → Pipeline Mapping

| Keyword in task | Pipeline |
|---|---|
| "thêm tính năng", "implement", "viết code mới", "feature" | `feature_development` |
| "sửa lỗi", "fix bug", "lỗi", "crash", "error", "phân tích log" | `bug_fix` |
| "dockerfile", "k8s", "deploy", "terraform", "ci/cd", "infra" | `devops_infra` |
| "review PR", "kiểm tra code", "pull request", "git diff" | `pr_review` |
