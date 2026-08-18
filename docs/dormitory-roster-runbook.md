# Dormitory roster compatibility and migration runbook

## Runtime contract

`dormitory_roster_entries` is the canonical collection. The model is
`DormitoryRosterEntry`; each entry has one `roster_entry_code` and may link to a
Student only through `student_id`. The old `/dormitory/registrations` route and
`registration_code` response field are compatibility aliases for one deprecation
window. Permission codes `DORM_REG_*` remain unchanged and are displayed as
“Danh sách KTX”.

Public QR submissions are manual-first. The endpoint never returns a match,
PII, or “student exists” signal for a submitted student code. A safe internal
single match may be stored as `student_id`; otherwise the validated snapshot is
stored as `UNLINKED`.

## Dry-run procedure

1. Run `npm run migration:dormitory-registration-reconciliation:dry-run` and
   record only redacted IDs, counts, conflicts, and checksums.
2. With no `MONGO_URI`, run
   `npm run migration:dormitory-roster:dry-run` to validate script wiring
   without database reads or writes.
3. For a disposable non-production database, run the roster dry-run and review
   linked-pair merges, unlinked public rows, target ID collisions, required
   fields, semester mapping, duplicate Student/semester pairs, and contract
   reference mappings.

## Human Gate before execute

Execution of the implemented idempotent writer requires an explicitly approved non-production target, a backup and
restore rehearsal, pre-migration index snapshot, redacted reconciliation and
roster plans, conflict-free counts/checksums, maintenance/concurrency controls,
and a rollback command/resume point. Do not set
`DORMITORY_ROSTER_MIGRATION_APPROVED=true` or run `--execute` from an ordinary
application deployment. The current implementation request does not include
that gate. Legacy collections remain intact and read-only until a
separate cutover and legacy-cleanup gate.

Rollback restores application routing to the legacy collections and reverses
only verified `roster_entry_id` reference changes from the captured mapping.
Never infer reverse merges or delete either legacy collection.
