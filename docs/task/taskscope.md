task: "Bỏ Dọn ghi nhận HSSV khỏi modal và tăng phân trang lên 500"
pipeline: feature_development
profile: Quick
objective: "Ẩn hoàn toàn tiện ích xóa theo khoảng ngày khỏi modal Cấu hình và cho phép tab Tình hình HSSV chọn tối đa 500 bản ghi mỗi trang."

evidence:
  - "frontend/src/app/(dashboard)/students/record/page.tsx:GhiNhanTab đang render khối `Dọn ghi nhận HSSV` trong Dialog `Cấu hình & Tiện ích hệ thống` và giữ state/handler riêng cho preview/execute."
  - "CustomPagination của tab `student` đang dùng pageSizeOptions `[5,10,20,40,50,100]`; fetchAcademicRecords chuyển itemsPerPage trực tiếp thành query limit."
  - "backend/src/academic-record/academic-record.controller.ts và service nhận limit trực tiếp, không áp trần 100."

scope:
  write:
    - "frontend/src/app/(dashboard)/students/record/page.tsx: GhiNhanTab, modal cấu hình và phân trang tab student"
    - "frontend/src/app/(dashboard)/students/record/page.test.tsx: kiểm thử modal/phân trang 500"
  preserve:
    - "Bộ lọc, mặc định 40 dòng, phân trang/infinite scroll hiện hữu và tab Tình hình lớp học."
    - "Backend purge endpoints, RBAC và quy tắc xóa dữ liệu; yêu cầu chỉ bỏ entry point trong modal."
  out:
    - "Thay đổi API/schema/backend hoặc phân trang các tab khác."

acceptance_criteria:
  - "AC-01: Modal Cấu hình không còn hiển thị `Dọn ghi nhận HSSV`, chọn khoảng ngày, xem trước hoặc xác nhận dọn; state/handler/import chỉ phục vụ UI này được loại bỏ."
  - "AC-02: Phân trang desktop của tab `Tình hình HSSV` có tùy chọn 500 và không có tùy chọn lớn hơn 500; mặc định vẫn là 40."
  - "AC-03: Chọn 500 đặt trang về 1 và lần tải tiếp theo gọi getAcademicRecords với `{ page: 1, limit: 500 }`; tổng số/trang hiển thị theo response hiện hữu."
  - "AC-04: Phân trang tab `Tình hình lớp học` và quyền truy cập modal không đổi."

execution:
  - "E-01 [AC-01] Gỡ khối purge khỏi Dialog và dọn code UI không còn tham chiếu; không xóa backend/client contract dùng ngoài modal."
  - "E-02 [AC-02,AC-03] Thêm 500 vào pageSizeOptions của CustomPagination tab student và giữ reset page hiện hữu."
  - "E-03 [AC-01..AC-04] Điều chỉnh test tập trung, đồng thời bảo toàn các thay đổi worktree không thuộc scope."

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx'"
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck"
  - "V-03 [AC-01..AC-04] git diff --check"

risks:
  - "Worktree đang có thay đổi dở từ task trước tại page/test/API; chỉ chỉnh hunk thuộc scope, không hoàn nguyên hàng loạt."

stop_conditions: []
temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]
