# Development performance run

- Timestamp: 2026-08-23T20:50:07+0700
- Commit: `116fcbb`
- Machine: `Darwin Air-cua-Nguyen 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:53:01 PST 2026; root:xnu-12377.81.4~5/RELEASE_ARM64_T8103 arm64`
- Compose files: `docker-compose.yml:docker-compose.dev.yml`
- Command: `BENCHMARK_COMPOSE_FILES='docker-compose.yml:docker-compose.dev.yml' BENCHMARK_OUTPUT='docs/performance/full-docker-post-3.md' ./scripts/benchmark-dev.sh`
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
| manager_points-backend-1 | 33.73% | 292.5 MiB | 33 |
| manager_points-frontend-1 | 175.80% | 1753.1 MiB | 36 |
| manager_points-grafana-1 | 34.18% | 360.2 MiB | 145 |
| manager_points-mongodb-1 | 39.74% | 133.4 MiB | 63 |
| manager_points-prometheus-1 | 14.19% | 30.1 MiB | 13 |
| manager_points-redis-1 | 5.64% | 7.9 MiB | 6 |

### Cold / first request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 1.544423 |
| `/reports` | 200 | 1.670357 |
| `/grading` | 200 | 2.259658 |
| `/grading/score` | 200 | 0.214426 |
| `/activities` | 200 | 0.103364 |
| `/dormitory` | 200 | 0.112441 |
| `/students` | 200 | 0.165841 |
| `/system` | 200 | 0.220300 |

### Warm / second request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 0.216006 |
| `/reports` | 200 | 0.205390 |
| `/grading` | 200 | 0.154834 |
| `/grading/score` | 200 | 0.167367 |
| `/activities` | 200 | 0.174034 |
| `/dormitory` | 200 | 0.263224 |
| `/students` | 200 | 0.187333 |
| `/system` | 200 | 0.184363 |
