# Antigravity Operating Contract

## 1. Authority and Required References

Before planning, delegating, writing a task scope, or changing any file, read these files in full:

1. `.agents/Rules/global.md`
2. `.agents/Rules/safety.md`
3. `.agents/Workflows/orchestrator.md`
4. `.agents/Workflows/pipeline.md`

Treat those files as canonical. Apply their precedence exactly as declared in `global.md`. Never rely on memory, summaries from an earlier task, or assumptions about their contents. If a required file is missing, unreadable, internally inconsistent, or conflicts with the user's requested pipeline constraints, stop before making changes and ask one focused clarification question that identifies the exact conflict.

Operate only as the orchestrator described in `.agents/Workflows/orchestrator.md`. Delegate execution, review, testing, infrastructure, and documentation work to the authorized sub-agent for the selected pipeline. Do not bypass a required review step, checkpoint, synchronization point, or Human Gate.

Communicate with the user in Vietnamese unless the user explicitly requests another language. Write all repository artifacts, task scopes, source code, code comments, configuration, commands, paths, logs, and agent-to-agent payload fields in English.

## 2. Deterministic Preflight

Before creating `taskscope.md`:

1. Inspect the repository state and the exact files, modules, symbols, scripts, and configuration relevant to the request.
2. Read the package scripts, test configuration, build configuration, deployment configuration, and dependent interfaces needed to derive valid verification commands.
3. Identify the environment (`development`, `staging`, or `production`), requested operation, affected data, external services, credentials, and deployment impact.
4. Select exactly one pipeline allowed by the user's contract: `feature_development`, `devops_infra`, or `pr_review`.
5. Classify risk using only the current `risk_level` values and Human Gate triggers defined in `.agents/Rules/safety.md`. Do not invent an additional risk level. In particular, do not emit `LOW` unless `safety.md` explicitly adds it.
6. Confirm that every path named in Scope exists, or explicitly identify it as a new file with an existing parent directory.
7. Confirm that every verification command is supported by the repository and is valid from the stated working directory.

Do not write a speculative task scope. If any fact required for an exact Scope, Step, Acceptance Criterion, Verification Command, Safety Gate, or artifact path cannot be discovered safely from the repository, ask the user for that specific fact before writing or replacing `taskscope.md`.

## 3. Task-Scope Output Contract

When asked to create or replace a task scope, write it to the exact path requested by the user. If no path is provided, use `taskscope.md` at the repository root. Do not modify implementation files unless the user also requests implementation.

The task scope must use the following twelve top-level sections, in this exact order, without omitting, renaming, merging, or adding a top-level section:

### 1. Task ID + Pipeline

- Provide one unique, stable task ID suitable for logs and checkpoints.
- Specify exactly one of: `feature_development`, `devops_infra`, or `pr_review`.
- If the canonical mapping in `.agents/Workflows/pipeline.md` requires a pipeline outside this allowed list, stop and ask the user to resolve the conflict.

### 2. Risk Level

- Use the exact enum spelling currently defined by the Human Gate Request Schema in `.agents/Rules/safety.md`.
- State the concrete reasons for the classification, including environment, data, security, infrastructure, deployment, and reversibility impact.
- Never downgrade risk to avoid a Human Gate.

### 3. Objective

- Write one or two sentences describing the measurable outcome and why the task is needed.
- Describe the desired behavior, not an implementation guess.

### 4. Scope

- List every file that may be created, modified, renamed, or deleted using a repository-relative path.
- For each file, name the exact module, exported symbol, class, function, configuration key, manifest object, or document section to be changed and the intended change.
- Mark new files explicitly as `new file`.
- A file not listed here must not be changed.

### 5. Out of Scope

- List adjacent modules, behaviors, environments, migrations, dependencies, refactors, deployment actions, and data changes that must remain untouched.
- Include explicit boundaries that prevent plausible scope creep for this task.

### 6. Context & Dependencies

- Record verified architectural decisions, current behavior, relevant interfaces, configuration sources, runtime constraints, service dependencies, and prior decisions.
- Distinguish verified facts from user-provided constraints. Do not include unverified assumptions.
- Never copy secrets or credential values; reference only the variable or secret name.

### 7. Steps — PLAN → EXECUTE → VERIFY → REFINE

- Preserve all four phases and place every numbered action under the correct phase.
- Each action must identify the exact path and symbol, section, key, resource, or command it affects.
- State the before-to-after behavior or exact result. A bare verb such as `update`, `fix`, `improve`, `refactor`, `configure`, `handle`, or `test` is invalid.
- PLAN must include discovery and baseline checks required before mutation.
- EXECUTE must describe bounded edits only to files listed in Scope.
- VERIFY must map every acceptance criterion to an exact command or observable artifact.
- REFINE must permit corrections only for concrete verification failures and must require the complete verification set to be rerun after a correction.

### 8. Acceptance Criteria

- Write binary, testable conditions with an observable pass/fail result.
- Cover functional behavior, failure behavior, security/safety invariants, regression protection, and required build or test status when applicable.
- Every criterion must be verifiable by a command or artifact listed in Sections 9 or 11.
- Do not use subjective terms such as `better`, `clean`, `robust`, `optimized`, or `user-friendly` without a numeric threshold or explicit observable definition.

### 9. Verification Commands

- State the exact working directory.
- Provide copy-paste-ready commands in execution order, using the shell syntax of the target environment.
- Derive commands from scripts and tools that actually exist in the repository. Include focused tests before broader tests, then type checks, lint, build, security, or infrastructure validation as required by the selected pipeline.
- Do not use placeholders, ellipses, guessed script names, guessed paths, interactive commands, destructive commands, or commands forbidden by `.agents/Rules/safety.md`.
- If a required check cannot be automated, define an exact manual procedure, expected observation, and evidence to capture.

### 10. Safety Gates

- List every applicable Human Gate trigger from `.agents/Rules/safety.md` and every task-specific condition that would expand scope or increase risk.
- For each trigger, state the action that must stop, the approval required, and the point in the pipeline where execution pauses.
- A Human Gate always sits outside the ENG Loop. Never retry, refine, delegate around, or partially execute a gated action while awaiting approval.

### 11. Artifacts to Review

- List the exact repository-relative or approved output path for each diff, report, test log, build log, scan result, plan, manifest, screenshot, or rollback artifact required for review.
- Identify which verification command or pipeline step produces each artifact.
- Include only artifacts that can actually be produced; do not invent output paths unsupported by the workflow.

### 12. loop_iterations Override

- Always include this section.
- If no override is needed, write `Override: None` and cite the default from `.agents/Rules/safety.md`.
- If an override is needed, specify the exact integer, the exact pipeline step or sub-agent to which it applies, and the evidence-based reason.
- Never exceed the canonical safety limit. A Human Gate cannot be overridden by loop iterations.

## 4. Precision and Consistency Gates

Before saving a task scope, validate all of the following:

- All twelve required sections exist exactly once and in the required order.
- The selected pipeline is allowed and consistent with the task.
- The risk value and Human Gate rules match the current `safety.md` schema.
- Scope and Steps reference the same closed set of files; Out of Scope does not contradict Scope.
- Every EXECUTE action names a specific file and target symbol, section, key, or resource.
- Every Acceptance Criterion maps to at least one Verification Command or review artifact.
- Every command is valid from the declared working directory and uses an existing script or executable allowed by `safety.md`.
- Safety Gates identify all production, destructive, database, IAM, secret, shared-history, and production CI/CD triggers that apply.
- No placeholder, unresolved token, approximate path, approximate command, stale line number, raw secret, or ambiguous instruction remains.
- The task scope is written in English.

If validation fails, do not publish a partial task scope. Resolve the issue from repository evidence or ask the user one focused clarification question.

## 5. Execution Discipline

After a task scope is approved or execution is requested:

1. Lock work to the files and behavior in Scope.
2. Follow the selected pipeline and the `PLAN → EXECUTE → VERIFY → REFINE` lifecycle.
3. Preserve unrelated user changes in a dirty worktree.
4. Stop before touching any file outside Scope and request a scope amendment.
5. Stop immediately at every Human Gate and emit the exact approval request schema from `.agents/Rules/safety.md` with real artifact paths.
6. Record verification output and distinguish pre-existing failures from failures introduced by the task.
7. Declare completion only when every Acceptance Criterion passes. Otherwise report the exact failed criterion, evidence, loop count, checkpoint, and required next action.
