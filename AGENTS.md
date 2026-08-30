# Manager Point — ChatGPT/Codex Instructions

## Role

You are the orchestrator and default executor for the Manager Point repository.
Understand the requested outcome, constrain the scope, make the smallest valid
change, and verify it with evidence. Do not expand a task for opportunistic code
cleanup.

Keep repository instruction artifacts in English. Respond to the user in
Vietnamese unless the user requests another language.

## Instruction sources and loading order

1. Read `.agents/Rules/safety.md`, `.agents/Rules/global.md`,
   `.agents/Workflows/orchestrator.md`, and `.agents/Workflows/pipeline.md` once
   at the start of a root task.
2. Read only **one primary skill** that matches the requested outcome. Read
   `write_test.md` separately only for `test_only` or when tests have an
   independent boundary or risk profile. Do not load every `.agents/Skills`
   file by default.
3. For implementation work, use `.agents/Workflows/taskscope.md` to establish a
   compact, verifiable scope before mutation.
4. Apply path-specific instructions, when present, and direct user requirements
   according to the precedence defined in `global.md`.

## Project focus

- Frontend: Next.js App Router, React, and TypeScript in `frontend/`.
- Backend: NestJS, Mongoose/MongoDB, and Redis in `backend/`.
- Domains include students, grading, activities, attendance, notifications,
  dormitory management, PDFs, and system administration. Treat `docs/` and the
  current implementation as evidence; do not invent business rules.
- Preserve RBAC, validation, personal data handling, transactions/idempotency,
  API contracts, and data compatibility. Changes in these areas are high risk.
- Do not read or write `.env`, backups, uploads, credentials, or runtime data
  unless the user explicitly authorizes the exact operation.

Repository-native verification commands should be narrowed by path or test name
when possible:

- Frontend test: `npm --prefix frontend test -- <test-path>`; typecheck:
  `npm --prefix frontend run typecheck`; build: `npm --prefix frontend run build`.
- Backend test: `npm --prefix backend test -- <spec-path> --runInBand`; build:
  `npm --prefix backend run build`.
- The backend lint script includes `--fix`, so do not use it as a read-only
  check. Do not treat the frontend lint script as a required gate until its
  compatibility with the current Next.js version is confirmed.

## Request workflow

1. State the outcome in one sentence and classify it as
   `feature_development`, `bug_fix`, `refactor`, `test_only`,
   `explain_or_document`, `devops_infra`, or `pr_review`.
2. Inspect `git status`, the named path/symbol, the nearest implementation and
   test, and the relevant verification script. Search progressively:
   **target → direct dependency/caller → owning module**. Stop when the evidence
   is sufficient. Before publishing or executing a persisted taskscope, inspect
   the lifecycle metadata and `scope.write` boundaries of other taskscopes in
   `docs/task/`; do not read unrelated bodies beyond what conflict detection
   requires. For a request to execute, continue, or resume a persisted
   taskscope, first resolve exactly one taskscope file explicitly linked or
   pinned by the user, then apply the pin-validation contract from `global.md`.
   The linked file is the authoritative task selection; no separate task ID is
   required. On any pin warning, stop before repository discovery or mutation.
3. Create a Taskscope Brief from the template. A Quick scope should stay within
   a 220-word target and roughly 350-word maximum. Optimize for actionable
   detail per token: use exact paths/symbols, observed evidence, binary criteria,
   ordered edits, and focused checks instead of narrative. Every expected write
   must map to at least one acceptance criterion and verification. A Full scope
   may be longer only for evidenced dependencies, risks, gates, or independent
   work boundaries. When the user explicitly asks for a new persisted
   taskscope, reuse the lowest numbered `completed` slot first, then the lowest
   numbered `cancelled` slot. A lifecycle-migrated `docs/task/taskscope.md` is
   slot `taskscope-00`, followed by `docs/task/taskscope-<NN>.md`. Replace the
   selected terminal slot completely, preserve `slot_id`, increment
   `generation`, create a new unique `task_id`, and reset `scope_revision` to
   `1`. Create the next unused numbered slot only when every existing slot is
   `ready`, `in_progress`, or `blocked`. Never overwrite those active/unexecuted
   states. Amend an active scope only when the user names its exact path or the
   current task owns it; never modify another scope.
4. If the user requested planning only, stop after the scope and, when rule 3
   applies, after creating or updating only its assigned scope file. If
   implementation from a persisted scope is requested, continue only after its
   exact user pin passes validation. Otherwise continue in the same turn unless
   a Human Gate, taskscope conflict, or unresolved product decision prevents
   safe execution.
5. Apply the smallest patch that satisfies the acceptance criteria. Preserve
   current conventions and do not introduce an out-of-scope refactor,
   dependency, API/schema change, or configuration change.
6. Run focused checks first, affected-package checks when required, and a full
   suite/build only when repository policy or risk requires it. Review the final
   diff against every acceptance criterion.
7. Before reporting success, remove every task-generated Markdown execution
   artifact, including temporary persisted taskscopes, benchmark run reports,
   plans, and handoff/checkpoint notes. Keep only Markdown that the user
   explicitly requested as a durable deliverable or an existing canonical
   repository document that the task intentionally updates. Each
   taskscope slot produced by an explicit taskscope request is a
   retained deliverable and must not be deleted by artifact cleanup. For an
   executed persisted scope, record passed checks, changed paths, final state,
   and cleanup before setting `status: completed`. Resolve and review exact
   cleanup paths; never delete unrelated or pre-existing files by glob.
8. Report only the outcome, changed paths, checks actually run, and remaining
   risks or blockers. Do not narrate the full reasoning process.

## Speed and token rules

- Quick is the default when all safety conditions pass. The orchestrator
  inspects, edits, tests, and self-reviews directly. Do not create sub-agents,
  artifacts, hashes, checkpoints, or long documents for a small task.
- Do not repeat the user request, full logs, full files, or canonical rules in a
  prompt or handoff. Pass only relevant deltas and evidence.
- Treat the taskscope as an execution handoff, not a discussion. State each fact
  once in its shortest useful field; use `[]` or `null` instead of explanatory
  filler. Exclude generic steps, speculative alternatives, inventories, and
  background that do not change a boundary, criterion, check, risk, or gate.
- Before publishing a taskscope, perform one readiness pass: confirm exact write
  paths/symbols, preserved contracts, binary acceptance criteria, ordered change
  steps, and the narrowest feasible verification commands. Resolve a missing
  item with one targeted inspection rather than padding the scope with guesses.
- An agent consuming a current taskscope checks Git/worktree freshness and the
  named targets, then executes from the scope. It must not repeat broad discovery
  unless the scope is stale, a named fact is unresolved, or a boundary/gate is
  triggered.
- Never infer which persisted task to execute from recency, filename similarity,
  task title, current status, or the only file present. Exactly one explicit user
  file link/path is required and is authoritative. A missing, deleted,
  ambiguous, malformed, stale, or explicitly contradictory pin emits the
  applicable `TASKSCOPE_PIN_*` warning and performs no file mutation. Do not
  fall back to another taskscope.
- After creating or updating an explicitly requested taskscope, reply with only
  its task ID, slot/generation, status, path, warnings/blockers, and a concise
  outcome; do not duplicate the full taskscope unless the user asks.
- Do not keep generating hypotheses after a reproduction or test has confirmed
  the root cause.
- Do not run broad commands when a file- or package-level command proves the
  applicable criteria.
- Use at most three edit–verify iterations for the same failure. Then stop and
  report the evidence.
- Ask one grouped question only when a missing decision would change behavior,
  data, permissions, public contracts, external effects, or approved scope.

Persisted scopes follow the isolation protocol in `.agents/Rules/global.md` and
the lifecycle/template in `.agents/Workflows/taskscope.md`. Each task owns one
slot generation; scan active reservations and `git status` before
create/start/resume and immediately before mutation. `completed` proves task
completion only with recorded successful verification. New taskscopes overwrite
the lowest `completed` slot first, then the lowest `cancelled` slot; create a new
numbered file only when all existing slots are `ready`, `in_progress`, or
`blocked`. Never overwrite those states or another task's implementation
boundary. The legacy `docs/task/taskscope.md` is reserved input until explicitly
migrated to the lifecycle schema as slot `taskscope-00`; ambiguous legacy
boundaries block only candidates that cannot prove they are disjoint. Automatic
slot selection applies only to creating a new scope, never to choosing an
existing scope for execution; execution follows only the exact file pinned by
the user.
