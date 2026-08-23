#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${BENCHMARK_OUTPUT_DIR:-$ROOT_DIR/docs/performance}"
OUTPUT_FILE="${BENCHMARK_OUTPUT:-$OUTPUT_DIR/run-$(date +%Y%m%d-%H%M%S).md}"
FRONTEND_URL="${BENCHMARK_FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BENCHMARK_BACKEND_URL:-http://localhost:8001}"
COMPOSE_FILE="${BENCHMARK_COMPOSE_FILE:-docker-compose.dev-infra.yml}"
ROUTES=(/ /students/record /activities /reports /permissions /system)

mkdir -p "$(dirname "$OUTPUT_FILE")"
TMP_FILE="$(mktemp)"
STARTUP_LOG=""
cleanup() {
  rm -f "$TMP_FILE" "$STARTUP_LOG"
  if [ -n "${app_pid:-}" ]; then
    kill "$app_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

probe() {
  local url="$1"
  curl -L -sS -o /dev/null --max-time "${BENCHMARK_TIMEOUT_SECONDS:-120}" \
    -w '%{http_code} %{time_total}' "$url" 2>/dev/null || printf 'ERR -'
}

wait_for_url() {
  local url="$1"
  local deadline=$(( $(date +%s) + ${BENCHMARK_STARTUP_TIMEOUT_SECONDS:-120} ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

run_pass() {
  local label="$1"
  printf '\n### %s\n\n| Route | HTTP | Total (s) |\n|---|---:|---:|\n' "$label" >> "$TMP_FILE"
  for route in "${ROUTES[@]}"; do
    result="$(probe "${FRONTEND_URL%/}${route}")"
    http="${result%% *}"
    total="${result#* }"
    printf '| `%s` | %s | %s |\n' "$route" "$http" "$total" >> "$TMP_FILE"
  done
}

startup_note="Không đo (ứng dụng đã chạy trước khi gọi script)."
if [ -n "${BENCHMARK_START_COMMAND:-}" ]; then
  STARTUP_LOG="$(mktemp)"
  (cd "$ROOT_DIR" && bash -lc "$BENCHMARK_START_COMMAND") >"$STARTUP_LOG" 2>&1 &
  app_pid=$!
  startup_started_at="$(date +%s)"
  wait_for_url "$BACKEND_URL/health" || { echo "Backend did not become ready." >&2; exit 1; }
  wait_for_url "$FRONTEND_URL/" || { echo "Frontend did not become ready." >&2; exit 1; }
  startup_seconds=$(( $(date +%s) - startup_started_at ))
  startup_note="${startup_seconds}s from command start until both health endpoints responded."
fi

run_pass "Cold / first request pass"
run_pass "Warm / second request pass"

machine="$(uname -a)"
commit="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
next_size="$(du -sh "$ROOT_DIR/frontend/.next" 2>/dev/null | awk '{print $1}' || printf 'not present')"
container_ids="$(docker compose -f "$ROOT_DIR/$COMPOSE_FILE" ps -q 2>/dev/null || true)"
if [ -n "$container_ids" ]; then
  docker_stats="$(docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' $container_ids 2>/dev/null || printf 'unavailable')"
else
  docker_stats="unavailable"
fi

{
  printf '# Development performance run\n\n'
  printf -- '- Timestamp: %s\n- Commit: `%s`\n- Machine: `%s`\n- Frontend: `%s`\n- Backend: `%s`\n- Startup: %s\n- Cache policy: script không tự xóa `.next`, volume hoặc database.\n\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$commit" "$machine" "$FRONTEND_URL" "$BACKEND_URL" "$startup_note"
  printf '## Environment snapshot\n\n```text\n'
  node --version 2>/dev/null || true
  (cd "$ROOT_DIR/frontend" && node --version 2>/dev/null) || true
  printf '.next size: %s\nDocker stats:\n%s\n```\n' "$next_size" "$docker_stats"
  if [ -n "$STARTUP_LOG" ]; then
    printf '\n## Compile log excerpts\n\n```text\n'
    rg -i 'compiled|compile|ready|rebuild' "$STARTUP_LOG" | tail -n 80 || true
    printf '```\n'
  fi
  cat "$TMP_FILE"
} > "$OUTPUT_FILE"

echo "Benchmark report written to $OUTPUT_FILE"
