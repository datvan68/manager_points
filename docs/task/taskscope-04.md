slot_id: "taskscope-04"
generation: 3
task_id: "20260905-094605-add-ranked-roster-student-suggestions"
scope_file: "docs/task/taskscope-04.md"
status: in_progress
scope_revision: 1
created_at: "2026-09-05T09:46:05+07:00"
updated_at: "2026-09-05T10:00:00+07:00"
base_commit: "598ee28d9e3b626eb8b5febf7e8e7d46f9fc084a"
task: "Rank likely students by name and date of birth in the manual KTX roster linking table"
pipeline: feature
profile: Full
environment: development
risk_level: medium
objective: "When an operator opens `Liên kết sinh viên`, show a deterministic, explainable ranking of current students whose name and date of birth are closest to the unresolved KTX roster entry, while retaining manual search and explicit confirmation."

coordination:
  depends_on: []
  warnings:
    - "Date of birth is personal data; expose it only through the existing DORM_REG_UPDATE-protected candidate endpoint and do not log candidate identities or scores."
    - "Similarity ranking is advisory only. It must never auto-select or auto-link a student."
  reservation_check: "taskscope-04 generation 2 is completed, the repository is clean at the pinned base commit, and no other lifecycle scope reserves the targets."

completion:
  completed_at: null
  outcome: "partial"
  final_commit_or_state: "Working tree contains the scoped ranked-link implementation; no commit created."
  changed_paths:
    - "backend/src/dormitory/dto/query-roster-link-candidates.dto.ts"
    - "backend/src/dormitory/services/dormitory-roster-link-ranking.ts"
    - "backend/src/dormitory/services/dormitory-roster-link-ranking.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.spec.ts"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/api/dormitory-api.test.ts"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx"
    - "docs/task/taskscope-04.md"
  checks_passed:
    - "V-01: backend ranking and roster service suites passed, 24 tests."
    - "V-02: frontend API and link modal suites passed, 20 tests; existing React act warning only."
    - "V-03: backend build and frontend production build exited 0."
    - "V-04: desktop browser check passed for source identity, ranked order, labels, pagination, and explicit confirmation; mobile viewport check remains blocked because the connected browser exposes no viewport override."
    - "V-05: scoped git diff --check exited 0."
  cleanup_pending:
    - "V-04 mobile responsive viewport check"

evidence:
  current_behavior:
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx already renders a large, paginated radio table and calls getLinkCandidates with only search/page/limit; it has no roster-entry context, birth-date column, similarity score, or recommendation explanation."
    - "GET /dormitory/roster/link-candidates is protected by DORM_REG_UPDATE and backend/src/dormitory/services/dormitory-roster.service.ts:findLinkCandidates returns current students ordered alphabetically, filtering only by free text."
    - "The roster entry supplies full_name and date_of_birth, while eligible students supply full_name and date_bir; the existing exact reconciliation logic does not provide fuzzy suggestions for the manual-link modal."
  expected_behavior: "Opening the modal for an unresolved roster entry sends its ID, displays the best current-student suggestions first with name, date of birth, class, score/explanation, and still lets the operator search, paginate, choose exactly one student, and explicitly confirm."
  gap: "The candidate API has no source-entry parameter or ranking contract, and the UI cannot explain why a candidate is suggested."

ranking_contract:
  eligibility:
    - "Only students with status `Studying` and a non-null class that still resolves to an existing class are candidates; semester is not an eligibility input."
    - "Exclude a student already linked to another roster entry in the same semester when that link would be rejected by the existing duplicate guard."
  normalization:
    - "Normalize names with Unicode NFKD, remove combining marks, lowercase with the Vietnamese locale, trim, collapse whitespace, and remove non-letter/non-digit separators."
    - "Compute name similarity as the maximum of normalized whole-string edit similarity and token-set Dice similarity, clamped to 0..1. Exact normalized names score 1."
    - "Compute birth-date similarity from calendar dates: exact date = 1; distance of 1 day = 0.8; distance of 2..31 days decreases linearly from 0.7 to 0.2; more than 31 days or an invalid/missing date = 0."
  scoring:
    - "match_score is round(100 * (0.70 * name_similarity + 0.30 * birth_date_similarity))."
    - "A candidate is `recommended` when match_score >= 60 and either birth date is within 31 days or the normalized full name is exact. Candidates below the threshold remain reachable through manual search but are not labeled recommended."
    - "Sort recommended first, then match_score descending, exact birth date first, name similarity descending, student_code ascending, and _id ascending for deterministic pagination."
    - "Return reason codes from NAME_EXACT, NAME_SIMILAR, DOB_EXACT, and DOB_NEAR; map them to Vietnamese UI labels rather than returning generated prose."

scope:
  inspect:
    - "docs/design/DESIGN.compact.md:modal, table, token, radius, motion, and semantic-state rules"
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts:link-candidates route and DORM_REG_UPDATE guard"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.ts:normalization/current-student rules"
    - "backend/src/dormitory/services/dormitory-roster.service.ts:findLinkCandidates and duplicate-link validation"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx:existing large dialog, table, search, paging, selection, and confirmation"
  write:
    - "backend/src/dormitory/dto/query-roster-link-candidates.dto.ts"
    - "backend/src/dormitory/services/dormitory-roster-link-ranking.ts (new pure ranking helper)"
    - "backend/src/dormitory/services/dormitory-roster-link-ranking.spec.ts (new)"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.spec.ts"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/api/dormitory-api.test.ts"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx"
  preserve:
    - "The existing PATCH roster link operation remains the sole mutation path and keeps assertCurrentStudent, duplicate prevention, optimistic stale-write protection, DORM_REG_UPDATE authorization, and explicit operator confirmation."
    - "Matching and suggestions remain independent of the selected/current semester except for excluding links that violate the existing same-semester uniqueness rule."
    - "Manual search by student name, student code, or class and its 250 ms cancellation/debounce behavior remain available."
    - "The modal follows docs/design/DESIGN.compact.md and remains usable on mobile, keyboard, reduced-motion, loading, empty, error, and long-text states."
  out:
    - "Automatic linking, bulk reconciliation heuristics, import matching, student/class schema migrations, persisted similarity scores, external fuzzy-search services, new dependencies, and changes to unrelated KTX workflows."

api_contract:
  request:
    - "Extend GET /dormitory/roster/link-candidates with optional validated MongoId query `roster_entry_id`; the modal always sends the opened registration ID."
    - "Keep search/page/limit backward compatible. Without roster_entry_id, retain the existing alphabetical candidate response so other callers are not broken."
  response:
    - "When roster_entry_id is supplied, each row additionally returns date_bir (YYYY-MM-DD), match_score (0..100), recommended (boolean), and match_reasons (reason-code array), plus the existing ID/code/name/status/class fields and pagination meta."
    - "Return 400 for an invalid roster_entry_id and 404 when the roster entry does not exist; never reveal candidate data before these checks and authorization."

acceptance_criteria:
  - "AC-01: Opening `Liên kết sinh viên` requests candidates with the active roster_entry_id and renders recommended current students before other results using the ranking contract, with deterministic order across repeated requests/pages."
  - "AC-02: Each candidate row shows student code, full name, formatted date of birth, class, and a compact Vietnamese match label/score; the source roster name and birth date are visible above the table for comparison."
  - "AC-03: Search by name/code/class remains debounced, cancellable, paginated, and operates within current-student eligibility; clearing search restores ranked suggestions and resets to page 1."
  - "AC-04: No candidate is selected automatically. Linking occurs only after one radio row is selected and `Xác nhận liên kết` is pressed, using the unchanged guarded PATCH flow."
  - "AC-05: Invalid/missing source identity data degrades safely: valid manual search remains available, no misleading recommended badge is shown, and no score calculation produces NaN or leaks logs."
  - "AC-06: The modal/table conform to the compact glass design tokens, preserve keyboard/radio semantics and focus restoration, and fit mobile and desktop without horizontal page overflow."
  - "AC-07: The endpoint remains backward compatible without roster_entry_id and excludes non-studying, missing-class, deleted-class, and same-semester already-linked candidates."

execution:
  - "E-01 [AC-01,05,07] Add optional @IsMongoId roster_entry_id to QueryRosterLinkCandidatesDto and implement the dependency-free pure normalizer/similarity/scoring/sort helper exactly as ranking_contract."
  - "E-02 [AC-01,03,05,07] Extend findLinkCandidates to validate/load the source roster, apply current-class and duplicate-link eligibility, rank before pagination, project only the allowed fields, and preserve the legacy no-context response. Keep DB reads bounded and document/test the chosen shortlist limit if ranking cannot be performed fully in MongoDB."
  - "E-03 [AC-01..05,07] Extend frontend API types/request with roster_entry_id and recommendation fields, using a date-only wire value to avoid timezone display drift."
  - "E-04 [AC-01..06] Update RosterStudentLinkModal to pass registration._id, show source identity, recommendation cues and DOB/score columns, keep manual selection explicit, and apply DESIGN.compact tokens/responsive states."
  - "E-05 [AC-01..07] Add focused backend, API-client, and modal regressions for ranking, tie-breaking, eligibility, fallback compatibility, request cancellation, selection, and accessibility."

verification:
  - "V-01 [AC-01,05,07] npm --prefix backend test -- --runInBand dormitory/services/dormitory-roster-link-ranking.spec.ts dormitory/services/dormitory-roster.service.spec.ts -> ranking boundaries, deterministic ties, eligibility, legacy fallback, invalid/missing roster ID, and pagination pass."
  - "V-02 [AC-01,03,04,07] npm --prefix frontend test -- src/api/dormitory-api.test.ts src/components/dormitory/RosterStudentLinkModal.test.tsx -> request contract, ranked rendering, clearing search, radio selection, no auto-selection, and cancellation pass."
  - "V-03 [AC-01..07] npm --prefix backend run build && npm --prefix frontend run build -> both builds exit 0."
  - "V-04 [AC-02,03,04,06] Manual responsive check at mobile and desktop widths: source identity, ranked table, labels, paging, keyboard choice, loading/error/empty states, and explicit confirmation are readable and match docs/design/DESIGN.compact.md."
  - "V-05 [AC-01..07] git diff --check -- backend/src/dormitory/dto/query-roster-link-candidates.dto.ts backend/src/dormitory/services/dormitory-roster-link-ranking.ts backend/src/dormitory/services/dormitory-roster-link-ranking.spec.ts backend/src/dormitory/services/dormitory-roster.service.ts backend/src/dormitory/services/dormitory-roster.service.spec.ts frontend/src/api/dormitory-api.ts frontend/src/api/dormitory-api.test.ts frontend/src/components/dormitory/RosterStudentLinkModal.tsx frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx docs/task/taskscope-04.md -> exits 0."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-04.md: user-requested reusable taskscope slot"]

risks:
  - "Ranking after an unbounded current-student read can become expensive; implementation must use a bounded shortlist or aggregation and test the boundary without silently changing pagination semantics."
  - "Fuzzy similarity can produce false positives, especially for common Vietnamese names or mistyped dates; recommendation wording must remain advisory and selection must remain manual."
  - "Date parsing across UTC/local time can shift a day; compare and serialize calendar-date keys rather than locale timestamps."

stop_conditions:
  - "A correct ranking requires loading the entire unbounded student collection or introducing a new schema/index/migration: stop and amend the scope with an explicit performance/data migration plan."
  - "Existing duplicate-link rules differ from the same-semester behavior evidenced in DormitoryRosterService: stop and resolve the domain contract before changing eligibility."
  - "Any implementation auto-selects/auto-links, exposes DOB outside DORM_REG_UPDATE, adds an external dependency, or changes reconciliation/import behavior: stop for an explicit scope amendment."
