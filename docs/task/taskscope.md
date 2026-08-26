task: "Hard-delete student with transactional dependent-data cleanup"
pipeline: feature_development
profile: Full
objective: "Deleting a student permanently removes or deliberately detaches every approved dependent record, so no Student/User reference becomes orphaned."

evidence:
  current_behavior: "backend/src/students/students.service.ts:remove deletes only Student and linked User; backend/src/students/students.service.ts:update deletes only SummaryPoint when status leaves Studying. Inbound Student/User references exist in grading, activities, attendance, dormitory, tasks, tokens, notifications, and audit collections."
  expected_behavior: "The product has no graduation transition as an exit path; the approved deletion action is atomic, permission-protected, and leaves no unapproved dangling Student/User references."
  root_cause: "StudentsService has no dependency inventory, transaction, cascade policy, or cleanup of User-linked records."

scope:
  inspect: ["backend/src/students/students.service.ts:remove/update", "backend/src/students/students.module.ts:MongooseModule.forFeature", "backend/src/**/schemas/*: Student/User inbound references", "frontend/src/components/popups/StudentPopup.tsx:status transition UI and student deletion confirmation"]
  write: ["backend/src/students/dto/delete-student.dto.ts:new confirmed-deletion input", "backend/src/students/students.controller.ts:DELETE contract", "backend/src/students/student-cascade-deletion.service.ts:new transactional preflight/cascade owner", "backend/src/students/students.service.ts:remove and status-transition guard", "backend/src/students/students.module.ts:model registrations/provider", "backend/src/students/test/students.service.spec.ts and backend/src/students/student-cascade-deletion.service.spec.ts", "frontend/src/api/student-api.ts:confirmed-delete request", "frontend/src/app/(dashboard)/students/[classId]/page.tsx and page.test.tsx:delete impact confirmation/refresh", "frontend/src/components/popups/StudentPopup.tsx:remove graduation-transition UI if Human Gate approves removal"]
  preserve: ["DELETE /students/:id permission STUDENT_DELETE", "unrelated student CRUD and RBAC", "activities/classes/rooms/criteria themselves; only their student-specific relations may change", "rollback on any cleanup failure"]
  out: ["bulk deletion, production execution, database migration, changes to semester/evaluation-period deletion"]

acceptance_criteria:
  - "AC-01: DELETE /students/:id preflights every approved dependent collection and rejects deletion when the required destructive confirmation/policy input is absent."
  - "AC-02: After confirmed deletion, no approved collection contains the deleted student ID; StudentTask.targetStudentIds and notification read/recipient references are pulled or handled by the approved policy."
  - "AC-03: The linked User and approved user-owned security records are removed in the same transaction; retained audit records contain no dangling User reference."
  - "AC-04: An injected failure rolls back all deletions and preserves the Student, User, and dependencies."
  - "AC-05: The UI no longer offers transition to Graduated if the Human Gate confirms removal of that lifecycle state."

execution:
  - "E-01 [AC-01] backend/src/students/student-cascade-deletion.service.ts → enumerate/count SummaryPoint, AcademicRecord, activity member/transfer/registration/attendance/check-in/award, dormitory roster/contract/violation/invoice, task progress/target arrays, and User-owned token/session/notification/audit references; return a redacted deletion impact."
  - "E-02 [AC-01, AC-02, AC-03, AC-04] backend/src/students/dto/delete-student.dto.ts + students.controller.ts + students.service.ts:remove → require explicit confirmed-delete input and delegate to the cascade service; retain STUDENT_DELETE authorization."
  - "E-03 [AC-01, AC-02, AC-03, AC-04] backend/src/students/student-cascade-deletion.service.ts → execute the approved delete, $pull/null/snapshot policy, and Student/User deletion in one MongoDB transaction; no independent best-effort catch after Student deletion."
  - "E-04 [AC-01, AC-02] backend/src/students/students.module.ts → register only models used by the cascade service; retain one write owner for every collection."
  - "E-05 [AC-01..AC-04] backend/src/students/*spec.ts → test dependency inventory, confirmed cleanup, non-confirmed refusal, array-reference cleanup, and rollback."
  - "E-06 [AC-01, AC-02] frontend/src/api/student-api.ts + frontend/src/app/(dashboard)/students/[classId]/page.tsx → request and display redacted impact before the final confirmation, then refresh only after successful deletion."
  - "E-07 [AC-05] frontend/src/components/popups/StudentPopup.tsx and its focused test → remove the graduation transition only after the gate; retain explicit permanent-delete confirmation."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix backend test -- students/test/students.service.spec.ts --runInBand → deletion/cascade/rollback cases pass."
  - "V-02 [AC-01..AC-04] npm --prefix backend run build → Nest dependency injection and TypeScript compile pass."
  - "V-03 [AC-05] npm --prefix frontend test -- <affected-student-popup-test> → no graduation transition and delete confirmation behavior pass."

risks: ["Irreversible deletion of grading, attendance, dormitory, and account data.", "MongoDB transactions require the deployed database topology to support transactions.", "Invoices, violations, login/audit history, and notifications may be subject to retention obligations; deleting them without an approved policy is unsafe.", "Removing every non-Studying status would alter reports, filters, imports, and historical records beyond this deletion feature."]
stop_conditions: ["HUMAN GATE: approve one policy for invoices, violations, notifications, login/audit records, and files: delete, anonymize/snapshot, or retain with null reference.", "HUMAN GATE: clarify whether 'only tồn tại/mất đi' removes just Graduated or every non-Studying status; existing Reserved/Dropped/Suspended records require an explicit migration/compatibility decision.", "Stop before mutation if MongoDB transactions are unavailable or an inbound Student/User reference is found outside the approved cleanup policy."]
