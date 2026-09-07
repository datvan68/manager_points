slot_id: "taskscope-02"
generation: 2
task_id: "20260907-134301-qr-modal-permission-design"
scope_file: "docs/task/taskscope-02.md"
status: completed
scope_revision: 2
created_at: "2026-09-07T13:43:01+07:00"
updated_at: "2026-09-07T13:50:30+07:00"
base_commit: "cf0eef63e4e3b1b9f9a7a26b2ad401618276861a"
task: "Center the mobile QR dialog and align camera permission UX and design"
pipeline: feature_development
profile: Quick
risk: medium
environment: development
objective: "Mobile QR attendance uses a viewport-centered, accessible glass dialog with an explicit camera permission action."
coordination:
  depends_on: []
  warnings:
    - "Clean discovery worktree. Active slots 00 and 01 have disjoint write reservations."
    - "Manual runtime testing remains waived by the user; visual placement and real device permission behavior require user verification."
completion:
  completed_at: "2026-09-07T13:50:30+07:00"
  outcome: "success"
  final_commit_or_state: "main worktree; scoped changes uncommitted; unrelated pre-existing changes preserved"
  changed_paths:
    - "frontend/src/components/attendance/QrScannerModal.tsx"
    - "frontend/src/components/attendance/QrScannerModal.test.tsx"
  checks_passed:
    - "V-01 focused attendance tests: 2 files, 9 tests passed"
    - "V-02 frontend typecheck passed"
    - "V-02 git diff --check passed; only line-ending normalization warnings"
    - "V-03 waived: mobile navigation/activity launch, native permission, scan and resize remain user-owned"
  cleanup_pending: []
evidence:
  current_behavior: "QrScannerModal renders fixed inline under Sidebar mobile navigation; globals.css:159 applies transform to that ancestor. Camera starts on open; the modal uses solid white, heavy shadow and rounded-lg controls."
  expected_behavior: "A body portal escapes navigation positioning; camera access follows an explicit user action; scanner styling follows docs/design."
  root_cause: "The transformed navigation contains the fixed overlay; the camera lifecycle auto-starts and modal styles do not use the documented tokens."
scope:
  inspect:
    - "docs/design/DESIGN.md"
    - "docs/design/DESIGN.compact.md"
    - "frontend/src/components/ui/dialog.tsx"
    - "frontend/src/components/attendance/StudentQrAttendance.tsx"
    - "frontend/src/components/attendance/StudentQrAttendance.test.tsx"
    - "frontend/src/components/layout/Sidebar.tsx"
    - "frontend/src/components/activities/ActivityDetailWorkspace.tsx"
    - "frontend/src/globals.css"
    - "frontend/package.json"
  write:
    - "frontend/src/components/attendance/QrScannerModal.tsx"
    - "frontend/src/components/attendance/QrScannerModal.test.tsx"
  preserve:
    - "Mobile breakpoint below 768px, caller props, token normalization, duplicate-submit protection, check-in API and backend authorization."
    - "Camera track cleanup and stale-request guards on close, unmount, success and desktop resize."
  out:
    - "Backend, navigation changes, shared dialog/global style edits, dependencies, new QR decoder, commit/push/deployment."
acceptance_criteria:
  - "AC-01: Dialog portals to body, centers in the viewport, stays within safe-area/dynamic-height bounds with scrollable content, and provides a labelled close action, focus containment/restoration and Escape dismissal."
  - "AC-02: Opening shows Vietnamese camera-purpose text and Cho phép camera; getUserMedia runs only after activation, once while pending. Show requesting, denied, unavailable and unsupported states with appropriate retry/settings guidance and manual fallback. Closing/reopening resets the permission UI; never promise to override browser denial or force a repeated native prompt."
  - "AC-03: Use glass surface and white border, light slate shadow, primary #1A73E8, documented text colors, rounded-2xl container and rounded-xl controls/state surfaces. All scanner states follow the same tokens."
  - "AC-04: Existing mobile-only behavior, normalized fallback and cleanup regressions pass; no real camera or visual result is claimed from mocked tests."
execution:
  - "E-01 [AC-01,AC-03] QrScannerModal.tsx: reuse ui/dialog.tsx portal/focus behavior, override styles locally and suppress its default close button in favor of the labelled control. Bound width/height and apply design tokens to all states."
  - "E-02 [AC-02,AC-04] QrScannerModal.tsx: replace automatic startup with explicit request state/action, retain cancellation guards, expose camera retry and manual entry. Missing decoder or mediaDevices yields actionable fallback without requesting unusable camera access."
  - "E-03 [AC-01,AC-02,AC-04] QrScannerModal.test.tsx: extend existing Vitest/Testing Library tests for portal placement under a transformed parent, Escape/focus, no request before click, pending duplicate prevention, denial/retry, unsupported fallback, reopen and track cleanup; update existing startup tests to activate the button."
verification:
  - "V-01 [AC-01,AC-02,AC-04] npm --prefix frontend test -- src/components/attendance/QrScannerModal.test.tsx src/components/attendance/StudentQrAttendance.test.tsx -> all focused regressions pass; DOM checks prove portal structure only."
  - "V-02 [AC-03,AC-04] npm --prefix frontend run typecheck and git diff --check, run separately -> exit 0; inspect scoped styles against both design documents."
  - "V-03 [AC-01,AC-02,AC-03] WAIVED/user-owned: mobile navigation and activity-detail launch at narrow/short viewport; verify centering, scrolling, native permission allow/deny, camera scan, close and desktop resize. Not an executor completion gate."
runtime_test:
  target_identity: "Not verified; manual testing waived."
  resources: "None."
  operations: "No runtime UI/API/data operations."
  scenarios: "V-03 remains unverified and user-owned."
  cleanup: "None."
temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-02.md: user-requested reusable taskscope slot"]
risks:
  - "Browser permission prompts remain browser-controlled; unsupported decoding retains manual fallback."
stop_conditions:
  - "Validate exact execution pin, current identity, freshness and reservations before implementation."
  - "Amend before expanding write paths or replacing decoder dependencies."
  - "Required automated failures prevent completion; report waived runtime checks separately."
