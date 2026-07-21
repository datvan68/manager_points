Antigravity Operating Contract

Version: 3.2.0

1. Startup

Load and version-check the canonical rule set once per root task. Revalidateonly when a rule hash/version, profile, role, environment, or boundary changes,or a path-specific instruction conflicts. Do not run a separate policy auditwhen versions and references are already compatible.

Route before detailed planning:

Read-only: no taskscope by default.

Quick: small, development-only, medium risk, no gate, eligible undersafety.md.

Full: all other implementation or planning work.

Planning-only: write the applicable scope and stop.

Planning does not authorize implementation.

2. Quick preflight

The orchestrator performs one focused read-only pass and records only factsneeded to execute safely:

repository root and relevant status;

owning package/module and applicable local instructions;

verified target paths/symbols or valid new paths under the owner;

exact focused verification command or precise inspection;

boundary, expected changed files, environment, risk, and gate result.

Do not delegate before publishing a planning-only Quick scope. Do not require acomplete dependency graph, full repository scan, artifact/hash design,checkpoint, rollback artifact, isolated worktree, or formal review DAG when theQuick eligibility evidence does not require them.

After one pass, publish Quick or promote to Full. Never extend Quick discoveryindefinitely to avoid promotion.

3. Quick taskscope contract

Use exactly this compact schema and keep it at or below 220 words when practical:

Task: <stable-id> | <pipeline> | Risk: medium | Profile: Quick
Objective: <one measurable outcome>
Boundary: <approved boundary> | Write: <verified write paths>
Targets: <verified paths/symbols or new paths owned by the boundary>
Steps: <baseline/inspect -> change -> focused verify>
Verify: <working directory> :: <exact command or inspection> => <expected result>
Done: <binary observable acceptance criteria>
Gate: None

Do not restate the request or canonical rules. Additional discovered paths mayenter the manifest without rewriting the scope when they remain inside theapproved boundary, do not increase risk, and do not change excluded behavior.

4. Full preflight and taskscope

Use delegated discovery when specialized evidence, multiple modules/services,security analysis, infrastructure, external state, or parallel ownership ismaterial. Collect only evidence needed by the selected pipeline.

Full taskscope contains these sections once and in order:

Task Identity and Pipeline — task/profile/version/repository/base state.

Risk Level — risk evidence, environment, reversibility, blast radius.

Objective — one measurable behavior and value.

Scope Boundaries — approved/write/excluded boundaries and known targets.

Out of Scope — adjacent behavior/resources left untouched.

Context and Dependencies — verified facts, constraints, interfaces, order.

Steps — owners, dependencies, mutations, synchronization, expected results.

Acceptance Criteria — stable IDs and binary observable conditions.

Verification — exact working directories, commands, expected results.

Safety Gates — trigger, artifact, approval, rollback, resume point.

Artifacts and Checkpoints — only evidence required for review/resume.

Execution Budgets — deadlines, concurrency, retry/loop/remediation limits.

Use None for inapplicable values. Reference long content by URI/hash. Do notrepeat information across sections.

5. Validation and execution

Before publishing either profile, verify paths/boundaries, pipeline, risk/gates,acceptance-to-verification mapping, command existence, and absence of guessedvalues. Quick validation is a direct checklist, not a separate agent or artifact.

When implementation is authorized:

Quick: send one capsule to at most one worker; it may inspect, mutate, verify,and self-review within the same boundary and response.

Full: follow the pipeline DAG, isolation, checkpoints, independent review, andartifact validation required by the applicable rules.

Amend scope only when work crosses the approved boundary, changes excludedbehavior, increases risk, or introduces a new dependency, migration, publiccontract, external effect, or authority requirement.

Complete only after required criteria and verification pass and the final diffcontains no unintended changes.