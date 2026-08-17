Task: `resolve-backend-dev-port-conflict` | `bug_fix` | Risk: medium | Profile: Quick

Objective: Start the Nest backend in development mode on `0.0.0.0:8001` with exactly one repository-owned listener and no `EADDRINUSE` failure.

Boundary: local development backend process and `backend/**` startup configuration | Write: no implementation files; runtime process state only

Targets: listener discovered dynamically on TCP `8001`; `backend/src/main.ts:bootstrap`; `backend/package.json` script `start:dev`

Steps: inspect the current TCP listener and its full command line -> confirm it belongs to `D:\PROJECT\manager_points\backend` -> stop only that exact stale backend process -> confirm port `8001` is free -> run `npm run start:dev` from `backend` -> inspect the new listener and health endpoint. If the listener is unrelated or ownership cannot be proven, stop without terminating it and report the conflict.

Verify: `D:\PROJECT\manager_points\backend` :: `npm run start:dev` plus PowerShell inspection of `Get-NetTCPConnection -LocalPort 8001 -State Listen` and `Invoke-WebRequest http://localhost:8001/health` => one repository-owned Node listener exists, Nest remains running in watch mode, and `/health` responds successfully without `EADDRINUSE`.

Done: The stale `backend\dist\main` listener is absent, one dev-watch backend owns port `8001`, and the health check passes.

Gate: None
