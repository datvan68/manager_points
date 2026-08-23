# Taskscope: Contain full-Docker CPU spikes during page navigation

```yaml
task: "Reduce full-Docker navigation CPU spikes"
pipeline: devops_infra
profile: Full
objective: "Keep frontend CPU within a documented development budget during cold route compilation without regressing warm navigation or production behavior."

evidence:
  current_behavior: >-
    On commit 116fcbb, using docker-compose.yml + docker-compose.dev.yml on
    Docker Desktop for macOS, a sequential request pass reached 917.57% CPU
    and 1.833 GiB memory in manager_points-frontend-1. The cold /dormitory
    request took 8.2s; the Next log attributes 7.8s to Next.js compilation.
    Warm routes returned in 0.17-0.57s. Backend CPU stayed materially lower
    (mostly 5-16%, one 28.10% sample).
  expected_behavior: >-
    Full-Docker development has a repeatable CPU/memory budget, cold compile
    cost is measured rather than hidden, and warm route navigation remains fast.
  root_cause: >-
    frontend/package.json runs Next 16 development mode with Turbopack while
    docker-compose.dev.yml bind-mounts frontend source from macOS. Next performs
    on-demand compilation for a previously uncompiled route and can consume all
    Docker-assigned cores; /dormitory reproduced this mechanism directly.

scope:
  inspect:
    - "docker-compose.yml and docker-compose.dev.yml frontend/backend services"
    - "frontend/package.json dev commands and frontend/Dockerfile development stage"
    - "scripts/benchmark-dev.sh CPU sampling and cold/warm route handling"
    - "frontend/src/app/(dashboard)/dormitory/{layout,page,overview/page}.tsx and direct imports only if the resource cap misses the latency criterion"
  write:
    - "docker-compose.dev.yml"
    - "frontend/package.json (only when benchmark proves a command/heap adjustment is needed)"
    - "scripts/benchmark-dev.sh"
    - "docs/performance/README.md"
    - "docs/performance/<full-docker-before-and-after-report>.md"
    - "the measured /dormitory direct import path only if AC-03 fails after the Docker-only change"
  preserve:
    - "Hot reload for frontend and backend in full-Docker development"
    - "RBAC, route behavior, API contracts, and UI behavior"
    - "docker-compose.prod.yml behavior and production image commands"
    - "The host-Node development workflow"
  out:
    - "Next.js/React/NestJS upgrades or changing the default bundler"
    - "Broad page refactors, database/query optimization, deployment, or CI changes"
    - "Automatic deletion of .next, Docker volumes, or application data"

acceptance_criteria:
  - "AC-01: Three comparable full-Docker runs record per-route cold/warm time plus continuous per-container CPU peak, memory peak, and PIDs; the report states commit, Docker resource allocation, cache state, and exact command."
  - "AC-02: During the representative route pass (/, /reports, /grading, /grading/score, /activities, /dormitory, /students, /system), frontend peak CPU is <= 250% in all three post-change runs."
  - "AC-03: Post-change cold-route median is no more than 20% slower than the three-run baseline, and every warm route median is <= 1.0s."
  - "AC-04: With no requests or file changes for 60 seconds, frontend median CPU is <= 5% and no unexplained compile/rebuild loop appears in logs."
  - "AC-05: Full-Docker hot reload still observes one intentional frontend edit and one backend edit exactly once; both services remain healthy afterward."
  - "AC-06: Compose validation, frontend typecheck/build, and any focused tests for conditionally changed application code pass; production Compose has no semantic diff."

execution:
  - "Extend scripts/benchmark-dev.sh to accept the two-file full-Docker Compose stack and sample docker stats throughout each pass, not only after requests finish (AC-01)."
  - "Capture three pre-change runs without deleting caches automatically; document cold-cache preparation as an explicit manual step (AC-01)."
  - "Add development-only, configurable CPU/process limits to frontend (and backend only if its samples justify it); right-size the frontend dev heap only if memory/GC evidence supports that change (AC-02, AC-04)."
  - "Run three post-change passes. If AC-03 fails, reduce only the measured /dormitory initial import graph through deferred imports, then rerun focused UI tests and the benchmark (AC-03, AC-06)."
  - "Exercise one frontend and backend hot reload, validate the resolved Compose configuration, and compare production Compose before finalizing (AC-05, AC-06)."

verification:
  - "bash -n scripts/benchmark-dev.sh -> benchmark script syntax"
  - "docker compose -f docker-compose.yml -f docker-compose.dev.yml config -> AC-05/AC-06"
  - "BENCHMARK_COMPOSE_FILES='docker-compose.yml:docker-compose.dev.yml' ./scripts/benchmark-dev.sh -> AC-01/AC-02/AC-03/AC-04 (run three times before and after)"
  - "npm --prefix frontend run typecheck -> AC-06"
  - "npm --prefix frontend run build -> AC-06"
  - "npm --prefix frontend test -- <focused-test-path> -> AC-06 when application code changes"

risks:
  - "A CPU quota can trade lower host contention for longer cold compilation; AC-03 prevents accepting that trade blindly."
  - "Docker Desktop percentages are multi-core values, so machine allocation and sampling interval must remain fixed across runs."
stop_conditions:
  - "Stop if meeting the CPU budget requires a production Compose/image change, a bundler/dependency upgrade, or more than the measured route's direct import boundary."
  - "Stop before deleting any cache, volume, or persistent data; cold-cache preparation requires explicit user action."
  - "Stop and rescope if backend/API time becomes the dominant measured cause instead of Next compilation."
```
