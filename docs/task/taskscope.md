task: "Loại bỏ giật khung hình khi xoá hàng loạt ghi nhận HSSV"
pipeline: bug_fix
profile: Quick
objective: "Xoá mềm/vĩnh viễn 500 ghi nhận HSSV không làm khựng UI; tiến trình và kết quả từng phần vẫn chính xác."

evidence:
  current_behavior: "page.tsx:runBulkRecordDelete chia 25 ID/lô; 500 ID gây 20 lần cập nhật list/progress. Bảng chính map hàng + selectedIds.includes; thùng rác map toàn bộ deletedRecords."
  expected_behavior: "Chỉ progress đổi theo lô; danh sách lớn đồng bộ một lần khi hoàn tất."
  root_cause: "page.tsx:runBulkRecordDelete cập nhật list/selection/progress sau mỗi await, render lại cây hàng 20 lần; selectedIds.includes lặp tuyến tính trên từng hàng."

scope:
  inspect: ["docs/design/DESIGN.compact.md:tokens/motion", "frontend/src/api/academic-record-api.ts:bulk contracts"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:bulk delete/rows/progress", "frontend/src/app/(dashboard)/students/record/page.test.tsx:regressions"]
  preserve: ["RBAC", "25-ID sequential batches", "duplicate lock", "failed IDs selected/visible", "delete semantics/final refetch"]
  out: ["Tình hình lớp học", "backend/API/schema", "unrelated table redesign"]

acceptance_criteria:
  - "AC-01: Với 500 ID, progress tăng theo lô nhưng row subtree không reconcile theo lô; UI vẫn phản hồi."
  - "AC-02: Kết thúc chỉ loại hàng thành công một lần, giữ hàng lỗi/selection/message, refetch một lần và chặn xoá trùng."
  - "AC-03: Dialog có processed/total, %, active/success/partial, progressbar ARIA, khóa đóng khi chạy và đúng glass/radius/motion trong docs/design."

execution:
  - "E-01 [AC-01,AC-02] page.tsx:runBulkRecordDelete -> gom kết quả ngoài list state; reconcile/refetch một lần cuối."
  - "E-02 [AC-01] page.tsx:row subtrees -> memo hóa với props/callback ổn định, Set membership; bỏ stagger theo index cho list lớn."
  - "E-03 [AC-03] page.tsx:progress dialog -> dựng compact-glass status/result UI có ARIA và running lock."
  - "E-04 [AC-01..AC-03] page.test.tsx -> kiểm tra multi-batch progress, deferred reconciliation, partial failure, duplicate lock, accessibility."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' -> focused suite passes."
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-01] Dev + React Profiler, 500 hàng ở bảng/thùng rác -> không có per-batch row commits hay input/scroll stall."

risks: ["Reconcile 500 hàng cuối luồng vẫn cần profiler xác nhận không rớt khung hình đáng kể."]
stop_conditions: ["Dừng nếu contract API khác hiện trạng hoặc cần đổi backend/public contract."]
