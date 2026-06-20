# Manager Point

Hệ thống quản lý và điều phối Agent AI đa năng.

## 📂 Cấu trúc thư mục (Directory Structure)

```text
manager-point/
├── .agents/                   # Cấu hình và Workflow cho AI Agents
│   └── workflows/             # Các kịch bản điều phối (Orchestrator, pipeline...)
├── backend/                   # Dịch vụ Backend (NestJS API)
│   ├── src/
│   │   ├── auth/              # Xác thực & Phân quyền (RBAC)
│   │   ├── students/          # Quản lý Sinh viên
│   │   ├── classes/           # Quản lý Lớp học
│   │   ├── departments/       # Quản lý Khoa/Phòng ban
│   │   └── orchestrator/      # Logic điều phối Agent AI (MCP)
│   ├── Dockerfile
│   └── package.json
├── frontend/                  # Giao diện người dùng (Next.js App Router)
│   ├── src/
│   │   ├── app/               # Routing & Pages (Dashboard, Students, Grading...)
│   │   ├── components/        # UI Components (Layout, Modals, Popups, UI...)
│   │   └── lib/               # Mock data, API client & Utilities
│   ├── Dockerfile
│   └── package.json
├── infra/                     # Cấu hình hạ tầng (Docker, Prometheus...)
├── docs/                      # Tài liệu kỹ thuật dự án
├── outputs/                   # Kết quả xuất bản từ Agent
├── docker-compose.yml         # Điều phối toàn bộ dịch vụ
├── mcp_config.json            # Cấu hình Model Context Protocol
└── README.md
```

## 🚀 Bắt đầu nhanh (Quick Start)

*(Đang cập nhật hướng dẫn cài đặt...)*

### Tính năng Import Backup Database (Bản nháp)
Hệ thống hỗ trợ nhập (import) các bản sao lưu cơ sở dữ liệu (`.gz`, `.archive`, `.zip`) thông qua giao diện quản trị.
Quy trình nhập dữ liệu bao gồm hai bước để đảm bảo an toàn:
1. **Preview (Xem trước):** Phân tích file tải lên để hiển thị danh sách các collections và số lượng bản ghi có trong bản sao lưu.
2. **Restore (Khôi phục):** Xác nhận khôi phục dữ liệu (yêu cầu gõ chữ `RESTORE`). Hệ thống sẽ tự động tạo một bản sao lưu (pre-restore backup) trước khi tiến hành ghi đè dữ liệu.

### Tiêu chí chấm điểm dạng Option (Chọn 1)
Cho phép quản trị viên cấu hình tiêu chí với danh sách các lựa chọn (ví dụ: Lớp trưởng, Lớp phó,...). Người chấm điểm chỉ được chọn một tùy chọn duy nhất thay vì nhập số lần. Chi tiết cấu hình và kiến trúc xem thêm tại [Tài liệu Single Option](./docs/single_option_feature.md).

## 🛠 Công nghệ sử dụng (Tech Stack)

- **AI Framework**: MCP (Model Context Protocol)
- **Backend**: (Chưa xác định - Dự kiến Python Fast API hoặc Node.js)
- **Frontend**: (Chưa xác định - Dự kiến React/Next.js)
- **Infrastructure**: Docker & Docker Compose

## 📜 Lịch sử thay đổi (Changelog)
Mọi cập nhật tính năng mới, sửa lỗi và cải tiến (như Hệ thống Xếp hạng Sinh viên, thẻ hiển thị hạng tích cực...) được ghi nhận chi tiết tại file [CHANGELOG.md](./CHANGELOG.md).
