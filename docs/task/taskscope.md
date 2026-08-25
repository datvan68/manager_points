task: "Enforce dormitory permissions consistently across UI and API"
pipeline: bug_fix
profile: Full
objective: "A signed-in account without assigned KTX permissions must not see or open the KTX module, and protected KTX APIs must return 403."

evidence:
  root_cause: "SubsystemPopup has no /dormitory mapping fallback and ultimately allows non-student/non-teacher roles; DormitoryLayout has no module-level RouteGuard; several dormitory read endpoints use JwtAuthGuard only."
  examples: ["SUPERVISOR without DORM_* sees Quản lý KTX", "GET dormitory/buildings and rooms require authentication but not DORM_BUILDING_READ/DORM_ROOM_READ"]

scope:
  write: ["frontend/src/components/popups/SubsystemPopup.tsx and test: fail-closed KTX card visibility", "frontend/src/app/(dashboard)/dormitory/layout.tsx and test: module/tab access", "backend/src/dormitory/controllers/*.controller.ts and focused specs: endpoint permission guards", "backend/src/auth/services/auth.service.ts: ensure /dormitory route mapping uses DORM_PAGE if seed mappings own module access"]
  preserve: ["ADMIN bypass", "Multi-role permission union", "Explicit public QR endpoints and authenticated self-service endpoints with ownership checks", "Existing DORM_* codes and API payloads"]
  out: ["Changing role assignments or granting SUPERVISOR implicit KTX access", "Redesigning KTX screens", "Auditing non-KTX business modules"]

acceptance_criteria:
  - "AC-01: KTX card is visible only to ADMIN or users with DORM_PAGE; absent/empty/failed route mapping never grants KTX access."
  - "AC-02: Direct navigation to /dormitory and descendants is denied before child UI/data requests when DORM_PAGE is absent."
  - "AC-03: KTX tabs and action controls render only with their exact read/action permission; hiding controls is not treated as API authorization."
  - "AC-04: Every non-public KTX controller endpoint has the matching DORM_* or PDF-template guard; list/detail reads no longer use JwtAuthGuard alone."
  - "AC-05: Public QR routes remain public; self-service routes remain limited to the authenticated subject through existing ownership/service checks and are documented in tests."
  - "AC-06: Denied API requests return 403 without invoking the service; allowed permission, multi-role union, and ADMIN cases still succeed."

execution:
  - "E-01 [AC-01,AC-02] align module mapping, popup fallback, and fail-closed route guard on DORM_PAGE."
  - "E-02 [AC-03] map each KTX tab/action to its registry permission."
  - "E-03 [AC-04..AC-06] inventory controller methods, replace authentication-only guards where no public/self-service exception applies, and add deny/allow tests."

temporary_artifacts: {create: ["docs/task/taskscope.md"], cleanup: [], retain: ["docs/task/taskscope.md"]}
verification:
  - "npm --prefix frontend test -- src/components/popups/SubsystemPopup.test.tsx 'src/app/(dashboard)/dormitory/layout.test.tsx'"
  - "npm --prefix frontend run typecheck"
  - "npm --prefix backend test -- dormitory --runInBand"
  - "npm --prefix backend run build"
  - "Manual: SUPERVISOR with zero DORM_* cannot see/open KTX and receives 403; granting only DORM_PAGE opens module shell but not unauthorized tabs/actions/APIs."

risks: ["Some JwtAuthGuard-only KTX routes may be intentional self-service flows; changing them without ownership classification could break student access."]
stop_conditions: ["Stop for product direction if an authenticated KTX endpoint has no registry permission and no evidenced public/self-service contract."]
