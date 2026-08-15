Task: dormitory-citizen-id-issue-date-validation | bug_fix | Risk: medium | Profile: Quick
Objective: Updating a dormitory registration accepts a valid CCCD/CMND issue date in the past while continuing to reject dates after the current local calendar day.
Boundary: `backend/src/dormitory/**` | Write: `backend/src/dormitory/dto/applicant-profile.dto.ts`, `backend/src/dormitory/dto/applicant-profile.dto.spec.ts`
Targets: `ApplicantProfileDto.citizen_id_issue_date` validation and focused DTO regression tests.
Steps: Reproduce the mismatch between the string-valued `@IsDateString` field and the Date-valued `@MaxDate` validator -> replace it with date-only validation compatible with the API's `YYYY-MM-DD` string contract and timezone-safe current-day comparison -> add regression cases for a valid past date, the current date, a future date, and an invalid date string -> run the focused DTO test and inspect the final diff.
Verify: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/dto/applicant-profile.dto.spec.ts` => past/current dates pass and future/invalid dates fail with the expected validation constraints; `D:\PROJECT\manager_points` :: `git diff --check` => no whitespace errors.
Done: Dormitory registration updates no longer return `applicant_profile.Citizen ID issue date cannot be in the future` for a valid past/current issue date; future and malformed dates remain rejected; no registration API fields or unrelated validation behavior change.
Gate: None
