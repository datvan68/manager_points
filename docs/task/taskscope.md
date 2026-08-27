task: "Make class-report saving retry-safe and suppress mobile selector autofocus"
pipeline: bug_fix
profile: Quick
objective: "Allow Ghi nhận lớp to save against an existing daily report without surfacing the duplicate-report conflict, and ensure the requested mobile class/criterion overlays open without focusing search."

evidence:
  current_behavior: "AddClassReportView creates one DailyClassReport per selected class before bulk-saving student records. A retry, a previously created report, or a partially completed multi-class save can therefore hit the backend uq_class_date constraint and expose `Daily class report already exists for this class and report date`. Both pages' mobile criterion dialogs still mark their search Input as autoFocus. AddRecordView does not pass the existing no-close/no-open-focus options to its mobile class RecordSelectionDialog."
  expected_behavior: "Saving resolves one active daily report per selected class/report day, reuses it when present, creates it only when absent, and continues the existing idempotent academic-record flow. Mobile criterion overlays on both forms, plus both class and criterion overlays on Ghi nhận HSSV, open without focusing search; the HSSV class overlay has no visible X."
  root_cause: "The frontend create flow assumes every selected class/date is new and has no conflict-recovery lookup. Separately, local criterion inputs retain autoFocus and the HSSV class selector does not opt into the shared mobile focus/close controls."

scope:
  inspect: ["frontend/src/api/daily-class-report-api.ts:getDailyClassReports/updateDailyClassReport contracts", "backend/src/daily-class-report/schemas/daily-class-report.schema.ts:uq_class_date invariant"]
  write: ["frontend/src/components/grading/AddClassReportView.tsx:resolve/reuse daily reports and mobile criterion focus", "frontend/src/components/grading/AddRecordView.tsx:mobile class/criterion focus and class close control", "frontend/src/components/grading/{AddClassReportView,AddRecordView,RecordSelectionUi}.test.tsx:focused regressions"]
  preserve: ["one active daily report per class/report date", "multi-class selection and report-to-class record mapping", "existing academic-record bulk idempotency keys and duplicate warning", "RBAC, edit mode, draft state, class/criterion search after manual tap", "current uncommitted responsive/full-height changes"]
  out: ["backend schema/index/API changes", "automatic restore or force-delete of soft-deleted reports", "deleting or replacing existing academic records", "desktop Select/Popover behavior", "global Dialog/Input defaults"]

acceptance_criteria:
  - "AC-01: In create mode, Ghi nhận lớp resolves each selected class against the exact report calendar day through the existing scoped daily-report API; an active matching report is updated with the current basic report fields and its ID is reused, while a missing report is created once."
  - "AC-02: A retry after a partial multi-class save and a create race that returns HTTP 409 both recover by refetching the matching active report and continue with the correct report ID per class; no second DailyClassReport is created and the raw English conflict is not shown."
  - "AC-03: Reusing a report does not delete its existing academic records. The current student/criterion rows continue through bulkCreateAcademicRecords with the existing report-scoped idempotency keys, and success/duplicate counts retain their current behavior."
  - "AC-04: If a 409 cannot be resolved to an accessible active report (including a soft-deleted or out-of-scope collision), saving stops without creating student records for an unresolved report and shows a clear Vietnamese recovery message; other API errors retain their normal handling."
  - "AC-05: On mobile Ghi nhận lớp, opening the criterion dialog leaves its search input unfocused and does not summon the software keyboard; tapping the input still focuses it and search/selection remain functional."
  - "AC-06: On mobile Ghi nhận HSSV, opening either the class or criterion dialog leaves search unfocused and does not summon the software keyboard; both inputs remain manually focusable and searchable."
  - "AC-07: The mobile Ghi nhận HSSV class dialog renders no visible X close control while retaining Hủy and supported outside/Escape dismissal; criterion and desktop overlay close behavior is unchanged."

execution:
  - "E-01 [AC-01..AC-04] AddClassReportView.tsx -> add a small report-day resolver using getDailyClassReports with classId/startDate/endDate, update-and-reuse an active match, create only when absent, and on create conflict refetch once before producing the Vietnamese unresolved-conflict error; use it for every selected class before building bulk record payloads."
  - "E-02 [AC-05] AddClassReportView.tsx -> remove criterion Input autoFocus and retain scoped DialogContent open-autofocus prevention."
  - "E-03 [AC-06,AC-07] AddRecordView.tsx -> pass mobileShowCloseButton=false and mobilePreventOpenAutoFocus to the class RecordSelectionDialog; remove criterion Input autoFocus while retaining scoped DialogContent open-autofocus prevention."
  - "E-04 [AC-01..AC-07] Add focused tests for existing-report reuse, create-409 refetch, unresolved conflict, correct per-class IDs/no record deletion, and the no-autofocus/no-X mobile contracts."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-07] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx src/components/grading/AddRecordView.test.tsx src/components/grading/RecordSelectionUi.test.tsx -> all focused tests pass."
  - "V-02 [AC-01..AC-07] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-01..AC-04] Manual create/retry at the same date with one class and with a partially existing multi-class selection -> one report per class/day, records attach to the correct report, save completes without the English conflict, and existing records remain."
  - "V-04 [AC-05..AC-07] Manual at 390x844 -> criterion overlay on Ghi nhận lớp and class/criterion overlays on Ghi nhận HSSV open without keyboard/focus; manual search works; the HSSV class overlay has no X and Hủy still closes it."

risks: ["Date lookup must use the same calendar-day boundary as the API and must select only an active exact class/day match.", "Updating an existing report must remain permission-scoped and must not turn a hidden soft-deleted collision into an implicit restore.", "A partially completed multi-class run must not map one class's records to another class's report ID."]
stop_conditions: ["Stop if product intent is to reject every attempt to add records to an existing class/day report rather than reuse it.", "Stop if a soft-deleted matching report must be restored automatically, because that changes deletion semantics and requires backend/index work."]
