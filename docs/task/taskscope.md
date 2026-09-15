slot_id: "taskscope-00"
generation: 4
task_id: "20260915T133018+0700-sort-lookup-weeks-ascending"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 3
created_at: "2026-09-15T13:30:18+07:00"
updated_at: "2026-09-15T14:16:00+07:00"
base_commit: "0b40a502611ddac10be195ce97f873a097841966"
task: "Sort timetable lookup weeks ascending"
pipeline: bug_fix
profile: Quick
objective: "Show available weeks from smallest to largest in the Tra cứu desktop/mobile selectors and previous/next navigation."
coordination:
  depends_on: []
  warnings: []
completion:
  completed_at: "2026-09-15T14:16:00+07:00"
  outcome: "success"
  final_commit_or_state: "main at 0b40a502611ddac10be195ce97f873a097841966; uncommitted scoped implementation/test changes preserved"
  changed_paths:
    - "frontend/src/components/timetable/TimetableLookup.tsx"
    - "frontend/src/components/timetable/TimetableLookup.test.tsx"
    - "docs/task/taskscope.md"
  checks_passed:
    - "V-01: npm --prefix frontend test -- --run src/components/timetable/TimetableLookup.test.tsx (5 tests passed)"
    - "V-02: npm --prefix frontend run typecheck"
    - "V-03: dev /timetable desktop/mobile dropdowns sorted ascending; selection, lookup, refresh and week-1 boundary verified"
    - "V-04: git diff --check for scoped files"
  cleanup_pending: []
evidence:
  current_behavior: "Screenshot shows 3,4,1,2,5. TimetableLookup renders options.weeks directly in both selectors and uses it for currentWeekIndex/goToWeek; every loader retains API order."
  expected_behavior: "Display 1,2,3,4,5, with week 10 after 9."
  root_cause: "TimetableService.getOptions uses snapshot coverage Set insertion order without sorting; TimetableLookup has no presentation ordering. Parsed source values are strings and may be opaque."
scope:
  inspect:
    - "frontend/src/components/timetable/TimetableLookup.tsx"
    - "frontend/src/components/timetable/TimetableLookup.test.tsx"
    - "frontend/src/components/timetable/timetable-filters.ts"
    - "frontend/src/api/timetable-api.ts"
    - "backend/src/timetable/timetable.service.ts"
    - "backend/src/timetable/timetable.parser.ts"
    - "frontend/package.json"
  write:
    - "frontend/src/components/timetable/TimetableLookup.tsx"
    - "frontend/src/components/timetable/TimetableLookup.test.tsx"
  preserve:
    - "Original values, labels, metadata and API filter payloads; no mutation of API arrays or automatic selection changes."
    - "Cascading resets, stale-request protection, coverage checks, loading/errors and search behavior."
    - "Existing empty-value placeholder remains first without duplication; no available options are removed."
  out:
    - "Other tabs, backend changes, API contracts, RBAC, synchronization and persistent data"
    - "Commit, push, deployment and production"
acceptance_criteria:
  - "AC-01: Both selectors display labels 3,4,1,2,5,10 in order 1,2,3,4,5,10, including Tuần N labels with opaque values."
  - "AC-02: Order remains ascending after initial load, filter reload and refresh; empty/single lists work, placeholder stays first, and unrecognized entries retain stable deterministic ordering."
  - "AC-03: Selection sends the original value; previous/next uses the same ascending order and remains disabled at boundaries. Existing lookup regressions pass."
execution:
  - "E-01 [AC-01, AC-02, AC-03] TimetableLookup.tsx -> derive one sorted copy of options.weeks for both selectors and navigation. Read a numeric label or explicit Tuần N prefix, falling back to a numeric value. Keep empty values first and unrecognized entries stable after numbered weeks; do not treat date digits as week numbers."
  - "E-02 [AC-01, AC-02, AC-03] TimetableLookup.test.tsx -> extend existing mocked API/listbox tests for unordered weeks, week 10, opaque values, refresh/filter reload, empty/single lists and navigation boundaries; assert original API values and input array remain unchanged."
verification:
  - "V-01 [AC-01, AC-02, AC-03] npm --prefix frontend test -- --run src/components/timetable/TimetableLookup.test.tsx -> focused suite and new regressions pass."
  - "V-02 [AC-01, AC-03] npm --prefix frontend run typecheck -> no TypeScript errors."
  - "V-03 [AC-01, AC-02, AC-03] Verified dev /timetable -> open Tra cứu week dropdown at desktop/mobile widths, inspect ascending available weeks, choose a week, use previous/next and refresh/reload filters; confirm original selection and boundary states. Record actual coverage; mocks do not replace runtime evidence."
  - "V-04 [AC-01, AC-02, AC-03] git diff --check -- frontend/src/components/timetable/TimetableLookup.tsx frontend/src/components/timetable/TimetableLookup.test.tsx docs/task/taskscope.md -> no whitespace errors; inspect scoped diff."
runtime_test:
  targets: "Before testing, establish effective dev frontend/API/database identities and production separation read-only under safety.md section 6a; not established during planning."
  resources: "Existing authenticated dev lookup session/catalog; browse, filter, refresh and search only."
  scenarios: "V-03 desktop/mobile ordering, selection and navigation with available dev weeks."
  cleanup: "No persistent-data writes or test records required."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "Opaque week identifiers require displayed-number ordering while retaining values. Presentation-only scope requires no independent review."
stop_conditions:
  - "Stop with TASKSCOPE_CONFLICT if scope identity changes, candidate writes gain unrelated changes or active reservations overlap."
  - "Stop dependent runtime checks if dev isolation cannot be established."
  - "Amend scope before backend/persistent-data changes; do not invent ordering for unsupported labels."
