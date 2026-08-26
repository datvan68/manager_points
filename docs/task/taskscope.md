task: "Keep MongoDB reachable across development Compose entrypoints"
pipeline: devops_infra
profile: Full
objective: "Running the infra-only Compose entrypoint cannot strand MongoDB outside the network used by an existing containerized backend."

evidence:
  current_behavior: "08/26/2026 container log shows MongooseServerSelectionError getaddrinfo ENOTFOUND mongodb from /app. docker inspect identifies manager_points-mongodb-1 from docker-compose.dev-infra.yml on manager_points_default, while manager_points-backend-1 from docker-compose.yml + docker-compose.dev.yml is on manager_points_manager-point-network; docker exec manager_points-backend-1 getent hosts mongodb exits 1."
  expected_behavior: "MongoDB and Redis created by either development Compose entrypoint share manager-point-network with the containerized backend; hostname mongodb resolves before Nest starts."
  root_cause: "docker-compose.dev-infra.yml uses the same Compose project/service names as the full stack but declares no networks. Starting its mongodb service recreates the shared service on the implicit default network and disconnects it from the backend network."

scope:
  inspect: ["docker-compose.yml:mongodb/redis/backend network contract", "docker-compose.dev.yml:development overlay", "docker-compose.dev-infra.yml:mongodb/redis network omission", "scripts/dev-host.sh:infra-only Compose invocation"]
  write: ["docker-compose.dev-infra.yml:attach mongodb and redis to manager-point-network and declare the same network key", "README.md:document entrypoint compatibility and safe ENOTFOUND recovery"]
  preserve: ["MONGO_URI mongodb://mongodb:27017/manager-point?replicaSet=rs0 inside containers", "localhost URI for host-run Nest", "existing MongoDB/Redis volumes and replica-set state", "unrelated dirty changes and all .env files"]
  out: ["production deployment", "volume deletion/recreation", "application retry changes", "custom DNS, external MongoDB, or multi-node topology"]

acceptance_criteria:
  - "AC-01: Rendered dev-infra configuration attaches mongodb and redis to the same manager-point-network key used by the full development stack."
  - "AC-02: After infra-only mongodb is started under project manager_points, backend and MongoDB have a common network and getent hosts mongodb succeeds inside backend."
  - "AC-03: Nest connects without ENOTFOUND mongodb; MongoDB remains an rs0 writable primary and existing named volumes are unchanged."
  - "AC-04: README gives a recovery command that recreates services without down -v or data deletion."

execution:
  - "E-01 [AC-01..AC-03] docker-compose.dev-infra.yml:mongodb/redis/networks → bind both services to manager-point-network using the same project-scoped network contract as docker-compose.yml."
  - "E-02 [AC-04] README.md:development troubleshooting → record the mixed-entrypoint failure signature and a no-volume-delete service recreation procedure."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01] docker compose -f docker-compose.dev-infra.yml config -q → exits 0; rendered mongodb/redis networks include manager-point-network."
  - "V-02 [AC-02, AC-03] docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongodb redis backend; docker compose -f docker-compose.dev-infra.yml up -d mongodb; docker exec manager_points-backend-1 getent hosts mongodb → exits 0 after the exact previously failing sequence."
  - "V-03 [AC-03] docker exec manager_points-mongodb-1 mongosh --quiet --eval 'const h=db.adminCommand({hello:1}); if(h.setName!==\"rs0\"||!h.isWritablePrimary) quit(1)' → exits 0; backend logs contain no new ENOTFOUND mongodb retry."
  - "V-04 [AC-04] git diff --check -- docker-compose.dev-infra.yml README.md → exits 0."

risks: ["Compose project-name overrides must remain consistent; different -p values create different physical networks even when YAML keys match."]
stop_conditions: ["Stop before any command that removes volumes or persistent data.", "Stop if the failing backend and MongoDB intentionally use different Compose projects; choose an explicit external-network contract instead of assuming shared project scope.", "Stop if DNS succeeds but MongoDB returns authentication, TLS, replica-set, or connection-refused errors; diagnose that separate failure."]
