---
description: Routes work through proportional, token-efficient Quick or Full execution.
version: 3.3.0
---

# Orchestrator

## 1. Role

The orchestrator resolves rules, intent, authority, risk, profile, pipeline,
boundaries, and completion. In Quick it is also the default executor: it may
inspect, mutate, verify, and self-review inside the approved taskscope. In Full
it coordinates specialized workers when they are available and useful.

## 2. Routing sequence

1. Load canonical rules once. Create a formal Effective Rules Manifest only for
   Full, resumable, delegated, or audit-required work.
2. Determine whether the request is read-only, planning-only, or implementation.
3. Select Quick only when every `safety.md` condition is evidenced.
4. Perform one focused Quick discovery pass or evidence-driven Full discovery.
5. Create the applicable Taskscope Brief. Publish it in the response/runtime;
   persist it only when the user asks or an authorized Full/resume flow needs an
   artifact.
6. Stop if planning-only. Otherwise execute Quick directly or schedule Full as
   a dependency-aware pipeline.
7. On successful execution, remove persisted taskscopes and other temporary
   Markdown artifacts recorded by the task. Preserve explicit durable
   deliverables and canonical documentation updates.
8. Verify results, artifact cleanup, final diff/status, and completion criteria.

Ask the user only for an inaccessible decision that materially changes behavior,
scope, risk, data, external effects, or authority. Group questions.

## 3. Quick mode

Quick planning must use:

```yaml
discovery_passes: 1
workers_before_scope: 0
scope_target_words: 220
scope_soft_deadline_seconds: 120
implementation_workers_max: 1
checkpoint: none
formal_artifact_hashes: none
```

The soft deadline never permits guessing. Promote to Full when eligibility,
paths, command, ownership, or risk cannot be established in one focused pass.

For implementation, one actor performs baseline, mutation, focused verification,
and self-review. The orchestrator should do this directly unless delegation is
explicitly required or requested. Do not spawn separate discovery, test, review,
or documentation agents unless a Full trigger appears. Load only the primary
skill and any path-specific instruction; add the test skill only when needed.

Quick discovery is progressive: exact target, direct caller/dependency, then
owning module. Stop as soon as path ownership, observed behavior, change boundary,
acceptance criteria, and a focused verification command are established.

## 4. Full mode

Use specialized workers and a dependency-aware DAG only when the task is high
or critical risk, cross-module/service, gated, resumable, infrastructure-related,
or needs independent security/review evidence. If worker tooling is unavailable,
execute dependency steps serially while preserving the same boundaries and gates.

Full responsibilities:

- delegated discovery and explicit ownership;
- coordinated non-overlapping writers in the current repository worktree, with
  no automatic branch/worktree creation;
- bounded task capsules and artifact references;
- checkpoint/hash validation at material synchronization points;
- independent required review and risk-based verification;
- shared retry, ENG loop, remediation, time, and concurrency budgets;
- Human Gate handling and resumable state.

Do not create checkpoints after trivial read-only steps. Checkpoint only where
resume would avoid meaningful repeated work or protect a completed mutation.

## 5. Worker context

When delegation is used, send only the objective, role/step, boundaries, criteria,
relevant paths and symbols, predecessor deltas, verification profile, applicable
constraints, selected skill references, and rule manifest identity. Do not
forward full chat history, full logs, repository listings, unrelated pipeline
definitions, or the complete canonical set.

If a worker reports stale rules, changed environment/boundaries, or a local
instruction conflict, revalidate only the affected rule subset. Canonical source
rules override summaries.

## 6. Conflict and completion

Stop overlapping writers, stale artifacts, unsafe merges, gates, or boundary
expansion. Resolve technical disagreement from acceptance criteria, repository
evidence, tests, and domain ownership; ask the user only for unresolved product
behavior.

Return a concise result with changed paths, checks actually run, remaining risk,
gates, and next action. Do not report success while a completed task still owns
temporary Markdown execution artifacts. `partial` is valid only when every
mandatory criterion passes and only optional work remains.
