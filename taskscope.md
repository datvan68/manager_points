# Taskscope: Fix Long-Hanging Test Execution

## Objective
Investigate and fix the issue where project tests do not execute normally or hang for a very long time.

The test workflow must become deterministic:
- Tests should start running quickly.
- Focused tests should complete within a predictable timeout.
- Hanging tests must fail with actionable diagnostics instead of blocking indefinitely.
- Open handles, timers, unresolved promises, app servers, database connections, and mocked network calls must be cleaned up correctly.

## Current Test Setup

### Frontend
- Package: `frontend/package.json`
- Test command: `npm test`
- Script: `vitest run`
- Test runner: Vitest
- Environment: `jsdom`
- Config file: `frontend/vitest.config.ts`

Current frontend config defines:
- `environment: 'jsdom'`
- alias `@ -> frontend/src`
- basic excludes for `node_modules`, `.next`, `dist`, and `cypress`

The config does not currently define explicit test timeouts, hook timeouts, setup cleanup, or hang diagnostics.

### Backend
- Package: `backend/package.json`
- Unit test command: `npm test`
- Script: `jest`
- Test runner: Jest
- Unit test root: `backend/src`
- Test regex: `.*\\.spec\\.ts$`
- E2E test command: `npm run test:e2e`
- E2E config file: `backend/test/jest-e2e.json`

Backend tests may hang if Nest applications, Mongoose connections, timers, queues, file streams, or mocked async dependencies are not closed in `afterAll` / `afterEach`.

## Problem Statement
Running tests can appear to stall or hang for a long time without useful output.

Likely causes to verify:
- A test starts a timer, interval, server, Nest app, database connection, or async job and does not close it.
- A component test waits for UI that never appears because a mocked API call never resolves or a mocked router/auth provider is incomplete.
- A backend spec uses a chainable Mongoose mock that never resolves.
- A test imports application code that starts side effects at module load time.
- Full test suite execution hides which specific test file is hanging.
- Runner config does not enforce reasonable timeouts or diagnostics.

## Required Behavior

### Test execution
- Running a focused frontend test file must complete or fail with a clear timeout.
- Running a focused backend spec file must complete or fail with a clear timeout.
- The test command must not hang indefinitely without naming the active test file.
- Test suites must clean up all open handles before process exit.

### Diagnostics
- Add or document a reliable command to identify hanging backend tests using Jest open-handle detection.
- Add or document a reliable command to identify hanging frontend tests using Vitest verbose and single-file execution.
- Keep normal test commands reasonably fast; heavier diagnostics can live in separate scripts if they slow down normal runs.

### Cleanup rules
- Frontend tests must cleanup rendered React trees after each test.
- Frontend tests must clear mocks and restore timers after each test.
- Backend tests must close Nest apps, HTTP servers, database connections, and module refs created during setup.
- Tests that use fake timers must always restore real timers.
- Tests that mock long-running API calls must return resolved or rejected promises explicitly.

## Implementation Scope

### Frontend changes
Review and update:
- `frontend/vitest.config.ts`
- frontend test setup file if one is added
- hanging or long-running frontend test files found during diagnosis

Expected frontend improvements:
- Add explicit `testTimeout` and `hookTimeout` values.
- Add a setup file for `@testing-library/react` cleanup if not already present.
- Clear mocks after each test.
- Restore real timers after each test.
- Avoid unbounded `waitFor`, unresolved mocked promises, and module-level side effects.
- Prefer running focused test files before running the entire frontend suite.

Suggested diagnostic commands:
```bash
cd frontend
npm test -- --reporter=verbose --fileParallelism=false
npm test -- "src/app/(dashboard)/grading/score/page.test.tsx" --reporter=verbose
```

If the installed Vitest version does not support `--fileParallelism=false`, use the closest supported single-file or single-worker Vitest option instead. The important requirement is to isolate the hanging file and print the active test output.

### Backend changes
Review and update:
- `backend/package.json`
- backend Jest config in `backend/package.json`
- `backend/test/jest-e2e.json`
- hanging or long-running backend spec files found during diagnosis

Expected backend improvements:
- Add explicit Jest `testTimeout` for unit tests.
- Add a separate diagnostic script for open handles, for example `jest --runInBand --detectOpenHandles --logHeapUsage`.
- Ensure Nest testing modules and app instances are closed.
- Ensure Mongoose connections and model mocks resolve properly.
- Ensure timers, intervals, streams, and async jobs are stopped in `afterEach` or `afterAll`.
- Avoid running E2E tests through the unit test command.

Suggested diagnostic commands:
```bash
cd backend
npm test -- --runInBand --detectOpenHandles
npm test -- academic-record/academic-record.service.spec.ts --runInBand --detectOpenHandles
npm run test:e2e -- --runInBand --detectOpenHandles
```

### Test selection workflow
Use this order when diagnosing the hang:
1. Run the smallest focused test file related to the current change.
2. Run the same focused test with verbose output.
3. Run with open-handle diagnostics.
4. Fix cleanup or unresolved async work in that test file.
5. Run the related folder or feature tests.
6. Run the full suite only after focused tests are stable.

## Out of Scope
- Changing business logic unrelated to the test hang.
- Rewriting the test framework.
- Removing tests only to make the suite pass.
- Increasing timeouts to hide real hangs.
- Running long E2E/database tests as part of normal unit test verification unless explicitly required.
- Changing production runtime behavior only for test convenience.

## Acceptance Criteria
- A focused frontend test file completes or fails within the configured timeout.
- A focused backend spec file completes or fails within the configured timeout.
- The previous hanging test command now identifies the active hanging test or exits with a useful timeout.
- No React component test leaves mounted UI, fake timers, or unresolved mocked promises behind.
- No backend unit test leaves Nest apps, database connections, timers, or async handles open.
- Normal test commands remain usable for day-to-day development.
- Diagnostic commands are documented in this scope or added as package scripts.

## Verification Plan
1. Run the suspected hanging frontend test file directly.
2. Run the suspected hanging backend spec file directly.
3. Run frontend tests with verbose output.
4. Run backend tests with `--runInBand --detectOpenHandles`.
5. Fix any reported open handles or unresolved async operations.
6. Re-run the focused tests.
7. Run the related feature test group.
8. Run the full frontend and backend test suites only after focused tests pass without hanging.

## Deliverable
A test-stability fix that makes frontend and backend tests execute predictably, exposes hanging tests with useful diagnostics, and prevents test processes from staying alive because of leaked timers, open handles, unresolved promises, or unclosed app/database resources.