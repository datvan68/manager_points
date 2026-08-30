task: "Complete grouped student record summaries"
pipeline: feature_development
profile: Full
objective: "Each student group in Tình hình HSSV shows every applicable record type as distinct color-coded icons, displays the algebraic sum of all matching positive and negative score contributions, and converges immediately after add/update/delete events without concurrent or per-event refetch storms."

evidence:
  current_behavior: "The in-progress grouped implementation returns recordTypes/totalPoints and renders Award, PlusCircle, and Gavel. Its score helper uses existing score-engine contribution semantics, but the required mixed-sign example and a more recognizable discipline icon are not yet explicit in the scope."
  expected_behavior: "totalPoints adds each active matching record's signed effective contribution: negative discipline contributions reduce positive contributions. For example, if two discipline records contribute -3 in total and three positive records contribute +5 in total, the group displays +2. Discipline uses a rose ShieldAlert icon, visually distinct from green Award and blue PlusCircle, with no visible type text."
  root_cause: "Without an explicit algebraic-sum regression, implementations can sum absolute values or one sign only; Gavel is not sufficiently recognizable for the discipline category."

scope:
  inspect: ["backend/src/academic-record/score-engine.service.ts:getCriterionContribution and calculate rules used to derive each signed contribution"]
  write: ["backend/src/academic-record/academic-record.service.ts:findAll grouped totalPoints calculation", "backend/src/academic-record/academic-record.service.spec.ts:mixed-sign grouped total regression", "frontend/src/app/(dashboard)/students/record/page.tsx:discipline icon and grouped total rendering", "frontend/src/app/(dashboard)/students/record/page.test.tsx:icon and +2 mixed-sign display regressions", "frontend/src/api/academic-record-api.ts:AcademicRecordStudentGroup contract when required by the grouped response"]
  preserve: ["RBAC and all existing list filters are applied before aggregation", "GET /academic-records without groupBy remains record-level and backward compatible", "latestRecord, recordCount, New badge, ordering, pagination, and full-history drawer remain available", "edit/delete/export continue to target explicit academic record IDs", "SSE class/semester scoping, reconnect behavior, immediate leading refresh, burst coalescing, and in-flight trailing refresh"]
  out: ["MongoDB schema/migration or denormalized score fields", "grading formula or sign-rule changes", "redesign of the full-history drawer", "cross-process SSE/Redis infrastructure"]

acceptance_criteria:
  - "AC-01: A group containing one, two, or all three criterion types returns a deterministic de-duplicated recordTypes set; table/card render green Award for khen_thuong, blue PlusCircle for cong_diem, and rose ShieldAlert for ky_luat, with no visible type text and an aria-label/title on every icon."
  - "AC-02: totalPoints is the algebraic sum of every active matching record's effective signed contribution under existing count/quantity, selected-option, and manual-score semantics; a fixture whose two discipline records total -3 and whose three positive records total +5 returns and displays +2."
  - "AC-03: Negative contributions are not converted to absolute values, omitted, or multiplied by record count after their per-record effective contribution is calculated; zero and positive totals keep their numeric value and positive totals retain the leading + display."
  - "AC-04: After a successful local add/update/delete or the first matching academic_record_changed SSE event, visible groups refresh without manual reload or a fixed delay; changes can update latest/count/types/total/order and deleting the final matching record removes the group."
  - "AC-05: During an SSE burst or an event received while a list request is in flight, the page performs no concurrent grouped-list requests, coalesces the burst, and runs at most one trailing refresh so the last event is not lost."
  - "AC-06: Grouped metadata, filters, RBAC, default record-level API, full-history detail, and explicit record mutation targets retain their current behavior."

execution:
  - "E-01 [AC-02,AC-03,AC-06] backend/src/academic-record/academic-record.service.ts:findAll -> sum signed per-record contributions produced with ScoreEngineService semantics; do not infer sign from record count or criterion label and do not change the default branch."
  - "E-02 [AC-01,AC-02,AC-03] frontend/src/app/(dashboard)/students/record/page.tsx -> replace Gavel with ShieldAlert for ky_luat and render the signed totalPoints returned for the group in table/card/export-facing grouped values."
  - "E-03 [AC-04,AC-05] frontend/src/app/(dashboard)/students/record/page.tsx -> retain leading realtime invalidation plus in-flight dirty state and immediate local mutation reconciliation."
  - "E-04 [AC-01..AC-06] focused backend/frontend specs -> add the exact two-negative/three-positive fixture, assert +2 end to end, assert ShieldAlert accessibility/color, and retain grouping/filter/realtime regressions."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-02,AC-03,AC-06] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand -> mixed-sign +2, score semantics, RBAC/filter, and default-contract cases pass."
  - "V-02 [AC-01..AC-06] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' -> ShieldAlert, +2 display, mutation, and realtime coalescing cases pass."
  - "V-03 [AC-01..AC-06] npm --prefix backend run build; npm --prefix frontend run typecheck -> both exit 0."

risks: ["A record's effective score may already incorporate quantity; multiplying again during grouping would double count it.", "Duplicating score-engine rules inside grouping can drift; parity tests must cover every supported action type and both signs.", "Realtime invalidation remains concurrency-sensitive and must not lose an event received during an active fetch."]
stop_conditions: ["Stop if the example means each of two records is -3 and each of three records is +5, rather than their category subtotals being -3 and +5.", "Stop if totalPoints must ignore active list filters and instead use an entire-semester SummaryPoint total.", "Stop if exact score parity requires a schema migration, denormalization, or grading formula change.", "Stop if realtime guarantees must work across multiple backend processes, because that requires approved shared pub/sub infrastructure."]
