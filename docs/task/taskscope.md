task: "Sửa cô lập tab truy cập và đánh dấu tài khoản đang được truy cập"
pipeline: bug_fix
profile: Full
objective: "Phiên truy cập quản trị không gọi API fork bị cấm, đồng thời danh sách người dùng hiển thị icon Truy cập màu đỏ cho tài khoản có impersonation session còn hiệu lực."

evidence:
  current_behavior: "frontend/src/providers/auth-provider.tsx:isolateDuplicatedTab gọi authApi.forkSession cho mọi access token khi phát hiện cùng auth_session_id; backend/src/auth/controllers/auth.controller.ts:forkSession chủ động trả 401 nếu JWT có impersonationSessionId. frontend/src/app/(dashboard)/permissions/page.tsx:actions luôn tô icon LogIn màu xanh và dữ liệu auth/users chưa có trạng thái impersonation."
  expected_behavior: "Tab impersonation không gọi session/fork hoặc ghi lỗi console; icon của đúng tài khoản đang được truy cập có màu đỏ, các tài khoản khác giữ màu xanh."
  root_cause: "Cơ chế cô lập tab không phân biệt phiên thường với impersonation dù backend cấm biến impersonation token thành phiên thường; getUsers chưa ghép các subject_user_id của session active/chưa hết hạn."

scope:
  inspect: ["backend/src/auth/schemas/impersonation-session.schema.ts:index/status/expiry contract"]
  write: ["frontend/src/providers/auth-provider.tsx:isolateDuplicatedTab", "frontend/src/providers/auth-provider.test.tsx", "backend/src/auth/services/impersonation.service.ts", "backend/src/auth/services/auth.service.ts:getUsers", "backend/src/auth/test/impersonation.service.spec.ts", "backend/src/auth/test/auth-security.spec.ts", "frontend/src/app/(dashboard)/permissions/page.tsx:actions", "frontend/src/app/(dashboard)/permissions/impersonation-flow.test.tsx"]
  preserve: ["Backend tiếp tục từ chối fork impersonation", "fork tab cho phiên đăng nhập thường", "giới hạn 5 phiên và uniqueness theo target", "ADMIN_FULL guard và dữ liệu người dùng hiện hữu"]
  out: ["Cho phép fork impersonation", "migration/schema/index", "đổi vòng đời hoặc tự động kết thúc phiên", "realtime trạng thái đa tab"]

acceptance_criteria:
  - "AC-01: Khi user lưu trong tab có impersonation, AuthProvider bỏ qua session/fork; bootstrap và /auth/me vẫn hoàn tất mà không log lỗi Failed to isolate duplicated auth tab."
  - "AC-02: GET /auth/users chỉ với ADMIN_FULL trả cờ boolean is_under_impersonation=true đúng cho session status=active và expires_at>now; stale session không được đánh dấu."
  - "AC-03: Nút Truy cập của user có cờ true dùng icon/màu đỏ và accessible label/title thể hiện đang được truy cập; user khác vẫn màu xanh và luồng mở phiên giữ nguyên."

execution:
  - "E-01 [AC-01] AuthProvider → nhận diện tokenStorage.getUser().impersonation trước duplicate probe/fork; thêm regression cho impersonation và phiên thường."
  - "E-02 [AC-02] ImpersonationService/AuthService → truy vấn subject active chưa hết hạn, ghép cờ boolean vào response getUsers; kiểm thử active/stale và enrichment cũ."
  - "E-03 [AC-03] permissions page → render trạng thái đỏ từ cờ backend; mở rộng impersonation-flow test."
  - "E-04 [AC-01,AC-02,AC-03] independent security review → xác nhận không nới guard/fork, không rò dữ liệu phiên và không phá concurrency contract."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md — user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01] npm --prefix frontend test -- src/providers/auth-provider.test.tsx → test pass, forkSession không gọi cho impersonation và vẫn gọi cho phiên thường khi trùng tab."
  - "V-02 [AC-02] npm --prefix backend test -- auth/test/impersonation.service.spec.ts auth/test/auth-security.spec.ts --runInBand → test pass."
  - "V-03 [AC-03] npm --prefix frontend test -- src/app/\\(dashboard\\)/permissions/impersonation-flow.test.tsx → test pass cho icon đỏ/xanh và luồng handoff."
  - "V-04 [AC-02] npm --prefix backend run build → exit code 0."
  - "V-05 [AC-01,AC-03] npm --prefix frontend run typecheck → exit code 0."

risks: ["Auth/session và impersonation là ranh giới bảo mật, cần Full profile và review độc lập.", "Trạng thái icon chỉ mới theo lần fetch/poll hiện có, không realtime tức thời."]
stop_conditions: ["Dừng nếu cần cho phép fork impersonation, thay schema/index, mở rộng dữ liệu phiên nhạy cảm, hoặc thay đổi guard/quyền API."]
