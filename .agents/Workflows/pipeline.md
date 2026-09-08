---
description: Choose one primary skill and proportional verification.
version: 3.4.2
managed_by: orchestrator
---

# Pipeline routing

Skill paths below are relative to `.agents/Skills/`. Load one primary skill;
do not read the other rows' skills. Diagnose/explain/review requests are
read-only unless the user also authorizes a fix or document change.

| Pipeline | Primary skill | Required outcome/check |
| --- | --- | --- |
| `feature_development` | `implement_feature.md` | Observable behavior, preserved contracts, relevant success/error test or manual evidence. |
| `bug_fix` | `debug_issue.md` | Reproduction/equivalent evidence → confirmed cause → authorized fix → focused regression check. |
| `refactor` | `refactor_code.md` | Passing baseline → scoped transform → unchanged observable behavior. |
| `test_only` | `write_test.md` | Existing conventions → meaningful assertions → changed test target passes. |
| `explain_or_document` | `explain_code.md` | Source-backed explanation or requested docs → links/consistency check. |
| `devops_infra` | `implement_feature.md` | Full: inspect state → scoped change → validate/plan → required review/gate → authorized apply → verify. |
| `pr_review` | `review_code.md` | Pin diff/base/head → executable evidence → prioritized findings; no patch. |

Quick eligibility and budgets belong to `safety.md`. Promote to Full before
mutation if scope exceeds those conditions. Full executes dependency steps
serially by default; keep the same scope unless new evidence requires amendment.

Independent review is required for changed authentication/authorization,
sensitive-data handling, concurrency, public compatibility, money, persistence,
or another evidenced material risk. Schedule it only when authorized and
available; otherwise record the unmet review requirement and do not claim
completion. Ordinary documentation and file count alone do not require it.

Determine this from the changed behavior or contract and its evidenced risk,
not merely an auth-related filename, a schema import, or use of persistence.
Record the review trigger and reviewer availability during scoping. An explicit
requirement here permits a bounded reviewer subtask when delegation tools are
available; supply the capsule from `global.md`. Otherwise prepare and verify
the authorized change, record the unmet review requirement, and request only
the missing review needed for completion. Do not waive required review.

Verification order: changed behavior → direct affected contracts → package
typecheck/build when required by scope or risk. Broaden only for new evidence,
a failure, repository policy, or cross-module impact. Do not run an application
build for instruction-only edits. Passing compilation does not prove behavior;
DOM/class assertions do not prove browser layout.

Select required checks once for the affected behavior/contracts. Reuse a pass
within the task while its source, configuration, dependencies and relevant
runtime inputs remain unchanged. Rerun affected checks after a relevant edit,
failure or environment change; a phase transition alone is not a trigger.
For low-impact copy/style/document edits, focused inspection or manual evidence
may suffice; add automated tests when they provide meaningful regression
protection. Keep runtime evidence when the criterion depends on interaction.

When an AC depends on real interaction, integration or data behavior, include a
focused dev UI/API scenario using `safety.md` section 6a. A mock-only pass cannot
satisfy that AC. Ordinary authorized dev CRUD testing alone does not trigger
Full or independent review; changed application risk still determines both.

Use `global.md` for pin/isolation/completion and `orchestrator.md` for the
execution loop. Do not create duplicate scope, result, or checkpoint artifacts.
