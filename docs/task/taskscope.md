task: "Default to student recording and compact dashboard cards"
pipeline: feature_development
profile: Quick
objective: "Open student management on Ghi nhận by default and compact the two mobile dashboard cards shown in the reference."

evidence:
  current_behavior: "Sidebar.tsx:allMenuItems links Học sinh sinh viên to /students; DashboardHeader stacks refresh below the greeting before md; StudentSpotlightPanel renders the old title and subtitle."
  expected_behavior: "The primary entry opens /students/record; mobile greeting and refresh share one row; spotlight shows Ghi nhận học sinh sinh viên without a subtitle."
  root_cause: "The menu targets the list route, header groups stack on mobile, and spotlight copy is hard-coded."

scope:
  inspect: ["frontend/src/components/ui/TabNavigation.tsx:route-active behavior", "C:/Users/hoang/AppData/Local/Temp/codex-clipboard-a85185c5-d934-4770-b078-fa73a58820e8.png:mobile reference"]
  write: ["frontend/src/components/layout/Sidebar.tsx:allMenuItems", "frontend/src/components/dashboard/DashboardHeader.tsx:header layout", "frontend/src/components/dashboard/StudentSpotlightPanel.tsx:title block", "frontend/src/components/layout/Sidebar.test.tsx", "frontend/src/components/dashboard/dashboard-responsive.test.tsx"]
  preserve: ["Danh sách/Nhiệm vụ routes", "route-specific active states", "RBAC", "refresh/semester behavior", "spotlight data, tabs, and CTA", "desktop layout", "accessible names"]
  out: ["backend/API", "route redirects", "dashboard data", "other card redesigns"]

acceptance_criteria:
  - "AC-01: The primary Học sinh sinh viên menu targets /students/record and Ghi nhận is active; choosing Danh sách still opens /students with Danh sách active."
  - "AC-02: Below sm, Xin chào, role icon, and refresh icon stay on one compact row; refresh remains functional, disabled while loading, keyboard-visible, and accessibly named."
  - "AC-03: Spotlight displays exactly Ghi nhận học sinh sinh viên with no subtitle; its CTA, tabs, counts, and records are unchanged."

execution:
  - "E-01 [AC-01] Sidebar.tsx:allMenuItems → change the primary student destination to /students/record."
  - "E-02 [AC-02] DashboardHeader.tsx → place greeting/role/refresh in the mobile top row; retain semester controls and sm+ layout."
  - "E-03 [AC-03] StudentSpotlightPanel.tsx → replace heading, remove subtitle, and tighten title spacing."
  - "E-04 [AC-01..AC-03] Extend focused sidebar and dashboard responsive tests."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01] npm --prefix frontend test -- src/components/layout/Sidebar.test.tsx"
  - "V-02 [AC-02..AC-03] npm --prefix frontend test -- src/components/dashboard/dashboard-responsive.test.tsx src/app/(dashboard)/page.test.tsx"
  - "V-03 [AC-01..AC-03] npm --prefix frontend run typecheck"

risks: ["Refresh must not be duplicated or displace the semester selector on narrow screens."]
stop_conditions: ["Stop if Ghi nhận must replace deep-link behavior or make /students unavailable; that changes routing semantics."]
