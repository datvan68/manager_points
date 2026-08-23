# Development performance run

- Timestamp: 2026-08-23T20:49:56+0700
- Commit: `116fcbb`
- Machine: `Darwin Air-cua-Nguyen 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:53:01 PST 2026; root:xnu-12377.81.4~5/RELEASE_ARM64_T8103 arm64`
- Compose files: `docker-compose.yml:docker-compose.dev.yml`
- Command: `BENCHMARK_COMPOSE_FILES='docker-compose.yml:docker-compose.dev.yml' BENCHMARK_OUTPUT='docs/performance/full-docker-post-2.md' ./scripts/benchmark-dev.sh`
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8001`
- Startup: Không đo (ứng dụng đã chạy trước khi gọi script).
- Cache policy: script không tự xóa `.next`, volume hoặc database.

## Environment snapshot

```text
.next size: 673M
Docker compose resource config: frontend NanoCpus=1500000000, Memory=2147483648, PidsLimit=512
```

## Continuous container peaks

| Container | CPU peak | Memory peak | PIDs peak |
|---|---:|---:|---:|
| manager_points-backend-1 | 56.22% | 294.2 MiB | 33 |
| manager_points-frontend-1 | 184.53% | 1707.0 MiB | 36 |
| manager_points-grafana-1 | 17.17% | 360.3 MiB | 145 |
| manager_points-mongodb-1 | 15.93% | 133.4 MiB | 63 |
| manager_points-prometheus-1 | 4.15% | 30.1 MiB | 13 |
| manager_points-redis-1 | 2.60% | 8.2 MiB | 6 |

### Cold / first request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 2.244099 |
| `/reports` | 200 | 0.757582 |
| `/grading` | 200 | 0.859524 |
| `/grading/score` | 200 | 0.568132 |
| `/activities` | 200 | 0.824432 |
| `/dormitory` | 200 | 1.337123 |
| `/students` | 200 | 0.388499 |
| `/system` | 200 | 1.341774 |

### Warm / second request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 1.172991 |
| `/reports` | 200 | 0.646119 |
| `/grading` | 200 | 0.965043 |
| `/grading/score` | 200 | 0.511198 |
| `/activities` | 200 | 0.205006 |
| `/dormitory` | 200 | 0.289744 |
| `/students` | 200 | 2.412291 |
| `/system` | 200 | 1.000152 |
