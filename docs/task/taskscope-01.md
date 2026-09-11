slot_id: "taskscope-01"
generation: 1
task_id: "20260911-145210-admin-timetable-database-sync"
scope_file: "docs/task/taskscope-01.md"
status: in_progress
scope_revision: 1
created_at: "2026-09-11T14:52:10+07:00"
updated_at: "2026-09-11T15:12:00+07:00"
base_commit: "d590defa33030ccd7ea21eb6b4aae8f4be05b4b5"
task: "Serve timetable from MongoDB with administrator-controlled synchronization"
pipeline: feature_development
profile: Full
risk: high
environment: development
objective: "All permitted users read timetable filters and results from local MongoDB; only administrators can start source synchronization or configure periodic synchronization."
coordination:
  depends_on: []
  blockers:
    - "V-05 runtime UI/API scenarios are not complete: the verified development backend container remained in Nest watch compilation after restart and did not become HTTP-ready within the bounded check; no authenticated session was used."
    - "V-06 independent review result was not available in this execution turn; completion cannot claim the mandatory independent review."
  warnings:
    - "Previous taskscope-03.md is absent; allocate slot 01 because only empty legacy slot 00 remains. Git worktree was clean during discovery."
    - "Periodic synchronization is disabled by default; an admin explicitly enables it and selects coverage and interval."
    - "Independent review of authorization, persistence and concurrency is mandatory; bounded reviewer tooling is available during execution."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "TimetableService.getOptions/getTimetable directly invoke SchoolTimetableAdapter per requester. TimetableController allows STUDENT/ADMIN/TEACHER reads. TimetableLookup reloads dependent options after parent selections. No timetable MongoDB models exist."
  expected_behavior: "Reads never call the source, including cache misses and missing snapshots. Admin-triggered background work publishes validated local snapshots."
  root_cause: null
scope:
  inspect:
    - backend/src/timetable
    - backend/src/tasks/tasks.module.ts
    - backend/src/tasks/schemas/task.schema.ts
    - backend/src/auth
    - backend/src/app.module.ts
    - backend/src/system
    - backend/package.json
    - frontend/src/api/http-client.ts
    - frontend/src/components/guards/RouteGuard.tsx
    - frontend/src/components/timetable
    - frontend/src/app/(dashboard)/timetable/page.tsx
    - frontend/package.json
    - .agents/Rules/safety.md
  write:
    - backend/src/timetable/timetable.module.ts
    - backend/src/timetable/timetable.controller.ts
    - backend/src/timetable/timetable.controller.spec.ts
    - backend/src/timetable/timetable.service.ts
    - backend/src/timetable/timetable.service.spec.ts
    - backend/src/timetable/timetable.types.ts
    - backend/src/timetable/timetable-sync.service.ts
    - backend/src/timetable/timetable-sync.service.spec.ts
    - backend/src/timetable/dto/sync-timetable.dto.ts
    - backend/src/timetable/timetable-snapshot.schema.ts
    - backend/src/timetable/timetable-sync-state.schema.ts
    - backend/src/timetable/school-timetable.adapter.ts
    - backend/src/timetable/school-timetable.adapter.spec.ts
    - frontend/src/api/timetable-api.ts
    - frontend/src/api/timetable-api.test.ts
    - frontend/src/components/timetable/TimetableLookup.tsx
    - frontend/src/components/timetable/TimetableSyncPanel.tsx
    - frontend/src/components/timetable/TimetableSyncPanel.test.tsx
    - frontend/src/app/(dashboard)/timetable/page.tsx
  preserve:
    - "Existing timetable read roles, JWT validation, source origin restriction, timeout/redirect safeguards and server-only credentials."
    - "Existing filter identifiers and result/lesson fields, grid semantics and legitimate empty results; only additive synchronization metadata and explicit not-synchronized errors."
    - "Reuse NestJS/Mongoose schema and module patterns from tasks, existing ScheduleModule.forRoot, frontend HTTP client and authentication context."
    - "Store class schedules only, with no student personal records, cookies, credentials or raw source HTML in MongoDB/logs."
  out:
    - "Student-information lookup changes, individual enrollment schedules, new read permissions or delegation of synchronization to non-admin roles."
    - "User-triggered refresh on reads, live-source fallback, automatic full-school crawling, Redis introduction or dependency updates."
    - "Production data, deployment, commit/push, existing collection migration or deletion."
acceptance_criteria:
  - "AC-01: Existing permitted users read options/results from MongoDB with zero source calls, even during synchronization or source outage. Missing coverage returns an explicit not-synchronized state; a successfully synchronized empty schedule remains distinguishable."
  - "AC-02: Only the authenticated canonical ADMIN role can start synchronization, refresh the source catalog or change schedule settings. Unauthenticated calls return 401 and every non-admin direct mutation returns 403 with zero source/database side effects. UI visibility is not the authorization boundary."
  - "AC-03: Admin can load the source catalog explicitly, choose year/semester, classes and weeks, then start a bounded background job and inspect progress, success/failure and last successful update. Jobs return promptly with an ID and survive request disconnection."
  - "AC-04: Snapshot keys include all relevant source filter IDs and coverage. Per-selection atomic publication replaces the entire validated result, including removed lessons or valid empty results. Failures preserve the previous successful snapshot; partial jobs report coverage and failures accurately."
  - "AC-05: An atomic database lease prevents overlapping sync workers across replicas, includes owner token/expiry/renewal and fenced publication. Expired workers cannot overwrite newer results; process restart recovers or explicitly fails interrupted jobs without permanent locks."
  - "AC-06: Admin-managed periodic sync uses the same bounded worker, starts disabled, supports enable/disable plus a validated interval of at least 30 minutes and explicit saved coverage. Non-admin traffic cannot create/change jobs or enable schedules. Disabling prevents future starts."
  - "AC-07: Lookup displays snapshot timestamp and clear missing-data message; admin panel handles initial empty database, running/failed jobs and persisted schedule settings on desktop/mobile. Source catalog bootstrap is possible without already having local filter data."
  - "AC-08: On verified dev services, 20 concurrent authorized readers return correct isolated filter results and issue zero source requests; required unit/build/runtime checks and independent review pass. Record measured latency without claiming a production capacity threshold."
execution:
  - "E-01 [AC-01,AC-04,AC-05,AC-06] Add timetable-snapshot.schema.ts and timetable-sync-state.schema.ts (new files in existing timetable directory); follow tasks Mongoose decorators. Define unique normalized snapshot keys, bounded catalog/settings/job documents and atomic lease ownership. Register models/providers in timetable.module.ts. Avoid unbounded embedded semester datasets."
  - "E-02 [AC-02,AC-03,AC-06] Add dto/sync-timetable.dto.ts and timetable-sync.service.ts (new); extend controller with admin-only POST sync/catalog, POST sync, GET sync/status and GET/PATCH sync/settings routes before ambiguous handlers. Validate coverage against source catalog and cap each job at 100 class-week selections; one upstream workflow at a time. Persist bounded job status and operator ID; reuse existing adapter origin/parser protections. Source catalog reads are explicit admin operations."
  - "E-03 [AC-03,AC-04,AC-05,AC-06] Implement leased worker and scheduler in timetable-sync.service.ts using existing Nest scheduler. Renew lease, verify ownership on publication, bound retries and job history, and recover expired work. Update adapter only as needed for server-side sync contexts and bypassing stale adapter cache on explicit sync; add adapter regression tests. Publish each complete validated selection atomically and retain old data on source failure."
  - "E-04 [AC-01,AC-04] Change timetable.service.ts to local-only reads and derive dependent options from persisted catalog/coverage. Extend timetable.types.ts additively with freshness/coverage metadata. Define an explicit TIMETABLE_NOT_SYNCED response for absent coverage; do not present partial aggregate coverage as a complete empty result. Add service and controller tests for database-only behavior and guards."
  - "E-05 [AC-02,AC-03,AC-06,AC-07] Extend timetable-api.ts and its tests; add TimetableSyncPanel.tsx and test in the existing timetable component directory. Use existing auth context and HTTP client. Mount panel on timetable/page.tsx, show to admins only, expose catalog bootstrap, bounded coverage, manual sync, job status and disabled-by-default periodic settings. Update TimetableLookup.tsx for missing data and per-result freshness. Poll only while needed and stop on unmount."
  - "E-06 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06,AC-07,AC-08] Add timetable-sync.service.spec.ts; verify failures, concurrent lease acquisition, expiry/fencing, disabled scheduling and recovery. Run focused checks, verified dev browser/API scenarios and bounded independent review; record actual evidence before completion."
verification:
  - "V-01 [AC-01,AC-02,AC-04] npm --prefix backend test -- --runTestsByPath src/timetable/timetable.controller.spec.ts src/timetable/timetable.service.spec.ts --runInBand -> role denial, no upstream read calls, metadata and missing/empty distinctions pass."
  - "V-02 [AC-03,AC-04,AC-05,AC-06] npm --prefix backend test -- --runTestsByPath src/timetable/timetable-sync.service.spec.ts src/timetable/school-timetable.adapter.spec.ts src/timetable/timetable.parser.spec.ts --runInBand -> atomic publication, source failures, duplicate/restarted workers and schedule cases pass."
  - "V-03 [AC-02,AC-03,AC-06,AC-07] npm --prefix frontend test -- src/api/timetable-api.test.ts src/components/timetable/TimetableSyncPanel.test.tsx -> role visibility, bootstrap, API failures, settings and polling cleanup pass."
  - "V-04 [AC-01,AC-07] npm --prefix backend run build; npm --prefix frontend run typecheck; git diff --check -> no introduced compilation or whitespace errors."
  - "V-05 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06,AC-07,AC-08] Verified dev UI/API: admin bootstrap and sync a bounded class/week, compare lessons against source; student/teacher reads and denied direct sync/settings calls; missing/empty states, interrupted sync, source outage preserving old data, two worker contenders, schedule enable/disable and 20 concurrent readers. Record latency and zero source calls from readers; inspect desktop/mobile."
  - "V-06 [AC-08] Independent reviewer examines authorization, database publication, lease/fencing, job recovery and API compatibility; resolve findings and rerun affected checks. Self-review alone is insufficient."
runtime_test:
  targets: "Resolve dev frontend/API and MongoDB identities read-only before runtime mutations; verify separation from production and configured source access without printing secrets."
  resources: "Reserve task-specific timetable test documents and job/settings records on verified dev data services. Capture any existing settings before changes; do not modify shared timetable records without isolation."
  operations: "Authorized bounded dev inserts/updates, manual source reads, isolated scheduler tests and concurrent read requests; no source-system writes."
  cleanup: "Stop task-owned workers/pollers, remove only exact task-created test records and temporary instrumentation, restore captured dev settings; retain no credentials or raw source pages."
temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested taskscope"]
risks:
  - "Local data may lag behind the source; timestamps and explicit coverage are mandatory. Schedule interval is a policy floor, not an established source capacity guarantee."
  - "Database-backed coordination must remain safe across replicas and crashes. Source failures must never erase the last successful schedule."
stop_conditions:
  - "Planning only: stop after saving this scope; application implementation requires a subsequent request."
  - "Before pinned execution validate exact file identity, baseline and reservations; amend the scope for additional write paths or changed requirements."
  - "Stop dependent runtime work until dev service/data isolation is verified; missing mandatory runtime evidence or independent review prevents completion."
  - "If the source schedule is personal rather than class-shared, or cannot reliably distinguish valid empty data from parser failure, stop publication and resolve the data contract."
