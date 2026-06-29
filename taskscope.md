# Taskscope: Safe Cleanup of Frontend `.test` Files

## Objective
Decide whether the existing `.test` files can be removed from the repository and define a safe cleanup scope that does not silently reduce regression protection.

## Current State
The frontend currently contains an active Vitest setup:
- `frontend/package.json` defines `test` as `vitest run` and `test:watch` as `vitest`.
- `frontend/vitest.config.ts` enables the Vitest test environment and uses default test-file discovery.
- The codebase currently includes `24` active `*.test.ts` / `*.test.tsx` files under `frontend/src`.
- The codebase also includes `2` non-active stale artifacts:
  - `frontend/src/components/layout/StudentCongratsModalGate.test.ts.stale`
  - `frontend/src/components/layout/StudentCongratsModalGate.test.ts.bak.stale`

Validation note:
- A real Vitest file (`frontend/src/lib/drl-score.test.ts`) was executed successfully, confirming that `.test` files are part of the active automated test workflow.

## Decision
No, the `.test` files should not be deleted in bulk.

These files are not disposable placeholders. They are part of the frontend test suite and removing them would immediately reduce automated coverage for utilities, API clients, hooks, page logic, and UI components.

## What Can Be Deleted Safely
The following files are safe cleanup candidates because they are clearly marked as stale or backup artifacts rather than active test files:
- `frontend/src/components/layout/StudentCongratsModalGate.test.ts.stale`
- `frontend/src/components/layout/StudentCongratsModalGate.test.ts.bak.stale`

## What Must Not Be Deleted Blindly
Do not delete active files matching:
- `*.test.ts`
- `*.test.tsx`
- files inside `__tests__`

unless one of the following is true:
1. The feature under test has already been removed from production code.
2. The test is obsolete and equivalent coverage has been replaced elsewhere.
3. The test is permanently broken and the team explicitly accepts the loss of protection.

## Recommended Cleanup Scope

### Phase 1: Safe Removal
1. Remove only stale and backup test artifacts.
2. Keep all active Vitest files in place.

### Phase 2: Audit Active Tests
1. Review each active test file and map it to current production code.
2. Mark tests as one of:
   - still valuable;
   - obsolete because the feature no longer exists;
   - redundant because coverage already exists elsewhere;
   - flaky and needing repair.
3. Delete active tests only after that audit is complete.

### Phase 3: Controlled Deletion Rules
If active test files are removed, each removal must include:
1. a short reason for deletion;
2. confirmation that the related feature was removed or replaced;
3. confirmation that critical behavior is still covered by other tests or by an accepted manual QA process.

## In Scope
- Identify whether bulk deletion of `.test` files is safe.
- Remove `.stale` and backup test artifacts.
- Audit active frontend Vitest files before any further deletion.
- Preserve meaningful regression coverage.

## Out Of Scope
- Removing all frontend tests for convenience.
- Disabling Vitest from the frontend toolchain.
- Rewriting the entire test strategy.
- Deleting backend tests or changing backend Jest configuration.

## Acceptance Criteria
- No active Vitest test file is deleted without explicit justification.
- Stale and backup test artifacts are isolated as safe cleanup targets.
- The repository keeps automated protection for currently supported frontend behavior.
- Any future test deletion follows an audit-based decision, not a filename-only cleanup rule.

## Deliverable
A cleanup plan that explicitly rejects blanket deletion of active `.test` files, allows removal of stale test artifacts, and requires an audit before deleting any remaining active tests.
