# Skill: Implement Feature

> Implement approved behavior inside explicit write boundaries while preserving repository conventions and producing verifiable artifacts.

## Metadata

```yaml
skill_id: implement_feature
version: 2.0.0
supported_agents: [code-agent]
capabilities: [search, code_gen]
supported_stacks: repository_defined
required_pipeline: feature_development
```

## Invariants

1. Acceptance criteria define behavior; examples do not override them.
2. Existing repository architecture, language, formatter, error model, test runner, and naming convention are authoritative unless the scope explicitly changes them.
3. No write may cross the assigned boundary.
4. Public API, schema, persistent data, dependency, and operational changes must be explicit in scope.
5. Completion requires risk-based tests and repository-supported verification.

## Input

```json
{
  "protocol_version": "3.0",
  "task_id": "uuid-v4",
  "pipeline_id": "feature_development",
  "step_id": "implement",
  "feature": {
    "name": "stable-feature-name",
    "objective": "Observable desired behavior",
    "acceptance_criteria_ids": ["AC-001", "AC-002"]
  },
  "scope": {
    "approved_boundaries": ["packages/api/src/orders/**"],
    "write_boundaries": ["packages/api/src/orders/**"],
    "excluded_boundaries": []
  },
  "context_refs": [
    {"type": "discovery", "uri": "output/tasks/<task_id>/discovery.json", "sha256": "..."}
  ],
  "constraints": {
    "public_api_change": false,
    "dependency_change": false,
    "data_migration": false
  }
}
```

## Output

Return the common result envelope with:

```json
{
  "summary": "Implemented the approved behavior.",
  "changed_paths": [],
  "created_paths": [],
  "deleted_paths": [],
  "public_contract_changes": [],
  "dependency_changes": [],
  "migration_changes": [],
  "test_requirements": [
    {"criterion_id": "AC-001", "level": "unit", "behavior": "..."}
  ],
  "artifact_refs": [
    {"type": "diff", "uri": "output/tasks/<task_id>/implement.diff", "sha256": "..."}
  ],
  "verification": []
}
```

Do not embed complete files in the result envelope. Save edits in the current
repository worktree and return paths/diff references. Do not create or switch
branches/worktrees unless the user explicitly asks.

## Workflow

### PLAN

- Load the discovery manifest and verify it matches the current base commit.
- Inspect the nearest existing implementations, interfaces, tests, and repository scripts.
- Map every planned change to an acceptance criterion and write boundary.
- Identify generated files and edit their source generator instead.
- Stop for a scope amendment if the change requires another module, dependency, migration, public contract, or environment impact not already approved.

### EXECUTE

- Implement the smallest cohesive change that satisfies the criteria.
- Reuse established project abstractions; do not introduce a preferred framework or pattern merely because it is familiar.
- Preserve backward compatibility unless a breaking change is explicitly approved.
- Validate input at the trust boundary using the repository's existing validation mechanism.
- Follow the repository's established error, logging, async, cancellation, transaction, and configuration patterns.
- Add a dependency only when explicitly scoped, necessary, and compatible with the repository package manager and lockfile.

### VERIFY

Run repository-derived checks in this order when applicable:

1. Formatter or generated-file validation for changed paths.
2. Focused tests for changed behavior.
3. Affected-package type/lint checks.
4. Affected-package build/integration tests.
5. Broader regression or security validation required by risk/policy.

Map command results to acceptance-criterion IDs and save long output as redacted artifacts.

### REFINE

- Correct only a concrete verification failure within the same boundary.
- Do not weaken tests, remove assertions, change criteria, or expand scope to make verification pass.
- Re-run the failed check and all checks that depend on it.

## Design guidance

- Prefer small, composable functions when that matches current code; numeric line limits are advisory, not universal gates.
- Keep business logic, persistence, transport, and infrastructure boundaries consistent with the existing module.
- Use types/schema definitions already standard in the repository.
- Avoid hidden global state and make concurrency/idempotency behavior explicit on critical paths.
- Preserve observability without logging secrets or excessive personal data.

## Large-repository guidance

- Implement by package/module boundary and sequence dependent packages according to the discovery graph.
- Parallelize only independent packages with disjoint write paths.
- Pass public contract artifacts between package workers instead of complete source trees.
- Verify consumers affected by a changed contract before declaring completion.

## Self-review

- Every changed path is scoped and necessary.
- Acceptance criteria have matching test requirements.
- Failure paths, authorization, sensitive data, concurrency, and compatibility were considered.
- No unrelated cleanup or refactor was included.
- No repository convention was replaced without explicit approval.
