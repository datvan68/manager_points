slot_id: "taskscope-02"
generation: 1
task_id: "20260906-220105-student-qr-navigation"
scope_file: "docs/task/taskscope-02.md"
status: completed
scope_revision: 5
created_at: "2026-09-06T22:01:05+07:00"
updated_at: "2026-09-06T22:42:43+07:00"
base_commit: "d57c18b6fcae96c9141c5cafe626cdc1137d729d"
task: "Replace student search with mobile-only QR attendance"
pipeline: feature_development
profile: Full
risk: medium
environment: development
objective: "Students have no directory search on desktop or mobile. QR attendance is available only on mobile, including activity detail; desktop offers no scanner or manual token entry. Reuse the existing authenticated attendance API."
coordination:
  depends_on: []
  warnings:
    - "Planning baseline: main, clean worktree. Slots 00 and 01 retain active reservations; their write paths are disjoint."
    - "TASKSCOPE_WARNING: slot 01 (20260906-210749-record-grading-permissions) inspects Sidebar.tsx. Coordinate a stable read or serialize that inspection before changing this file."
    - "User waived manual runtime testing and will test directly; the previous runtime isolation blocker no longer gates source implementation or completion."
completion:
  completed_at: "2026-09-06T22:42:43+07:00"
  outcome: "Mobile-only QR implementation completed; automated checks passed. Manual runtime verification explicitly waived by the user, who will test directly."
  final_commit_or_state: "main worktree; scoped changes uncommitted; unrelated changes preserved"
  changed_paths:
    - "frontend/src/components/activities/ActivityDetailWorkspace.tsx"
    - "frontend/src/components/layout/Header.tsx"
    - "frontend/src/components/layout/Header.test.tsx"
    - "frontend/src/components/layout/Sidebar.tsx"
    - "frontend/src/components/layout/Sidebar.test.tsx"
    - "frontend/src/components/attendance/StudentQrAttendance.tsx"
    - "frontend/src/components/attendance/StudentQrAttendance.test.tsx"
    - "frontend/src/components/attendance/QrScannerModal.tsx"
    - "frontend/src/components/attendance/QrScannerModal.test.tsx"
  checks_passed:
    - "V-01: 4 suites, 31 tests passed; student navigation, token submission and desktop camera lifecycle. Existing act warnings remain in layout tests."
    - "V-02: frontend typecheck exited 0."
    - "V-04: scoped diff reviewed; git diff --check exited 0, with a line-ending normalization warning."
  cleanup_pending: []

evidence:
  current_behavior: "Revision 2 worktree implements student QR navigation in Header and Sidebar. ActivityDetailWorkspace also mounts QrScannerModal. Mobile-only availability is not yet established."
  expected_behavior: "Student mobile navigation offers Quét QR điểm danh; desktop has neither student search nor QR attendance controls. Non-student search eligibility remains unchanged."
  root_cause: null
  integration: "activity-api.ts:attendanceSessionApi.checkinQr accepts only { token }; POST /attendance-sessions/checkin/qr derives user identity on the backend and uses ACTIVITY_SCHEDULE_REGISTER. No selected activity ID is required by this client endpoint."
  scanner_limit: "QrScannerModal supports attendance: token extraction, but its manual input appears only on cameraError, while missing BarcodeDetector currently loops without decoding. Its async camera startup also needs close/unmount cleanup verification."
scope:
  inspect:
    - "frontend/src/utils/role.util.ts"
    - "frontend/src/providers/auth-provider.tsx"
    - "frontend/src/components/students/StudentDirectorySearch.tsx"
    - "frontend/src/hooks/useAttendanceSession.ts"
    - "frontend/src/api/activity-api.ts"
    - "backend/src/attendance-sessions/attendance-sessions.controller.ts"
    - "backend/src/attendance-sessions/attendance-sessions.service.ts"
    - "frontend/package.json"
  write:
    - "frontend/src/components/activities/ActivityDetailWorkspace.tsx"
    - "frontend/src/components/layout/Header.tsx"
    - "frontend/src/components/layout/Header.test.tsx"
    - "frontend/src/components/layout/Sidebar.tsx"
    - "frontend/src/components/layout/Sidebar.test.tsx"
    - "frontend/src/components/attendance/StudentQrAttendance.tsx"
    - "frontend/src/components/attendance/StudentQrAttendance.test.tsx"
    - "frontend/src/components/attendance/QrScannerModal.tsx"
    - "frontend/src/components/attendance/QrScannerModal.test.tsx"
  preserve:
    - "Existing role normalization; non-student search eligibility, student profile access, navigation destinations, responsive breakpoints and safe-area spacing."
    - "Backend authentication, authorization, membership/session/token validation, duplicate attendance behavior and API response contracts remain authoritative and unchanged."
    - "Existing activity-page scanner integration on mobile and QR format; reuse the existing HTTP client without new identity or session-selection parameters."
  out:
    - "Removing student directory API access, changing role grants/guards or redesigning RBAC; this task changes navigation availability only."
    - "Attendance business rules, activity management, proximity attendance, unrelated search surfaces, database/schema changes and new scanner dependencies."
    - "Commit, push, deployment and production access."
acceptance_criteria:
  - "AC-01: A user recognized by isStudentRole sees Quét QR điểm danh only in the central mobile action; desktop Header exposes neither QR attendance nor directory search, even with student-read permission. No student directory search component or search request is initiated from these controls. Non-students retain their existing eligibility and behavior; unauthenticated users gain neither action."
  - "AC-02: Opening the student action opens one scanner without selecting an activity. A decoded token calls attendanceSessionApi.checkinQr({ token }) once while pending; success appears only after API success. Errors, including invalid/expired token or permission rejection, remain visible and allow retry without an unhandled rejection. Closing, reopening, route or user changes cannot display stale results."
  - "AC-03: Camera starts only when opened and stops on close, unmount and success, including a camera promise resolving after close. Camera denial/unavailability or missing BarcodeDetector provides usable manual token entry with the same attendance: normalization. Existing activity-page use retains compatible props and behavior."
  - "AC-04: Mobile UI shows an accessible QR action with no duplicate visible scanner, clipped overlay or obstructed close control. Use the existing responsive mobile breakpoint consistently, including activity detail. Desktop cannot open the scanner or manual token fallback; switching to desktop closes the scanner and releases camera tracks; existing non-student search opens/closes normally. Required automated checks pass. Manual UI/API and camera verification is delegated to the user by explicit request."
execution:
  - "E-01 [AC-02] Add StudentQrAttendance.tsx and its test in the existing attendance component directory using Vitest/Testing Library conventions from Header.test.tsx. Encapsulate the reusable trigger/modal and idle/checking/success/error state; call the existing token-only API, catch failures, prevent concurrent submissions and ignore results after close/unmount/user change. Follow useAttendanceSession.checkinQr response handling without creating a fake activity context or starting unrelated subscriptions."
  - "E-02 [AC-01,AC-04] Header.tsx and Sidebar.tsx: prioritize normalized student detection, exclude students from canSearchStudents, remove the student QR action from Header and retain it only in the mobile center slot. ActivityDetailWorkspace.tsx: restrict student QR entry to the same mobile breakpoint. QrScannerModal.tsx: guard opening and close/release the camera when leaving mobile, including late camera startup. Preserve organizer QR display and other attendance methods. Reset open state on navigation/identity changes. Extend the existing Header and Sidebar tests for student, student with read permission, authorized non-student and guest cases, including absence of directory calls. Extend scanner tests to prove desktop cannot start camera or submit a token, and mobile-to-desktop resize closes the modal and stops tracks."
  - "E-03 [AC-03] QrScannerModal.tsx: preserve its public props, make unsupported decoding expose the existing manual fallback, normalize both input paths, and close async camera lifecycle gaps. Add QrScannerModal.test.tsx beside the component for late camera resolution, stream cleanup, unsupported decoder, manual normalization and retry. Limit scanner edits to the behavior required by this navigation flow."
  - "E-04 [AC-01,AC-02,AC-03,AC-04] Execute V-01, V-02 and V-04; inspect scoped diff and preserve unrelated changes. Record actual runtime results and any retained dev data before completing the pinned scope."
verification:
  - 'V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- src/components/layout/Header.test.tsx src/components/layout/Sidebar.test.tsx src/components/attendance/StudentQrAttendance.test.tsx src/components/attendance/QrScannerModal.test.tsx -> all suites pass, including pending duplicate suppression, rejected API response and camera cleanup.'
  - 'V-02 [AC-04] npm --prefix frontend run typecheck -> exit 0; existing ActivityDetailWorkspace scanner call remains type-compatible.'
  - "V-03 [WAIVED by explicit user request; user will test directly] On verified dev, verify desktop exposes neither student search nor QR scanner/manual entry in navigation and activity detail. At mobile width, open the QR action, decode a valid activity attendance QR, verify the persisted check-in through supported UI/API, retry the same QR and confirm existing duplicate behavior without an extra record; submit an invalid/expired token and verify a visible rejection. Exercise camera denial/manual fallback, close/reopen and navigation cleanup. Resize an open mobile scanner to desktop and verify camera shutdown and no remaining token submission UI. Smoke-test the mobile activity-page scanner and authorized non-student directory search. Manual input alone does not establish successful camera decoding."
  - "V-04 [AC-04] Inspect git diff for all declared application/test paths and run git diff --check -> no unintended edits or whitespace errors; record V-03 as user-owned, unrun manual verification; no runtime data was changed."
runtime_test:
  target_identity: "Not verified; runtime tests waived by explicit user instruction."
  resources: "None used."
  operations: "None performed; no runtime records changed."
  scenarios: "V-03 delegated to user; real camera decoding, browser layout and persisted API attendance remain unverified."
  cleanup: "No runtime cleanup required."
temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-02.md: user-requested reusable taskscope slot"]
risks:
  - "Hiding navigation search is not revocation of backend directory access; backend policy changes require a separate explicit scope."
  - "Actual camera decoding needs a supported browser and available camera; missing hardware/session/dev-isolation evidence blocks the dependent runtime check, not source work."
stop_conditions:
  - "Apply exact-file pin, freshness, ownership and reservation checks from global.md before execution; serialize the slot 01 Sidebar inspection when needed."
  - "Amend scope before changing backend authorization, dependencies, attendance rules or additional write paths. Changed authorization or other material risk requires the independent review specified by pipeline.md."
  - "Do not mark complete while any required automated check remains unrun or failed. V-03 is user-owned and is not a completion gate."
