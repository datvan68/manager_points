task: "Diagnose frontend hydration mismatch"
pipeline: bug_fix
profile: Quick
objective: "Identify the first server/client markup divergence on the affected route and define the smallest regression-safe fix."

evidence:
  current_behavior: "React reports a hydration mismatch. The issue was not reproduced on /login in the current development build."
  expected_behavior: "Initial server HTML and the first client render match without recoverable hydration errors."
  root_cause: null

scope:
  inspect:
    - "Affected URL and complete React component stack/HTML diff"
    - "frontend/src/app/layout.tsx: RootLayout"
    - "frontend/src/providers/auth-provider.tsx: AuthProvider initial render"
    - "First mismatching component and its direct caller"
    - "Nearest existing test for the confirmed component"
  write: []
  preserve:
    - "Authentication bootstrap and redirects"
    - "SSR behavior and existing API contracts"
    - "Browser-only session isolation"
  out:
    - "Suppressing the warning without fixing the divergence"
    - "Unrelated Date/locale cleanup"
    - "Backend, schema, dependency, or configuration changes"

acceptance_criteria:
  - "AC-01: The affected URL deterministically reproduces the mismatch or extension involvement is isolated."
  - "AC-02: Root cause identifies an exact path, symbol, and differing server/client value or DOM structure."
  - "AC-03: A proposed focused regression check fails before the fix."
  - "AC-04: Write boundaries are amended to only the confirmed component and regression test."

execution:
  - "Capture the affected URL and complete hydration component diff."
  - "Reproduce in development with extensions disabled or a clean browser context."
  - "Trace the first differing node through its component and direct caller."
  - "Test only the minimum competing hypotheses: browser-only branch, unstable value, locale/time zone, changing data, or invalid nesting."
  - "Amend this scope with exact write paths before mutation."

temporary_artifacts:
  create: []
  cleanup: []
  retain: []

verification:
  - "npm --prefix frontend run dev; open the affected URL and reload twice → AC-01/AC-02"
  - "npm --prefix frontend test -- <confirmed-test-path> → AC-03"
  - "npm --prefix frontend run typecheck → validates the eventual scoped patch"

risks:
  - "The failure may be route-, session-, time-zone-, or extension-specific."

stop_conditions:
  - "Do not modify source until the affected URL and first mismatching component are identified."
  - "Promote scope if the cause crosses multiple frontend modules or changes auth behavior."