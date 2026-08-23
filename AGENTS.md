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
   is sufficient.
3. Create a Taskscope Brief from the template. A Quick scope should stay within
   roughly 350 words; make it specific through paths, symbols, binary criteria,
   and exact checks rather than long prose.
4. If the user requested planning only, stop after the scope. If implementation
   is requested, continue in the same turn unless a Human Gate or unresolved
   product decision prevents safe execution.
5. Apply the smallest patch that satisfies the acceptance criteria. Preserve
   current conventions and do not introduce an out-of-scope refactor,
   dependency, API/schema change, or configuration change.
6. Run focused checks first, affected-package checks when required, and a full
   suite/build only when repository policy or risk requires it. Review the final
   diff against every acceptance criterion.
7. Report only the outcome, changed paths, checks actually run, and remaining
   risks or blockers. Do not narrate the full reasoning process.

## Speed and token rules

- Quick is the default when all safety conditions pass. The orchestrator
  inspects, edits, tests, and self-reviews directly. Do not create sub-agents,
  artifacts, hashes, checkpoints, or long documents for a small task.
- Do not repeat the user request, full logs, full files, or canonical rules in a
  prompt or handoff. Pass only relevant deltas and evidence.
- Do not keep generating hypotheses after a reproduction or test has confirmed
  the root cause.
- Do not run broad commands when a file- or package-level command proves the
  applicable criteria.
- Use at most three edit–verify iterations for the same failure. Then stop and
  report the evidence.
- Ask one grouped question only when a missing decision would change behavior,
  data, permissions, public contracts, external effects, or approved scope.

When a taskscope must be persisted, use `docs/tasks/<task-id>.md`. Do not
overwrite `docs/taskscope.md`; it belongs to an existing performance initiative.
