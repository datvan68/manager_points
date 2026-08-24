task: "Tối ưu responsive màn hình ghi nhận"
pipeline: feature_development
profile: Quick
objective: "Trên viewport dưới 1024px, thẻ chọn sinh viên ở hai màn hình dễ đọc/chạm hơn và các nội dung tổng hợp, hướng dẫn lặp được ẩn; desktop giữ nguyên."

evidence:
  current_behavior: "frontend/src/components/grading/{AddRecordView,AddClassReportView}.tsx:quick-entry cards dùng p-2/text-xs/text-[10px]; các thanh tổng hợp cuối form vẫn hiển thị ở mọi viewport; isMobile dùng matchMedia('(max-width: 1023px)')."
  expected_behavior: "Mobile/tablet (<1024px) có thẻ sinh viên lớn hơn, thông tin chính rõ ràng, không hiện nhãn/hướng dẫn dư và thanh tổng hợp; desktop (>=1024px) không đổi bố cục/nội dung."
  root_cause: "Hai component dùng kích thước compact làm mặc định và thiếu utility responsive để ẩn microcopy/thanh tổng hợp dưới breakpoint lg."

scope:
  inspect: ["frontend/src/components/grading/AddRecordView.tsx:quick-entry/student summary", "frontend/src/components/grading/AddClassReportView.tsx:quick-entry/attendance summary", "frontend/src/components/grading/{AddRecordView,AddClassReportView}.test.tsx:nearest regression coverage"]
  write: ["frontend/src/components/grading/AddRecordView.tsx:responsive presentation", "frontend/src/components/grading/AddClassReportView.tsx:responsive presentation"]
  preserve: ["API payload, chọn/bỏ sinh viên, tải thêm, manual/edit mode, desktop >=1024px, accessibility aria-pressed"]
  out: ["Backend/API, logic tính sĩ số/chuyên cần, desktop redesign, breakpoint khác 1024px"]

acceptance_criteria:
  - "AC-01: Ở 375px và 768px, thẻ sinh viên chọn nhanh của cả hai trang có vùng chạm tối thiểu 44px, tên/MSSV lớn hơn hiện tại và không tràn ngang."
  - "AC-02: Ở viewport <1024px, ẩn nhãn chữ 'Đã chọn', câu hướng dẫn chọn tiêu chí/thẻ, và các thanh 'Tổng số SV ghi nhận' hoặc 'Sĩ số lớp/Hiện diện/Vắng mặt/% Chuyên cần'; trạng thái chọn vẫn phân biệt bằng màu và aria-pressed."
  - "AC-03: Ở viewport >=1024px, các nội dung và kích thước desktop hiện tại vẫn hiển thị; mọi thao tác ghi nhận giữ nguyên."

execution:
  - "E-01 [AC-01,AC-02,AC-03] frontend/src/components/grading/AddRecordView.tsx:quick-entry/summary → tăng min-height, padding và font dưới lg; lg khôi phục giá trị cũ; ẩn microcopy và summary dưới lg."
  - "E-02 [AC-01,AC-02,AC-03] frontend/src/components/grading/AddClassReportView.tsx:quick-entry/summary → áp dụng cùng quy tắc responsive; giữ nguyên dữ liệu và desktop attendance summary."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- src/components/grading/AddRecordView.test.tsx src/components/grading/AddClassReportView.test.tsx → toàn bộ test pass."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck → exit code 0."
  - "V-03 [AC-01,AC-02,AC-03] kiểm tra thủ công hai trang ở 375px, 768px, 1024px → đúng kích thước/ẩn-hiện, không overflow, chọn-bỏ sinh viên hoạt động."

risks: ["Thiếu lớp lg khôi phục có thể làm thay đổi bố cục desktop."]
stop_conditions: ["Dừng nếu yêu cầu phải đổi breakpoint, nghiệp vụ/tải dữ liệu, API payload, hoặc cần chỉnh component dùng chung ngoài hai file đã nêu."]
