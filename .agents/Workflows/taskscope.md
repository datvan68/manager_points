---
description: Proportional runtime scope and routing for persisted taskscopes.
version: 3.4.2
managed_by: orchestrator
---

# Taskscope

For ordinary implementation keep one runtime brief: objective, observed
evidence, exact write boundaries and preserved contracts, acceptance criteria,
ordered edits, required checks and concrete stops. Do not create a file or
duplicate the brief in chat unless requested.

Quick actionable prose targets 220 words, roughly 350 maximum. Full adds only
evidenced dependencies, risks, gates or independently checkable work units.
Do not omit required evidence to satisfy a word target. Every meaningful write
must serve an acceptance criterion and have a feasible verification signal;
formal E/AC/V numbering is optional for an ordinary runtime brief.

Resolve the target, current behavior, nearest relevant pattern and exact check
before editing. Keep product decisions, safety gates and boundary changes
distinct from routine implementation choices. A Quick-to-Full promotion within
authorized boundaries updates the brief and continues without a new approval.
Use `safety.md` for eligibility/gates and `global.md` for ownership and cleanup.

For runtime verification, record dev target identities and isolation evidence,
scoped resources/operations, scenarios/pass signals, and cleanup or restoration
in runtime. Verify unknown connection facts before dependent runtime actions.
Reuse unchanged dev evidence under `safety.md` section 6a. Existing explicit
runtime-data exclusions remain binding.

## Persisted taskscopes only

Read [taskscope-persisted.md](taskscope-persisted.md) only when creating or
updating a requested taskscope, validating/executing an exact pinned scope, or
resolving ambiguous legacy reservation metadata. It owns the slot allocation,
persisted schema, readiness and lifecycle details referenced by this workflow.

Ordinary implementation checks active reservations through `global.md` without
loading the persisted template. Allocation never selects what to execute.
Planning-only stops after the requested deliverable; pinned execution follows
the exact-file contract in `global.md`.
