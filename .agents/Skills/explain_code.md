# Skill: Explain Code

> Produce an evidence-linked explanation of code, behavior, or architecture at the requested level without modifying implementation files.

## Metadata

```yaml
skill_id: explain_code
version: 2.0.0
supported_agents: [review-agent, doc-agent]
capabilities: [search, summarize]
supported_stacks: repository_defined
default_mode: read_only
```

## Modes

| Mode | Primary output |
|---|---|
| `beginner` | Concepts and a small step-by-step example |
| `technical` | Contracts, control/data flow, dependencies, trade-offs |
| `architecture` | Boundaries, ownership, runtime flow, failure modes |
| `debug` | Execution path, state transitions, evidence gaps |
| `review` | Evidence-linked risks and actionable improvements |
| `docs` | Repository-ready documentation following existing style |

## Input

```json
{
  "protocol_version": "3.0",
  "task_id": "uuid-v4",
  "pipeline_id": "explain_or_document",
  "step_id": "inspect",
  "mode": "technical",
  "targets": [
    {"path": "packages/api/src/orders/service.ts", "symbol": "createOrder"}
  ],
  "focus": "transaction and failure behavior",
  "question": "How does the operation remain idempotent?",
  "audience": "backend engineer",
  "output_format": "markdown | inline_comments | jsdoc | structured",
  "context_refs": []
}
```

Source content should normally be loaded from repository paths and artifact references. Do not embed entire large files in the input.

## Output

Return the common result envelope with:

```json
{
  "summary": "Concise explanation.",
  "flow": [
    {"order": 1, "path": "...", "symbol": "...", "behavior": "..."}
  ],
  "contracts": [],
  "dependencies": [],
  "failure_modes": [],
  "design_decisions": [
    {"decision": "...", "evidence_ref": {"path": "...", "symbol": "..."}}
  ],
  "potential_issues": [
    {
      "severity": "critical | warning | suggestion",
      "path": "...",
      "symbol": "...",
      "description": "...",
      "evidence": "...",
      "suggestion": "..."
    }
  ],
  "artifact_refs": []
}
```

Potential issues are observations, not authorization to modify code. Route implementation through the appropriate pipeline.

## Method

1. Resolve the exact commit, path, symbol, and question.
2. Read the target plus only direct interfaces and dependencies needed to answer.
3. Distinguish observed behavior, inferred intent, and undocumented assumptions.
4. Trace control flow, data transformations, side effects, state transitions, and error paths.
5. Explain why the current design exists only when evidence supports it; otherwise label the rationale as unknown.
6. Match depth, terminology, and examples to the requested audience.
7. Reference paths and symbols; use line numbers only when the commit is pinned and the location is stable.

## Mode requirements

### Beginner

- Define unfamiliar terms briefly.
- Explain the main path before exceptions.
- Use one representative example rather than narrating every line.

### Technical

- Cover input/output contracts, invariants, dependencies, side effects, complexity, concurrency, and error behavior.
- Identify trade-offs without forcing a different architecture.

### Architecture

- Start from module/service boundaries and ownership.
- Describe synchronous and asynchronous flows, persistence, external systems, security boundaries, and failure recovery.
- Use a diagram artifact only when relationships are clearer visually.

### Debug

- Trace from the failure observation to candidate state transitions.
- State evidence gaps and checks needed; do not present hypotheses as confirmed causes.

### Review

- Prioritize correctness and security before performance and maintainability.
- Every issue needs concrete evidence and an actionable alternative.

### Docs

- Follow repository terminology, templates, heading hierarchy, and link style.
- Do not duplicate source code that will drift; document contracts and usage.

## Large-codebase guidance

- Begin with the module manifest and dependency graph.
- Build explanations in layers: system -> module -> symbol -> edge cases.
- Shard read-only inspection by independent module, then deduplicate at synthesis.
- Store long inventories or diagrams as artifacts and keep the user-facing explanation focused.

## Quality rules

- Explain why and when, not merely what each statement does.
- Preserve code identifiers in English; user-facing prose follows the requested language.
- Never claim a security issue, race, or performance defect without an executable path or evidence.
- Never modify code in this skill.
