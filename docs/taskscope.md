# Task Identity and Pipeline

- Task: `grading-score-access-export-congrats-branch-cleanup`
- Pipeline: `bug_fix` + `feature_development` + Git cleanup; Profile: **Full**; rule version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; environment: development.
- Base/current state: `main` at `09ad7b00d75b91a1dbe89910753e76979662e254`, tracking `origin/main`, clean worktree when scoped.
- Planning-only: tài liệu này không cho phép triển khai, merge hoặc xoá nhánh.

# Risk Level

- **High**: thay đổi authorization theo phạm vi cá nhân, export dữ liệu nhiều lớp/khoa và xoá Git refs.
- Blast radius: frontend grading UI, backend grading access/query/export và local branch state; không thay đổi schema hay persistent application data.
- Code có thể hoàn tác bằng commit; branch deletion chỉ thực hiện sau checkpoint vì `codex/grading-score-export-modal` có commit chưa nằm trong `main`.

# Objective

Cho phép student truy cập đúng hồ sơ chấm điểm của chính mình, cung cấp cho admin export Excel theo lớp/khoa/tất cả, chỉ hiển thị modal chúc mừng trong 72 giờ kể từ lúc bảng điểm được khóa, rồi dọn đúng hai local Codex branch sau khi phần cần giữ đã có trên `main`.

# Scope Boundaries

- Approved: `frontend/src/app/(dashboard)/grading/**`, `frontend/src/components/layout/StudentCongratsModalGate*`, `frontend/src/api/summaries-point-api.ts`, `backend/src/auth/**`, `backend/src/summaries-point/**`, `backend/src/evaluation-detail/**`, các test cùng module và local refs nêu dưới đây.
- Write: các implementation/test path trong approved boundary; `docs/taskscope.md`; local refs `codex/grading-score-export-modal` và `codex/complete-activity-naming-migration` chỉ sau Gate G1.
- Known targets:
  - `frontend/src/app/(dashboard)/grading/score/_hooks/useGradingScoreAccess.ts`
  - `frontend/src/app/(dashboard)/grading/score/page.tsx` và `page.test.tsx`
  - `frontend/src/app/(dashboard)/grading/page.tsx` cùng component/test export mới nếu tách modal
  - `frontend/src/components/layout/StudentCongratsModalGate.tsx` và `.test.tsx`
  - `backend/src/auth/utils/grading-access.util.ts`, `backend/src/auth/test/grading-access.spec.ts`
  - `backend/src/summaries-point/dto/export-summary-excel.dto.ts`, `summaries-point.service.ts`, controller/API và các spec liên quan
  - `backend/src/evaluation-detail/evaluation-detail.service.ts` và spec liên quan.

# Out of Scope

- Không deploy, migrate dữ liệu, đổi schema, IAM/permission catalog hoặc hành vi chấm điểm của role khác ngoài hồi quy cần thiết.
- Không xoá remote branch. `origin/Dev-1` không phải một trong hai nhánh trong ảnh và được giữ nguyên nếu chưa có chỉ dẫn riêng.
- Không lấy nguyên trạng commit `8e991059` vì diff của nhánh chứa cả thay đổi ngoài yêu cầu; chỉ port/reimplement phần đã review.

# Context and Dependencies

- `assertCanAccessStudent` trên `main` đang so `requester.userId` với document `studentId`; model đã có liên kết `Student.user_id`, đây là nguyên nhân student bị 403 khi xem bản thân.
- Backend đã biểu diễn student scope là `self`, nhưng các query summary/evaluation phải luôn ánh xạ account user sang student document và không được cho phép đọc student khác.
- Export hiện bắt buộc `semesterId + classId`; `xlsx`/Excel generator đã có. Scope mới cần `class | faculty | all`, chỉ dành cho admin, với lớp/khoa bắt buộc theo scope.
- Modal đã dùng `locked_at` và session key nhưng chưa kiểm tra tuổi; cửa sổ yêu cầu là `0 <= now - locked_at <= 72 giờ`.
- Local branches: `codex/grading-score-export-modal` tại `8e991059` chưa merge; `codex/complete-activity-naming-migration` tại `373fbacd` đã là ancestor của `main`.

# Steps

1. **Discover/diagnose (review-agent, read-only):** chốt toàn bộ endpoint/query được trang score gọi, ma trận role/scope, shape dữ liệu export và diff có giá trị tại `8e991059`; tạo checkpoint commit/ref trước mutation.
2. **Implement access (code-agent):** ánh xạ `requester.userId -> Student.user_id -> Student._id` trong access, summary và evaluation queries; student chỉ đọc/sửa phạm vi self, không đọc roster hay hồ sơ khác; thêm regression tests 200/self và 403/other.
3. **Implement export (code-agent):** thêm admin-only modal/selector tại tab `Danh sách`; validate `semesterId`, `classId`/`departmentId` theo `scope`; backend dựng tập student theo lớp, khoa hoặc toàn hệ thống và sinh workbook/filename phù hợp; giữ luồng export theo lớp hiện có cho role được phép nếu không mâu thuẫn authorization.
4. **Implement expiry (code-agent):** dùng `locked_at` làm mốc tuyệt đối 72 giờ, bỏ qua ngày lỗi/tương lai/quá hạn, vẫn chỉ hiển thị một lần mỗi session; dùng clock giả trong test cho biên 72 giờ.
5. **Verify/review (test-agent rồi review-agent):** chạy kiểm thử tập trung, typecheck/build, rà quyền truy cập ngang, export sai scope, diff ngoài phạm vi và lỗi sẵn có.
6. **Integrate:** triển khai trên isolated `codex/` branch/worktree; sau review, chỉ merge vào `main` khi policy/gate cho phép và xác nhận commit cần giữ từ `8e991059` đã được port hoặc chủ đích bỏ.
7. **Cleanup (devops-agent, sau G1):** xoá chính xác hai local branch bằng non-force delete khi đã merge; nếu Git từ chối vì unmerged thì dừng, không dùng `-D`; xác minh local branch còn đúng `main`.

# Acceptance Criteria

- **AC1:** Student mở `/grading/score` và xem/chấm hồ sơ gắn với chính `user_id` mà không bị 403; yêu cầu tới student khác vẫn bị 403 và UI không lộ roster.
- **AC2:** Admin tại tab `Danh sách` chọn xuất theo lớp, khoa hoặc tất cả; request được validate theo scope, workbook chỉ chứa đúng student của học kỳ/phạm vi đã chọn và có tên file phù hợp.
- **AC3:** Non-admin không thể gọi scope `faculty`/`all`; backend từ chối ngay cả khi bỏ qua UI.
- **AC4:** Modal student chỉ có thể xuất hiện khi summary `locked` có `locked_at` hợp lệ trong 72 giờ gần nhất, không xuất hiện sau mốc này hoặc với timestamp tương lai/không hợp lệ, và dismissal vẫn theo user/summary/session.
- **AC5:** Không có thay đổi ngoài boundary; test/typecheck/build bắt buộc đều qua hoặc lỗi môi trường/pre-existing được ghi rõ, không tuyên bố hoàn tất sai.
- **AC6:** Sau G1 và integration, `git branch --format='%(refname:short)'` chỉ trả `main`; commit cần giữ từ nhánh chưa merge đã hiện diện trên `main` hoặc có quyết định bỏ được ghi nhận; remote refs không đổi.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/grading/score/page.test.tsx" "src/components/layout/StudentCongratsModalGate.test.tsx"` => AC1, AC4 pass.
- `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/grading/ExportSummaryExcelModal.test.tsx"` (nếu tạo component) => AC2/AC3 UI pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => không có TypeScript error mới.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand auth/test/grading-access.spec.ts summaries-point/test/summaries-point.service.spec.ts summaries-point/test/summaries-point.controller.spec.ts evaluation-detail/test/evaluation-detail.service.spec.ts` => AC1-AC4 backend pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest build pass.
- `D:\PROJECT\manager_points :: git diff --check` và `git status --short` => không whitespace lỗi, chỉ scoped files.
- Sau cleanup: `git branch --format='%(refname:short)'` và `git branch -r` => local chỉ `main`; remote refs giữ nguyên.

# Safety Gates

- **G1 — destructive local branch cleanup:** trước khi xoá, trình `git log main..codex/grading-score-export-modal`, mapping phần đã port/bỏ, test results và SHA checkpoint `8e991059`; yêu cầu xác nhận tiếp tục tại resume point Step 7. Impact: bỏ hai local refs; rollback: tạo lại refs từ SHA `8e991059` và `373fbacd` khi object còn tồn tại. Không force-delete.
- **G2 — merge/protected branch (conditional):** nếu `main` được bảo vệ hoặc cần merge/push, trình diff + verification và xin phê duyệt riêng; không push/deploy trong scope này.

# Artifacts and Checkpoints

- Base checkpoint: `main@09ad7b00d75b91a1dbe89910753e76979662e254`; branch checkpoints: `8e9910597c95b49a9e9c9d4fb299933f94a074b5`, `373fbacda8c8484d7d7a5a3c1d947a33a2802ffe`.
- Rule manifest v3.2 SHA-256: `safety 1B5B5B...D0864`, `global 67806F...A43F`, `contract CCE352...0AA4`, `orchestrator CC25A7...1C13`, `pipeline 0419C0...41F3`.
- Lưu kết quả test, final diff/status và branch mapping trong handoff; không tạo artifact chứa secret hay dữ liệu sinh viên thật.

# Execution Budgets

- Concurrency: tối đa 3 worker đọc độc lập; một writer mỗi path; mutation access -> export -> modal -> cleanup được serialize khi chồng file.
- Deadline: 600 giây/step, tối đa 1800 giây; idempotent retry `0..2`, ENG loop `0..3`, review remediation `0..2`.
- Stop khi cần mở rộng boundary, thay public contract ngoài DTO đã nêu, phát sinh migration/dependency mới, dữ liệu nhạy cảm, stale checkpoint, test quyền thất bại hoặc Gate chưa được duyệt.
