task: "Allow custom roles to view student records by permission"
pipeline: bug_fix
profile: Full
objective: "A user with READ_STUDENT_RECORD can open the student-record screen and load its permitted data regardless of the role's name."

evidence:
  root_cause: "The frontend checks READ_STUDENT_RECORD for content, but the page/module entry checks STUDENT_PAGE and GET /academic-records uses checkRole(Admin, Teacher, Supervisor, Student). A newly created role therefore reaches a 403 and the page shows 'Không thể tải dữ liệu ghi nhận HSSV'."
  dependencies: ["The screen also loads authenticated criteria and class lookups", "AcademicRecordService applies requester-based data scoping"]

scope:
  write:
    - "backend/src/academic-record/academic-record.controller.ts: replace fixed-role guards with matching READ/CREATE/UPDATE/DELETE_STUDENT_RECORD permission guards for staff operations"
    - "backend/src/academic-record/academic-record.controller.spec.ts: assert custom-role allow, missing-permission deny, and service non-invocation on denial"
    - "frontend/src/app/(dashboard)/students/record/page.tsx and page.test.tsx: align route/data loading with READ_STUDENT_RECORD and permission-gate optional class-record requests"
    - "frontend/src/components/popups/SubsystemPopup.tsx and focused test: expose the record module when READ_STUDENT_RECORD is effective"
  preserve: ["ADMIN bypass", "student self-service access and ownership checks", "multi-role permission union", "requester-based class/student data scope", "existing response payloads"]
  out: ["Granting STUDENT_PAGE implicitly", "Changing role assignments or permission codes", "Redesigning the record UI", "Changing record schemas"]

acceptance_criteria:
  - "AC-01: A non-built-in custom role with READ_STUDENT_RECORD can see/open /students/record and GET /academic-records returns its scoped dataset instead of 403."
  - "AC-02: A non-admin account without READ_STUDENT_RECORD cannot see/open the student-record view and the read API returns 403 without calling the service."
  - "AC-03: The student tab loads independently; absence of READ_CLASS_RECORD does not request class-report data or produce a page-level load error."
  - "AC-04: Create, update, delete, import, restore, and force-delete endpoints require their corresponding action permission; view permission alone cannot mutate data."
  - "AC-05: Student self-service routes retain ownership restrictions, ADMIN remains allowed, and effective permissions merged from multiple roles are honored."

execution:
  - "E-01 [AC-01,AC-02] align popup and page access with READ_STUDENT_RECORD."
  - "E-02 [AC-01,AC-04,AC-05] replace role-name authorization in academic-record endpoints while preserving explicit self-service behavior."
  - "E-03 [AC-03] fetch class-record resources only when READ_CLASS_RECORD is present and isolate optional lookup failures."
  - "E-04 [AC-01..AC-05] add focused frontend and controller guard regressions."

temporary_artifacts: {create: ["docs/task/taskscope.md"], cleanup: [], retain: ["docs/task/taskscope.md"]}
verification:
  - "npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' 'src/components/popups/SubsystemPopup.test.tsx'"
  - "npm --prefix frontend run typecheck"
  - "npm --prefix backend test -- src/academic-record/academic-record.controller.spec.ts --runInBand"
  - "npm --prefix backend run build"
  - "Manual: custom role with only READ_STUDENT_RECORD loads the student tab; mutation calls and class tab remain denied."

risks: ["Replacing fixed-role guards without separating student self-service from staff operations could broaden access; retain service ownership checks and cover both paths."]
stop_conditions: ["Stop for product direction if READ_STUDENT_RECORD is not intended to grant route access, or if a student self-service endpoint has no enforceable ownership boundary."]
