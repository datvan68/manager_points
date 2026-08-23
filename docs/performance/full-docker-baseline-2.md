# Development performance run

- Timestamp: 2026-08-23T20:43:57+0700
- Commit: `116fcbb`
- Machine: `Darwin Air-cua-Nguyen 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:53:01 PST 2026; root:xnu-12377.81.4~5/RELEASE_ARM64_T8103 arm64`
- Compose files: `docker-compose.yml:/tmp/manager-point-docker-compose.dev.before.yml`
- Command: `BENCHMARK_COMPOSE_FILES='docker-compose.yml:/tmp/manager-point-docker-compose.dev.before.yml' BENCHMARK_OUTPUT='docs/performance/full-docker-baseline-2.md' ./scripts/benchmark-dev.sh`
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8001`
- Startup: Không đo (ứng dụng đã chạy trước khi gọi script).
- Cache policy: script không tự xóa `.next`, volume hoặc database.

## Environment snapshot

```text
.next size: 673M
Docker compose resource config: frontend NanoCpus=0, Memory=0, PidsLimit=<no value>
```

## Continuous container peaks

| Container | CPU peak | Memory peak | PIDs peak |
|---|---:|---:|---:|
| manager_points-backend-1 | 59.83% | 319.9 MiB | 33 |
| manager_points-frontend-1 | 205.94% | 1798.1 MiB | 45 |
| manager_points-grafana-1 | 19.44% | 346.8 MiB | 145 |
| manager_points-mongodb-1 | 34.90% | 127.7 MiB | 63 |
| manager_points-prometheus-1 | 6.55% | 29.4 MiB | 13 |
| manager_points-redis-1 | 5.31% | 8.2 MiB | 6 |

### Cold / first request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 0.521552 |
| `/reports` | 200 | 0.323149 |
| `/grading` | 200 | 0.590130 |
| `/grading/score` | 200 | 0.823156 |
| `/activities` | 200 | 0.708014 |
| `/dormitory` | 200 | 0.646120 |
| `/students` | 200 | 2.393845 |
| `/system` | 200 | 0.516440 |

### Warm / second request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 0.222469 |
| `/reports` | 200 | 0.224388 |
| `/grading` | 200 | 0.181536 |
| `/grading/score` | 200 | 0.215290 |
| `/activities` | 200 | 0.138336 |
| `/dormitory` | 200 | 0.371113 |
| `/students` | 200 | 0.293891 |
| `/system` | 200 | 0.258614 |
