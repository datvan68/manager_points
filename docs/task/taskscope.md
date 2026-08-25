task: "Replace department filter with protected student directory search"
pipeline: feature_development
profile: Full
objective: "Authorized staff can search accessible students from the student-list page, preview one student's basic information, and open the existing detail page without creating excessive client or server load."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/page.tsx:StudentsPageContent renders Research with 'Tìm kiếm khoa...' and filters only the already-loaded department array; backend/src/students/students.service.ts:findAll already supports RBAC-aware search/pagination and fields=slider, but accepts unescaped regex text and uncapped page/limit values."
  expected_behavior: "The left-column search queries students visible to the requester, shows a bounded result list, opens a compact basic-information modal on result selection, and navigates through /students/{classId}/{studentId}."
  root_cause: null

scope:
  inspect:
    - "frontend/src/app/(dashboard)/students/[classId]/page.tsx:student drawer and detail navigation conventions"
    - "backend/src/core/rate-limit/rate-limit.module.ts:shared Redis-backed production throttling"
  write:
    - "frontend/src/app/(dashboard)/students/page.tsx:StudentsPageContent"
    - "frontend/src/components/students/StudentDirectorySearch.tsx:student search/results/preview UI"
    - "frontend/src/components/students/StudentDirectorySearch.test.tsx:interaction and request-control coverage"
    - "frontend/src/api/student-api.ts:studentApi.getStudents optional AbortSignal"
    - "backend/src/students/students.controller.ts:findAll query throttling"
    - "backend/src/students/students.service.ts:findAll input normalization and bounded lightweight search"
    - "backend/src/students/test/students.service.spec.ts:search safety/RBAC/limit coverage"
    - "backend/src/students/test/students.controller.spec.ts:route throttle metadata coverage"
  preserve:
    - "Department selection, class cards, responsive class navigation, JwtAuthGuard, and teacher/student visibility restrictions"
    - "Existing GET /students response shapes for callers not using the new search UI"
  out:
    - "Student schema/index migration, fuzzy-search service, cross-user result cache, detail-page redesign, or permission changes"

acceptance_criteria:
  - "AC-01: 'Tìm kiếm sinh viên...' replaces department filtering; fewer than 2 trimmed characters performs no request, and 400 ms debounce issues page=1, limit=8, fields=slider."
  - "AC-02: A newer query aborts or invalidates the previous request; loading, empty, API-error, and HTTP 429 states are visible without clearing department/class state."
  - "AC-03: Selecting a result opens an accessible compact modal showing name, student code, class, date of birth, sex, email, and study status from the reduced payload."
  - "AC-04: 'Chi tiết' closes the modal and opens /students/{classId}/{studentId}; it is disabled with an explanation when class_id is absent, and closing/focus behavior is keyboard accessible."
  - "AC-05: Search remains JWT/RBAC-scoped, escapes regex metacharacters, trims/length-bounds input, clamps positive page/limit values (server maximum 50), and never returns more fields than fields=slider currently permits."
  - "AC-06: GET /students has a stricter shared throttle (burst 20/10 s, sustained 120/min) while the existing global Redis production store and standard 429 contract remain unchanged."

execution:
  - "E-01 [AC-05,AC-06] backend/src/students/students.controller.ts and students.service.ts → normalize/escape search, clamp pagination, retain requester filters and reduced projection, and apply named route throttles."
  - "E-02 [AC-01,AC-02] frontend/src/api/student-api.ts and StudentDirectorySearch.tsx → add cancellable bounded search with debounce and explicit result states."
  - "E-03 [AC-03,AC-04] StudentDirectorySearch.tsx and students/page.tsx → replace the department Research control, add preview modal, and use the populated class id for existing detail routing."
  - "E-04 [AC-01..AC-06] focused frontend/backend specs → cover timing, stale response, modal/navigation, RBAC filter preservation, regex escaping, caps, and throttle configuration."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx → all interaction tests pass."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-03 [AC-05,AC-06] npm --prefix backend test -- students/test/students.service.spec.ts students/test/students.controller.spec.ts --runInBand → focused Jest suites pass."
  - "V-04 [AC-05,AC-06] npm --prefix backend run build → exits 0."
  - "V-05 [AC-01..AC-04] Manual desktop/mobile: search by name/code, select result, close by Escape, and follow Chi tiết; department/class selection remains usable."

risks:
  - "Student results contain personal data; reduced fields, existing RBAC filters, and no shared result cache are mandatory."
  - "The stricter GET /students throttle also covers class-list pagination callers; focused tests and manual load-more checks must detect regressions."
stop_conditions:
  - "Stop if product requires typo-tolerant/global search, per-account rather than current IP-based throttling, a new permission, schema/index migration, or a different destination for students without class_id."
