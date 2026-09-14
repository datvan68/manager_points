slot_id: "taskscope-01"
generation: 1
task_id: "20260914-162434-student-today-timetable-popover"
scope_file: "docs/task/taskscope-01.md"
status: blocked
scope_revision: 1
created_at: "2026-09-14T16:24:34+07:00"
updated_at: "2026-09-14T16:24:34+07:00"
base_commit: "b54ccd17cb8017259f995ce6741f6f5eee84df5a"
task: "Sửa lịch hôm nay chưa hiện và mở lịch ngày trong popover"
pipeline: feature_development
profile: Full
objective: "Nút Thời khóa biểu hôm nay trong popover sinh viên mở một popover lịch theo ngày như giao diện tham chiếu; dữ liệu có sẵn của đúng lớp/đúng ngày được hiển thị và trạng thái thiếu dữ liệu được giải thích đúng."
coordination:
  depends_on:
    - "20260914-154718-student-preview-advisor-today-timetable: hoàn tất hoặc giải phóng các write path trùng trước khi thực thi."
  warnings:
    - "TASKSCOPE_CONFLICT: taskscope-00 đang in_progress và giữ backend/src/timetable/timetable.service.ts, backend/src/timetable/timetable.service.spec.ts, frontend/src/components/students/StudentDirectorySearch.tsx, frontend/src/components/students/StudentDirectorySearch.test.tsx; scope này chỉ được lưu ở trạng thái blocked."
    - "Chưa xác minh dữ liệu dev thực tế: phát hiện nguyên nhân từ code, không khẳng định snapshot dev có hay không."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "backend/src/timetable/timetable.service.ts:getTodayForClass yêu cầu link.week, nhưng TimetableClassLink trong timetable.types.ts không có week và cấu hình lưu classLinks theo lớp; vì vậy link hợp lệ bị trả unavailable trước truy vấn snapshot. Test hiện dùng fixture link.week không đúng hợp đồng. StudentDirectorySearch.tsx hiển thị chi tiết TKB dạng danh sách mở ngay trong dialog; TimetableMobileView.tsx đã có thẻ lịch chia Sáng/Chiều/Tối giống ảnh."
  expected_behavior: "Tìm snapshot của đúng lớp chứa ngày hiện tại theo Asia/Ho_Chi_Minh; nút lịch mở popover riêng chứa lịch của ngày đó, hoặc trạng thái ngày trống/chưa có dữ liệu/lỗi tải."
  root_cause: "Điều kiện link.week trong getTodayForClass không khớp kiểu và dữ liệu classLinks; cần xác minh thêm dev snapshot/bản đồ tuần trước khi kết luận dữ liệu nguồn thiếu."
scope:
  inspect:
    - "backend/src/timetable/timetable.types.ts"
    - "backend/src/timetable/timetable-sync.service.ts"
    - "backend/src/timetable/timetable-snapshot.schema.ts"
    - "frontend/src/components/ui/popover.tsx"
    - "frontend/src/components/timetable/TimetableWeekPopover.tsx"
  write:
    - "backend/src/timetable/timetable.service.ts"
    - "backend/src/timetable/timetable.service.spec.ts"
    - "frontend/src/components/students/StudentDirectorySearch.tsx"
    - "frontend/src/components/students/StudentDirectorySearch.test.tsx"
    - "frontend/src/components/timetable/TimetableMobileView.tsx"
    - "frontend/src/components/timetable/TimetableMobileView.test.tsx"
    - "frontend/src/components/timetable/TimetableDayView.tsx (new; parent exists)"
  preserve:
    - "Giữ nguyên GVCN, tìm sinh viên, Chi tiết, đóng thông tin và Ghi nhận học vụ từ taskscope-00."
    - "Giữ nguyên GET /timetable/today/:classId, kiểu response available/empty/unavailable và TimetableAccessGuard; không mở rộng dữ liệu sang lớp khác hoặc thay quyền."
    - "Chỉ đọc snapshot/cấu hình đồng bộ; không tự sync, refresh, sửa classLinks, weekDates hay dữ liệu học vụ."
  out:
    - "Thay API ngoài route today, schema/migration, dữ liệu production, commit/push/deploy."
acceptance_criteria:
  - "AC-01: Với classLink hợp lệ không có week, API xác định đúng snapshot chứa hôm nay theo Asia/Ho_Chi_Minh bằng ngữ cảnh lớp và tuần/ngày đã lưu; có tiết trả available và đúng tiết, snapshot xác nhận ngày trống trả empty."
  - "AC-02: Thiếu classLink, bản đồ tuần/snapshot phù hợp, ngày trong snapshot hoặc có nhiều snapshot không phân giải được thì trả unavailable; UI không gọi đó là Không có lịch học."
  - "AC-03: Trong thông tin sinh viên, Thời khóa biểu hôm nay là nút có trạng thái tóm tắt; mặc định popover lịch đóng, click/Enter/Space mở và Escape/click ngoài đóng, focus quay về nút; đổi/đóng sinh viên không lộ lịch cũ."
  - "AC-04: Popover ghi ngày và hiển thị lịch chỉ của hôm nay theo nhóm Sáng/Chiều/Tối với thẻ môn, tiết, giáo viên, phòng, thời lượng và liên kết họp an toàn khi có; bố cục cuộn được trên màn hình nhỏ như ảnh tham chiếu. Trạng thái loading/empty/unavailable/error có nội dung riêng trong popover."
  - "AC-05: Lịch tuần trên TimetableMobileView và các thao tác thông tin sinh viên hiện có tiếp tục hoạt động; API vẫn chỉ đọc và giữ guard cũ."
execution:
  - "E-01 [AC-01,AC-02] Trên dev đã xác minh cách ly production, chỉ đọc cấu hình classLinks, rolling.weekDates và metadata snapshot của một lớp/ngày bị báo thiếu; ghi nhận thiếu liên kết, thiếu map, thiếu snapshot hay chỉ do link.week. Không thay dữ liệu để tạo ca kiểm tra."
  - "E-02 [AC-01,AC-02,AC-05] backend/src/timetable/timetable.service.ts:getTodayForClass -> bỏ giả định link.week; dùng classLinks theo systemClassId và ngày để xác định tuần từ rolling.weekDates hoặc snapshot có khoảng ngày phù hợp, đối chiếu đủ year/semester/faculty/course/className và từ chối kết quả mơ hồ; chỉ lọc lessons của ngày. Sửa fixture/spec dùng classLink đúng kiểu, kiểm tra có tiết, ngày trống và từng trường hợp unavailable."
  - "E-03 [AC-04,AC-05] Trích phần nhóm buổi và thẻ học từ TimetableMobileView.tsx sang TimetableDayView.tsx để tái sử dụng cho một ngày; giữ giao diện và hành vi lịch tuần, bổ sung test hồi quy."
  - "E-04 [AC-03,AC-04,AC-05] StudentDirectorySearch.tsx -> thay accordion inline bằng nút và Popover/PopoverContent hiện có, hiển thị TimetableDayView chỉ cho ngày API trả; quản lý mở/đóng, focus, reset và phản hồi trễ; cập nhật test cho cả 4 trạng thái dữ liệu, bàn phím và luồng Ghi nhận học vụ."
verification:
  - "V-01 [AC-01,AC-02,AC-05] npm --prefix backend test -- --runTestsByPath src/timetable/timetable.service.spec.ts --runInBand -> classLink không có week vẫn tìm đúng ngày/lớp, empty và unavailable phân biệt, không đọc lớp khác."
  - "V-02 [AC-03,AC-04,AC-05] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx src/components/timetable/TimetableMobileView.test.tsx -> popover/ngày/keyboard/trạng thái và lịch tuần pass."
  - "V-03 [AC-01..AC-05] npm --prefix frontend run typecheck; npm --prefix backend run build; git diff --check -> không có lỗi kiểu, biên dịch hoặc whitespace."
  - "V-04 [AC-01..AC-05] Trên dev UI/API đã xác minh cách ly: tái hiện ca đang báo chưa có dữ liệu, so API với snapshot/lớp/ngày, mở/đóng popover ở desktop/mobile và kiểm tra lịch trống thật nếu dữ liệu dev cho phép; ghi nhận ca thực sự thử."
  - "V-05 [AC-05] Reviewer độc lập kiểm tra truy vấn snapshot theo lớp/ngày, guard và hợp đồng route; xử lý phát hiện trước khi hoàn thành."
runtime_test:
  targets: "Trước lần kiểm tra runtime, xác minh frontend/API, MongoDB, Redis/queue và tích hợp liên quan trỏ dev tách production bằng metadata không chứa bí mật; taskscope-00 chưa chứng minh được điều này."
  resources: "Chỉ đọc classLink, weekDates, metadata/snapshot và sinh viên dev phù hợp; không sync, refresh hoặc ghi dữ liệu."
  scenarios: "Ca hiện báo chưa có dữ liệu; ngày có tiết, ngày rỗng xác thực và thiếu nguồn nếu dev có sẵn; thao tác mở/đóng/đổi sinh viên."
  cleanup: "Không dự kiến thay đổi dữ liệu; ghi lại tài nguyên đã đọc và kết quả thực tế."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Full vì sửa backend/frontend và cách chọn dữ liệu theo lớp; reviewer độc lập cần kiểm tra quyền và nguy cơ lộ TKB lớp khác."
  - "Nếu không có snapshot hiện tại trên dev, sửa code không tự tạo dữ liệu; cần giữ trạng thái unavailable và báo đúng thiếu nguồn."
stop_conditions:
  - "Không thực thi khi taskscope-00 còn giữ write path trùng; đối chiếu trạng thái và diff rồi mới gỡ blocked."
  - "Dừng runtime test nếu không chứng minh được đích dev tách production; không ghi/sync để tạo dữ liệu."
  - "Không đánh dấu completed nếu chưa có runtime evidence bắt buộc hoặc reviewer độc lập."
