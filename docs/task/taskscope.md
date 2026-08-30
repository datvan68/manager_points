task: "Gom tình hình HSSV theo sinh viên"
pipeline: feature_development
profile: Full
objective: "Tab Tình hình HSSV chỉ hiển thị một group cho mỗi sinh viên, cập nhật rõ ghi nhận mới nhất/số lần ghi nhận và vẫn mở được toàn bộ lịch sử của sinh viên."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:fetchAcademicRecords/paginatedRecords render một hàng/thẻ cho mỗi AcademicRecord; handleOpenDrawerChange và handleOpenDetailView lại gọi getAcademicRecordsByStudent nên Chi tiết trạng thái hiển thị toàn bộ lịch sử. backend/src/academic-record/academic-record.service.ts:findAll phân trang/countDocuments theo bản ghi, vì vậy group sau khi tải ở frontend có thể lặp sinh viên giữa các trang."
  expected_behavior: "Danh sách phân trang theo sinh viên; mỗi group hiển thị hồ sơ, ghi nhận mới nhất, tổng số ghi nhận phù hợp bộ lọc và dấu hiệu New khi ghi nhận mới nhất vừa xuất hiện. Khi có academic_record_changed, group tương ứng cập nhật, tăng số lượng và lên đúng thứ tự. Chi tiết tiếp tục hiển thị toàn bộ lịch sử được phép xem."
  root_cause: "Danh sách và meta.total hiện dùng AcademicRecord làm đơn vị phân trang, không cùng đơn vị sinh viên với drawer chi tiết."

scope:
  inspect: ["frontend/src/app/(dashboard)/students/record/page.tsx:record selection/export/edit/delete semantics trước khi đổi row identity"]
  write: ["backend/src/academic-record/academic-record.controller.ts:findAll groupBy query", "backend/src/academic-record/academic-record.service.ts:AcademicRecordFindAllQuery/findAll grouped pagination", "backend/src/academic-record/academic-record.controller.spec.ts:query forwarding", "backend/src/academic-record/academic-record.service.spec.ts:group/filter/RBAC pagination", "frontend/src/api/academic-record-api.ts:student-group response type/query", "frontend/src/app/(dashboard)/students/record/page.tsx:group list/card/table/SSE", "frontend/src/app/(dashboard)/students/record/page.test.tsx:grouped UI regressions"]
  preserve: ["RBAC và toàn bộ search/class/date/creator filters", "GET /academic-records mặc định vẫn trả record-level response", "drawer/detail dùng GET /academic-records/student/:studentId và hiển thị toàn bộ lịch sử", "thao tác sửa/xóa/xuất chỉ tác động record ID rõ ràng, không ngầm xóa cả group"]
  out: ["schema/migration MongoDB", "đổi nghiệp vụ tính điểm", "tab Tình hình lớp", "thiết kế lại drawer"]

acceptance_criteria:
  - "AC-01: Một sinh viên có nhiều ghi nhận chỉ xuất hiện một lần trong table/card; meta.total/totalPages/has-more tính theo số sinh viên distinct sau RBAC và bộ lọc."
  - "AC-02: Group hiển thị ghi nhận mới nhất, tổng số ghi nhận phù hợp bộ lọc và badge New theo latestRecord.createdAt; thứ tự giảm dần theo thời gian mới nhất."
  - "AC-03: Sau academic_record_changed, sinh viên hiện hữu không tạo dòng trùng; latest/count/New được làm mới và group mới xuất hiện đúng thứ tự."
  - "AC-04: Mở Chi tiết trạng thái từ group gọi đúng student ObjectId và hiển thị toàn bộ lịch sử truy cập được, không chỉ latestRecord."
  - "AC-05: Chế độ GET /academic-records không có groupBy và các thao tác record-level hiện hữu giữ nguyên contract/ID đích."

execution:
  - "E-01 [AC-01,AC-02,AC-05] backend controller/service -> thêm groupBy=student opt-in; tái dùng filter/RBAC trước aggregation, sort latest, count distinct và populate dữ liệu đại diện; giữ nhánh mặc định."
  - "E-02 [AC-01,AC-02,AC-04,AC-05] frontend API/page -> yêu cầu groupBy=student, dùng studentId làm identity và latestRecord cho nội dung; hiển thị recordCount/New; giữ record ID tường minh cho sửa/xóa/xuất."
  - "E-03 [AC-03] page SSE refresh -> thay page đầu theo group identity và không append trùng sinh viên."
  - "E-04 [AC-01..AC-05] backend/frontend specs -> phủ duplicate student, filter/RBAC/meta, new SSE record, drawer full history và backward compatibility."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02,AC-05] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand -> grouped/default cases pass."
  - "V-02 [AC-05] npm --prefix backend test -- src/academic-record/academic-record.controller.spec.ts --runInBand -> query/guard cases pass."
  - "V-03 [AC-01..AC-05] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' -> grouped list/SSE/detail cases pass."
  - "V-04 [AC-01..AC-05] npm --prefix backend run build; npm --prefix frontend run typecheck -> cả hai exit 0."

risks: ["Aggregation phải áp RBAC/filter trước group để không lộ hoặc đếm dữ liệu ngoài quyền.", "Group row không được làm mơ hồ đích sửa/xóa/xuất; mọi mutation vẫn cần record ID cụ thể."]
stop_conditions: ["Dừng nếu product muốn tổng số ghi nhận toàn lịch sử thay vì theo bộ lọc hiện tại.", "Dừng nếu checkbox/xóa ở group được hiểu là xóa toàn bộ lịch sử sinh viên; hành vi đó cần phê duyệt riêng.", "Dừng nếu cần đổi schema, migration hoặc response mặc định của GET /academic-records."]
