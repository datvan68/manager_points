# Skill: Write Test

> Use for a `test_only` request or when tests have an independent write boundary
> or risk profile. For ordinary implementation, keep focused tests in the
> primary feature or bug-fix step unless the orchestrator selects this skill.

## Metadata

```yaml
skill_id: write_test
version: 3.0.0
protocol_version: "3.3"
supported_agents: [test-agent, code-agent]
capabilities: [search, code_gen]
```

## Required context

- Changed behavior or confirmed bug mechanism and acceptance-criterion IDs.
- Exact test write boundary, current implementation/diff, and risk areas.
- Owning package, nearest representative test, repository runner, fixtures, and
  focused command.

Preserve the repository's framework, layout, helpers, naming, database policy,
and configured thresholds. Do not invent a runner or universal coverage target.

## Test selection

Choose the lowest level that reliably observes each criterion. Add a higher
level only for a boundary that lower-level tests cannot prove.

Cover when applicable:

- Changed happy path and meaningful changed failure behavior.
- A deterministic regression for the confirmed bug mechanism.
- Negative authorization, sensitive-data, persistent-data, destructive, money,
  or public-contract behavior proportional to its risk.
- Relevant boundary, ordering, idempotency, or shared-state behavior.

Avoid duplicate coverage at every level, impossible-state cases, implementation
details, broad snapshots, and assertions that exist only to raise line coverage.

## Method

1. Inspect the owning runner/config, nearest tests, fixtures, cleanup policy, and
   exact target. Confirm all writes stay inside the assigned boundary.
2. Map every required criterion to setup, action, observable result, and failure
   message. Control time, randomness, network, and shared state with existing
   utilities.
3. Follow local test style; keep tests independent and order-insensitive. Mock
   only outside the behavior under test, never the assertion target.
4. Use established isolated test resources. Never use production databases,
   credentials, or uncontrolled external services; clean persistent/process
   state through repository fixtures.
5. Run the changed test first, then the affected suite/package and static checks.
   Run integration, full regression, or coverage only when impact, policy, or
   risk requires it.
6. Fix only faulty test setup or expectations inside this step. If the test
   exposes a product defect, return the failure to the owning pipeline instead
   of silently changing implementation code.

## Quality and result

When a pre-change baseline is feasible, the test must fail for the intended
reason and pass after the authorized implementation. Never add retries, sleeps,
skips, broad mocks, or weaker assertions merely to obtain green status.

Return the common `global.md` envelope plus a criterion-mapped test matrix,
commands actually run, changed paths, and measured coverage data when available.
If coverage was not run or no repository threshold exists, report threshold and
report reference as `null`; never present estimated coverage as measured.
