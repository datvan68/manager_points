task: "Khôi phục panel trì hoãn và trả đủ 10 dòng bảng xếp hạng"
pipeline: bug_fix
profile: Full
objective: "Các panel phía dưới dashboard luôn được kích hoạt khi gần viewport sau khi dữ liệu tải xong, và API cung cấp tối đa 10 học sinh cho cả bốn tab bảng xếp hạng."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/page.tsx:deferred-panels effect dùng dependency [] và đọc deferredPanelsSentinelRef khi render loading chưa có sentinel, nên observer không được đăng ký lại; backend/src/system/system.service.ts:getDashboardMetrics vẫn dùng limit(5)/$limit: 5 cho topScores, rewardsAgg, bonusAgg và disciplineAgg dù StudentSpotlightPanel.tsx đã render list.slice(0, 10)."
  expected_behavior: "Sau khi metrics xuất hiện, dashboard gắn observer vào sentinel hiện hữu và tải cụm panel dưới khi gần viewport; mỗi leaderboard trả/render tối đa 10 học sinh theo đúng thứ tự hiện hành."
  root_cause: "Lifecycle của observer kết thúc trước khi sentinel được mount; giới hạn 5 nằm ở nguồn dữ liệu backend nên thay đổi cap phía frontend không thể tạo thêm dòng."

scope:
  inspect: ["frontend/src/app/(dashboard)/page.tsx:loading branches/deferred observer", "frontend/src/components/dashboard/DashboardDeferredPanels.tsx:role-specific panel composition", "frontend/src/components/dashboard/StudentSpotlightPanel.tsx:getTabList/list.slice", "backend/src/system/system.service.ts:getDashboardMetrics highlight queries", "frontend/src/app/(dashboard)/page.test.tsx and backend/src/system/system.service.spec.ts:nearest regression suites"]
  write: ["frontend/src/app/(dashboard)/page.tsx:deferred observer lifecycle", "frontend/src/app/(dashboard)/page.test.tsx:observer lifecycle regression", "backend/src/system/system.service.ts:getDashboardMetrics leaderboard limits", "backend/src/system/system.service.spec.ts:leaderboard limit regression"]
  preserve: ["one dashboard-metrics request, in-flight request coalescing, timeout/error/retry and semester selection", "next/dynamic split, placeholder, 640px preload margin and no-IntersectionObserver fallback", "current role-based panel visibility/order", "leaderboard filters, aggregation, quantity semantics, sort/tie-break rules, response shape and RBAC"]
  out: ["new endpoint/schema/dependency", "dashboard redesign or pagination", "changes to unrelated recent-list limits", "global CSS or non-dashboard performance work"]

acceptance_criteria:
  - "AC-01: When metrics finish loading in a browser with IntersectionObserver, the sentinel is observed; intersecting it mounts QuickActions and the role-appropriate lower panels exactly once."
  - "AC-02: Without IntersectionObserver, lower panels mount through the existing fallback; loading, error and missing-metrics states do not throw or duplicate dashboard requests."
  - "AC-03: getDashboardMetrics returns at most 10 ordered entries for topScores, topRewards, topBonus and topDiscipline when at least 10 eligible students exist; fewer eligible students are returned unchanged and item 11 is excluded."
  - "AC-04: StudentSpotlightPanel displays all 10 supplied entries on every non-empty admin/teacher leaderboard tab while preserving tab order, empty states, row ordering and mobile overflow behavior."

execution:
  - "E-01 [AC-01,AC-02] frontend/src/app/(dashboard)/page.tsx:DashboardPage → bind observer setup to the post-metrics sentinel lifecycle (dependency or callback-ref pattern), disconnect after activation/unmount, and keep the current dynamic chunk/fallback behavior."
  - "E-02 [AC-03] backend/src/system/system.service.ts:getDashboardMetrics → replace only the five leaderboard caps (teacher/non-teacher topScores plus rewards/bonus/discipline aggregation stages) from 5 to 10; leave recentAcademicRecords and other recent-list caps unchanged."
  - "E-03 [AC-01,AC-02,AC-04] frontend/src/app/(dashboard)/page.test.tsx → add a jsdom render regression that starts without a sentinel, resolves metrics, verifies observer registration, triggers intersection, and asserts deferred content/fallback mounting without duplicate API calls; retain the 10/not-11 UI contract."
  - "E-04 [AC-03] backend/src/system/system.service.spec.ts:getDashboardMetrics → assert both topScores query branches use limit(10) and all three highlight pipelines contain $limit: 10, with no change to unrelated limit(5) recent lists."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02,AC-04] npm --prefix frontend test -- src/app/(dashboard)/page.test.tsx → observer lifecycle, fallback, row cap and request-coalescing tests pass."
  - "V-02 [AC-03] npm --prefix backend test -- system/system.service.spec.ts --runInBand → leaderboard limit regressions pass."
  - "V-03 [AC-01..AC-04] npm --prefix frontend run typecheck && npm --prefix backend run build → both exit 0."
  - "V-04 [AC-01,AC-03,AC-04] browser check with at least 11 eligible fixtures → lower panels appear before/when scrolled near them; each tab exposes rows 1–10 and never row 11."
  - "V-05 [AC-01..AC-04] git diff --check -- frontend/src/app/(dashboard)/page.tsx frontend/src/app/(dashboard)/page.test.tsx backend/src/system/system.service.ts backend/src/system/system.service.spec.ts docs/task/taskscope.md → exits 0."

risks: ["Increasing four leaderboard payloads raises dashboard response size; cap remains 10 and existing aggregation/index filters must stay intact.", "Observer tests must reproduce the initial loading render; source-string assertions alone would not catch the confirmed lifecycle failure."]
stop_conditions: ["Stop if returning 10 entries requires changing response DTO/schema or RBAC.", "Stop if lower panels have mount-time side effects that cannot safely remain deferred.", "Stop if the five leaderboard limits cannot be isolated from unrelated recent-list limit(5) calls by tests."]
