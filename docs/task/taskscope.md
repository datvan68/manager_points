task: "Redesign permissions user toolbar and mobile list"
pipeline: feature_development
profile: Quick
objective: "Người dùng exposes direct role/status filters and a compact virtualized infinite mobile list while retaining desktop pagination."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/permissions/page.tsx:PermissionsPageContent nests both filters in Bộ lọc and gives paginatedUsers to every breakpoint. ActivityListWorkspace.tsx uses 36px translucent rounded toolbar controls. ResponsiveDataView supports hidden mobile pagination, footer/ref, and virtualization."
  expected_behavior: "Two Activities-style toolbar filters; compact mobile cards load progressively without pagination."
  root_cause: "Nested controls and one paginated dataset prevent direct filtering and progressive mobile rendering."

scope:
  inspect: ["frontend/src/components/activities/ActivityListWorkspace.tsx:toolbar", "frontend/src/components/ui/ResponsiveDataView.tsx:mobile list props"]
  write: ["frontend/src/app/(dashboard)/permissions/page.tsx:PermissionsPageContent", "frontend/src/app/(dashboard)/permissions/user-list.test.tsx"]
  preserve: ["Search/filter semantics, bulk actions, CRUD/impersonation, other RBAC tabs, desktop CustomPagination", "authApi.getUsers contract"]
  out: ["Backend pagination", "Shared component redesign"]

acceptance_criteria:
  - "AC-01: Vai trò and Trạng thái are separate toolbar controls, filter immediately, and Bộ lọc is removed."
  - "AC-02: All toolbar controls use Activities' 36px translucent rounded style and wrap readably at 375px without horizontal overflow."
  - "AC-03: Below md, pagination is hidden; virtualized cards start with one batch and a sentinel appends batches through all filtered users."
  - "AC-04: Query changes reset mobile count/scroll; desktop paging and page-size behavior remain unchanged."

execution:
  - "E-01 [AC-01,AC-02] page.tsx:PermissionsPageContent → replace popover with two labeled Select controls and responsive Activities-style toolbar layout."
  - "E-02 [AC-03,AC-04] page.tsx:PermissionsPageContent → add md detection, visible-count/sentinel/reset logic, responsive dataset selection, mobileVirtualization, and hidePaginationOnMobile."
  - "E-03 [AC-01,AC-03,AC-04] user-list.test.tsx → cover direct filters, sentinel append/reset, mobile props, and desktop paging."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-03,AC-04] npm --prefix frontend test -- src/app/(dashboard)/permissions/user-list.test.tsx → pass."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exit 0."
  - "V-03 [AC-02,AC-03] Manual /permissions > Người dùng at 375px/desktop → compact direct filters; mobile infinite virtual list without pagination; desktop pagination visible."

risks: ["getUsers still downloads all users; virtualization reduces rendered nodes, not network payload."]
stop_conditions: ["Stop if mobile requires server pagination, status should become single-select, or breakpoint differs from md."]
