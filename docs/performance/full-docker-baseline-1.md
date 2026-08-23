# Development performance run

- Timestamp: 2026-08-23T20:43:30+0700
- Commit: `116fcbb`
- Machine: `Darwin Air-cua-Nguyen 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:53:01 PST 2026; root:xnu-12377.81.4~5/RELEASE_ARM64_T8103 arm64`
- Compose files: `docker-compose.yml:/tmp/manager-point-docker-compose.dev.before.yml`
- Command: `BENCHMARK_COMPOSE_FILES='docker-compose.yml:/tmp/manager-point-docker-compose.dev.before.yml' BENCHMARK_OUTPUT='docs/performance/full-docker-baseline-1.md' ./scripts/benchmark-dev.sh`
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
| manager_points-backend-1 | 380.51% | 338.2 MiB | 33 |
| manager_points-frontend-1 | 567.10% | 1835.0 MiB | 43 |
| manager_points-grafana-1 | 138.59% | 345.8 MiB | 145 |
| manager_points-mongodb-1 | 116.66% | 128.1 MiB | 63 |
| manager_points-prometheus-1 | 88.13% | 29.4 MiB | 13 |
| manager_points-redis-1 | 5.69% | 7.9 MiB | 6 |

### Cold / first request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 3.653751 |
| `/reports` | 200 | 4.803086 |
| `/grading` | 200 | 9.640076 |
| `/grading/score` | 200 | 2.055023 |
| `/activities` | 200 | 0.591780 |
| `/dormitory` | 200 | 0.435989 |
| `/students` | 200 | 1.037320 |
| `/system` | 200 | 0.307933 |

### Warm / second request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 0.072086 |
| `/reports` | 200 | 0.186864 |
| `/grading` | 200 | 0.117508 |
| `/grading/score` | 200 | 0.149049 |
| `/activities` | 200 | 0.099723 |
| `/dormitory` | 200 | 0.252660 |
| `/students` | 200 | 0.340266 |
| `/system` | 200 | 0.092859 |
