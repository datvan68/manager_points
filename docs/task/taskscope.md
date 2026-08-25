task: "Fully hydrate Class Report edit in quick-selection mode"
pipeline: bug_fix
profile: Quick
objective: "Opening an existing class report for edit must reproduce its saved form state, including the quick-selection roster and selected violations."

evidence:
  current_behavior:
    - "AddClassReportView maps linked academic records into addedViolations but does not restore selectedCriterionId or explicitly enter quick mode."
    - "Setting classIds triggers the class-dependent effect, which clears criterion/input state while the edit form is hydrating."
  expected_behavior:
    - "Edit opens like the completed quick-entry view: saved general information is visible, the roster loads, and saved students are highlighted for the restored criterion."

scope:
  write:
    - "frontend/src/components/grading/AddClassReportView.tsx"
    - "frontend/src/components/grading/AddClassReportView.test.tsx"
  preserve:
    - "Create-form drafts, manual entry, explicit class changes, update payload, RBAC, and API contracts"
  out:
    - "Backend/schema changes and unfinished-edit persistence"

acceptance_criteria:
  - "AC-01: Edit hydration retains the saved class, teacher, report date, class note, and every linked violation after class loading completes."
  - "AC-02: Edit defaults to quick mode, restores a valid saved criterion, loads the class roster, and highlights/counts every student recorded under that criterion."
  - "AC-03: Records with multiple criteria remain intact; changing the displayed criterion shows the matching saved selections without deleting other saved violations."
  - "AC-04: A class explicitly changed by the user still clears incompatible dependent state; create/draft behavior and update contracts remain unchanged."

execution:
  - "E-01 [AC-01..AC-04] AddClassReportView.tsx -> add one-shot edit hydration, derive the initial criterion from loaded records, select quick mode, and separate hydration from user class changes."
  - "E-02 [AC-01..AC-04] AddClassReportView.test.tsx -> cover complete edit restoration, roster reload, selection highlighting/counts, multiple criteria, and subsequent class change."

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx"
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck"
  - "V-03 [AC-01..AC-03] Manual: edit a saved class report and compare all restored fields and selected student cards with its detail view."

risks:
  - "Async class, roster, criteria, and record requests can overwrite one another; the hydration guard must be consumed once without suppressing later user changes."

stop_conditions:
  - "Stop if linked records lack stable student/criterion identifiers and require an API or schema change."
