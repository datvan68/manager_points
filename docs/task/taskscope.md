task: "Khôi phục hydration boundary cho AuthProvider"
pipeline: bug_fix
profile: Quick
objective: "Trang SSR dưới RootLayout hydrate không có recoverable hydration mismatch và vẫn giữ nguyên bootstrap xác thực."

evidence:
  current_behavior: "frontend/src/app/layout.tsx:RootLayout đặt AuthProvider trực tiếp trong body; log /students/* cho thấy server body chỉ có whitespace nhưng client render loading div của frontend/src/providers/auth-provider.tsx:AuthProvider."
  expected_behavior: "Server/client có boundary ổn định quanh cây AuthProvider và không báo hydration mismatch."
  root_cause: "Commit b1663a13 bỏ Suspense quanh AuthProvider; AuthProvider phụ thuộc usePathname và render nhánh loading trong lần client đầu, khiến cây client không khớp HTML server rỗng."

scope:
  inspect: ["frontend/src/providers/auth-provider.tsx:AuthProvider — xác nhận hook điều hướng và nhánh loading"]
  write: ["frontend/src/app/layout.tsx:RootLayout", "frontend/src/app/layout.test.tsx:RootLayout hydration regression"]
  preserve: ["Thứ tự AuthProvider > AppBrandingProvider", "children/Toaster/PwaInstallPrompt", "logic session, redirect và RBAC trong AuthProvider"]
  out: ["Thay đổi API/backend", "refactor auth/session", "che lỗi bằng suppressHydrationWarning bổ sung"]

acceptance_criteria:
  - "AC-01: AuthProvider nằm trong Suspense boundary có fallback xác định; SSR/hydration layout không ghi recoverable mismatch."
  - "AC-02: Cây provider và các phần tử con vẫn render đúng thứ tự hiện tại."

execution:
  - "E-01 [AC-01,AC-02] frontend/src/app/layout.tsx:RootLayout → khôi phục Suspense boundary tối thiểu quanh AuthProvider với fallback ổn định."
  - "E-02 [AC-01,AC-02] frontend/src/app/layout.test.tsx → mở rộng regression để kiểm tra boundary/fallback và cây provider hydrate không lỗi."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md — user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02] npm --prefix frontend test -- src/app/layout.test.tsx → test pass, recoverableErrors rỗng."
  - "V-02 [AC-01,AC-02] npm --prefix frontend run typecheck → exit code 0."
  - "V-03 [AC-01] npm --prefix frontend run dev rồi mở /students/tasks trong phiên chưa xác thực → console không còn Hydration failed."

risks: ["Test jsdom không mô phỏng đầy đủ streaming SSR của Next.js; cần kiểm chứng dev thủ công V-03."]
stop_conditions: ["Dừng nếu fix cần đổi hành vi xác thực/điều hướng, public contract, hoặc vượt quá hai file frontend đã nêu."]
