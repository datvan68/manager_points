slot_id: "taskscope-00"
generation: 1
task_id: "20260916-144509-desktop-class-select-chevron"
scope_file: "docs/task/taskscope.md"
status: in_progress
scope_revision: 3
created_at: "2026-09-16T14:45:09+07:00"
updated_at: "2026-09-16T14:50:30+07:00"
base_commit: "cbd343b9cdb856673f10035b2a65f5f506fd78ff"
task: "Chuẩn hóa mũi tên select lớp trên desktop"
pipeline: implement_feature
profile: Quick
objective: "Select lớp trên desktop hiển thị chevron rõ ràng, cân đối và phản ánh chính xác trạng thái đóng/mở của popup."
coordination:
  depends_on: []
  warnings:
    - "V-03 chỉ xác nhận được trạng thái đóng qua dev UI; trigger lớp bị disabled vì dev catalog không có lớp khả dụng, nên chưa thể mở popup lớp để kiểm tra trực tiếp trạng thái xoay."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths:
    - "frontend/src/components/timetable/TimetableLookup.tsx"
    - "frontend/src/components/timetable/TimetableLookup.test.tsx"
    - "docs/task/taskscope.md"
  checks_passed:
    - "V-01: 9 tests pass; existing act warning in mobile scenario remains non-failing."
    - "V-02: npm --prefix frontend run typecheck exited 0."
    - "V-03: closed-state desktop screenshot confirmed class and week ChevronDown 16px, slate color, 16px right spacing, and stable label position."
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/timetable/TimetableLookup.tsx:DesktopClassPopover dùng ký tự ⌄ cỡ text-sm, không xoay theo trạng thái open."
  expected_behavior: "Trigger lớp và tuần dùng ChevronDown 16px màu slate, cách mép phải 16px và xoay 180 độ khi mở với transition 150-200ms."
  root_cause: null
scope:
  inspect:
    - "frontend/src/components/timetable/TimetableLookup.tsx"
    - "frontend/src/components/timetable/TimetableLookup.test.tsx"
  write:
    - "frontend/src/components/timetable/TimetableLookup.tsx"
    - "frontend/src/components/timetable/TimetableLookup.test.tsx"
  preserve:
    - "Toàn bộ trigger vẫn mở/đóng popup và giữ nguyên nhãn, trạng thái disabled cùng thuộc tính combobox hiện có."
    - "Popup desktop vẫn neo dưới select; giao diện modal và hành vi chọn lớp trên mobile không thay đổi."
    - "Tôn trọng prefers-reduced-motion bằng motion-reduce:transition-none."
  out:
    - "Không thay đổi API, dữ liệu lớp, logic tìm kiếm, xác nhận hoặc hủy lựa chọn."
acceptance_criteria:
  - "AC-01: Desktop class trigger hiển thị icon ChevronDown 16px, stroke rõ ràng, màu #64748B và có khoảng cách phải 16px; không còn ký tự ⌄."
  - "AC-02: Khi popup đóng icon hướng xuống; khi mở icon xoay 180 độ trong 150-200ms, và trở lại hướng xuống khi đóng."
  - "AC-03: Trigger vẫn là toàn bộ vùng bấm, aria-expanded phản ánh trạng thái và mobile class modal không bị thay đổi."
execution:
  - "E-01 [AC-01,AC-02,AC-03] frontend/src/components/timetable/TimetableLookup.tsx:DesktopClassPopover và desktop tuần -> dùng ChevronDown 16px; đặt stroke, màu, khoảng cách phải và class xoay theo trạng thái mở với reduced-motion fallback."
  - "E-02 [AC-01,AC-02,AC-03] frontend/src/components/timetable/TimetableLookup.test.tsx -> bổ sung assertion cho icon desktop, aria-expanded và trạng thái xoay khi mở/đóng; giữ nguyên các kịch bản mobile."
verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- \"src/components/timetable/TimetableLookup.test.tsx\" -> toàn bộ test trong file pass."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck -> thoát mã 0."
  - "V-03 [AC-01,AC-02] kiểm tra thủ công desktop ở trạng thái đóng, mở và đóng lại -> icon đúng kích thước/vị trí, xoay đúng chiều và không dịch chuyển nhãn."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "Class xoay hoặc padding có thể làm icon lệch trục hay co nhãn trong trigger hẹp; kiểm tra ở chiều rộng desktop tối thiểu được hỗ trợ."
stop_conditions:
  - "Dừng nếu target đã được thay đổi ngoài task làm mất DesktopClassPopover hoặc phát sinh xung đột với reservation đang hoạt động."
