task: "Expose latest locked training score on student profile"
pipeline: bug_fix
profile: Quick
objective: "A student profile distinguishes a failed latest-score request from no locked score and continues to show the most recent locked prior-semester result."

evidence:
  current_behavior: "Runtime data for Nguyễn Lê Hoàng Thọ has a locked HK2 2025-2026 summary (85, Tốt) and an active HK1 2026-2027 draft; frontend/src/app/(dashboard)/profile/page.tsx previously mapped both API failures and null to the same empty label."
  expected_behavior: "The latest locked summary, including one from an inactive semester, is displayed; an API failure is visibly reported; null remains a valid empty state."
  root_cause: "frontend/src/app/(dashboard)/profile/page.tsx:fetchProfile swallowed getMyLatestSummary errors. backend/src/summaries-point/summaries-point.service.ts:findLatestForStudent already queries the student's latest locked summary without restricting it to the active semester."

scope:
  inspect: ["frontend/src/app/(dashboard)/profile/page.tsx:fetchProfile and latest-score render", "backend/src/summaries-point/summaries-point.service.ts:findLatestForStudent"]
  write: ["frontend/src/app/(dashboard)/profile/page.tsx:resolveLatestSummaryState/fetchProfile/render", "frontend/src/app/(dashboard)/profile/page.test.tsx:latest-score state tests"]
  preserve: ["GET /summaries-points/me/latest contract and its no-semester-filter behavior", "locked-score rank, total, and semester display", "null as the legitimate no-locked-score state"]
  out: ["MongoDB data changes, summary locking workflow, semester status changes, API/RBAC contract changes"]

acceptance_criteria:
  - "AC-01: A locked summary from a prior inactive semester renders its rank, score, and semester."
  - "AC-02: A null API response renders 'Chưa có điểm rèn luyện đã chốt'."
  - "AC-03: A latest-summary request failure renders a loading-error message, not the empty-data message."

execution:
  - "E-01 [AC-01, AC-02, AC-03] frontend/src/app/(dashboard)/profile/page.tsx:resolveLatestSummaryState/fetchProfile → retain request errors separately and render locked, empty, and error states distinctly."
  - "E-02 [AC-01, AC-02, AC-03] frontend/src/app/(dashboard)/profile/page.test.tsx → cover locked prior-semester input, null, and error states."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01, AC-02, AC-03] npm --prefix frontend test -- src/app/(dashboard)/profile/page.test.tsx → all latest-score state tests pass."

risks: ["The already-locked prior-semester record is correctly selected by the backend; any remaining live failure is likely API/auth/network related and must be observed without changing data."]
stop_conditions: ["The authenticated endpoint returns null or an error despite the confirmed linked student and locked summary; stop for a scoped API/auth investigation rather than altering persistent data."]
