#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev-infra.yml}"
ENV_FILE="${ENV_FILE:-}"
SERVICE="${MONGO_SERVICE:-mongodb}"
WAIT_TIMEOUT="${MONGO_WAIT_TIMEOUT:-120}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --compose-file) COMPOSE_FILE="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --timeout) WAIT_TIMEOUT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

compose=(docker compose -f "$COMPOSE_FILE")
if [ -n "$ENV_FILE" ]; then compose+=(--env-file "$ENV_FILE"); fi

mongosh_args=(mongosh --quiet)
if [ -n "${MONGO_ROOT_USERNAME:-}" ] && [ -n "${MONGO_ROOT_PASSWORD:-}" ]; then
  mongosh_args+=(--username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin)
fi

probe_js='const h=db.adminCommand({hello:1}); if(h.setName && h.setName !== "rs0") quit(11); if(h.setName === "rs0") { const c=rs.conf(); if(c._id !== "rs0" || c.members.length !== 1 || c.members[0].host !== "mongodb:27017") quit(11); if(h.isWritablePrimary) quit(0); quit(10); } quit(12);'
deadline=$(( $(date +%s) + WAIT_TIMEOUT ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  set +e
  "${compose[@]}" exec -T "$SERVICE" "${mongosh_args[@]}" --eval "$probe_js" >/dev/null 2>&1
  probe_rc=$?
  set -e
  if [ "$probe_rc" -eq 0 ]; then
    echo "MongoDB reports rs0 writable primary."
    exit 0
  fi
  if [ "$probe_rc" -eq 11 ]; then
    echo "MongoDB reports an unexpected replica-set topology; refusing to alter it." >&2
    exit 1
  fi
  if [ "$probe_rc" -eq 12 ]; then
    init_js='const r=db.adminCommand({replSetInitiate:{_id:"rs0",members:[{_id:0,host:"mongodb:27017"}]}}); if(!r.ok && r.codeName !== "AlreadyInitialized") quit(1);'
    if ! "${compose[@]}" exec -T "$SERVICE" "${mongosh_args[@]}" --eval "$init_js" >/dev/null 2>&1; then
      echo "MongoDB replica-set initialization failed." >&2
      exit 1
    fi
  fi
  sleep 2
done

echo "Timed out waiting for an rs0 writable primary." >&2
exit 1
