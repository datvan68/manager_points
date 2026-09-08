# Antigravity operating entrypoint

Version: 3.4.2

Follow [AGENTS.md](AGENTS.md) for loading and execution. This entrypoint does
not define a separate profile, scope schema, delegation policy or result format.
If canonical instructions are already loaded, do not load them again.

Canonical owners:

- [Safety](Rules/safety.md): permissions, gates, dev testing and budgets.
- [Global](Rules/global.md): ownership, baselines, pins and completion.
- [Orchestrator](Workflows/orchestrator.md): execution sequence.
- [Pipeline](Workflows/pipeline.md): primary skill and verification selection.
- [Taskscope](Workflows/taskscope.md): runtime brief and persisted-scope routing.

Load only the sources required by the current task. Default to direct execution;
Full alone does not require delegation or additional artifacts.
