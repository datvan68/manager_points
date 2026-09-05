# Skill: Explain Code

> Use for source-backed explanations and explicitly requested documentation or
> repository-instruction edits. Use another skill for diagnosis, formal review,
> or application implementation.

## Metadata

```yaml
skill_id: explain_code
version: 3.4.0
protocol_version: "3.3"
supported_agents: [review-agent, doc-agent]
capabilities: [search, summarize, scoped_documentation_write]
default_mode: read_only
required_pipeline: explain_or_document
```

## Required context

- Exact question, target paths or symbols, intended audience, and desired depth.
- Commit or current worktree state when location-sensitive evidence matters.
- Output form: response, inline comments, or an explicitly authorized document.

Choose the narrowest useful mode:

| Mode | Cover |
| --- | --- |
| `beginner` | Main concept, essential terms, one representative example |
| `technical` | Contracts, control/data flow, dependencies, side effects, errors |
| `architecture` | Ownership, boundaries, runtime flow, recovery, security edges |
| `debug` | Observed execution path, state transitions, evidence gaps |
| `docs` | Stable contracts and usage in repository style |

Use `review_code` when the requested outcome is a prioritized verdict with
findings. A `debug` explanation does not confirm a root cause.

## Method

1. Resolve the exact target and question before reading broadly.
2. Inspect the target, then only the direct interfaces, callers, dependencies,
   and tests needed to answer. Stop when the question is evidenced.
3. Trace inputs, transformations, side effects, state changes, outputs, and
   relevant failure paths in execution order.
4. Label observed implementation, inferred intent, and undocumented rationale
   distinctly. Explain a design choice only when code, tests, or docs support it.
5. Match terminology and depth to the audience. Explain the main path before
   exceptions and use one example instead of narrating every line.
6. Reference repository-relative paths and stable symbols. Use line numbers
   only against a pinned revision or stable current snapshot.

## Output and quality

Follow the `global.md` result contract. Include only sections that help answer
the question: summary, ordered flow, contracts, dependencies, side effects,
failure modes, evidence-backed decisions, and unresolved evidence gaps.

- Explain why and when, not merely what each statement does.
- Keep identifiers in their source language; write prose for the requested
  audience and language.
- Do not claim a race, vulnerability, performance defect, or business rule
  without an executable path or repository evidence.
- Prefer a small diagram only when three or more relationships or state changes
  are materially clearer visually.
- For durable docs, follow existing terminology, heading, and link conventions;
  document stable contracts rather than copying source that will drift.
- For instruction edits, keep each rule in one canonical owner and link to it.
  Check routing paths, rule consistency, and representative workflow decisions;
  do not run application builds or claim model-performance gains from prose
  changes alone. Keep lifecycle compatibility unless explicitly changing it.
- Potential improvements are observations, not permission to modify code.
