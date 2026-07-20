# Skill: Refactor Code

> Improve internal structure while preserving observable behavior, public contracts, and approved operational characteristics.

## Metadata

```yaml
skill_id: refactor_code
version: 2.0.0
supported_agents: [code-agent]
capabilities: [search, code_gen]
supported_stacks: repository_defined
required_pipeline: refactor
```

## Preconditions

- A stable base commit and isolated write boundary exist.
- Observable invariants and relevant public contracts are documented.
- Focused baseline verification passes, or pre-existing failures are captured and do not invalidate the invariant.
- The scope separates refactoring from bug fixes and feature changes.

If characterization tests are missing, the test step creates the smallest useful baseline before refactoring.

## Input

```json
{
  "protocol_version": "3.0",
  "task_id": "uuid-v4",
  "pipeline_id": "refactor",
  "step_id": "refactor",
  "refactor_type": "extract | rename | simplify | deduplicate | move | improve_types | standardize_error_handling | dependency_boundary | other",
  "targets": [
    {"path": "packages/api/src/orders/service.ts", "symbol": "processOrder", "code_smell": "..."}
  ],
  "behavior_invariants": ["INV-001"],
  "public_contracts": [],
  "scope": {
    "approved_boundaries": ["packages/api/src/orders/**"],
    "write_boundaries": ["packages/api/src/orders/**"]
  },
  "context_refs": [
    {"type": "baseline", "uri": "output/tasks/<task_id>/baseline.json", "sha256": "..."}
  ]
}
```

## Output

Return the common result envelope with:

```json
{
  "summary": "Internal structure improved with observable behavior preserved.",
  "changed_paths": [],
  "before_after": [],
  "behavior_invariants": [
    {"id": "INV-001", "status": "passed", "evidence_ref": {"uri": "...", "sha256": "..."}}
  ],
  "public_contract_changed": false,
  "performance_characteristic_changed": false,
  "bugs_discovered": [],
  "artifact_refs": []
}
```

Record discovered bugs separately. Do not fix them within this pipeline unless the user approves a new bug-fix scope.

## Workflow

### 1. Baseline

- Pin the base commit and current public surface.
- Run focused tests and capture results, snapshots/contracts, generated artifacts, and performance budgets relevant to the target.
- Identify callers and consumers using the dependency graph, not repository-wide guesswork.

### 2. Transform

- Apply one coherent structural transformation at a time.
- Preserve public names, behavior, side effects, error semantics, ordering, concurrency, serialization, and persistence contracts unless scope explicitly permits change.
- Follow existing repository conventions; do not force universal rules such as a specific file size, layer pattern, dependency injection framework, or error model.
- Do not hand-edit generated output.

### 3. Verify

- Re-run the focused baseline after each meaningful transformation.
- Run affected consumer checks after public/internal boundary movement.
- Compare public API/schema artifacts and generated output when relevant.
- Run performance checks when the refactor affects queries, allocation, concurrency, caching, or critical loops.

### 4. Refine or stop

- A verification failure may be corrected inside the ENG Loop only when behavior remains unchanged and scope stays fixed.
- If preserving behavior conflicts with the requested structure, stop and report the exact invariant rather than altering behavior.

## Large-repository strategy

- Decompose by dependency direction: leaf modules before dependants unless an interface-first migration is approved.
- For cross-package renames, generate a verified reference manifest and stage changes in compatible slices.
- Parallelize only independent slices with disjoint paths.
- Use temporary compatibility adapters for multi-stage migrations only when explicitly scoped and tested.

## Prohibited actions

- Mixing refactoring with a feature, bug fix, dependency upgrade, or schema migration.
- Deleting or weakening tests to restore green status.
- Updating expectations when the implementation changed behavior unintentionally.
- Claiming preservation from code review alone when executable checks exist.
- Crossing the write boundary for opportunistic cleanup.
