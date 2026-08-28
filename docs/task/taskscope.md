task: "Split dashboard student records into three responsive groups"
pipeline: feature_development
profile: Full
objective: "Admin/teacher home shows separate Discipline, Rewards, and Bonus student lists in a desktop grid and mobile popovers, while class-aware header/sidebar search remains bounded and fast."

evidence:
  current_behavior: "At commit 30c48fe4, StudentDirectorySearch.tsx requests page 1 with limit 20, so a class query returns at most 20 authorized students. StudentSpotlightPanel.tsx renders four tabs and one active list; system.service.ts supplies ten items per highlight group."
  expected_behavior: "Class search stays capped at 20 results. For admin/teacher, the home spotlight removes High training scores, shows three simultaneous desktop cards, and below md shows only three category buttons whose popovers contain the corresponding student list."
  root_cause: "StudentSpotlightPanel is tab-driven, including a scores tab. The backend and fallback helper classify Bonus with criterion_type cong_diem OR any positive score, so positive Rewards can overlap the Bonus list."

scope:
  inspect: ["frontend/src/components/students/StudentDirectorySearch.tsx:debounced request cap", "frontend/src/components/ui/popover.tsx:existing Radix wrapper", "frontend/src/app/(dashboard)/page.tsx:StudentSpotlightPanel caller"]
  write: ["frontend/src/components/dashboard/StudentSpotlightPanel.tsx:admin/teacher spotlight", "frontend/src/components/dashboard/dashboard-responsive.test.tsx:layout/accessibility regressions", "frontend/src/components/dashboard/dashboard-helpers.ts:highlight fallback classification", "frontend/src/components/dashboard/dashboard-helpers.test.tsx:exclusive category regressions", "backend/src/system/system.service.ts:getDashboardMetrics highlight pipelines", "backend/src/system/system.service.spec.ts:dashboard aggregation regressions"]
  preserve: ["student-role personal spotlight", "DashboardMetrics and GET dashboard response fields, including topScores for compatibility", "semester, role, teacher-class, status, and soft-delete scoping", "ten students maximum per dashboard category", "student detail and /students/record navigation", "header/sidebar debounce, cancellation, errors, RBAC, page 1, and limit 20"]
  out: ["returning every student in a searched class", "search pagination/load-more", "dashboard API/schema/index changes", "other dashboard panels", "student record page redesign"]

acceptance_criteria:
  - "AC-01: A class-name search in header/sidebar returns the first authorized page only, with no more than 20 students; it does not fetch the entire class."
  - "AC-02: At md and wider, the admin/teacher spotlight has a three-column grid containing independent Discipline, Rewards, and Bonus cards and no High training scores control/card."
  - "AC-03: Below md, the three desktop cards are hidden and exactly three >=44px category buttons are visible; activating one opens a keyboard-accessible popover containing only that category's list, count, empty state, and student-detail actions."
  - "AC-04: Each category contains at most ten authorized students for the selected semester; records are mutually classified by criterion_type ky_luat, khen_thuong, or cong_diem, so Rewards are not included in Bonus totals/lists."
  - "AC-05: Student-role personal spotlight and existing navigation, loading, empty, focus, and responsive overflow behavior remain functional."

execution:
  - "E-01 [AC-04] backend/src/system/system.service.ts:getDashboardMetrics → make all three highlight pipelines use exact criterion_type filters while retaining base authorization/semester stages, ordering, projections, and limit 10."
  - "E-02 [AC-04] backend/src/system/system.service.spec.ts → assert three exact, exclusive criterion filters and unchanged limit 10/scoping stages."
  - "E-03 [AC-04] frontend/src/components/dashboard/dashboard-helpers.ts:buildDashboardOverview → align fallback aggregates and per-list records with exact criterion types."
  - "E-04 [AC-04] frontend/src/components/dashboard/dashboard-helpers.test.tsx → prove a positive khen_thuong record never contributes to topBonus and the three lists remain independently ranked."
  - "E-05 [AC-02..AC-03,AC-05] frontend/src/components/dashboard/StudentSpotlightPanel.tsx → replace admin/teacher four-tab state with shared category/list rendering, desktop grid cards, and mobile Radix popovers; keep the student branch unchanged."
  - "E-06 [AC-02..AC-03,AC-05] frontend/src/components/dashboard/dashboard-responsive.test.tsx → assert three desktop cards, three mobile triggers, no High training scores UI, and accessible names/focus/touch targets."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx → request remains page 1/limit 20."
  - "V-02 [AC-02..AC-05] npm --prefix frontend test -- src/components/dashboard/dashboard-responsive.test.tsx src/components/dashboard/dashboard-helpers.test.tsx → focused suites pass."
  - "V-03 [AC-04] npm --prefix backend test -- src/system/system.service.spec.ts --runInBand → dashboard aggregation suite passes."
  - "V-04 [AC-02..AC-05] npm --prefix frontend run typecheck → exits 0."
  - "V-05 [AC-04] npm --prefix backend run build → exits 0."
  - "V-06 [AC-02..AC-03,AC-05] Manual 375x812 and >=1024px viewports → mobile has three working popovers without horizontal scroll; desktop has three aligned list cards."

risks: ["Changing category filters can alter existing dashboard counts where legacy records have a score sign inconsistent with criterion_type; criterion_type is the schema-owned category and no data migration is included.", "Student data/RBAC and cross-package classification require independent diff review before completion."]
stop_conditions: ["Stop if product requires all students from a class search, pagination/load-more, or a cap other than 20.", "Stop if exact category separation requires schema/data migration or changes to public dashboard fields.", "Stop if dirty worktree changes overlap any write path before implementation."]
