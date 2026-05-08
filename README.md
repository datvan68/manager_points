# Manager Point

Hệ thống quản lý và điều phối Agent AI đa năng.

## 📂 Cấu trúc thư mục (Directory Structure)

```text
manager-point/
├── agents/                    # Định nghĩa và hướng dẫn cho các Agent AI
│   ├── orchestrator/          # Agent điều phối chính
│   │   ├── system.md          # Prompt hệ thống
│   │   ├── rules.md           # Quy tắc vận hành
│   │   └── tools/             # Công cụ riêng của orchestrator
│   ├── design/                # Agent chuyên về thiết kế & Concept
│   │   ├── system.md
│   │   ├── output.schema.json # Định dạng đầu ra
│   │   └── templates/         # Các mẫu thiết kế
│   ├── ui/                    # Agent chuyên về phát triển Giao diện
│   │   ├── system.md
│   │   ├── output.schema.json
│   │   └── components/        # Thư viện component mẫu
│   └── qa/                    # Agent chuyên về Kiểm thử & Chất lượng
│       ├── system.md
│       └── reports/           # Logic xuất báo cáo kiểm thử
├── backend/                   # Dịch vụ Backend (API, Logic nghiệp vụ)
│   ├── app/                   # Source code chính
│   │   ├── api/               # Router & Handlers
│   │   ├── core/              # Cấu hình hệ thống (Settings, Auth)
│   │   ├── models/            # Schema cơ sở dữ liệu
│   │   └── services/          # Xử lý logic nghiệp vụ
│   ├── tests/                 # Unit & Integration tests
│   ├── Dockerfile             # Cấu hình Docker cho backend
│   └── requirements.txt       # Danh sách thư viện Python (nếu dùng Python)
├── frontend/                  # Giao diện người dùng (React/Next.js)
│   ├── src/                   # Source code React
│   │   ├── components/        # UI Components
│   │   ├── hooks/             # Custom React Hooks
│   │   ├── pages/             # Layout & Routing
│   │   └── styles/            # CSS/Sass/Tailwind
│   ├── public/                # Tài nguyên tĩnh (Images, Font)
│   ├── Dockerfile             # Cấu hình Docker cho frontend
│   └── package.json           # Quản lý dependency frontend
├── infra/                     # Cấu hình hạ tầng & Deployment
│   ├── docker/                # Config chi tiết cho các service (Nginx, DB, Redis)
│   └── scripts/               # Script hỗ trợ cài đặt & bảo trì
├── docs/                      # Tài liệu kỹ thuật
│   ├── architecture/          # Sơ đồ kiến trúc (Diagrams)
│   ├── api/                   # Tài liệu API (Swagger/OpenAPI)
│   └── user-guide/            # Hướng dẫn sử dụng cho người dùng
├── docker-compose.yml         # File điều phối toàn bộ container
├── mcp_config.json            # Cấu hình Model Context Protocol (MCP)
├── .gitignore                 # Các file bỏ qua khi commit git
└── README.md                  # Hướng dẫn tổng quan (File này)
```

## 🚀 Bắt đầu nhanh (Quick Start)

*(Đang cập nhật hướng dẫn cài đặt...)*

## 🛠 Công nghệ sử dụng (Tech Stack)

- **AI Framework**: MCP (Model Context Protocol)
- **Backend**: (Chưa xác định - Dự kiến Python Fast API hoặc Node.js)
- **Frontend**: (Chưa xác định - Dự kiến React/Next.js)
- **Infrastructure**: Docker & Docker Compose
