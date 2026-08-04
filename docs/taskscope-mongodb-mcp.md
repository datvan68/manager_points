# Task Identity and Pipeline

Task: `configure-mongodb-mcp` | Pipeline: `devops_infra` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `4aa1017671eb25f8f6304fd0ae379870179d986d`

# Risk Level

Risk: high. Development workstation configuration with credential forwarding and database write capability. Configuration is reversible; no database mutation is included in this task.

# Objective

Configure the official MongoDB MCP Server for this trusted project, verify that the existing MongoDB connection is reachable, and require approval for write-capable MCP tools.

# Scope Boundaries

Approved/read: MongoDB MCP documentation, Codex MCP documentation, `backend/.env` only through a redacted connection check. Write: `.codex/config.toml`, this taskscope, and the current user's `MDB_MCP_CONNECTION_STRING` environment variable. Known target: project-scoped `mongodb` MCP server.

# Out of Scope

Business-data creation or modification, schema/index changes, migrations, production deployment, database-user or Atlas IAM changes, and exposing credentials in files or logs.

# Context and Dependencies

MongoDB is reachable using the repository's existing `MONGO_URI`. Node.js and `npx` are installed. Codex loads trusted project MCP configuration from `.codex/config.toml`; the official server accepts `MDB_MCP_CONNECTION_STRING`.

# Steps

1. Validate the existing MongoDB URI with a redacted ping.
2. Add project-scoped MCP configuration with write-tool approval mode.
3. Copy `MONGO_URI` to the current user's `MDB_MCP_CONNECTION_STRING` without printing it.
4. Install/start-check the official MCP package, restart Codex, and verify the server exposes MongoDB tools.

# Acceptance Criteria

- AC1: MongoDB ping succeeds without credential disclosure.
- AC2: Project configuration starts `mongodb-mcp-server@latest` and forwards only the named environment variable.
- AC3: Write-capable MCP tools require approval.
- AC4: No database records, schemas, indexes, or permissions are changed.

# Verification

- `D:\PROJECT\manager_points\backend :: node -r dotenv/config -e <redacted MongoClient ping>` => success.
- `D:\PROJECT\manager_points :: npx -y mongodb-mcp-server@latest --help` => package starts successfully and returns its usage reference.
- After Codex restart: MCP server `mongodb` initializes and exposes database tools.
- `D:\PROJECT\manager_points :: git diff --check; git status --short` => only intended configuration/scope changes plus preserved pre-existing changes.

# Safety Gates

Credential forwarding and local MCP installation are explicitly authorized by the user's request. Any later persistent-data mutation requires a separate explicit request and tool approval. Rollback: remove the MCP table and user environment variable; resume after Codex restart.

# Artifacts and Checkpoints

Configuration and taskscope files only. No secret or database dump artifact.

# Execution Budgets

Deadline: 600 seconds. Concurrency: 1 writer per path. Retries: 2. Verification loops: 3. Review remediation: 2.
