task: "Fix permanent bulk deletion routing in trash"
pipeline: bug_fix
profile: Quick
objective: "Permanent bulk deletion from the academic-record trash reaches the bulk handler instead of treating `bulk` as a record ID."

evidence:
  current_behavior: "DELETE /academic-records/bulk/force returns repeated `AcademicRecord with ID bulk not found` errors."
  root_cause: "backend/src/academic-record/academic-record.controller.ts declares @Delete(':id/force') before @Delete('bulk/force'), so the parameterized route captures the static bulk URL."
  expected_behavior: "The request invokes bulkForceRemove once with the submitted IDs and never invokes forceRemove with id `bulk`."

scope:
  write: ["backend/src/academic-record/academic-record.controller.ts:forceRemove/bulkForceRemove", "backend/src/academic-record/academic-record.controller.spec.ts"]
  preserve: ["DELETE_STUDENT_RECORD guard", "DELETE /academic-records/:id/force contract", "DELETE /academic-records/bulk/force contract", "daily-report bypass and permanent-delete eligibility rules"]
  out: ["frontend deletion flow", "bulk service semantics", "soft-delete routes", "rate-limit configuration"]

acceptance_criteria:
  - "AC-01: DELETE /academic-records/bulk/force resolves to bulkForceRemove and forwards dto.ids, requester, and bypass=true."
  - "AC-02: DELETE /academic-records/:id/force still resolves to forceRemove for a real record ID."
  - "AC-03: A route-level regression test fails if the static bulk route is captured as id=`bulk`."

execution:
  - "E-01 [AC-01,AC-02] Reorder the static bulk/force route before the parameterized :id/force route without changing paths or guards."
  - "E-02 [AC-01,AC-02,AC-03] Add Nest route-resolution coverage for bulk and single permanent deletion."

verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix backend test -- academic-record/academic-record.controller.spec.ts --runInBand"
  - "V-02 [AC-01,AC-02] npm --prefix backend run build"

risks: ["Route precedence regressions can silently dispatch destructive requests to the wrong handler."]
stop_conditions: ["Stop if fixing precedence requires changing the public endpoint or weakening its permission guard."]
