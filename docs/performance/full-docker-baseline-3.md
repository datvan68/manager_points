# Development performance run

- Timestamp: 2026-08-23T20:44:05+0700
- Commit: `116fcbb`
- Machine: `Darwin Air-cua-Nguyen 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:53:01 PST 2026; root:xnu-12377.81.4~5/RELEASE_ARM64_T8103 arm64`
- Compose files: `docker-compose.yml:/tmp/manager-point-docker-compose.dev.before.yml`
- Command: `BENCHMARK_COMPOSE_FILES='docker-compose.yml:/tmp/manager-point-docker-compose.dev.before.yml' BENCHMARK_OUTPUT='docs/performance/full-docker-baseline-3.md' ./scripts/benchmark-dev.sh`
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
| manager_points-backend-1 | 33.58% | 319.9 MiB | 33 |
| manager_points-frontend-1 | 136.58% | 1848.3 MiB | 43 |
| manager_points-grafana-1 | 30.02% | 346.6 MiB | 145 |
| manager_points-mongodb-1 | 27.01% | 127.7 MiB | 63 |
| manager_points-prometheus-1 | 3.74% | 29.4 MiB | 13 |
| manager_points-redis-1 | 1.28% | 8.2 MiB | 6 |

### Cold / first request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 0.981659 |
| `/reports` | 200 | 1.342163 |
| `/grading` | 200 | 0.508048 |
| `/grading/score` | 200 | 0.392107 |
| `/activities` | 200 | 0.299979 |
| `/dormitory` | 200 | 0.180589 |
| `/students` | 200 | 0.199872 |
| `/system` | 200 | 0.215397 |

### Warm / second request pass

| Route | HTTP | Total (s) |
|---|---:|---:|
| `/` | 200 | 0.145691 |
| `/reports` | 200 | 0.209088 |
| `/grading` | 200 | 0.298901 |
| `/grading/score` | 200 | 0.155216 |
| `/activities` | 200 | 0.215493 |
| `/dormitory` | 200 | 0.207768 |
| `/students` | 200 | 0.224245 |
| `/system` | 200 | 0.206394 |
