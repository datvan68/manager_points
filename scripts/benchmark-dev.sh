#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${BENCHMARK_OUTPUT_DIR:-$ROOT_DIR/docs/performance}"
OUTPUT_FILE="${BENCHMARK_OUTPUT:-$OUTPUT_DIR/run-$(date +%Y%m%d-%H%M%S).md}"
FRONTEND_URL="${BENCHMARK_FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BENCHMARK_BACKEND_URL:-http://localhost:8001}"
COMPOSE_FILES_RAW="${BENCHMARK_COMPOSE_FILES:-${BENCHMARK_COMPOSE_FILE:-docker-compose.dev-infra.yml}}"
IFS=: read -r -a COMPOSE_FILES <<< "$COMPOSE_FILES_RAW"
ROUTES=(/ /reports /grading /grading/score /activities /dormitory /students /system)
STATS_INTERVAL_SECONDS="${BENCHMARK_STATS_INTERVAL_SECONDS:-0.5}"

mkdir -p "$(dirname "$OUTPUT_FILE")"
TMP_FILE="$(mktemp)"
STATS_FILE="$(mktemp)"
STARTUP_LOG=""
cleanup() {
  if [ -n "${stats_pid:-}" ]; then
    kill "$stats_pid" 2>/dev/null || true
    wait "$stats_pid" 2>/dev/null || true
  fi
  rm -f "$TMP_FILE" "$STATS_FILE" "$STARTUP_LOG"
  if [ -n "${app_pid:-}" ]; then
    kill "$app_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

compose_args() {
  local file
  for file in "${COMPOSE_FILES[@]}"; do
    if [[ "$file" = /* ]]; then
      printf '%s\n' -f "$file"
    else
      printf '%s\n' -f "$ROOT_DIR/$file"
    fi
  done
}

compose() {
  local args=()
  while IFS= read -r arg; do
    args+=("$arg")
  done < <(compose_args)
  docker compose "${args[@]}" "$@"
}

start_stats_sampler() {
  local ids
  ids="$(compose ps -q 2>/dev/null || true)"
  [ -n "$ids" ] || return 0
  (
    while :; do
      docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}' $ids 2>/dev/null \
        | while IFS=$'\t' read -r name cpu memory pids; do
            printf '%s\t%s\t%s\t%s\t%s\n' "$(date +%s%3N)" "$name" "$cpu" "$memory" "$pids"
          done >> "$STATS_FILE"
      sleep "$STATS_INTERVAL_SECONDS"
    done
  ) &
  stats_pid=$!
}

probe() {
  local url="$1"
  local result
  if result="$(curl -L -sS -o /dev/null --max-time "${BENCHMARK_TIMEOUT_SECONDS:-120}" \
    -w '%{http_code} %{time_total}' "$url" 2>/dev/null)"; then
    printf '%s' "$result"
  else
    printf 'ERR -'
  fi
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

wait_for_url "$BACKEND_URL/health" || { echo "Backend did not become ready." >&2; exit 1; }
wait_for_url "$FRONTEND_URL/" || { echo "Frontend did not become ready." >&2; exit 1; }
start_stats_sampler
run_pass "Cold / first request pass"
run_pass "Warm / second request pass"

if [ -n "${stats_pid:-}" ]; then
  kill "$stats_pid" 2>/dev/null || true
  wait "$stats_pid" 2>/dev/null || true
  unset stats_pid
fi

machine="$(uname -a)"
commit="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
next_size="$(du -sh "$ROOT_DIR/frontend/.next" 2>/dev/null | awk '{print $1}' || printf 'not present')"
resource_config="frontend cpus=${FRONTEND_DEV_CPUS:-1.5}, mem_limit=${FRONTEND_DEV_MEMORY:-2g}, pids_limit=${FRONTEND_DEV_PIDS:-512}"
benchmark_command="${BENCHMARK_COMMAND:-BENCHMARK_COMPOSE_FILES='$COMPOSE_FILES_RAW' ./scripts/benchmark-dev.sh}"
frontend_id="$(compose ps -q frontend 2>/dev/null | head -n 1 || true)"
if [ -n "$frontend_id" ]; then
  resource_config="$(docker inspect "$frontend_id" --format 'frontend NanoCpus={{.HostConfig.NanoCpus}}, Memory={{.HostConfig.Memory}}, PidsLimit={{.HostConfig.PidsLimit}}' 2>/dev/null || printf '%s' "$resource_config")"
fi

stats_summary="$(awk -F '\t' '
function number(value) { gsub(/%/, "", value); return value + 0 }
function memory_mib(value, amount, unit) {
  split(value, parts, /[[:space:]]*\//)
  amount = parts[1]
  unit = amount
  gsub(/[0-9.]+/, "", unit)
  gsub(/[^0-9.]/, "", amount)
  if (unit == "GiB" || unit == "GB") return amount * 1024
  if (unit == "KiB" || unit == "KB") return amount / 1024
  if (unit == "B") return amount / 1024 / 1024
  return amount
}
NF >= 5 {
  name=$2; cpu=number($3); memory=memory_mib($4); pids=$5+0
  if (!(name in max_cpu) || cpu > max_cpu[name]) max_cpu[name]=cpu
  if (!(name in max_memory) || memory > max_memory[name]) max_memory[name]=memory
  if (!(name in max_pids) || pids > max_pids[name]) max_pids[name]=pids
}
END {
  for (name in max_cpu) printf "| %s | %.2f%% | %.1f MiB | %d |\n", name, max_cpu[name], max_memory[name], max_pids[name]
}' "$STATS_FILE" | sort)"

{
  printf '# Development performance run\n\n'
  printf -- '- Timestamp: %s\n- Commit: `%s`\n- Machine: `%s`\n- Compose files: `%s`\n- Command: `%s`\n- Frontend: `%s`\n- Backend: `%s`\n- Startup: %s\n- Cache policy: script không tự xóa `.next`, volume hoặc database.\n\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$commit" "$machine" "$COMPOSE_FILES_RAW" "$benchmark_command" "$FRONTEND_URL" "$BACKEND_URL" "$startup_note"
  printf '## Environment snapshot\n\n```text\n'
  node --version 2>/dev/null || true
  (cd "$ROOT_DIR/frontend" && node --version 2>/dev/null) || true
  printf '.next size: %s\nDocker compose resource config: %s\n```\n' "$next_size" "$resource_config"
  printf '\n## Continuous container peaks\n\n| Container | CPU peak | Memory peak | PIDs peak |\n|---|---:|---:|---:|\n%s\n' "${stats_summary:-| unavailable | unavailable | unavailable | unavailable |}"
  if [ -n "$STARTUP_LOG" ]; then
    printf '\n## Compile log excerpts\n\n```text\n'
    rg -i 'compiled|compile|ready|rebuild' "$STARTUP_LOG" | tail -n 80 || true
    printf '```\n'
  fi
  cat "$TMP_FILE"
} > "$OUTPUT_FILE"

echo "Benchmark report written to $OUTPUT_FILE"
