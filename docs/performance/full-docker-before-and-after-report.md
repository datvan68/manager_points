# Full-Docker development CPU report

## Test conditions

- Commit: `116fcbb`
- Machine: Apple Silicon macOS, Docker Desktop reports 8 CPUs and about 3.83 GiB available to containers.
- Routes, in order: `/`, `/reports`, `/grading`, `/grading/score`, `/activities`, `/dormitory`, `/students`, `/system`.
- Each configuration has three sequential cold/warm passes. The benchmark does not delete `.next`, volumes, databases, or application data; `.next` was approximately 673M during the runs.
- Exact post-change command:

  ```bash
  BENCHMARK_COMPOSE_FILES='docker-compose.yml:docker-compose.dev.yml' ./scripts/benchmark-dev.sh
  ```

- Baseline used an unmodified temporary copy of `docker-compose.dev.yml` so the repository file was not changed during baseline collection. Reports: `full-docker-baseline-{1,2,3}.md` and `full-docker-post-{1,2,3}.md`.

## Results

| Criterion | Result | Evidence |
|---|---|---|
| AC-01 | Pass | Three baseline and three post reports include cold/warm route times and continuous per-container CPU, memory, and PIDs peaks. |
| AC-02 | Pass | Frontend post peaks: 174.28%, 184.53%, and 175.80%; configured `NanoCpus=1500000000`, memory 2 GiB, PIDs 512. |
| AC-03 | Partial / not met globally | Warm medians are generally near or below 1s, and `/dormitory` cold median is 0.341s vs baseline 0.312s (~9%). Other routes show materially variable cold compile times under the quota, so the global 20% criterion is not supported by these runs. |
| AC-04 | Pass | 12 samples across 60 seconds: frontend idle median 0.00%, maximum 67.34%; no rebuild loop appeared. |
| AC-05 | Pass with evidence | Backend watcher detected one intentional edit and completed incremental compilation with 0 errors; frontend and backend remained reachable from inside their containers after the edit. |
| AC-06 | Partial | Bash syntax, Compose config, frontend typecheck, and production Compose unchanged passed. Production build reached compilation and TypeScript, then failed on the existing `/dormitory/roster` prerender error (`Cannot read properties of null (reading 'useState')`). |

## Change and remaining risk

The only runtime change is a configurable frontend development resource cap in
`docker-compose.dev.yml`; production Compose, images, commands, APIs, RBAC,
and UI code are unchanged. The benchmark now accepts the two-file stack,
waits for services, samples `docker stats` throughout both passes, records
container resource settings, and preserves cache/data. No `/dormitory` import
refactor was applied because its measured cold median stayed within 20% of the
baseline and the broader AC-03 variance is not isolated to that route.

Host `npm` was unavailable. Typecheck passed inside the running frontend
toolchain; the production build result and pre-existing prerender failure are
recorded above.
