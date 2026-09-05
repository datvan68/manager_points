---
description: Deterministic execution with bounded context and evidence.
version: 3.4.1
---

# Orchestrator

The default executor performs this sequence directly. Full adds only the
dependency, risk, review, or resume controls actually needed; it does not
automatically add workers.

## Execute in order

1. **Select.** Classify read-only, planning-only, or implementation; choose the
   pipeline/primary skill from `pipeline.md`. For persisted execution, validate
   the exact user pin using `global.md` before implementation discovery.
2. **Baseline.** Inspect branch, HEAD, Git status, applicable local instructions,
   and active scope reservations. Record them in runtime; use persisted
   lifecycle metadata when executing a pinned scope.
3. **Locate.** Inspect the target, one nearest matching implementation/test,
   and the configured verification script. Use `PROJECT_MAP.md` if the owner is
   unknown. Follow only dependencies needed to resolve a named evidence gap.
4. **Scope.** Select Quick only if all `safety.md` conditions pass; otherwise
   Full. Establish the taskscope contract. For explicit scope creation use its
   allocation algorithm. Stop here for planning-only; read-only work reports
   evidence without entering mutation steps.
5. **Edit.** Recheck reservations and owned changes immediately before each
   write batch. Read the exact code being changed. Apply one execution step,
   preserving its named contracts. Reuse the nearest matching pattern; inspect
   its inputs and error handling before copying it.
6. **Verify.** Run the step's narrow check at a meaningful boundary, then the
   required affected-package checks after dependent steps finish. For runtime
   criteria, verify dev targets once under `safety.md` section 6a, then interact
   through the UI/API with scoped data without repeated approval. Restore/clean
   test changes and record actual scenarios. If failure occurs, capture the first
   actionable error and actual/expected behavior; repair within scope/budget.
7. **Finish.** Check each AC against its evidence and review the final diff/status
   for unintended writes. Complete cleanup and, for an executed persisted scope,
   its completion block. Report outcome, changed paths, checks, and blockers.

## Work units for less capable models

Keep only the current step's target, relevant existing example, required change,
preserved contract, and pass signal in working context. A step should produce
one reviewable behavior; keep coupled edits together when partial changes would
break a contract. Complete dependency steps in order.

Do not invent a symbol, library API, script, response shape, permission, or
business rule. Resolve a missing fact with one targeted read. If an initial
search misses, try the direct caller/owner once; broaden only with a named gap.
A 120-second Quick discovery target is soft: incomplete evidence promotes to
Full, never to guessing.

Once the scope is actionable, start. Do not generate several competing designs
unless an observed constraint requires a choice. Stop analysis of a root cause
once a reproduction or equivalent evidence confirms it.

## Context and resume

A current pinned taskscope is the handoff: verify identity, status, baseline,
targets, and reservations, then execute its steps. Do not rediscover the module
or regenerate the plan. If rules changed, read only the changed applicable
sources and revalidate affected constraints; do not rewrite another scope.

For a long interruption keep only completed step IDs, actual checks, changed
paths, next step, and blocker in the owned scope/runtime. Use hashes/checkpoints
only at material synchronization or resume points under `safety.md`.
Do not restart budgets after a handoff.

When delegation is explicitly used, follow the capsule in `global.md`. Never
send full chat history, all rules, or unrelated source. A required independent
review cannot be replaced by claiming self-review was independent.

On a boundary/gate/conflict, stop dependent mutation and report exact evidence.
A routine profile promotion or technical choice already authorized by the user
does not itself require a new approval.
