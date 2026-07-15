---
trigger: always_on
priority: highest
applies_to: all_agents
override: none   # No agent, not even the orchestrator, may override this file
---

# Safety Rules

> These rules have the highest priority in the entire system. Even the orchestrator may not override them. Every violation must be logged and reported immediately.

---

## 1. Shell Commands — Whitelist

Only the following commands are permitted. Any command not on this list → refuse, return `SAFETY_VIOLATION`.

```bash
# ✅ Version Control
git clone | git pull | git push | git fetch
git status | git log | git diff | git checkout | git branch
git add | git commit | git stash | git tag

# ✅ Docker
docker build | docker run | docker ps | docker stop
docker logs | docker inspect | docker images | docker pull
docker-compose up | docker-compose down | docker-compose build

# ✅ Kubernetes
kubectl get | kubectl describe | kubectl apply | kubectl delete
kubectl rollout | kubectl logs | kubectl exec | kubectl port-forward
kubectl config view | kubectl config use-context

# ✅ Node.js / npm / yarn
npm install | npm run | npm test | npm build | npm audit
yarn install | yarn run | yarn test | yarn build

# ✅ Python
pip install | pip list | pip show
pytest | python -m | python3 -m

# ✅ File System (restricted to allowed paths)
ls | cat | grep | find | echo | head | tail | wc
mkdir | cp | mv | touch | diff | stat

# ✅ Common utilities
jq | yq | curl (GET only, never piped into a shell) | wget (download only)
zip | unzip | tar (extract only) | base64 | sha256sum
```

```bash
# ❌ ABSOLUTELY FORBIDDEN — Immediately triggers SAFETY_VIOLATION
rm -rf /                  # Wipe the entire filesystem
rm -rf * (at root paths)  # Uncontrolled mass deletion
chmod 777                 # Unrestricted permission opening
chown -R                  # Bulk ownership change
curl <url> | bash         # Directly execute a script from the internet
wget <url> | bash         # Same as above
sudo su | sudo -i | su -  # Root privilege escalation
dd if=/dev/               # Direct disk manipulation
nc | netcat | ncat        # Arbitrary network connections (reverse shell)
> /etc/passwd             # Overwrite system files
iptables | ufw            # Firewall changes
crontab -e                # Add a scheduled task
ssh-keygen | ssh-copy-id  # Generate/distribute SSH keys
eval "$(...)"`             # Execute a dynamic string
```

> **Note on `curl`:** Only for GET requests against API/JSON data. Never `curl <url> | bash` or `curl <url> | sh`.

---

## 2. File System Scope

```yaml
allowed_read:
  - ./src/**
  - ./tests/**
  - ./docs/**
  - ./configs/**
  - ./.agents/**          # Read agent definitions
  - /tmp/agent-workspace/**

allowed_write:
  - ./output/**
  - /tmp/agent-workspace/**
  - ./logs/**
  - ./docs/**             # doc-agent updates documentation

allowed_read_only:        # Read-only, never write/delete
  - .env                  # Read for config values only, contents must never be logged
  - .env.local
  - .env.staging
  - .env.production

forbidden_read_write:
  - /etc/**
  - /root/**
  - ~/.ssh/**
  - /proc/**
  - /sys/**
  - /boot/**
  - .env* (write — writing to any .env file is strictly forbidden)
```

> **`.env` rule:** Agents may read `.env` for config values (e.g. `DATABASE_URL`), but must **never** log, print, or pass the contents elsewhere. Any value taken from `.env` must be masked immediately wherever it appears in output.

---

## 3. Resource Limits

```yaml
max_execution_time: 300s        # Max 5 minutes per task (hard limit)
max_output_tokens: 8192         # Output limit per model call
max_retry_attempts: 2           # Number of retries for API_ERROR or TOOL_TIMEOUT
max_loop_iterations: 3          # Max PLAN-EXECUTE-VERIFY-REFINE iterations (ENG Loop, see global.md §8) — separate from max_retry_attempts
max_concurrent_subagents: 5     # Number of sub-agents running concurrently (consistent with orchestrator.md)
max_file_size_write: 10MB       # Max file size that can be written
max_pipeline_duration: 600s     # Max total duration of a pipeline (10 minutes)
checkpoint_ttl: 3600s           # Checkpoint expires after 1 hour if not resumed
```

> When `max_execution_time` is exceeded: the agent stops immediately, returns `TOOL_TIMEOUT`, and saves a checkpoint if possible.

---

## 4. Sensitive Information Protection

The following patterns must never appear in logs, output, payloads, or notifications:

```regex
# API Keys & Secrets
(?i)(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*=\s*\S+
(?i)(password|passwd|pwd)\s*=\s*\S+
(?i)(private[_-]?key|client[_-]?secret)\s*=\s*\S+
TOKEN\s*=\s*\S+
PRIVATE_KEY\s*=\s*\S+

# Personal information
\b\d{3}-\d{2}-\d{4}\b                            # US SSN
\b4[0-9]{12}(?:[0-9]{3})?\b                      # Visa card
\b5[1-5][0-9]{14}\b                              # Mastercard
[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,} # Email (in logs/payloads)
```

**Mandatory masking procedure:**
```
Input:   DATABASE_URL=postgres://admin:secretpass@host:5432/db
Output:  DATABASE_URL=postgres://***REDACTED***@host:5432/db

Input:   API_KEY=sk-1234abcd
Output:  API_KEY=***REDACTED***
```

> Masking must occur **before** processing — never log a raw secret, even for debugging purposes.

---

## 5. Environment-Based Limits

```yaml
environment: production
  allowed_actions:
    - read
    - analyze
    - generate_code      # Generate code/config but do not apply it
    - security_scan
  forbidden_actions:
    - deploy             # Requires human approval first
    - delete_resource    # Requires human approval first
    - modify_database    # Requires human approval first
    - kubectl apply      # Only usable after human approval
    - terraform apply    # Only usable after human approval
  note: "Any action executed on production requires a human_gate in the pipeline"

environment: staging
  allowed_actions:
    - read
    - analyze
    - generate_code
    - security_scan
    - deploy             # Allowed, but must be approved by review-agent
  forbidden_actions:
    - delete_resource
    - modify_database    # Schema changes — requires human approval
  note: "deploy on staging is allowed but requires a review-agent gate"

environment: development
  allowed_actions: all
  note: "The shell command whitelist and file system rules above still apply"
```

---

## 6. Behavior Upon Detecting a Violation

When any agent detects an action that violates safety rules:

```
1. Stop execution immediately — do not proceed even partially
2. Log fully according to the schema below
3. Return status: error with error_code: SAFETY_VIOLATION
4. Notify the orchestrator to escalate
5. Do not retry the rejected action on its own
6. Do not continue the pipeline — the orchestrator decides how to proceed
```

**Violation Log Schema:**

```json
{
  "timestamp": "ISO-8601",
  "agent_id": "violating-agent-name",
  "task_id": "uuid-v4",
  "pipeline_id": "pipeline-name",
  "step": 2,
  "violation_type": "SHELL_FORBIDDEN | FILE_FORBIDDEN | ENV_FORBIDDEN | SECRET_EXPOSURE | RESOURCE_LIMIT",
  "action_attempted": "rm -rf /tmp/agent-workspace/../../../etc",
  "reason": "Shell command not on the whitelist",
  "blocked": true,
  "notify": ["orchestrator"]
}
```

---

## 7. Human-in-the-Loop (Mandatory)

The following situations **require the pipeline to stop and ask the user** before proceeding — this also applies while an agent is running inside the ENG Loop (`global.md §8`); the loop must stop immediately at that iteration and send `approval_required`, without self-refining/retrying to bypass the gate:

**Production environment:**
- [ ] Deploy anything to production (`kubectl apply`, `terraform apply`, ...)
- [ ] Delete a resource (database, bucket, service, namespace, IAM role)
- [ ] Change infrastructure configuration (network, firewall, load balancer)
- [ ] Execute a database migration (schema changes)
- [ ] Create or delete an IAM role/policy/permission

**All environments:**
- [ ] Merge into `main` / `master` / `release/*` branches
- [ ] Delete a branch from the remote repository
- [ ] Reset or rebase history of a shared branch
- [ ] Operate on secrets/credentials (rotate, revoke, generate)
- [ ] Change CI/CD pipeline configuration that affects the production workflow

**Human Gate Request Schema** (sent by the orchestrator to the user):

```json
{
  "type": "approval_required",
  "task_id": "uuid-v4",
  "pipeline_id": "devops_infra",
  "step": 3,
  "environment": "production",
  "action_summary": "Apply k8s manifest thay đổi replica count từ 2 → 5 cho service api-gateway",
  "artifacts_to_review": [
    {
      "type": "file",
      "path": "./output/k8s-manifest.yaml",
      "description": "K8s deployment manifest đã được review bởi devops-agent"
    }
  ],
  "risk_level": "medium | high | critical",
  "triggered_by": "pipeline_rule: environment == production",
  "message": "Vui lòng review artifact và xác nhận để tiếp tục."
}
```
