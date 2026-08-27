task: "Streamline quick multi-student recording layout and mobile confirmation flow"
pipeline: feature_development
profile: Full
objective: "Both Ghi nhận lớp and Ghi nhận HSSV use only the quick multi-student workflow: criteria live in Thông tin cơ bản, desktop shows one student-card roster on the right, and mobile selects then saves students through an overlay after class and criterion are complete."

evidence:
  current_behavior: "AddClassReportView.tsx and AddRecordView.tsx render a manual/quick mode switch, duplicate criterion controls inside the right-hand recording card, and inline student cards. RecordSelectionDialog also renders a visible title and description above search, matching the supplied mobile screenshot."
  expected_behavior: "The class selector opens directly at search/list content without a visible header; no manual-entry choice or fields remain; the criterion selector is inside Thông tin cơ bản; desktop's right column contains only one roster card; mobile opens a draft student-card overlay once class and criterion prerequisites are committed, and its confirmation saves the record."
  root_cause: "The views still share layout and state branches for legacy manual entry, while selection prerequisites and the quick roster are colocated in the right-hand entry card instead of being split between basic information and a responsive roster surface."

scope:
  inspect: ["frontend/src/app/(dashboard)/students/record/page.tsx:view routing", "frontend/src/components/ui/{dialog,popover}.tsx:overlay semantics"]
  write: ["frontend/src/components/grading/RecordSelectionUi.tsx:headerless selection overlay and reusable student-card confirmation behavior", "frontend/src/components/grading/AddClassReportView.tsx:quick-only layout, criterion placement and mobile save overlay", "frontend/src/components/grading/AddRecordView.tsx:quick-only layout, criterion placement and mobile save overlay", "frontend/src/components/grading/RecordSelectionUi.test.tsx:overlay accessibility/commit regressions", "frontend/src/components/grading/{AddClassReportView,AddRecordView}.test.tsx:quick-only state and mobile selection/save regressions"]
  preserve: ["multi-class roster union/deduplication, class search/confirm/cancel, date/teacher/class-note fields, RBAC, validation and existing API payloads", "edit-mode prefill and update contracts; editing may present its existing selected student without restoring a manual/quick mode switch", "legacy persisted drafts remain readable or are safely normalized to quick mode"]
  out: ["backend/API/schema changes", "record-list page redesign", "global dialog/popover primitives", "automatic saving before an explicit mobile confirmation"]

acceptance_criteria:
  - "AC-01: On both forms, opening the class selector shows search, selectable class rows and the Hủy/Xác nhận footer without a visible title or description block; the overlay retains an accessible name and existing multi-class commit/cancel behavior."
  - "AC-02: Create mode renders no Nhập thủ công/Chọn nhanh mode buttons, single-student input, manual add action, or manual-only staged table; student selection is exclusively multi-select through student cards."
  - "AC-03: Each form renders its criterion selector exactly once inside the Thông tin cơ bản card, after the class control and before the remaining basic fields; changing criterion preserves committed records and clears only unconfirmed selections tied to the previous criterion."
  - "AC-04: At widths >=768 px, the right column contains one roster card with student cards and its scoped loading/empty/count/load-more feedback, with no mode switch, nested entry form, or duplicate criterion control; selecting cards continues to stage/destage the corresponding student-and-criterion pairs."
  - "AC-05: Below 768 px, the inline right-column roster is hidden. After at least one class and one criterion are committed, the student-card overlay opens for the current criterion; users can select/deselect multiple students in draft state, Hủy closes without saving, and Xác nhận submits the selected records through the existing save flow."
  - "AC-06: The mobile overlay does not open while class or criterion is missing, does not reopen in a loop after cancel/confirm, prevents duplicate student-and-criterion records, exposes selection state through aria-selected plus a visible indicator, and keeps controls/cards at least 44 px high without horizontal overflow."
  - "AC-07: Existing edit behavior, multi-class roster loading, validation, idempotency, notifications and create/update API payload shapes remain unchanged except for removal of the manual-entry path and mobile confirmation timing."

execution:
  - "E-01 [AC-01,AC-05,AC-06] RecordSelectionUi.tsx -> make the visible header optional/headerless while retaining accessible dialog semantics; support draft card selection with explicit cancel/confirm and mobile touch sizing."
  - "E-02 [AC-02..AC-07] AddClassReportView.tsx -> remove the manual/quick branch and obsolete manual controls, move criterion selection into Thông tin cơ bản, reduce desktop right content to one roster card, and route mobile roster confirmation to the existing save handler."
  - "E-03 [AC-02..AC-07] AddRecordView.tsx -> apply the same quick-only structure and mobile confirmation flow while preserving its record edit/update contract."
  - "E-04 [AC-01..AC-07] Update the three focused test files for headerless accessible overlays, prerequisite gating, draft cancel, confirm-and-save, duplicate protection, legacy draft normalization and desktop/mobile visibility contracts."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-07] npm --prefix frontend test -- src/components/grading/RecordSelectionUi.test.tsx src/components/grading/AddClassReportView.test.tsx src/components/grading/AddRecordView.test.tsx -> all focused tests pass."
  - "V-02 [AC-01..AC-07] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-01,AC-04] Manual at 1280 px on both create forms -> class selector has no visible header; criterion appears once on the left; the right side is one student-card roster; no entry-mode/manual UI remains."
  - "V-04 [AC-05,AC-06] Manual at 390x844 on both create forms -> no inline roster; missing prerequisites do not open the overlay; completed prerequisites open it once; cancel discards draft selection; confirm saves selected cards once; targets are >=44 px and no horizontal overflow occurs."
  - "V-05 [AC-07] Manual edit smoke test for one class report and one HSSV record -> existing values prefill and update through the unchanged API contract."

risks: ["Auto-opening from prerequisite state can loop after dismissal; track the handled class/criterion selection key and reset it only when prerequisites materially change.", "Mobile confirmation now triggers persistence rather than merely committing UI state; reuse the existing guarded save path so validation, idempotency and error handling remain intact.", "Removing entryMode can invalidate stored drafts; retain backward-compatible parsing and normalize legacy manual drafts without rendering the removed workflow."]
stop_conditions: ["Stop if the mobile confirmation must alter backend/public payloads, save multiple edited persisted records in one request, or replace global overlay primitives.", "Stop for product direction if mobile Xác nhận is intended to stage selections only rather than persist the recording, because that changes AC-05 and save timing."]
