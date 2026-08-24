task: "Đồng bộ modal đăng ký KTX sau khi quét QR"
pipeline: feature_development
profile: Quick
objective: "Trang đăng ký KTX công khai mở từ QR có bố cục và phong cách thống nhất với modal 'Thêm sinh viên đăng ký KTX' trong Danh sách KTX."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:getPublicRegistrationUrl trỏ QR tới /public/dormitory/register; frontend/src/components/dormitory/PublicDormitoryRegistrationModal.tsx:PublicDormitoryRegistrationModal dùng max-w-2xl và một khối form, trong khi roster/page.tsx:createOpen dùng max-w-4xl, nền gradient, hai thẻ nội dung và footer Hủy/Tạo đăng ký."
  expected_behavior: "Modal công khai áp dụng shell, header, bố cục hai cột responsive và footer theo modal thêm mới; các trường công khai bổ sung vẫn được giữ ở phần phù hợp."
  root_cause: "PublicDormitoryRegistrationModal có class và cấu trúc form riêng, chưa dùng cùng quy ước trình bày với createOpen."

scope:
  inspect: ["frontend/src/app/(dashboard)/dormitory/roster/page.tsx:createOpen làm chuẩn giao diện", "frontend/src/app/public/dormitory/register/page.tsx:điểm vào sau quét QR"]
  write: ["frontend/src/components/dormitory/PublicDormitoryRegistrationModal.tsx:PublicDormitoryRegistrationModal", "frontend/src/components/dormitory/PublicDormitoryRegistrationModal.test.tsx:kiểm thử hồi quy modal công khai"]
  preserve: ["URL QR và hành vi đóng về trang chủ", "toàn bộ trường công khai, validation, trạng thái tải/lỗi/thành công", "payload/API đăng ký, quy tắc loại phòng theo giới tính"]
  out: ["modal hiển thị mã QR trong Danh sách KTX", "backend/API/schema", "modal sửa đăng ký"]

acceptance_criteria:
  - "AC-01: Trên desktop, form công khai có shell max-w-4xl, nền gradient, header học kỳ và hai thẻ song song: thông tin cá nhân bên trái, loại phòng/ghi chú bên phải; trên màn hình nhỏ tự xếp một cột và cuộn trong viewport."
  - "AC-02: Footer có Hủy và Gửi đăng ký theo cùng thứ tự/phong cách modal tham chiếu; Hủy đóng modal, submit/loading/error/success vẫn hoạt động như hiện tại."
  - "AC-03: Không mất trường, không đổi validation hoặc payload gửi dormitoryApi.public.register."

execution:
  - "E-01 [AC-01..AC-03] PublicDormitoryRegistrationModal.tsx:đổi shell/header/grid/section/footer theo createOpen, chỉ tái bố trí các control hiện có."
  - "E-02 [AC-01..AC-03] PublicDormitoryRegistrationModal.test.tsx:render modal với API mock và kiểm tra tiêu đề, nhóm trường, Hủy/Gửi đăng ký cùng payload hiện hữu."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- src/components/dormitory/PublicDormitoryRegistrationModal.test.tsx -> focused tests pass."
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck; git diff --check -> no TypeScript or whitespace errors."
  - "V-03 [AC-01..AC-02] Mở /public/dormitory/register ở desktop và mobile -> đối chiếu trực quan với modal createOpen và không tràn viewport."

risks: ["Form công khai có thêm mã sinh viên và hồ sơ tùy chọn; chỉ đồng bộ bố cục, không loại bỏ dữ liệu đang hỗ trợ."]
stop_conditions: ["Dừng nếu yêu cầu 'giống' bao gồm bỏ trường, đổi validation/payload, hoặc sửa API/backend."]
