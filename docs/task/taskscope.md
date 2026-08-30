task: "Củng cố đăng nhập đa thiết bị và cuộn mobile"
pipeline: bug_fix
profile: Full
objective: "Một tài khoản duy trì các phiên thiết bị độc lập; thao tác cuộn dọc trên mobile phản hồi liên tục, không bị chặn hoặc khựng bởi shell dùng chung."

baseline:
  branch: "main"
  commit: "4127963ba416490262caa7b90aa6238819d4ae8b"

evidence:
  current_behavior: "backend/src/auth/services/auth.service.ts:login tạo refresh token mới mỗi lần đăng nhập; auth.controller.ts:getRefreshCookieName tách cookie theo browser session và logout chỉ revoke cookie hiện tại. Chưa có E2E chứng minh hai thiết bị vẫn độc lập qua refresh/logout. frontend/src/globals.css mobile cố định .dashboard-shell, đặt overscroll-behavior:none và .dashboard-header touch-action:none; các trang dùng nhiều overflow-y-auto lồng nhau."
  expected_behavior: "Hai session ID đăng nhập cùng tài khoản refresh độc lập; logout A không ảnh hưởng B. Vuốt dọc bắt đầu ở header hoặc nội dung đều không bị chặn; scroll surface hiện hữu giữ quán tính và modal vẫn khóa nền đúng."
  root_cause: "Thiếu hồi quy đa thiết bị khiến contract phiên độc lập chưa được bảo vệ; globals.css:.dashboard-header chặn mọi touch gesture và shell triệt tiêu scroll chaining trên mobile, tạo trạng thái vuốt không phản hồi tại vùng dùng chung."

scope:
  inspect: ["backend/src/auth/services/token.service.ts:rotation/revoke semantics", "backend/src/auth/controllers/auth.controller.ts:session cookie routing", "frontend/src/app/(dashboard)/layout.tsx:shell ownership", "frontend/src/globals.css:mobile touch/overscroll rules"]
  write: ["backend/src/auth/services/token.service.ts:refreshToken revoked-token distinction", "backend/test/auth.e2e-spec.ts:multi-device session regression", "frontend/src/globals.css:mobile dashboard touch/scroll policy", "frontend/src/components/layout/Header.test.tsx:global shell regression"]
  preserve: ["JWT/RBAC and cookie security flags", "refresh-token rotation/reuse detection", "logout only current ordinary session", "impersonation isolation", "desktop layout", "modal body lock and horizontal controls"]
  out: ["session-management UI", "device inventory/fingerprint", "API/schema/migration", "page-specific redesign", "animation cleanup"]

acceptance_criteria:
  - "AC-01: Hai X-Auth-Session-Id khác nhau đăng nhập cùng tài khoản; cả hai refresh thành công với cookie riêng."
  - "AC-02: Sau logout session A, refresh A trả 401 còn session B tiếp tục refresh 200; không revoke token B."
  - "AC-03: Trên viewport mobile, vuốt dọc từ header và scroll surface được phép; shell không tạo vùng touch bị khóa, không phát sinh cuộn ngang."
  - "AC-04: Trên iOS Safari và Android Chrome, ba route đại diện cuộn liên tục và thao tác modal/nested list không làm đơ UI hoặc kéo nền ngoài ý muốn."

execution:
  - "E-01 [AC-01,AC-02] backend/test/auth.e2e-spec.ts -> dùng hai session ID/cookie riêng để kiểm tra login, rotation, logout A và refresh B; backend/src/auth/services/token.service.ts:refreshToken -> token logout không có replaced_by trả 401 mà không revoke token khác, giữ reuse detection cho token đã rotate."
  - "E-02 [AC-03] frontend/src/globals.css -> đổi header sang touch-action cho phép pan-y; áp dụng momentum/overscroll-y cho scroll surface dashboard, giữ body khóa và mixed-axis control pan-x pan-y."
  - "E-03 [AC-03] frontend/src/components/layout/Header.test.tsx -> thay assertion touch-action:none bằng contract pan-y, mixed-axis và scroll-surface mobile."
  - "E-04 [AC-04] chạy manual trace trên /students, /grading/score, /dormitory/overview; chỉ mở rộng sang route/component cụ thể nếu trace xác định long task tại đó."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02] npm --prefix backend run test:e2e -- auth.e2e-spec.ts --runInBand -> multi-device cases pass."
  - "V-02 [AC-03] npm --prefix frontend test -- src/components/layout/Header.test.tsx -> shell style regression passes."
  - "V-03 [AC-03] npm --prefix frontend run typecheck -> exits 0."
  - "V-04 [AC-04] iOS Safari + Android Chrome, 15 giây/route -> vuốt từ header/nội dung không đứng; không cuộn ngang; modal cuộn riêng và nền đứng yên; Performance trace không có chuỗi long task >100 ms do scroll handler."

risks: ["Authentication là ranh giới bảo mật nên diff/test cần review độc lập.", "CSS dùng chung có thể đổi scroll chaining của modal hoặc trang có nested scroller; phải kiểm tra trên thiết bị thật."]
stop_conditions: ["Dừng nếu cần đổi cookie/API contract, schema hoặc impersonation semantics.", "Dừng và tách task theo route nếu trace quy nguyên nhân cho render/data/handler riêng thay vì shell CSS.", "Nếu môi trường E2E không có Mongo khả dụng, ghi nhận blocked verification và không giả định test pass."]
