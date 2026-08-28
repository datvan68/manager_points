task: "Improve mobile student search controls and class-aware lookup"
pipeline: feature_development
profile: Full
objective: "Header/sidebar student search has mobile-standard touch targets and returns authorized students by literal name, student code, or class text without weakening current load controls."

evidence:
  current_behavior: "frontend/src/components/students/StudentDirectorySearch.tsx uses 32px/compact action buttons in the pictured preview and record picker; backend/src/students/students.service.ts:findAll escapes search text but filters only full_name and student_code."
  expected_behavior: "Below sm, actionable controls are at least 44x44px (or 44px high for text buttons); a trimmed query matches its literal case-insensitive character sequence in student name/code or class_name, with class shown in existing results."
  root_cause: "StudentDirectorySearch hard-codes compact padding/sizes; StudentsService.findAll never resolves matching class IDs into its search $or."

scope:
  inspect: ["frontend/src/components/layout/Header.tsx and Sidebar.tsx:shared search mount/permissions", "backend/src/classes/schemas/class.schema.ts:class_name contract"]
  write: ["frontend/src/components/students/StudentDirectorySearch.tsx:search, result, preview, criterion, and footer actions", "frontend/src/components/students/StudentDirectorySearch.test.tsx:mobile/search regressions", "backend/src/students/students.service.ts:findAll search filter", "backend/src/students/test/students.service.spec.ts:findAll regressions"]
  preserve: ["GET /students query/response contract", "READ_STUDENT/teacher class scoping and CREATE_STUDENT_RECORD gate", "400ms debounce, AbortController/stale-response guard, minimum 2 characters, limit 20 slider request", "server max search length 100, page cap 50, throttle, escaped regex input", "desktop density, preview navigation, record idempotency/error behavior"]
  out: ["schema/index/migration changes", "fuzzy or accent-insensitive search", "other student lists", "header/sidebar redesign"]

acceptance_criteria:
  - "AC-01: At widths below sm, every actionable control in search results, student preview, and criterion picker has a >=44px touch target; sm+ remains compact and disabled/focus states remain visible."
  - "AC-02: A 2-100 character trimmed query returns authorized students when the literal case-insensitive sequence occurs in full_name, student_code, or class_name; regex metacharacters remain literal."
  - "AC-03: Class matching composes with classId/departmentId/teacher restrictions and never exposes students outside the requester's existing scope."
  - "AC-04: Search still sends one debounced, cancellable page-1 slider request capped at 20 results and preserves 429/generic error states."

execution:
  - "E-01 [AC-01] StudentDirectorySearch.tsx → add mobile min-h/min-w 11 and responsive sm overrides to all interactive rows/buttons without changing actions or badges."
  - "E-02 [AC-02..AC-03] students.service.ts:findAll → query matching class IDs using the escaped bounded search, add them to the existing $or, and retain top-level authorization/class filters plus lean/select-only class lookup."
  - "E-03 [AC-01,AC-04] StudentDirectorySearch.test.tsx → assert representative mobile target classes and unchanged debounce/cancel/bounded request behavior."
  - "E-04 [AC-02..AC-03] students.service.spec.ts → cover literal name/code filtering, class-name IDs, regex escaping, and teacher/class-scope composition."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-04] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx → focused suite passes."
  - "V-02 [AC-02..AC-03] npm --prefix backend test -- src/students/test/students.service.spec.ts --runInBand → findAll suite passes."
  - "V-03 [AC-01,AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-04 [AC-02..AC-03] npm --prefix backend run build → exits 0."
  - "V-05 [AC-01] Manual 375x812 viewport → close/detail/result/record/criterion/footer controls meet 44px target with no clipping or horizontal scroll."

risks: ["Class-name lookup adds one bounded database read per eligible search; keep projection lean and do not add schema/index changes without a separate approved scope.", "Student data/RBAC requires independent diff review before completion."]
stop_conditions: ["Stop if class search requires a new public parameter, schema/index migration, fuzzy/diacritic normalization, or relaxation of existing RBAC.", "Stop if dirty worktree changes overlap any write path before implementation."]
