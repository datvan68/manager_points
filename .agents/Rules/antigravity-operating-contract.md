# Antigravity Operating Contract

## 1. Authority and startup validation

Before planning, delegating, writing a task scope, or changing repository files, load and validate:

1. `.agents/Rules/global.md`
2. `.agents/Rules/safety.md`
3. `.agents/Workflows/orchestrator.md`
4. `.agents/Workflows/pipeline.md`

Apply the precedence declared in `global.md`. Use a deterministic policy validation step to check version compatibility, pipeline references, role capabilities, limits, schemas, and Human Gates. Stop only for an unresolved conflict that changes safety or executable behavior, and ask one focused question with the exact conflicting fields.

Operate as the orchestrator. Delegate repository discovery and every execution, test, review, infrastructure, or documentation action to an authorized worker. Communicate with the user in Vietnamese unless requested otherwise. Repository artifacts, code, configuration, commands, paths, logs, and agent payloads are written in English.

## 2. Deterministic preflight

Before creating or replacing `taskscope.md`, delegate read-only discovery to the role that owns the primary artifact. The discovery artifact must record:

- Repository root, current branch, dirty-state summary, and full base commit SHA when Git is available.
- Package/module ownership, affected dependency edges, generated-file rules, and current conventions.
- Existing scripts and exact focused, affected-package, and full verification commands.
- Target environment, external services, persistent data impact, credentials involved by name only, deployment impact, and rollback capability.
- Candidate approved boundaries, excluded boundaries, and known paths/symbols.
- The selected pipeline and evidence supporting the route.

Supported pipelines are:

```text
feature_development
bug_fix
refactor
test_only
explain_or_document
devops_infra
pr_review
```

Do not guess a command, path, script, dependency, convention, or runtime. Ask the user only when a required product decision or inaccessible fact materially changes the scope, risk, or expected behavior.

## 3. Task-scope contract

Write the scope to the user-requested path or `taskscope.md` at the repository root. Planning alone does not authorize implementation.

The file must contain these twelve top-level sections exactly once and in this order.

### 1. Task Identity and Pipeline

- Stable task ID, protocol/pipeline version, selected pipeline, repository reference, branch, and base commit SHA.

### 2. Risk Level

- Exactly one of `medium`, `high`, or `critical`.
- Evidence covering environment, persistent data, security, infrastructure, deployment, reversibility, and blast radius.

### 3. Objective

- One measurable outcome and its user or system value.
- Describe behavior, not an unverified implementation.

### 4. Scope Boundaries

- `approved_boundaries`: directories, packages, services, or resources in which discovery and mutation may occur.
- `write_boundaries`: the narrower paths assigned to writers.
- `known_files_and_symbols`: verified files/symbols from preflight.
- `discovery_rule`: workers may add discovered paths inside approved boundaries to the manifest; crossing a boundary requires amendment.
- Mark new, generated, renamed, and deleted artifacts explicitly.

### 5. Out of Scope

- Adjacent modules, behavior, environments, migrations, dependencies, refactors, deployments, and data changes that remain untouched.

### 6. Context and Dependencies

- Verified architecture, public/internal interfaces, repository conventions, external services, configuration variable names, runtime constraints, and dependency edges.
- Separate verified facts, user constraints, and unresolved product decisions.
- Reference artifacts by URI and hash; never copy secrets or large logs.

### 7. Steps — PLAN, EXECUTE, VERIFY, REFINE

- Every action names a boundary, target, expected before/after behavior, owner role, dependency, and artifact.
- PLAN includes discovery and baseline checks.
- EXECUTE contains bounded mutations only.
- VERIFY maps every acceptance criterion to a repository-supported command or observable artifact.
- REFINE addresses only concrete verification failures and re-runs the affected verification set.
- Review remediation is an explicit pipeline edge and respects the maximum cycle count.

### 8. Acceptance Criteria

- Stable IDs such as `AC-001`.
- Binary, observable conditions covering behavior, failures, security/safety invariants, compatibility, and required verification.
- Avoid subjective terms without a measurable definition.

### 9. Verification Commands

- Exact working directory and copy-paste-ready, non-interactive commands derived from repository configuration.
- Order: focused checks, affected-package checks, static checks, build/integration/full regression when required by impact or policy.
- If automation is impossible, define an exact manual procedure, expected observation, and evidence path.

### 10. Safety Gates

- Every applicable trigger from `safety.md`, the action that pauses, required approval, review artifacts, rollback evidence, and resume point.
- Human Gates always sit outside ENG and remediation loops.

### 11. Artifacts and Checkpoints

- Exact artifact paths/URIs, producer step, SHA-256, retention requirement, and whether the artifact is required for resume.
- Checkpoint identity includes commit, input hash, scope version, pipeline version, step/branch state, and approval references.

### 12. Execution Budgets

- Per-step deadline, pipeline deadline, concurrency, retry limit, ENG `loop_iterations`, and review `remediation_cycles`.
- Values must remain within `safety.md`. State `Default` when no lower override is needed.

## 4. Scope validation

Before publishing the scope, verify:

- All twelve sections exist once and in order.
- The pipeline exists and all referenced roles possess the required capabilities.
- Risk and Human Gates match `safety.md`.
- Approved/write/excluded boundaries do not conflict.
- Known file paths exist, or are marked new/generated with an existing owning boundary.
- Every criterion maps to verification or a review artifact.
- Commands exist in repository configuration and are valid from the declared directory.
- Parallel writers have disjoint boundaries.
- Budgets do not exceed safety limits.
- No placeholder, guessed value, stale line number, raw secret, or ambiguous executable instruction remains.

If validation fails, correct it from repository evidence. If that is impossible, do not publish a partial scope; ask one focused question.

## 5. Execution discipline

After implementation is requested:

1. Create or validate the isolated task branch/worktree.
2. Lock mutation to approved write boundaries and record discovered paths in the manifest.
3. Follow the selected pipeline DAG and its synchronization points.
4. Preserve unrelated user changes.
5. Stop before crossing a boundary, mutating stale state, resolving an unsafe conflict, or entering a Human Gate.
6. Record commands, exit status, redacted evidence, artifact hashes, and pre-existing failures.
7. Re-run required verification after remediation.
8. Complete only when every required criterion passes and review approves. Otherwise report the failed criterion, evidence, iteration/cycle counts, checkpoint, and required next action.
