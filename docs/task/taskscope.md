task: "Fix root layout hydration mismatch"
pipeline: bug_fix
profile: Quick
objective: "The /students route hydrates with identical server/client body structure and no removeChild NotFoundError."

evidence:
  current_behavior: "frontend/src/app/layout.tsx:RootLayout plus the supplied Next dev trace -> server body contains a whitespace text node where the client expects Suspense; hydration then throws removeChild NotFoundError."
  expected_behavior: "RootLayout emits a stable body child tree on SSR and first hydration while providers, page content, toaster, and PWA prompt remain mounted."
  root_cause: "frontend/src/app/layout.tsx:RootLayout wraps all body content in a root Suspense boundary whose streamed server marker/whitespace structure differs from the initial client tree. AuthProvider uses usePathname/useRouter, not useSearchParams, so this root boundary is not required by that provider."

scope:
  inspect: ["frontend/src/app/layout.tsx:RootLayout", "frontend/src/providers/auth-provider.tsx:AuthProvider navigation hooks", "frontend/vitest.config.ts:test environment"]
  write: ["frontend/src/app/layout.tsx:RootLayout", "frontend/src/app/layout.test.tsx:RootLayout hydration regression"]
  preserve: ["provider nesting and auth/RBAC behavior", "metadata/icons", "Toaster and PwaInstallPrompt rendering", "page-local Suspense boundaries"]
  out: ["backend/API changes", "Next/React upgrades", "auth flow refactor", "unrelated removeChild call sites"]

acceptance_criteria:
  - "AC-01: RootLayout server markup and first client hydration complete without hydration-mismatch or removeChild errors."
  - "AC-02: AuthProvider > AppBrandingProvider nesting and all existing root children remain unchanged."

execution:
  - "E-01 [AC-01, AC-02] frontend/src/app/layout.tsx:RootLayout -> remove or relocate only the unnecessary root Suspense boundary without changing provider order."
  - "E-02 [AC-01, AC-02] frontend/src/app/layout.test.tsx:RootLayout hydration regression -> mock client side-effect components/providers, SSR then hydrate, and assert no recoverable hydration error plus preserved children."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01, AC-02] npm --prefix frontend test -- src/app/layout.test.tsx -> focused test passes with no hydration diagnostic."
  - "V-02 [AC-01, AC-02] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-01] npm --prefix frontend run build -> exits 0 and reports no missing Suspense boundary."
  - "V-04 [AC-01] npm --prefix frontend run dev, open /students in a clean browser session -> console contains neither hydration-mismatch nor removeChild NotFoundError."

risks: ["Removing the global boundary may expose a page that improperly relies on it; the production build is the stop-on-failure check for that case."]
stop_conditions: ["Build identifies a route requiring the global boundary", "Fix requires a Next/React upgrade or auth/RBAC contract change", "Target paths contain overlapping uncommitted changes before implementation"]
