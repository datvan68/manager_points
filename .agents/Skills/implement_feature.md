# Skill: Implement Feature

> Use for approved new or changed behavior in a `feature_development` pipeline.
> Use `debug_issue` for root-cause diagnosis and `refactor_code` when observable
> behavior must not change.

## Metadata

```yaml
skill_id: implement_feature
version: 3.0.0
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
4. Add or update focused tests when behavior changes. Load `write_test` only
   when tests form an independent step or risk boundary.
5. Verify in the narrowest useful order: changed test, affected static check,
   affected build/integration check, then broader checks only when policy or
   risk requires them.
6. Repair only a concrete in-scope failure. Never weaken a test or expand the
   criteria to obtain a pass.
7. Review the final diff against every criterion, boundary, and preserved
   contract; remove task-generated temporary Markdown artifacts before success.

## Stop conditions

Stop and return the exact scope amendment or gate when the implementation
requires an unapproved module, fourth meaningful Quick write path, public or
schema change, dependency, migration, persistent-data mutation, infrastructure
effect, external communication, credential/permission change, or production
action.

## Result

Return the common `global.md` envelope with changed/created/deleted paths,
criterion-mapped verification, and explicit lists for public-contract,
dependency, and migration changes. Use empty lists rather than omitting these
change classes. Never embed complete files or claim a check that did not run.
