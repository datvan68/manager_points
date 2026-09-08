# Skill: Implement Feature

> Use for approved new or changed behavior in a `feature_development` pipeline,
> or scoped infrastructure work routed here by `pipeline.md`.
> Use `debug_issue` for root-cause diagnosis and `refactor_code` when observable
> behavior must not change.

## Metadata

```yaml
skill_id: implement_feature
version: 3.4.2
protocol_version: "3.3"
supported_agents: [code-agent]
capabilities: [search, code_gen]
required_pipeline: feature_development
```

## Required context

- Observable objective and binary acceptance-criterion IDs.
- Current base/worktree state and exact approved/write/excluded boundaries.
- Nearest representative implementation, contract, test, and verification
  command discovered by the orchestrator.
- Explicit values for public API, schema, dependency, migration, persistent-data,
  authorization, and environment impact when applicable.

Stop before mutation if a missing product decision changes behavior, permissions,
data, public contracts, or external effects.

## Invariants

1. Acceptance criteria are authoritative; examples clarify but do not expand
   them.
2. Existing architecture, validation, error handling, naming, generated-file,
   and test conventions remain authoritative unless explicitly scoped otherwise.
3. Every write maps to a criterion and remains inside its write boundary.
4. Public contracts, persistence, dependencies, configuration, and operational
   behavior remain unchanged unless the taskscope explicitly authorizes them.

## Execution

1. Confirm the named target and base state are current. Inspect only the nearest
   implementation, direct caller or dependency, interface, and test needed to
   execute the scope.
2. Map each intended write and meaningful error/permission state to an
   acceptance criterion. Edit a generator instead of generated output.
3. Implement the smallest cohesive change. Reuse established abstractions and
   preserve backward compatibility, authorization, validation, transaction,
   idempotency, logging, and personal-data handling.
4. Add or update focused tests when they provide meaningful regression
   protection for the changed behavior; use `pipeline.md` for proportional
   verification of low-impact edits. Load `write_test` only
   when tests form an independent step or risk boundary.
5. Run the checks selected under `pipeline.md`; reuse still-valid results.
   Expand verification only for evidenced impact, failure, policy or risk.
6. Repair only a concrete in-scope failure. Never weaken a test or expand the
   criteria to obtain a pass.
7. Review the final diff against every criterion, boundary, and preserved
   contract; remove task-generated temporary Markdown artifacts before success.

## Stop conditions

Apply `safety.md` gates and `global.md` boundaries. Stop dependent work only
when a required authorization or scope amendment is missing; identify the exact
action and affected boundary. Already authorized changes need no repeated gate.

An additional Quick write path alone requires profile reassessment, not a
permission request. Promote to Full and continue if authorized boundaries and
behavior remain valid; amend an owned persisted scope when applicable.

Bounded dev verification authorized by `safety.md` section 6a is not an
unapproved persistent-data mutation and needs no repeated gate. Add its runtime
boundary when needed; preserve explicit exclusions in the pinned taskscope.

## Result

Follow `global.md`: report the outcome, changed paths, actual verification and
remaining blockers/risks in concise prose. Mention public-contract, dependency
or migration changes when present. Structured fields and empty lists are needed
only for a machine-consumed handoff. Never claim a check that did not run.
