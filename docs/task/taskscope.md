task: "Ưu tiên bảng học sinh cần chú ý theo số lượt ghi nhận"
pipeline: feature_development
profile: Full
objective: "Dashboard mở tab Kỷ luật & Chú ý đầu tiên, hiển thị số lượt thực tế theo từng loại ghi nhận và đếm đúng sinh viên có hơn 3 lượt kỷ luật/chú ý trong học kỳ đang chọn."

evidence:
  current_behavior: "frontend/src/components/dashboard/StudentSpotlightPanel.tsx mặc định rewards, render dạng thẻ và chỉ hiện ghi nhận mới nhất; frontend/src/components/dashboard/dashboard-helpers.ts tăng mỗi AcademicRecord đúng 1, dù backend AcademicRecord.quantity biểu diễn số lần, và tab Điểm cộng ưu tiên tổng điểm; KpiGrid.tsx dùng pendingMyReviewCount cho 'Hồ sơ cần xử lý'."
  expected_behavior: "Admin/giảng viên thấy Kỷ luật & Chú ý là tab đầu/mặc định; các tab Kỷ luật, Khen thưởng và Điểm cộng nhóm số lượt theo loại ghi nhận, xếp sinh viên giảm dần theo tổng số lượt; KPI admin là 'Sinh viên cần xử lý' và bằng số sinh viên có tổng lượt kỷ luật/chú ý > 3 trong phạm vi học kỳ/quyền hiện tại."
  root_cause: "AcademicRecord.quantity chưa có trong frontend/src/api/academic-record-api.ts và dashboard-helpers.ts đang dùng số document thay cho tổng quantity; StudentHighlightItem chỉ mang latestRecordTitle nên UI không thể trình bày các loại ghi nhận đã gộp."

scope:
  inspect: ["backend/src/academic-record/schemas/academic-record.schema.ts:quantity contract", "frontend/src/components/dashboard/dashboard-helpers.ts:buildDashboardOverview", "frontend/src/components/dashboard/StudentSpotlightPanel.tsx:admin/teacher tabs", "frontend/src/components/dashboard/KpiGrid.tsx:admin KPI"]
  write: ["frontend/src/api/academic-record-api.ts:AcademicRecord.quantity", "frontend/src/components/dashboard/dashboard-helpers.ts:StudentHighlightItem/buildDashboardOverview aggregation", "frontend/src/components/dashboard/StudentSpotlightPanel.tsx:tab order/default and table columns", "frontend/src/components/dashboard/KpiGrid.tsx:admin attention KPI", "frontend/src/components/dashboard/dashboard-helpers.test.tsx:aggregation and UI regression coverage"]
  preserve: ["semester, role, active/deleted record filters", "teacher 'Hồ sơ chờ phê duyệt' semantics", "student/system dashboard variants", "Điểm rèn luyện cao remains ordered by currentScore", "routes and backend/API schema"]
  out: ["backend mutation or migration", "threshold configuration UI", "dashboard redesign outside the spotlight/KPI panels"]

acceptance_criteria:
  - "AC-01: Kỷ luật & Chú ý is the first visible and initially active tab."
  - "AC-02: Discipline rows expose Họ và tên, Lớp, Số lượt, Điểm bị trừ, Ghi nhận; repeated records of one criterion are represented once with summed quantity."
  - "AC-03: Kỷ luật, Khen thưởng and Điểm cộng rank by total quantity descending, with existing domain score/date rules used only as ties; Điểm rèn luyện cao keeps score ordering."
  - "AC-04: Admin KPI title is 'Sinh viên cần xử lý' and value is the distinct in-scope student count with discipline/warning recordCount > 3; exactly 3 is excluded. Teacher approval KPI is unchanged."

execution:
  - "E-01 [AC-02..AC-04] academic-record-api.ts/dashboard-helpers.ts → type quantity, normalize invalid/missing quantity to 1, aggregate per student and criterion, expose grouped labels/counts, and derive the >3 count from topDiscipline."
  - "E-02 [AC-01..AC-03] StudentSpotlightPanel.tsx → reorder/default tabs and render the requested discipline columns; reuse grouped-count presentation for Khen thưởng/Điểm cộng without changing score-tab ranking."
  - "E-03 [AC-04] KpiGrid.tsx → replace only the admin card label/value/description with the derived student-attention metric."
  - "E-04 [AC-01..AC-04] dashboard-helpers.test.tsx → cover quantity grouping, descending order, threshold boundaries, default tab/columns, and teacher KPI preservation."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/dashboard/dashboard-helpers.test.tsx → focused Vitest suite passes."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-03 [AC-01..AC-04] git diff --check -- frontend/src/api/academic-record-api.ts frontend/src/components/dashboard/dashboard-helpers.ts frontend/src/components/dashboard/StudentSpotlightPanel.tsx frontend/src/components/dashboard/KpiGrid.tsx frontend/src/components/dashboard/dashboard-helpers.test.tsx → exits 0."

risks: ["quantity is a backend occurrence count while points_effect may already be the total score impact; multiply points only if repository fixtures prove it is per-unit, otherwise preserve points_effect to avoid double counting."]

stop_conditions: ["Stop if product expects the >3 threshold across all positive and negative records rather than discipline/warning records.", "Stop if grouped 'Ghi nhận' must support drill-down or editing, which expands navigation/API scope.", "Stop if implementing quantity requires a backend contract or migration change."]
