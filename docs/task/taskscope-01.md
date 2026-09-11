---
slot_id: "taskscope-01"
generation: 2
task_id: "20260911-094028-school-timetable-page"
scope_file: "docs/task/taskscope-01.md"
status: blocked
scope_revision: 6
created_at: "2026-09-11T09:40:28+07:00"
updated_at: "2026-09-11T10:49:00+07:00"
base_commit: "2119f64d1f831456a8423c6775bb3a71e933c6b0"
task: "Build the school timetable lookup page"
pipeline: feature_development
profile: Full
objective: "Provide a Vietnamese /timetable page in Manager Point that submits school lookup filters to a NestJS adapter and displays normalized weekly timetable results in a class/session/period/day grid."
coordination:
  depends_on: []
  warnings:
    - "Slot 00 is an empty legacy file and remains untouched. Slot 01 generation 1 has valid completion evidence and is reused. No active write reservations or dirty paths were found at planning baseline."
    - "Execution started from the exact user-pinned ready scope; implementation and verification are in progress."
  decisions:
    - "User confirmed HSSV viewers and one dedicated backend school account able to query all timetables. Plan read-only lookup of all source classes for authenticated HSSV; no mapping to assigned local classes or per-user school login."
  blockers:
    - "V-04 source/API verification passed, but final authenticated browser interaction and desktop/mobile rendered-grid verification are blocked by Chrome reporting another extension UI open on the local timetable tab; no password was entered or automated."
    - "Mandatory V-05 independent review was dispatched after the latest fixes but did not return within bounded waits; completion cannot claim fresh review evidence."
  runtime_prerequisites:
    - "The operator must securely supply TIMETABLE_SOURCE_USERNAME and TIMETABLE_SOURCE_PASSWORD to the backend process before real login testing. No credentials were requested, read, exported or provisioned in this planning task."
    - "Successful backend login, automatic reauthentication and populated end-to-end UI/API verification remain mandatory implementation checks. The browser session proves access only, not the dedicated backend account contract."
  readiness_basis: "The fixed-origin unauthenticated redirect/login form and populated timetable DOM now establish an implementable adapter/parser contract. Missing runtime credentials block dependent live checks, not synthetic implementation work; runtime prerequisites cannot be marked passed from browser access or mocks."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: ["backend/package.json", "backend/package-lock.json", "backend/src/app.module.ts", "backend/src/timetable/", "frontend/src/api/timetable-api.ts", "frontend/src/api/timetable-api.test.ts", "frontend/src/app/(dashboard)/timetable/page.tsx", "frontend/src/components/timetable/", "frontend/src/components/layout/Sidebar.tsx", "frontend/src/components/layout/Sidebar.test.tsx"]
  checks_passed: ["V-01 backend focused tests: 3 suites / 10 tests passed after guard and HTTP error mapping fixes", "V-02 frontend focused tests: 4 suites / 22 tests passed", "V-03 backend build, frontend typecheck and git diff --check passed", "V-04 source adapter populated query returned 10 lessons across days 1-5 and periods 13-18; valid empty class/week returned isEmpty=true; invalid week returned SOURCE_INVALID_SELECTION; cache identity was isolated and reused; unauthenticated dev API returned 401"]
  cleanup_pending: ["V-04 browser rendered-grid and mobile verification after Chrome extension UI is dismissed", "V-05 fresh independent review result after latest fixes"]
evidence:
  current_behavior: "At the recorded commit, targeted searches of backend/src and frontend/src found no pmdt/ScheduleOfClass/timetable integration. backend/src/app.module.ts registers domain modules and global config/cache. backend/src/classes/classes.controller.ts uses JwtAuthGuard and requester-scoped class reads; this is not authority to expose all external classes."
  expected_behavior: "A dedicated source adapter returns typed options and timetable data to the existing frontend HTTP client; users see filters and a weekly grid with explicit loading, empty, access-denied and upstream-error states."
  root_cause: null
  reference: "codex://threads/01a08e44-8f1b-72e0-b9e5-03404ce87cb2 reports POST Web Forms at https://pmdt.namsaigon.edu.vn/Pages/Sims/ScheduleOfClass.aspx?pt=4, dynamic hidden state and dependent dropdown postbacks. Its observed lookup was empty; conclusions are prior observations, not fresh verification."
  live_inspection:
    - "2026-09-11: no school tab was initially listed; reopening the exact timetable URL in the in-app browser reused an effective authenticated session. A separate credential-free HTTP GET redirected to https://pmdt.namsaigon.edu.vn/dang-nhap.html."
    - "Login form method POST, action ./dang-nhap.html. Username field ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName; password field ctl00$cphMain1$MainLogin1$DemoLogin1$txtPassword; visible submit ctl00$cphMain1$MainLogin1$DemoLogin1$btnLogin; alternate btnActionLogin also exists. Read current hidden inputs including __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION, __EVENTTARGET and __EVENTARGUMENT for each form. Field names were inspected without values; no login was submitted."
    - "Selected year value 2025, semester 2, week label 55/value 54. Year/semester/faculty/course have onchange postbacks; week/class do not. Blank faculty/course/class with search returned two classes, each with evening periods 13-18 and five lesson cells spanning periods 13-16, Monday-Friday. A single sample class at weeks 55 and 50 returned an authentic header-only empty table."
    - "Result table within [id$=udpContent] uses ten logical columns, repeated header rows, rowSpan=6 for class and evening session, rowSpan=4 for populated lessons and blank nonbreaking-space cells. Lesson lines are separated by br: subject display name, room, teacher, source time/duration text. The source displays 06:00-09:15 (4h) in evening rows; preserve this string without guessing a 24-hour conversion or equating h with periods."
  patterns:
    - "frontend/src/api/class-api.ts: httpClient, handleResponse and API_BASE convention."
    - "frontend/src/app/(dashboard)/tasks/page.tsx: dashboard main/scroll container; frontend/src/components/layout/Sidebar.tsx: allMenuItems and dynamic visibility."
    - "backend/src/classes/test/classes.controller.spec.ts: Nest testing convention; frontend/src/api/daily-class-report-api.test.ts: Vitest HTTP mocks."
scope:
  inspect:
    - "backend/src/classes/"
    - "backend/src/auth/guards/"
    - "backend/src/core/rate-limit/"
    - "backend/src/main.ts"
    - "backend/package.json"
    - "frontend/package.json"
    - "frontend/src/api/http-client.ts"
    - "frontend/src/components/guards/RouteGuard.tsx"
    - "frontend/src/providers/auth-provider.tsx"
    - "frontend/src/components/ui/"
    - "scripts/dev-host.sh"
    - "docker-compose.dev-infra.yml"
    - "https://pmdt.namsaigon.edu.vn/Pages/Sims/ScheduleOfClass.aspx?pt=4"
  write:
    - "backend/package.json"
    - "backend/package-lock.json"
    - "backend/src/timetable/timetable.config.ts"
    - "backend/src/app.module.ts"
    - "backend/src/timetable/timetable.module.ts"
    - "backend/src/timetable/timetable.controller.ts"
    - "backend/src/timetable/timetable.service.ts"
    - "backend/src/timetable/school-timetable.adapter.ts"
    - "backend/src/timetable/timetable.parser.ts"
    - "backend/src/timetable/timetable.types.ts"
    - "backend/src/timetable/dto/query-timetable.dto.ts"
    - "backend/src/timetable/timetable.controller.spec.ts"
    - "backend/src/timetable/school-timetable.adapter.spec.ts"
    - "backend/src/timetable/timetable.parser.spec.ts"
    - "frontend/src/api/timetable-api.ts"
    - "frontend/src/api/timetable-api.test.ts"
    - "frontend/src/app/(dashboard)/timetable/page.tsx"
    - "frontend/src/components/timetable/TimetableLookup.tsx"
    - "frontend/src/components/timetable/TimetableGrid.tsx"
    - "frontend/src/components/timetable/TimetableLookup.test.tsx"
    - "frontend/src/components/timetable/TimetableGrid.test.tsx"
    - "frontend/src/components/layout/Sidebar.tsx"
    - "frontend/src/components/layout/Sidebar.test.tsx"
  preserve:
    - "Existing authentication, requester scoping and dynamic route permissions; UI visibility never replaces backend authorization."
    - "Existing API endpoints, MongoDB schemas/data, classes and activity-schedules behavior. External IDs remain opaque strings distinct from MongoDB IDs."
    - "Credentials, cookies, hidden form tokens and raw source HTML remain server-side and absent from logs, client responses and committed fixtures."
  out:
    - "Production deployment, commit/push, credential provisioning, permission database mutations and migrations."
    - "Editing the school timetable, scheduled synchronization, persistent timetable storage, Excel/PDF export and public unauthenticated access."
    - "Automatic matching of school classes to Manager Point classes by display name."
    - "Runtime secret files and deployment configuration remain outside writes; only the named backend package manifests and timetable.config.ts may change for this adapter."
acceptance_criteria:
  - "AC-01: Authenticated HSSV can load the page, option lists and timetable for all source classes; direct API calls enforce the HSSV access policy, reject unauthenticated/non-HSSV requests and never return source secrets. Do not add other viewer roles without an explicit scope decision."
  - "AC-02: UI provides Niên học, Học kỳ, Tuần, Khoa, Khóa, Lớp and Tìm kiếm. Options use source label/value pairs; changing a parent resets/reloads affected descendants. Stale responses cannot overwrite newer selections."
  - "AC-03: Adapter follows verified Web Forms state/postbacks, retains the correct cookie context, validates filter values, bounds request time/concurrency/retries and distinguishes session expiry, timeout, invalid selection and changed source markup from a valid empty result."
  - "AC-04: Typed JSON preserves source class/week labels and values and normalized lessons with day, start/end periods, subject display text, optional subject code, teacher, room or safe online URL, plus source time/duration display text. Do not invent subject codes or equate display duration with rowSpan. Populated source data matches the parsed result; no fixed offset is inferred from week labels."
  - "AC-05: Grid shows Lớp học, Buổi, Tiết and Monday through Sunday, including evening periods through 18, with merged lesson cells based on an occupancy grid that accounts for rowSpan/colSpan and skips repeated headers, all lessons retained, legible desktop layout and horizontal mobile scrolling. Empty, loading and failure states are distinct; results always identify the filters that produced them."
  - "AC-06: Short-lived bounded caching is isolated by effective source access context and full query; concurrent requests cannot cross-contaminate Web Forms state or expose results across users. Upstream errors are not cached as empty schedules."
execution:
  - "E-00 [AC-01,AC-03,AC-04] Retain the resolved HSSV/all-source-classes policy and use the live_inspection contract. New timetable.config.ts reads TIMETABLE_SOURCE_USERNAME and TIMETABLE_SOURCE_PASSWORD through ConfigService at runtime; never include real values or NEXT_PUBLIC settings. Use a fixed HTTPS school origin, 15-second request timeout, at most one reauthentication/replay, a 60-second result cache and at most 100 cache entries. New domain files follow existing backend/src and frontend/src parents; no provisioning is performed by code changes."
  - "E-01 [AC-01,AC-02,AC-04] New timetable.types.ts and dto/query-timetable.dto.ts define opaque option values and validated query/response contracts. Proposed internal routes are GET /timetable/options with parent filters and GET /timetable with the selected filters; confirm global API prefix in main.ts. New controller/module/service plus app.module.ts registration enforce the resolved access policy and return typed results using existing Nest conventions."
  - "E-02 [AC-03,AC-04,AC-06] New school-timetable.adapter.ts GETs the observed login form, POSTs its current hidden fields and named credential controls server-side, retains cookies and verifies access by GETting the timetable page. Restrict redirects to the fixed origin and detect returned login forms as session expiry. Use native fetch with manual redirect handling and tough-cookie for the cookie jar; add cheerio for HTML parsing in the named backend manifests after confirming package/runtime compatibility. Serialize each complete form workflow and bound its queue; cache only successful normalized results after access checks. timetable.parser.ts reconstructs logical cell occupancy from rowSpan/colSpan, skips repeated headers, preserves period labels and source display lines, and distinguishes valid empty tables from missing/changed markup. Do not use browser automation or browser-cookie extraction as the production adapter."
  - "E-03 [AC-01,AC-03,AC-04,AC-06] New backend spec files cover actual parsed synthetic HTML, refreshed token submission, expiry/redirect/timeout/markup failures, input validation, denied direct access, cache isolation and concurrent requests. Include multi-period cells, blank cells, multiple lessons and label/value mismatch; do not merely assert implementation structure."
  - "E-04 [AC-01,AC-02,AC-05] New timetable-api.ts uses existing httpClient/handleResponse; new page.tsx, TimetableLookup.tsx and TimetableGrid.tsx build controlled filters and the weekly table. Reuse existing controls and RouteGuard under the resolved policy. Add the Vietnamese timetable navigation item in Sidebar.tsx with matching visibility. Render source text as text and allow only safe link schemes."
  - "E-05 [AC-01,AC-02,AC-05] New frontend tests and Sidebar.test.tsx cover dependent option reset, opaque values, out-of-order requests, loading/empty/error states, lesson merge geometry and navigation access. Run affected checks and dev UI/API scenarios, then obtain the required independent review before declaring implementation complete."
verification:
  - "V-01 [AC-01,AC-03,AC-04,AC-06] npm --prefix backend test -- --runTestsByPath src/timetable/timetable.controller.spec.ts src/timetable/school-timetable.adapter.spec.ts src/timetable/timetable.parser.spec.ts --runInBand -> all meaningful success/failure/isolation assertions pass."
  - "V-02 [AC-01,AC-02,AC-05] npm --prefix frontend test -- src/api/timetable-api.test.ts src/components/timetable/TimetableLookup.test.tsx src/components/timetable/TimetableGrid.test.tsx src/components/layout/Sidebar.test.tsx -> suites pass including stale-response and denial cases."
  - "V-03 [AC-01,AC-04,AC-05] npm --prefix backend run build and npm --prefix frontend run typecheck -> both exit 0. git diff --check -> no whitespace errors."
  - "V-04 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06] On verified dev, query an authorized populated class/week and compare every rendered lesson with source; change parents rapidly, test valid empty week and controlled expired-session/upstream failure, then direct denied API access. Inspect desktop and 390px mobile layout and repeated-query cache behavior. No mock-only substitute for populated-source verification."
  - "V-05 [AC-01,AC-03,AC-06] Independent reviewer inspects scoped diff and evidence for auth enforcement, secret handling, redirect destination restrictions, concurrency and cache isolation; resolve material findings and rerun affected checks."
runtime_test:
  targets: "At test start verify effective dev frontend/API and data-service isolation using non-secret metadata. School origin is an external read-only integration, not a local dev data service; use only the authorized access context."
  resources: "Read selected school classes/weeks and existing dev viewer accounts. No school writes, local DB mutations, raw-cookie exports or bulk scraping."
  scenarios: "Populated and empty results; dependent filters; denied access; session expiry; upstream failure; repeated and concurrent queries; desktop/mobile grid."
  pass_signal: "Source and rendered lessons agree, correct error states appear, access/context isolation holds and source secrets never reach the browser."
  cleanup: "Discard task-created session/cache state and temporary source captures; retain only synthetic test fixtures, never real source data."
review:
  required: true
  trigger: "New external-session secret handling, authorization boundary and concurrent/cache state."
  availability: "A bounded independent reviewer subagent is available through collaboration tools; pipeline.md explicitly authorizes this required review during execution. No agent is needed for this planning deliverable."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "The populated DOM and unauthenticated login form are verified; successful dedicated-account login and expiry recovery are not yet tested. Source variants beyond the observed evening table require focused checks during implementation."
  - "The dedicated account supports all-class lookup for HSSV. Keep server-side session mutation serialized or isolated and keep all upstream credentials inaccessible to viewers."
stop_conditions:
  - "Implementation starts only when the user pins this exact ready scope for execution; the current request authorizes inspection and scope update only."
  - "Stop dependent work if source login requires an unapproved credential operation, CAPTCHA bypass, unverified destination or unsupported authentication flow."
  - "Stop and amend scope if resolved access policy needs additional permission/mapping/configuration/dependency files or persistent data changes."
  - "Stop runtime actions if dev isolation or authorized source access cannot be verified; do not mark live ACs passed from mocks."
---
