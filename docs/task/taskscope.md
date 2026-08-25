task: "Expand the violation student grid and scope class-report visibility"
pipeline: feature_development
profile: Full
objective: "The class-record form gives the student-card grid more usable space without clipping, while non-admin class-report readers see only reports they created unless granted explicit full-view permission."

evidence:
  current_behavior: "frontend/src/components/grading/AddClassReportView.tsx renders a desktop attendance summary below the violation section; its quick list combines responsive columns with quickGridClass fixed pixel heights and lg:min-h-0 cards. backend/src/daily-class-report/daily-class-report.service.ts:getScopeFilter grants Supervisor all reports and Teacher reports for advised classes; findAll does not default to reported_by=requester.userId."
  expected_behavior: "Remove the pictured attendance summary, use the released area for complete grid rows/cards, and enforce creator-only class-report listing for every non-admin without READ_ALL_CLASS_RECORD. Admin or a user assigned READ_ALL_CLASS_RECORD sees all reports allowed by existing query filters."
  root_cause: "The redundant summary consumes vertical space while fixed max-heights and shrinkable card rows can cut content. Report visibility is role-based instead of ownership plus an explicit full-view capability."

scope:
  inspect: ["frontend/src/components/grading/{AddClassReportView.tsx,RecordSelectionUi.tsx}: violation layout and shared six-card viewport", "frontend/src/components/grading/{AddClassReportView.test.tsx,RecordSelectionUi.test.tsx}: nearest UI regressions", "backend/src/daily-class-report/{daily-class-report.service.ts,daily-class-report.service.spec.ts}: list scope and pagination", "backend/src/auth/{permissions.registry.ts,services/auth.service.ts,test/auth.service.spec.ts}: assignable permissions, route actions, and RBAC seed"]
  write: ["frontend/src/components/grading/AddClassReportView.tsx: remove summary and preserve complete card height", "frontend/src/components/grading/RecordSelectionUi.tsx: grid-row-based six-card viewport", "frontend/src/components/grading/{AddClassReportView.test.tsx,RecordSelectionUi.test.tsx}: layout regressions", "backend/src/daily-class-report/{daily-class-report.service.ts,daily-class-report.service.spec.ts}: ownership/full-view filtering", "backend/src/auth/{permissions.registry.ts,services/auth.service.ts,test/auth.service.spec.ts}: READ_ALL_CLASS_RECORD registration and seed coverage"]
  preserve: ["Quick selection, criterion selection, 0-6 no-scroll and 7+ scroll behavior, loading/empty/load-more states, manual-entry table, and save payloads", "Existing class/date/search pagination contract and reported_by population", "Admin unrestricted visibility and existing READ_CLASS_RECORD requirement to access the tab"]
  out: ["DailyClassReport schema/migration changes", "Academic/HSSV record visibility", "Create/update/delete authorization changes", "Unrelated reports-page or permission-page redesign"]

acceptance_criteria:
  - "AC-01: The class violation form no longer renders the Sĩ số lớp/Hiện diện/Vắng mặt/% Chuyên cần summary shown in the attachment, and the violation card area expands into that space."
  - "AC-02: At every existing responsive column breakpoint, student cards use non-shrinking grid rows; up to six cards are fully visible, while 7+ cards scroll after exactly six complete cards with no text/card clipping."
  - "AC-03: GET /daily-class-reports combines existing class/date/search/deleted filters with reported_by=current user for every non-admin lacking READ_ALL_CLASS_RECORD; response data and meta.total obey the same ownership filter."
  - "AC-04: Admin and non-admin users assigned READ_ALL_CLASS_RECORD receive the full filtered result set; READ_ALL_CLASS_RECORD is visible/assignable in the grading permission group and /grading action permissions without being granted automatically to ordinary roles."

execution:
  - "E-01 [AC-01,AC-02] frontend/src/components/grading/{AddClassReportView.tsx,RecordSelectionUi.tsx} → remove the summary, keep card min-height at compact desktop widths, and calculate overflow from responsive grid rows representing six cards rather than unrelated fixed container heights."
  - "E-02 [AC-01,AC-02] frontend/src/components/grading/{AddClassReportView.test.tsx,RecordSelectionUi.test.tsx} → assert summary removal and complete 6/7-card grid viewport classes."
  - "E-03 [AC-03,AC-04] backend/src/auth/{permissions.registry.ts,services/auth.service.ts} → register READ_ALL_CLASS_RECORD in G_GRADING and /grading actions while preserving custom role assignments."
  - "E-04 [AC-03,AC-04] backend/src/daily-class-report/daily-class-report.service.ts:getScopeFilter/findAll → return unrestricted scope only for Admin or READ_ALL_CLASS_RECORD; otherwise add a reported_by ObjectId ownership filter before all list filters/counts."
  - "E-05 [AC-03,AC-04] backend/src/daily-class-report/daily-class-report.service.spec.ts and backend/src/auth/test/auth.service.spec.ts → cover owner-only, full-permission/Admin bypass, meta filtering, and permission seeding."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx src/components/grading/RecordSelectionUi.test.tsx → both suites pass."
  - "V-02 [AC-01,AC-02] npm --prefix frontend run typecheck → exit code 0."
  - "V-03 [AC-03,AC-04] npm --prefix backend test -- src/daily-class-report/daily-class-report.service.spec.ts src/auth/test/auth.service.spec.ts --runInBand → both suites pass."
  - "V-04 [AC-03,AC-04] npm --prefix backend run build → exit code 0."
  - "V-05 [AC-01,AC-02,AC-03,AC-04] Manual /students/record check at compact desktop and with owner/non-owner/full-view accounts → complete card rows and correct table totals/rows."

risks: ["Authorization change affects every consumer of GET /daily-class-reports, so ownership must be applied before countDocuments and data queries; RBAC seeding must not auto-grant the new permission to existing non-admin roles."]
stop_conditions: ["Stop if full visibility should retain Teacher/advisor class scope instead of global filtered visibility, if any non-admin role must receive READ_ALL_CLASS_RECORD by default, or if direct detail/deleted endpoints must be included beyond the requested table list. A permission deployment/seed execution requires separate approval; this task only changes and verifies code."]
