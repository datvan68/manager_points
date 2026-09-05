# Manager Point — ChatGPT/Codex Instructions

## Role

Act as the default executor: understand the outcome, make the smallest valid
change, and verify it. Keep instruction artifacts in English; respond in
Vietnamese unless requested otherwise. Optimize work by removing duplicate
context and unnecessary steps, never by omitting required evidence.

## Load only what this request needs

1. Read `.agents/Rules/safety.md` and `.agents/Rules/global.md` once per root
   task. Read `.agents/Workflows/orchestrator.md` for the execution sequence.
2. Use the routing table in `.agents/Workflows/pipeline.md`; load only its one
   primary skill. Add `write_test.md` only for an independent testing boundary.
3. For a mutation or explicit taskscope request, read
   `.agents/Workflows/taskscope.md`. Read-only answers need no scope template.
4. Use `.agents/PROJECT_MAP.md` when locating code or checks; skip it when a
   current taskscope already supplies exact targets and commands.
5. Read applicable path-specific instructions. Do not reload unchanged sources
   already present in this task's context; after compaction, recover missing
   constraints and current state rather than restarting discovery.

Each rule has one canonical owner: safety/gates in `safety.md`, ownership and
pin validation in `global.md`, execution order in `orchestrator.md`, task
routing in `pipeline.md`, and slot allocation/template in `taskscope.md`.
Follow references; do not copy entire rules between documents or handoffs.

## Project contracts

Frontend is Next.js App Router/React/TypeScript in `frontend/`; backend is
NestJS/Mongoose/MongoDB/Redis in `backend/`. Current implementation, focused
tests, and scoped domain docs are evidence; never invent business rules.

Preserve RBAC, validation, personal-data handling, API compatibility,
transactions/idempotency, and persistent-data compatibility. Task-scoped testing
on verified dev services and real dev data is authorized by the dev-testing
contract in `safety.md`; do not ask again for each normal test interaction.
Secrets, backups, destructive operations and production remain separately
controlled there. Reuse the target module's existing API
client, guards, DTOs, services, UI patterns, and test setup.

## Execution essentials

- State the outcome and pipeline in one sentence, then inspect the exact target.
  A request to execute a persisted task must first pass the exact-file pin
  contract in `global.md`; any pin warning stops before discovery or mutation.
- Search target → direct caller/dependency → owning module. Stop when outcome,
  write paths, preserved contracts, and verification are known.
- Keep an ordinary implementation brief in runtime. Save a taskscope only when
  requested; planning-only ends after that deliverable. New scopes reuse slots
  according to `taskscope.md`; execution uses only the user's pinned file.
- Check Git and active task reservations before writing. Preserve unrelated
  changes. Implement one checkable step at a time using the selected skill.
- Run focused verification, inspect the diff against acceptance criteria, and
  report only actual results. No passing check means no claim that it passed.
- Verify user-facing behavior through the dev UI/API when the acceptance
  criteria require runtime evidence. Use the dev-testing contract, then report
  tested scenarios and any remaining data changes. Observe its release boundary
  before commit/push actions that would trigger the VPS production rollout.
- Retain explicitly requested taskscope slots. Apply the cleanup/completion
  contract in `global.md` before declaring an executed scope completed.

## Cost and clarity

Default to one executor. Full is a risk/dependency profile, not an instruction
to spawn agents or manufacture artifacts. Delegate only when explicitly
requested or required by an applicable instruction and useful for an independent
subtask. Never lower verification because the model is smaller.

Batch independent reads with bounded output. Use `rg --files` for paths and
`rg -n` for symbols inside the owning directory; quote paths containing
parentheses/spaces. Read complete selected instruction files, but only needed
source sections. Do not dump the repo, lockfiles, generated files, or full logs.

Use direct steps, exact symbols, expected results, and one matching example.
Avoid repeated plans, speculative alternatives, generic checklists, forced JSON
in user replies, and extra docs. Ask only for a decision that materially changes
behavior, scope, data, permissions, or external effects and cannot be established
from the request or repository.
