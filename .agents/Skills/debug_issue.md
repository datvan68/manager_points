# Skill: Debug Issue

> Use for evidence-based diagnosis in a `bug_fix` pipeline. Do not use for a
> general explanation, code review, or an unconfirmed implementation request.

## Metadata

```yaml
skill_id: debug_issue
version: 3.0.0
protocol_version: "3.3"
supported_agents: [code-agent, review-agent]
capabilities: [search]
default_mode: read_only
```

## Required context

- Observable failure, environment, frequency, and affected version or commit.
- Exact approved inspection boundary and any suspected path or symbol.
- Focused, redacted evidence references and known reproduction facts.
- Whether the task ends at diagnosis or explicitly includes a fix.

Request only the smallest missing evidence that can change the diagnosis. Do
not require full logs when a focused slice proves the relevant state transition.

## Outcome

Return the common `global.md` result envelope plus:

```yaml
diagnosis_status: root_cause_confirmed | probable_cause | more_evidence_required | not_reproduced
root_cause:
  path: repository-relative path or null
  symbol: stable symbol or null
  mechanism: earliest evidenced incorrect state or null
  confidence: high | medium | low
  evidence_refs: []
fix_boundary: []
regression_check:
  level: unit | integration | contract | e2e | manual
  observable_failure: exact pre-fix failure
next_action: regression_baseline | request_evidence | null
```

Use `root_cause_confirmed` only when a reproduction or converging independent
evidence links the mechanism to the failure. A crash location alone is not a
root cause.

## Method

1. Separate observed facts, user hypotheses, agent hypotheses, and unknowns.
2. Reproduce with the least expensive reliable option: a focused failing test,
   minimal local reproduction, deterministic trace/log correlation, or a
   last-known-good comparison.
3. Trace progressively from the failing symbol to direct callers or data
   producers, then to the owning module. Stop at the earliest incorrect state.
4. When multiple causes remain plausible, test only the checks that distinguish
   them. Record each hypothesis, expected observation, actual observation, and
   verdict; do not edit speculatively.
5. Define the smallest behavior change, preserved contracts, and a regression
   check that exercises the confirmed mechanism rather than only the symptom.
6. If implementation is authorized, hand the confirmed boundary to the fix
   step. Diagnosis itself remains read-only.

## Accuracy and safety

- Inspect validation, serialization, nullability, units/time zones, async
  ordering, retries/idempotency, transactions, cache state, and external
  partial failures only when they lie on the evidenced execution path.
- Require profiles, query plans, traces, or measurements for performance claims.
- Keep production diagnosis read-only; never mutate persistent data to reproduce
  a failure without the required Human Gate.
- Never swallow errors, weaken assertions, delete failing tests, or combine an
  unrelated refactor with the fix.
- If evidence remains insufficient, report the exact discriminating check; do
  not promote a probable cause to a confirmed one.
