task: "Fix mobile protected-route hydration failure"
pipeline: bug_fix
profile: Quick
objective: "Protected routes opened on mobile redirect or render without hydration, DOM-removal, or forced-reload errors."

evidence:
  current_behavior: "At 320x568, opening Docker-served /students shows security loading then redirects to /login; frontend logs repeat a Head/MetadataWrapper hydration mismatch, removeChild NotFoundError, and Fast Refresh reload. The container has no restart or OOM."
  expected_behavior: "Server and client trees match; unauthenticated routes redirect once and authenticated routes hydrate normally."
  root_cause: null

scope:
  inspect: ["frontend/src/app/layout.tsx", "frontend/src/providers/auth-provider.tsx", "frontend/next.config.js", "frontend/src/providers/auth-provider.test.tsx"]
  write: ["confirmed owner: frontend/src/app/layout.tsx or frontend/src/providers/auth-provider.tsx", "frontend/src/providers/auth-provider.test.tsx"]
  preserve: ["RBAC/token validation", "public routes", "role-based destinations", "desktop and PWA metadata"]
  out: ["login form spacing", "responsive redesign", "backend/API changes", "dependency upgrade"]

acceptance_criteria:
  - "AC-01: At 320x568, unauthenticated /students reaches /login once without hydration, removeChild, or forced-reload errors."
  - "AC-02: An authenticated protected route opened or refreshed on mobile hydrates without redirect regression."
  - "AC-03: Existing public-route and role-based redirect tests remain passing."

execution:
  - "Isolate the first divergent tree to AuthProvider navigation or Next metadata streaming; do not patch until confirmed."
  - "Fix only the confirmed owner and add an AC-01/AC-02 regression test."
  - "Run focused checks and repeat the Docker mobile reproduction."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "npm --prefix frontend test -- src/providers/auth-provider.test.tsx -> AC-02, AC-03"
  - "npm --prefix frontend run typecheck -> changed paths type-check"
  - "Docker frontend at 320x568: open /students, verify final URL and docker compose logs --since 2m frontend -> AC-01, AC-02"

risks:
  - "Evidence does not yet distinguish redirect timing from a Next.js 16.2.9 metadata-streaming defect."
stop_conditions: ["Fix requires Next/React upgrade or auth contract change", "Failure disappears after clearing Fast Refresh state", "Backend or persistent-data change is required"]
