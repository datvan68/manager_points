task: "Fix missing role code in create-role modal"
pipeline: bug_fix
profile: Quick
objective: "Allow Phân quyền > Vai trò > Tạo vai trò mới to submit the required role_code instead of failing backend validation."

evidence:
  current_behavior: "frontend/src/components/modals/RoleModal.tsx only collects name, description, and permissions, then submits that object; backend CreateRoleDto and RbacService.createRole require role_code, producing 'Mã vai trò không được để trống, role_code must be a string'."
  root_cause: "The create form has no role_code state, input, client validation, or request value."

scope:
  write: ["frontend/src/components/modals/RoleModal.tsx: add and submit the role-code field", "frontend/src/components/modals/__tests__/RoleModal.test.tsx: create/edit initialization, validation, normalization, and payload regressions"]
  preserve: ["POST/PATCH API contracts and backend uniqueness checks", "Role name, description, permission selection, loading, close, and error behavior"]
  out: ["Generating role codes automatically", "Changing backend DTO/schema or existing role data", "Changing permission assignment behavior"]

acceptance_criteria:
  - "AC-01: Create mode shows a required input labeled 'Mã vai trò' with an example such as QUAN_LY_DAO_TAO."
  - "AC-02: Empty or whitespace-only name/role_code blocks submission and shows a field-level Vietnamese validation message."
  - "AC-03: A valid submission includes role_code trimmed and uppercased; name, description, and permission IDs remain unchanged."
  - "AC-04: Reopening create mode resets role_code; edit mode initializes it from initialData.role_code and submits it without losing other fields."
  - "AC-05: Backend duplicate-code and other save failures remain visible through the existing error flow; the modal stays open on failure."

execution:
  - "E-01 [AC-01..AC-04] extend RoleModal form state, initialization, input rendering, validation, and submit normalization."
  - "E-02 [AC-01..AC-05] add focused component tests for create success, empty fields, reset/edit initialization, and rejected save."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-05] npm --prefix frontend test -- src/components/modals/__tests__/RoleModal.test.tsx"
  - "V-02 [AC-01..AC-05] npm --prefix frontend run typecheck"
  - "V-03 [AC-01,AC-03,AC-05] Manual create with lowercase/spaces, then duplicate code: normalized request succeeds once; duplicate error is shown without closing the modal."

risks: ["Adding stricter character rules in the UI would diverge from the current backend contract; only trim and uppercase are specified."]
stop_conditions: []
