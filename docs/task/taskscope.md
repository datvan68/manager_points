task: "Move student search to global header and mobile navigation"
pipeline: feature_development
profile: Full
objective: "Authorized users can open student search from the desktop header or the exact center of the mobile bottom navigation, scroll results beyond eight visible rows, and select a student to view the existing basic-information preview."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/page.tsx:StudentsPageContent embeds StudentDirectorySearch only in the Danh sách tab; Header.tsx renders an inert desktop search button; Sidebar.tsx has no centered mobile search action. StudentDirectorySearch.tsx debounces 400 ms, requests only 8 slider rows, and opens an accessible basic-information dialog."
  expected_behavior: "Remove the fixed search from /students; both global triggers open the same search flow, whose result viewport shows at most eight rows before vertical scrolling, then replaces the result surface with the selected student's basic-information preview."
  root_cause: "Search ownership is local to StudentsPageContent and the shared layout triggers are not wired to StudentDirectorySearch."

scope:
  inspect: ["backend/src/students/students.service.ts:findAll requester scoping and slider projection", "frontend/src/globals.css:.mobile-bottom-nav layout contract"]
  write: ["frontend/src/components/students/StudentDirectorySearch.tsx:controlled global search/preview surface", "frontend/src/components/layout/Header.tsx:desktop trigger and anchored surface", "frontend/src/components/layout/Sidebar.tsx:center mobile trigger and surface", "frontend/src/app/(dashboard)/students/page.tsx:remove tab-local search", "frontend/src/components/students/StudentDirectorySearch.test.tsx:search/scroll/preview regressions", "frontend/src/components/layout/Header.test.tsx:desktop trigger contract", "frontend/src/components/layout/Sidebar.test.tsx:center mobile trigger contract", "frontend/src/globals.css:mobile centered-action spacing only if required"]
  preserve: ["400 ms debounce, two-character threshold, request cancellation, loading/empty/429/error states, Escape/outside close, keyboard focus, detail navigation", "backend requester scoping: student=self, teacher=assigned classes, and existing authorized staff scope", "notification/profile/header actions and existing mobile destinations"]
  out: ["Backend/API/schema changes", "Changing student detail or edit forms", "Search on public/portal routes", "Unrelated header/sidebar redesign"]

acceptance_criteria:
  - "AC-01: The Danh sách sinh viên tab no longer contains a permanently rendered student-search input."
  - "AC-02: On desktop, the existing header search button opens and focuses a student-name/code input; close, Escape, outside-click, loading, empty, throttled, and generic-error states are usable."
  - "AC-03: Matching results render name, code, and class in a dropdown capped to eight row-heights; a larger first page can be reached by vertical scroll without expanding the surface."
  - "AC-04: Selecting a result closes/replaces the options and opens the existing basic-information preview; its close and Chi tiết navigation behaviors remain intact."
  - "AC-05: Below 768 px, a labeled search icon is visually centered in the bottom navigation and runs the same input → scrollable options → basic preview flow without covering safe-area navigation."
  - "AC-06: The trigger is absent for users outside existing student-read scope; no query can broaden backend requester filtering or returned slider fields."

execution:
  - "E-01 [AC-02,AC-03,AC-04,AC-06] StudentDirectorySearch.tsx → make the surface reusable/controlled, focus on open, request a backend-supported first page greater than eight, cap list height to eight rows with overflow-y-auto, and retain preview/accessibility/error behavior."
  - "E-02 [AC-02,AC-06] Header.tsx → wire the desktop button to the reusable surface and gate it with existing role/permission helpers."
  - "E-03 [AC-05,AC-06] Sidebar.tsx and globals.css → insert the gated search action at the visual center, preserve destination order/touch targets, and position the mobile surface above the safe-area nav."
  - "E-04 [AC-01] students/page.tsx → remove StudentDirectorySearch, its import, and local detail callback only when unused."
  - "E-05 [AC-01..AC-06] focused test files → cover visibility, focus/close states, >8-result scrolling, selection transition, navigation, permissions, and responsive trigger placement."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-02,AC-03,AC-04] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx → interaction tests pass, including >8 results with a scroll container."
  - "V-02 [AC-02,AC-05,AC-06] npm --prefix frontend test -- src/components/layout/Header.test.tsx src/components/layout/Sidebar.test.tsx → desktop/mobile trigger, center placement, and permission tests pass."
  - "V-03 [AC-01..AC-06] npm --prefix frontend run typecheck → no TypeScript errors."
  - "V-04 [AC-01..AC-06] Manual viewport checks at 1280 px and 390 px with 10+ matches → local input absent; desktop and centered-mobile flows show eight rows plus scroll, then the basic preview."

risks: ["Moving personal-data search into the global shell can expose it on more routes; UI gating and existing backend requester scoping must both remain effective.", "The mobile nav has dynamic role-based item counts, so visual centering must be verified for admin, teacher, and student menus."]
stop_conditions: ["Stop for approval if implementation requires broader student visibility, new returned fields, or a backend authorization change.", "Stop if exact center placement would require removing or reordering an existing mobile destination without product approval."]
