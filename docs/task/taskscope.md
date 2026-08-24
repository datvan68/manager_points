task: "Ổn định bảng Tình hình và tăng mặc định lên 40 dòng"
pipeline: bug_fix
profile: Quick
objective: "Bảng desktop tab Tình hình lớp học không nháy thanh cuộn ngang khi tương tác và hai tab Tình hình mặc định tải/hiển thị 40 dòng mỗi trang."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx khởi tạo itemsPerPage và classItemsPerPage bằng 20; row desktop của Tình hình lớp học có hover:scale-[1.002]; CustomPagination mặc định chỉ có [5,10,20,50,100]."
  expected_behavior: "Tình hình HSSV và Tình hình lớp học dùng page size mặc định 40, bộ chọn Số dòng có lựa chọn 40; tương tác với giá trị/row bảng lớp không phát sinh overflow ngang thoáng qua."
  root_cause: "Transform scale làm row rộng hơn table/container khi hover; hai state phân trang chưa dùng 40 và danh sách page-size dùng chung không chứa 40."

scope:
  inspect: ["frontend/src/components/ui/pagination.tsx:CustomPagination pageSizeOptions", "frontend/src/app/(dashboard)/students/record/page.tsx:fetchAcademicRecords/fetchClassReports"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:page-size states, two CustomPagination calls, class desktop row className", "frontend/src/app/(dashboard)/students/record/page.test.tsx:focused regression tests"]
  preserve: ["API/filter/sort/RBAC và hành vi chọn, xem, sửa, xóa row", "Pagination vẫn đổi trang/đổi số dòng và reset về trang 1", "Giao diện thẻ mobile/tablet và các pagination khác"]
  out: ["Backend/API/schema", "Sửa CustomPagination dùng chung", "Thay đổi hiệu ứng của nút hành động hoặc row Tình hình HSSV"]

acceptance_criteria:
  - "AC-01: Row desktop của Tình hình lớp học không dùng scale theo hover/click, vẫn giữ đổi màu nền, transition và mọi thao tác hiện có; không xuất hiện thanh cuộn ngang do row transform."
  - "AC-02: Lần tải đầu của Tình hình HSSV gọi academicRecordApi với limit 40 và pagination hiển thị pageSize 40."
  - "AC-03: Lần tải đầu của Tình hình lớp học gọi dailyClassReportApi với limit 40 và pagination hiển thị pageSize 40."
  - "AC-04: Cả hai bộ chọn Số dòng chứa 40 cùng các lựa chọn hiện hành cần giữ lại; thay đổi lựa chọn vẫn về trang 1 và tải đúng limit."

execution:
  - "E-01 [AC-01..AC-04] page.tsx → đổi hai state mặc định thành 40, truyền pageSizeOptions có 40 cho đúng hai CustomPagination và bỏ hover scale khỏi motion.tr của bảng lớp."
  - "E-02 [AC-01..AC-04] page.test.tsx → cập nhật fixture phân trang 20→40 và thêm assertions cho limit/page-size 40 ở hai tab cùng regression className không scale."
  - "E-03 [AC-01..AC-04] review diff → xác nhận không đổi component pagination dùng chung, API contract hoặc hành vi ngoài hai bảng."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → Vitest pass."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exit 0."
  - "V-03 [AC-01..AC-04] git diff --check -- 'frontend/src/app/(dashboard)/students/record/page.tsx' 'frontend/src/app/(dashboard)/students/record/page.test.tsx' → exit 0; focused diff review pass."

risks: ["Mặc định 40 tăng dữ liệu/render mỗi lần tải so với 20; phạm vi chỉ thay limit đã được API hỗ trợ."]
stop_conditions: ["Dừng nếu thanh cuộn ngang còn do container ngoài row transform, API giới hạn limit dưới 40, hoặc yêu cầu đổi mặc định pagination toàn hệ thống."]
