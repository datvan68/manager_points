# Skill: Write Test

> Add or update the smallest risk-based test set that proves changed behavior and prevents meaningful regressions, using the repository's existing test stack.

## Metadata

```yaml
skill_id: write_test
version: 2.0.0
supported_agents: [test-agent, code-agent]
capabilities: [search, code_gen]
supported_stacks: repository_defined
```

This skill does not mandate Vitest, Jest, Pytest, Supertest, a directory layout, or a universal coverage percentage. Discover and preserve the repository's established runner, helpers, fixtures, naming, and thresholds.

## Input

```json
{
  "protocol_version": "3.0",
  "task_id": "uuid-v4",
  "pipeline_id": "feature_development",
  "step_id": "tests",
  "target": {
    "changed_paths": ["packages/api/src/orders/service.ts"],
    "changed_symbols": ["createOrder"],
    "behavior_summary": "..."
  },
  "acceptance_criteria_ids": ["AC-001"],
  "risk_profile": {
    "level": "medium | high | critical",
    "areas": ["authorization", "persistent_data"]
  },
  "scope": {
    "approved_boundaries": ["packages/api/**"],
    "write_boundaries": ["packages/api/tests/**"]
  },
  "context_refs": [
    {"type": "diff", "uri": "output/tasks/<task_id>/implement.diff", "sha256": "..."}
  ]
}
```

## Output

Return the common result envelope with:

```json
{
  "summary": "Added focused regression coverage for changed behavior.",
  "changed_paths": [],
  "test_matrix": [
    {
      "id": "T-001",
      "criterion_id": "AC-001",
      "level": "unit | integration | contract | e2e | property | manual",
      "behavior": "...",
      "risk": "...",
      "status": "passed | failed | not_run",
      "evidence_ref": {"uri": "...", "sha256": "..."}
    }
  ],
  "commands": [],
  "coverage": {
    "repository_threshold_met": null,
    "changed_behavior_covered": true,
    "report_ref": null
  },
  "artifact_refs": []
}
```

Never report estimated coverage as measured coverage. If a coverage command was not run or the repository defines no threshold, return `repository_threshold_met: null`, `report_ref: null`, and state that explicitly.

## Test selection

Build the matrix from changed behavior and risk, not from a fixed checklist for every function.

### Required when applicable

- Each acceptance criterion has at least one observable test or approved manual check.
- The changed happy path is covered.
- Meaningful failure behavior introduced or changed by the diff is covered.
- A bug fix has a deterministic regression test for the confirmed root cause when technically feasible.
- Authorization, sensitive-data, persistent-data, money, destructive, and externally visible contract paths receive negative tests appropriate to their risk.
- Boundary and concurrency tests are included when the implementation contains relevant boundaries or shared-state behavior.

### Avoid by default

- Testing framework or language implementation details.
- Duplicating the same behavior at every test level.
- Exhaustive null/empty/404/409 cases for functions where those states cannot occur.
- Snapshot tests that hide semantic regressions.
- Assertions used only to inflate line coverage.

## Workflow

### 1. Discover

- Identify the owning package, existing runner/configuration, nearest representative tests, fixtures, test database policy, and repository commands.
- Resolve changed callers/consumers using the dependency manifest.
- Confirm that test files are inside the assigned write boundary.

### 2. Design

- Choose the lowest test level that reliably proves each behavior.
- Add a higher-level contract/integration/E2E test only for a boundary that cannot be proven below it.
- Define deterministic setup, action, observation, cleanup, and failure message.
- Control time, randomness, network, and shared state using existing repository utilities.

### 3. Implement

- Follow existing naming and arrangement style; AAA/Given-When-Then are options, not mandatory replacements.
- Keep tests independent and order-insensitive.
- Mock only outside the behavior under test. Do not mock the assertion target itself.
- Never use production databases, production credentials, or uncontrolled external services.
- Clean up persistent or process-wide state through established fixtures.

### 4. Verify

Run in order:

1. The new or changed test file.
2. The affected test suite/package.
3. Static checks for changed tests.
4. Integration/full regression/coverage only when required by impact, repository policy, or risk.

Save long output and coverage reports as redacted artifacts. Distinguish pre-existing failures from failures introduced by the test or implementation.

### 5. Refine

- Fix flaky setup, incorrect expectations, or implementation defects according to the owning pipeline.
- Do not add retries, sleeps, broad mocks, skipped tests, or weakened assertions merely to obtain a pass.
- A test that exposes an implementation bug returns `VERIFICATION_FAILED` to the orchestrator; the test agent must not silently rewrite product code unless assigned a separate authorized step.

## Large-repository strategy

- Use changed-file and dependency impact analysis to select packages.
- Shard test execution only when fixtures and external resources are isolated.
- Cap parallel workers according to database, container, CPU, memory, and rate-limit capacity.
- Cache dependencies/build artifacts only when the repository guarantees cache validity for the pinned commit and configuration.

## Quality gate

- Tests fail for the intended pre-fix/pre-feature state when that baseline is available.
- Tests pass for the final state.
- Failure messages identify the violated behavior.
- Each required criterion has evidence.
- Repository coverage thresholds pass when applicable; numeric thresholds are not invented by this skill.
