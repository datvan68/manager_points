# Skill: Refactor Code

> Use to improve internal structure while preserving observable behavior. If a
> requested change fixes a defect or changes a contract, route that part through
> `bug_fix` or `feature_development` instead.

## Metadata

```yaml
skill_id: refactor_code
version: 3.0.0
protocol_version: "3.3"
supported_agents: [code-agent]
capabilities: [search, code_gen]
required_pipeline: refactor
```

## Required context

- Exact targets, structural problem, write boundary, and current base state.
- Observable invariants and public/serialization/persistence contracts to keep.
- Passing focused baseline, or recorded pre-existing failures that do not
  invalidate the invariants.
- Direct callers or consumers affected by a move, rename, or boundary change.

When executable characterization is missing and risk warrants it, create the
smallest baseline test as a separate test boundary before transforming code.

## Method

1. Pin the focused baseline and relevant contract surface. Capture only evidence
   needed to compare before and after.
2. Apply one coherent structural transformation at a time inside the named
   paths. Follow current repository patterns and edit source generators rather
   than generated output.
3. Preserve names, return values, side effects, error semantics, ordering,
   authorization, serialization, concurrency, caching, and persistence unless
   the scope explicitly identifies an inapplicable invariant.
4. Re-run the focused baseline after each meaningful transformation. Check
   affected consumers after a move or internal interface change, and compare
   generated/public artifacts when relevant.
5. Run performance checks only when the transformation touches queries,
   allocations, critical loops, concurrency, or caches with a stated budget.
6. Review the final diff for behavioral drift and unrelated cleanup.

## Decision rules

- Do not force universal file-size, layering, dependency-injection, or error
  patterns; repository convention and the stated structural outcome decide.
- Record a discovered bug separately. Do not fix it in this pipeline without an
  approved bug-fix scope.
- Correct a verification failure only when the same invariants and boundary
  remain valid. If the desired structure conflicts with behavior preservation,
  stop and name the conflicting invariant.
- Never delete or weaken tests, update expectations to hide drift, add a
  dependency, or cross the boundary for opportunistic cleanup.

## Result

Return the common `global.md` envelope plus the transformation summary,
changed paths, invariant status with command evidence, and explicit booleans for
public-contract and performance-characteristic changes. Success requires both
the focused baseline comparison and applicable consumer checks; code review
alone is insufficient when executable checks exist.
