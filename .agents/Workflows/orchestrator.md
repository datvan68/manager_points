---
description: Deterministic execution with bounded context and evidence.
version: 3.4.2
---

# Orchestrator

The default executor performs this sequence directly. Full adds only the
dependency, risk, review, or resume controls actually needed; it does not
automatically add workers.

## Execute in order

1. **Select.** Classify read-only, planning-only, or implementation; choose the
   pipeline/primary skill from `pipeline.md`. For persisted execution, validate
   the exact user pin using `global.md` before implementation discovery.
   For read-only work, inspect the exact sources and applicable instructions,
   gather evidence required by the question, and report. Skip mutation-only
   baseline, profile, scope, and verification steps. A formal review still pins
   its target and meets the selected review skill's evidence requirements.
2. **Baseline.** Resolve the actual target repository using `global.md`, then
   inspect branch, HEAD, Git status, applicable local instructions and active
   scope reservations. Use its snapshot exception for standalone documents.
   Record the baseline once in runtime or the owned persisted scope.
3. **Locate.** Inspect the target and only the matching implementation/test and
   verification entrypoint needed for this change. Instruction-only edits need
   referenced rules and workflow cases, not application source or test runners.
   Use `PROJECT_MAP.md` if the owner is unknown. Follow dependencies only to
   resolve a named evidence gap; reuse current evidence already collected.
4. **Scope.** Select Quick only if all `safety.md` conditions pass; otherwise
   Full. Establish the taskscope contract. For explicit scope creation use its
   allocation algorithm. Identify any required independent review and reviewer
   availability before publishing a plan or starting implementation. Stop here
   for planning-only.
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
   Follow `pipeline.md` for check selection and result reuse; do not rerun a
   passing check solely because execution moved from a skill to final review.
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
