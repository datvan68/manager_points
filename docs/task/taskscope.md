task: "Center desktop student preview in the viewport"
pipeline: bug_fix
profile: Quick
objective: "Selecting a student from desktop header search opens the basic-information popover at the exact center of the browser viewport while mobile and tablet behavior remains unchanged."

evidence:
  current_behavior: "StudentDirectorySearch.tsx renders the preview as a fixed descendant; Header.tsx mounts it inside a sticky backdrop-filtered header, so the fixed layer can use the header as its containing block and appear clipped/offset at the top. Sidebar.tsx owns the current mobile/tablet surface."
  expected_behavior: "Desktop preview is viewport-centered as shown by a full-screen overlay; mobile/tablet search and preview retain their current layout and interactions."

scope:
  write: ["frontend/src/components/students/StudentDirectorySearch.tsx: optional desktop-only portal target", "frontend/src/components/layout/Header.tsx: enable viewport portal for desktop search", "frontend/src/components/students/StudentDirectorySearch.test.tsx: portal and interaction regression"]
  preserve: ["preview content, close/outside-click/Escape/focus behavior, Chi tiết navigation", "Sidebar.tsx and all mobile/tablet breakpoint behavior"]
  out: ["Search results, API/RBAC, student data, responsive redesign"]

acceptance_criteria:
  - "AC-01: Clicking a desktop search result renders the preview overlay under document.body, with fixed inset-0 flex centering and no header clipping."
  - "AC-02: Preview fields and Đóng, outside-click, Escape, focus, and Chi tiết actions behave exactly as before."
  - "AC-03: Below the desktop breakpoint, DOM placement, styling, positioning, and search-to-preview flow are unchanged."

execution:
  - "E-01 [AC-01..AC-03] Add an opt-in preview portal to StudentDirectorySearch; keep inline rendering as the default."
  - "E-02 [AC-01] Enable the opt-in only from Header; do not modify Sidebar."
  - "E-03 [AC-01,AC-02] Test portal placement and retained close/navigation behavior."

verification:
  - "V-01 [AC-01,AC-02] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx"
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck"
  - "V-03 [AC-01,AC-03] Manual checks at 1280 px, 768 px, and 390 px: desktop centered; tablet/mobile unchanged."

risks: ["Portal event boundaries can affect outside-click handling; preserve the current overlay target check."]
stop_conditions: ["Stop if fixing desktop requires changing Sidebar or existing responsive breakpoints."]

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]
