# Development performance run

- Timestamp: 2026-08-23T20:49:36+0700
- Commit: `116fcbb`
- Machine: `Darwin Air-cua-Nguyen 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:53:01 PST 2026; root:xnu-12377.81.4~5/RELEASE_ARM64_T8103 arm64`
- Compose files: `docker-compose.yml:docker-compose.dev.yml`
- Command: `BENCHMARK_COMPOSE_FILES='docker-compose.yml:docker-compose.dev.yml' BENCHMARK_OUTPUT='docs/performance/full-docker-post-1.md' ./scripts/benchmark-dev.sh`
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
| manager_points-backend-1 | 31.54% | 293.3 MiB | 33 |
| manager_points-frontend-1 | 174.28% | 1596.4 MiB | 36 |
| manager_points-grafana-1 | 14.33% | 360.3 MiB | 145 |
| manager_points-mongodb-1 | 74.00% | 133.6 MiB | 63 |
| manager_points-prometheus-1 | 29.73% | 30.4 MiB | 13 |
| manager_points-redis-1 | 6.51% | 8.2 MiB | 6 |

### Cold / first request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 4.964042 |
| `/reports` | 200 | 5.770337 |
| `/grading` | 200 | 4.787585 |
| `/grading/score` | 200 | 9.756400 |
| `/activities` | 200 | 3.874910 |
| `/dormitory` | 200 | 2.659011 |
| `/students` | 200 | 7.091924 |
| `/system` | 200 | 4.921876 |

### Warm / second request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 0.791139 |
| `/reports` | 200 | 0.507418 |
| `/grading` | 200 | 0.348358 |
| `/grading/score` | 200 | 1.375979 |
| `/activities` | 200 | 2.666359 |
| `/dormitory` | 200 | 0.392651 |
| `/students` | 200 | 3.179876 |
| `/system` | 200 | 0.602405 |
