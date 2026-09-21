slot_id: "taskscope-00"
generation: 1
task_id: "20260921-132646-decouple-grading-from-student-record-permissions"
scope_file: "docs/task/taskscope.md"
status: in_progress
scope_revision: 1
created_at: "2026-09-21T13:26:46+07:00"
updated_at: "2026-09-21T13:40:00+07:00"
base_commit: "356fb5713c7fc13b5b0d3406a93d9c1e3cb711b5"
task: "Cho phép chấm điểm mà không cần quyền thêm hoặc sửa ghi nhận sinh viên"
pipeline: bug_fix
profile: Full
objective: "Tài khoản có GRADING_PAGE và GRADING_SCORE_GRADE lưu được điểm rèn luyện qua luồng academic-records/intent mà không cần CREATE_STUDENT_RECORD hoặc UPDATE_STUDENT_RECORD; các thao tác quản lý ghi nhận độc lập vẫn giữ nguyên quyền hiện tại."
coordination:
  depends_on: []
  warnings:
    - "Thay đổi authorization cần independent review trước khi hoàn tất."
    - "Implementation và focused checks đã pass; chưa có reviewer độc lập khả dụng để đáp ứng AC-06."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths:
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/academic-record.controller.spec.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "backend/src/auth/permissions.registry.ts"
    - "backend/src/auth/test/permission-policy.spec.ts"
  checks_passed:
    - "V-01: controller spec pass (35 tests)."
    - "V-02: service spec pass (91 tests, 2 pre-existing todo)."
    - "V-03: permission-policy spec pass (5 tests)."
    - "V-04: npm --prefix backend run build pass."
    - "git diff --check pass for all scoped implementation files."
  cleanup_pending:
    - "V-05/AC-06: independent authorization review of final diff."
evidence:
  current_behavior: "frontend/src/app/(dashboard)/grading/score/page.tsx gọi academicRecordApi.sendIntent khi lưu điểm; backend/src/academic-record/academic-record.controller.ts:handleIntent chỉ chấp nhận CREATE_STUDENT_RECORD hoặc UPDATE_STUDENT_RECORD, nên tài khoản chỉ có GRADING_SCORE_GRADE nhận 403."
  expected_behavior: "GRADING_SCORE_GRADE đủ để thực hiện các intent chấm điểm trong phạm vi grading; quyền CREATE/UPDATE/DELETE_STUDENT_RECORD chỉ kiểm soát màn hình và API quản lý ghi nhận sinh viên độc lập."
  root_cause: "Luồng chấm điểm tái sử dụng POST /academic-records/intent nhưng guard và phân loại requester của academic-record vẫn dựa trên quyền ghi nhận hoặc tên vai trò, chưa nhận capability chấm điểm mới."
scope:
  inspect:
    - "frontend/src/app/(dashboard)/grading/score/page.tsx"
    - "frontend/src/api/academic-record-api.ts"
    - "backend/src/auth/utils/grading-access.util.ts"
    - "backend/src/academic-record/dto/intent-score.dto.ts"
    - "backend/src/academic-record/schemas/academic-record.schema.ts"
  write:
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/academic-record.controller.spec.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "backend/src/auth/permissions.registry.ts"
    - "backend/src/auth/test/permission-policy.spec.ts"
  preserve:
    - "Student self-service hiện có trên academic-records/intent."
    - "CREATE_STUDENT_RECORD và UPDATE_STUDENT_RECORD tiếp tục cho phép thao tác intent theo hợp đồng hiện tại."
    - "Các endpoint POST/PATCH/DELETE quản lý academic-record khác không được mở bằng GRADING_SCORE_GRADE."
    - "Kiểm tra khóa bảng điểm, phạm vi sinh viên/lớp và đồng bộ summary hiện có."
    - "GRADING_SCORE_APPROVE không tự động cấp quyền nhập hoặc sửa điểm."
  out:
    - "Thay đổi giao diện trang chấm điểm."
    - "Thay đổi quyền duyệt/hủy duyệt điểm."
    - "Migration hoặc cập nhật dữ liệu quyền trực tiếp."
acceptance_criteria:
  - "AC-01: Tài khoản tùy chỉnh có GRADING_PAGE và GRADING_SCORE_GRADE, không có CREATE_STUDENT_RECORD/UPDATE_STUDENT_RECORD, được guard cho phép gọi POST /academic-records/intent."
  - "AC-02: Tài khoản chỉ có GRADING_PAGE hoặc GRADING_SCORE_APPROVE vẫn bị từ chối khi gọi POST /academic-records/intent."
  - "AC-03: GRADING_SCORE_GRADE không cho phép gọi các endpoint tạo, sửa, xóa, import hoặc bulk academic-record độc lập."
  - "AC-04: Service nhận diện requester có GRADING_SCORE_GRADE theo ngữ nghĩa người chấm điểm khi cập nhật evaluation detail, không rơi về nhánh sinh viên/người dùng thường, đồng thời vẫn áp dụng kiểm tra phạm vi và trạng thái khóa."
  - "AC-05: Permission policy khai báo POST /academic-records/intent là owner của GRADING_SCORE_GRADE nhưng không gán các endpoint quản lý ghi nhận khác."
  - "AC-06: Các test backend liên quan pass và independent authorization review không còn finding mức blocking/high."
execution:
  - "E-01 [AC-01,AC-02,AC-03] backend/src/academic-record/academic-record.controller.ts:handleIntent -> cho guard nhận GRADING_SCORE_GRADE riêng cho endpoint intent; không thay guard của create/bulk/import/update/delete."
  - "E-02 [AC-01,AC-02,AC-03] backend/src/academic-record/academic-record.controller.spec.ts -> thêm ma trận allow/deny cho grade-only, approve-only, page-only và xác nhận các endpoint quản lý ghi nhận không bị mở rộng."
  - "E-03 [AC-04] backend/src/academic-record/academic-record.service.ts:handleScoreIntent/getRoleLevel/deriveRecordedByRole -> nhận diện capability chấm điểm bằng helper RBAC hiện có và ghi điểm theo ngữ nghĩa người chấm điểm, giữ nguyên scope/lock checks."
  - "E-04 [AC-04] backend/src/academic-record/academic-record.service.spec.ts -> thêm regression test chứng minh grade-only cập nhật đúng trường điểm và các capability không phù hợp bị chặn trước mutation."
  - "E-05 [AC-05] backend/src/auth/permissions.registry.ts và backend/src/auth/test/permission-policy.spec.ts -> cập nhật ownership chính xác cho GRADING_SCORE_GRADE và khóa negative ownership đối với CRUD/import academic-record."
  - "E-06 [AC-06] thực hiện independent authorization review trên diff cuối; sửa finding blocking/high trong phạm vi tối đa hai chu kỳ remediation."
verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix backend test -- --runTestsByPath src/academic-record/academic-record.controller.spec.ts --runInBand -> toàn bộ ma trận guard pass."
  - "V-02 [AC-04] npm --prefix backend test -- --runTestsByPath src/academic-record/academic-record.service.spec.ts --runInBand -> grade-only đi đúng nhánh chấm điểm; scope và lock regression pass."
  - "V-03 [AC-05] npm --prefix backend test -- --runTestsByPath src/auth/test/permission-policy.spec.ts --runInBand -> ownership positive/negative pass."
  - "V-04 [AC-01,AC-04] npm --prefix backend run build -> backend biên dịch thành công."
  - "V-05 [AC-06] independent review diff cuối -> không còn finding authorization mức blocking/high."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "Mở GRADING_SCORE_GRADE quá rộng có thể cấp quyền CRUD/import ghi nhận ngoài màn hình chấm điểm."
  - "Chỉ sửa controller mà không sửa phân loại requester có thể ghi sai sv_score/gv_score/final_score hoặc quyền xóa lịch sử."
  - "Tái sử dụng academic-record làm nguồn điểm có thể tác động dữ liệu; verification mặc định dùng unit test, chưa yêu cầu runtime mutation."
stop_conditions:
  - "Dừng nếu implementation cần thay đổi ý nghĩa nghiệp vụ của cấp điểm teacher/supervisor/custom mà code và test hiện tại không xác định được."
  - "Dừng nếu phát hiện GRADING_SCORE_GRADE phải bị giới hạn theo lớp nhưng helper scope hiện tại không cung cấp đủ dữ liệu để chứng minh phạm vi."
  - "Không hoàn tất khi independent authorization review chưa thực hiện hoặc còn finding blocking/high."
