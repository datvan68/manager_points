
# Thiết Kế Backend - Manager Point (NestJS)

Tài liệu này mô tả kiến trúc backend cho dự án **Manager Point**, sử dụng **NestJS** làm framework chính.

## 1. Giới thiệu

Backend của Manager Point đóng vai trò là trung tâm điều phối, xử lý logic nghiệp vụ, quản lý dữ liệu và cung cấp API cho Frontend cũng như các Agent AI.

## 2. Công nghệ sử dụng (Tech Stack)

*   **Framework:** NestJS (Node.js + TypeScript)
*   **Database:** MongoDB (Sử dụng Mongoose hoặc TypeORM)
*   **API Standard:** RESTful API (có thể mở rộng sang GraphQL nếu cần)
*   **Documentation:** Swagger (OpenAPI)
*   **Authentication:** Passport (JWT Strategy)
*   **Queue/Job:** Bull (Redis) - để xử lý task bất đồng bộ của Agent
*   **Deployment:** Docker, Docker Compose

## 3. Kiến trúc Module (Modular Architecture)

Hệ thống được chia thành các module chính:

### 3.1 Core Module (`src/core`)
*   Chứa các cấu hình chung (Config), logger, filter, interceptor, guard dùng chung cho toàn bộ hệ thống.
*   Kết nối Database.

### 3.2 Auth Module (`src/auth`)
*   Xử lý logic đăng ký, đăng nhập.
*   Quản lý luồng quên mật khẩu qua OTP (Gửi OTP, Xác minh, Đặt lại mật khẩu).
*   Tạo và xác thực JWT Token.
*   Phân quyền (Role-based Access Control).

### 3.3 Users Module (`src/users`)
*   Quản lý thông tin người dùng.
*   CRUD User.

### 3.4 Agents Module (`src/agents`)
*   Quản lý danh sách Agent AI (Orchestrator, Design, UI, QA...).
*   Cấu hình Agent (Prompts, Tools, Models).
*   Trạng thái hoạt động của Agent.

### 3.5 Tasks Module (`src/tasks`)
*   Quản lý các task được giao cho Agent.
*   Theo dõi tiến độ task (Pending, In Progress, Completed, Failed).
*   Lưu trữ kết quả đầu ra của task.

### 3.6 Orchestrator Module (`src/orchestrator`)
*   Logic điều phối luồng công việc giữa các Agent.
*   Nhận yêu cầu từ người dùng -> Phân tích -> Giao việc cho Agent phù hợp.

## 4. Cấu trúc thư mục dự kiến

```
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── core/              # Core functionalities
│   ├── auth/              # Authentication
│   ├── users/             # User management
│   ├── agents/            # Agent management
│   ├── tasks/             # Task management
│   └── orchestrator/      # Business logic coordination
├── test/
├── .env
├── package.json
└── tsconfig.json
```

## 5. Mô hình dữ liệu (Database Schema - MongoDB)

### Agent Schema
```typescript
{
  name: String,
  role: String, // 'orchestrator', 'design', 'ui', 'qa'
  description: String,
  status: String, // 'active', 'inactive', 'busy'
  configuration: Object // Prompts, specific settings
}
```

### Task Schema
```typescript
{
  title: String,
  description: String,
  status: String, // 'pending', 'processing', 'completed', 'failed'
  assignedTo: ObjectId (Ref: Agent),
  result: Object,
  logs: Array
}
```

## 6. API Endpoints Quan trọng

*   `POST /auth/login`: Đăng nhập
*   `POST /auth/password-reset/request`: Yêu cầu gửi mã OTP quên mật khẩu
*   `POST /auth/password-reset/resend`: Gửi lại mã OTP quên mật khẩu
*   `POST /auth/password-reset/verify`: Xác minh mã OTP quên mật khẩu
*   `POST /auth/password-reset/complete`: Đặt lại mật khẩu sau khi xác minh OTP
*   `GET /agents`: Lấy danh sách Agent
*   `POST /tasks`: Tạo task mới
*   `GET /tasks/:id`: Xem chi tiết task
*   `POST /orchestrator/execute`: Gửi yêu cầu điều phối task

## 7. Kế hoạch triển khai

1.  **Phase 1:** Khởi tạo dự án NestJS, cấu hình Database, Logger.
2.  **Phase 2:** Implement Auth & Users Module.
3.  **Phase 3:** Implement Agents Module & Basic CRUD.
4.  **Phase 4:** Implement Tasks & Orchestrator simple logic.
5.  **Phase 5:** Tích hợp với hệ thống AI/LLM thật.

