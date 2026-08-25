task: "Prioritize users and role values by role hierarchy"
pipeline: feature_development
profile: Quick
objective: "In Phân quyền > Người dùng, display users and role values with the priority ADMIN > SUPERVISOR > TEACHER > all remaining roles, consistently on desktop and mobile."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/permissions/page.tsx filters users but preserves API order; role options and assigned-role values do not share an explicit display hierarchy. Multi-role assignment, permission union, mobile infinite loading, and virtualization already exist."
  expected_behavior: "After filtering, prioritized roles appear first; a multi-role user's highest-priority assigned role determines that user's display rank."

scope:
  write: ["frontend/src/app/(dashboard)/permissions/user-role-priority.ts: normalized role-code ranking helpers", "frontend/src/app/(dashboard)/permissions/page.tsx: apply ranking before desktop pagination and mobile infinite/virtualized slicing, and order role filter values", "frontend/src/app/(dashboard)/permissions/user-list.test.tsx: hierarchy, multi-role, fallback, and viewport regressions"]
  preserve: ["Search, role/status filters, desktop pagination, mobile infinite scroll and virtualization", "Primary-role marker and assigned-role order in edit payloads", "RBAC, effective permissions, API contracts, and backend persistence"]
  out: ["Changing authorization precedence or effective permissions", "Automatically changing primary_role_id", "Defining business priority among roles other than ADMIN, SUPERVISOR, and TEACHER"]

acceptance_criteria:
  - "AC-01: Role codes are matched case-insensitively and ranked ADMIN first, SUPERVISOR second, TEACHER third; every other or missing role is placed afterward."
  - "AC-02: For a user with multiple assigned roles, the highest-ranked code across roles[] determines the user's list rank; legacy role/roleCode values remain supported."
  - "AC-03: The filtered user result is sorted by role rank before desktop pagination or mobile visible-count slicing, so both viewports expose the same priority order."
  - "AC-04: Users with the same rank, and users whose roles have no declared priority, retain their original API order to avoid unstable reshuffling."
  - "AC-05: Role filter/select display values use ADMIN > SUPERVISOR > TEACHER, then retain source order for remaining roles; labels continue using current localized role names."
  - "AC-06: Sorting changes presentation only; it does not change the primary role, permission union, filtering matches, selected users, or submitted role IDs."

execution:
  - "E-01 [AC-01,AC-02,AC-04] add a pure helper that normalizes role_code/roleCode/code and performs a stable decorated sort."
  - "E-02 [AC-03,AC-05,AC-06] use the helper in the Người dùng list pipeline and role-value rendering without mutating source arrays."
  - "E-03 [AC-01..AC-06] extend focused tests for single-role, multi-role, mixed case, unknown/missing roles, ties, filters, desktop pages, and mobile batches."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-06] npm --prefix frontend test -- 'src/app/(dashboard)/permissions/user-list.test.tsx' → focused suite passes."
  - "V-02 [AC-01..AC-06] npm --prefix frontend run typecheck → exit 0."
  - "V-03 [AC-03,AC-05,AC-06] Manual desktop/mobile check with ADMIN, SUPERVISOR, TEACHER, unknown, and multi-role users → identical hierarchy; pagination/infinite loading and filters remain correct."

risks: ["Sorting after slicing would produce inconsistent priority between pages/batches.", "Sorting roles in place could mutate API-backed React state."]
stop_conditions: ["Stop for product direction if the ellipsis requires an explicit priority order for additional role codes instead of stable source order."]
