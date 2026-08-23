---
description: Compact, evidence-based scope template for implementation tasks.
version: 3.3.0
managed_by: orchestrator
---

# Taskscope Brief

A taskscope must contain enough detail for an agent to implement and verify the
change without repeating discovery, but it must not become a design document.
Keep a Quick scope within roughly 350 words. A Full scope should be longer only
when real boundaries, dependencies, or gates require it.

## Required template

```yaml
task: "Short action-oriented name"
pipeline: bug_fix | feature_development | refactor | test_only | explain_or_document | devops_infra | pr_review
profile: Quick | Full
objective: "One observable or measurable outcome"

evidence:
  current_behavior: "Observed behavior, not a hypothesis"
  expected_behavior: "Behavior that must be produced"
  root_cause: "Path + symbol + failure mechanism; null if not yet confirmed"

scope:
  inspect: ["path/symbol that must be read"]
  write: ["path expected to change"]
  preserve: ["behavior or contract that must remain unchanged"]
  out: ["adjacent work that is explicitly outside this task"]

acceptance_criteria:
  - "AC-01: Given/When/Then or another binary pass/fail statement"

execution:
  - "Small change step mapped to an AC and path"

verification:
  - "Exact repository-native command → AC proven by this command"

risks: [] # Add only evidence-backed risks.
stop_conditions: ["Specific boundary, gate, or decision that requires a stop"]
```

## Pipeline-specific requirements

- **Bug fix:** require a reproduction or equivalent evidence, the root cause,
  preserved behavior, and a regression check. Do not patch a symptom while the
  cause remains unknown.
- **Feature:** define inputs, outputs, relevant error/permission states, and
  whether any contract changes. Map each AC to code plus a test or manual check.
- **Refactor:** record the baseline and invariants. Any behavioral change is out
  of scope.
- **Review:** pin the diff or file set. Produce evidence-backed findings, not a
  patch.
- **Docs/explanation:** define the audience, question, and code sources. Default
  to read-only behavior.

## Anti-overthinking rule

Do not add architecture discussion, alternatives, edge cases, a test matrix, or
a rollout plan unless they affect an acceptance criterion or evidenced risk. If
a path or root cause is unknown, add one targeted discovery step rather than
guessing. Start execution as soon as the objective, boundary, acceptance
criteria, and feasible verification are established.
