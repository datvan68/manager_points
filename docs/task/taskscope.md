task: "Kết thúc quyền truy cập từ danh sách tài khoản"
pipeline: feature_development
profile: Full
objective: "Tài khoản đang có impersonation session hiển thị icon X màu đỏ; admin xác nhận để chấm dứt ngay toàn bộ quyền truy cập của phiên đó."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/permissions/page.tsx:actions tô đỏ khi is_under_impersonation=true nhưng luôn render LogIn và gọi handleAccessUser; POST /auth/impersonations/cancel chỉ nhận browser session của handoff do chính actor tạo."
  expected_behavior: "Tài khoản không bị truy cập dùng LogIn màu xanh; tài khoản đang bị truy cập dùng X màu đỏ, mở ConfirmModal và chỉ sau xác nhận mới kết thúc lease, thu hồi token rồi làm mới trạng thái."
  root_cause: "Danh sách chỉ có cờ is_under_impersonation và chưa có API quản trị kết thúc active session theo subject_user_id; cancelImpersonation không phải contract cho phiên đã bàn giao."

scope:
  inspect: ["backend/src/auth/schemas/impersonation-session.schema.ts:index/active-session contract"]
  write: ["backend/src/auth/dto/auth.dto.ts:TerminateImpersonationDto", "backend/src/auth/controllers/auth.controller.ts:terminateImpersonation", "backend/src/auth/services/auth.service.ts:terminateImpersonation", "backend/src/auth/services/impersonation.service.ts:releaseActiveForSubject", "backend/src/auth/test/auth.controller.spec.ts", "backend/src/auth/test/auth.service.spec.ts", "backend/src/auth/test/impersonation.service.spec.ts", "backend/src/auth/test/auth-security.spec.ts", "frontend/src/api/auth-api.ts:terminateImpersonation", "frontend/src/api/auth-api.test.ts", "frontend/src/app/(dashboard)/permissions/page.tsx:actions/ConfirmModal", "frontend/src/app/(dashboard)/permissions/impersonation-flow.test.tsx"]
  preserve: ["StrictAdminGuard và yêu cầu role_code ADMIN", "cancel handoff theo browser session", "logout/refresh/fork hiện hữu", "giới hạn và uniqueness impersonation", "nút xem/sửa/xóa tài khoản"]
  out: ["đóng cưỡng bức tab trình duyệt từ xa", "realtime/WebSocket", "schema/index/migration", "lịch sử quản lý phiên mới"]

acceptance_criteria:
  - "AC-01: User có is_under_impersonation=true hiển thị nút X màu đỏ với accessible label/title 'Kết thúc truy cập'; user false vẫn hiển thị LogIn màu xanh."
  - "AC-02: Click X chỉ mở ConfirmModal; hủy không gọi API, xác nhận gọi API bằng target_user_id và bearer token admin."
  - "AC-03: Endpoint được StrictAdminGuard bảo vệ, chỉ kết thúc active/unexpired session của target, ghi audit lý do admin_terminated và thu hồi mọi refresh token liên kết; request lặp lại trả kết quả không thay đổi an toàn."
  - "AC-04: Thành công thông báo, đóng modal và fetch lại danh sách; lỗi giữ trạng thái hiện tại, hiển thị thông báo an toàn và cho phép thử lại."

execution:
  - "E-01 [AC-03] DTO/controller/service → thêm POST /auth/impersonations/terminate nhận target_user_id đã validate; release theo subject rồi revokeAllImpersonationTokens."
  - "E-02 [AC-03] backend tests → khóa guard, ownership-independent target termination, active/stale/idempotent behavior, audit và token revocation."
  - "E-03 [AC-02,AC-04] auth-api → thêm typed terminateImpersonation(targetUserId, accessToken) và contract test không rò token vào URL/body ngoài bearer."
  - "E-04 [AC-01,AC-02,AC-04] permissions page → phân nhánh LogIn/X, cấu hình ConfirmModal, pending state, toast và fetchData sau thành công; mở rộng flow test."
  - "E-05 [AC-03] independent security review → xác nhận impersonated token bị StrictAdminGuard từ chối và việc chấm dứt không nới quyền/API khác."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md — user-requested rolling taskscope"]

verification:
  - "V-01 [AC-03] npm --prefix backend test -- auth/test/impersonation.service.spec.ts auth/test/auth.service.spec.ts auth/test/auth.controller.spec.ts auth/test/auth-security.spec.ts --runInBand → pass."
  - "V-02 [AC-02,AC-04] npm --prefix frontend test -- src/api/auth-api.test.ts → pass."
  - "V-03 [AC-01,AC-02,AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/permissions/impersonation-flow.test.tsx' → pass."
  - "V-04 [AC-03] npm --prefix backend run build → exit code 0."
  - "V-05 [AC-01,AC-02,AC-04] npm --prefix frontend run typecheck → exit code 0."

risks: ["Đây là thao tác authorization/concurrency: phải kết thúc đúng một active subject session và thu hồi token trước khi báo thành công.", "Không thể đóng tab từ xa; quyền bị vô hiệu ở request kế tiếp nhờ JWT strategy kiểm tra lease."]
stop_conditions: ["Dừng nếu yêu cầu cho phép role ngoài ADMIN, thay schema/index, trả chi tiết phiên nhạy cảm, hoặc cần đóng tab/realtime đa trình duyệt."]
