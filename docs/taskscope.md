Task: `prevent-objectid-idof-recursion` | `bug_fix` | Risk: medium | Profile: Quick

Objective: Make the dormitory dashboard normalize Mongoose `ObjectId` values without recursive `_id` access or `RangeError: Maximum call stack size exceeded`.

Boundary: `backend/src/dormitory/services/**` | Write: `backend/src/dormitory/services/dormitory-reports.service.ts`, `backend/src/dormitory/services/dormitory-reports.service.spec.ts`

Targets: helper `idOf`; dashboard ID maps and lookups in `DormitoryReportsService.getDashboardStats`; dashboard contract tests

Steps: reproduce the failure with a real Mongoose `ObjectId` whose `_id` getter resolves to itself -> update `idOf` to handle ObjectId/string-convertible scalar identifiers before traversing wrapper fields and guard self/cyclic references -> preserve support for plain `{ _id }`, `{ $oid }`, strings, null, and invalid objects -> add focused regression cases -> run the service test and build.

Verify: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/services/dormitory-reports.service.spec.ts` and `npm run build` => the ObjectId regression passes, existing dashboard assertions pass, and TypeScript compilation succeeds without stack overflow.

Done: A dashboard request containing native Mongoose ObjectIds completes successfully; identifier normalization remains correct for supported wrapper/scalar forms; focused tests and build pass.

Gate: None
