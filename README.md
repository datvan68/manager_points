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

### Phát triển với Docker (hot reload)

Khởi động môi trường phát triển:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Frontend chạy tại `http://localhost:3000`, backend tại `http://localhost:8001`. Thay đổi trong `frontend/` hoặc `backend/` sẽ được framework biên dịch lại mà không cần build hay khởi động lại container.

Khi `package-lock.json` thay đổi, cập nhật hai volume dependency riêng thay vì dùng `down -v` (lệnh đó có thể xóa cả volume database):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps frontend npm ci
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm --no-deps backend npm ci
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Tính năng Import Backup Database (Bản nháp)
Hệ thống hỗ trợ nhập (import) các bản sao lưu cơ sở dữ liệu (`.gz`, `.archive`, `.zip`) thông qua giao diện quản trị.
Quy trình nhập dữ liệu bao gồm hai bước để đảm bảo an toàn:
1. **Preview (Xem trước):** Phân tích file tải lên để hiển thị danh sách các collections và số lượng bản ghi có trong bản sao lưu.
2. **Restore (Khôi phục):** Xác nhận khôi phục dữ liệu (yêu cầu gõ chữ `RESTORE`). Hệ thống sẽ tự động tạo một bản sao lưu (pre-restore backup) trước khi tiến hành ghi đè dữ liệu.

### Tiêu chí chấm điểm dạng Option (Chọn 1)
Cho phép quản trị viên cấu hình tiêu chí với danh sách các lựa chọn (ví dụ: Lớp trưởng, Lớp phó,...). Người chấm điểm chỉ được chọn một tùy chọn duy nhất thay vì nhập số lần. Chi tiết cấu hình và kiến trúc xem thêm tại [Tài liệu Single Option](./docs/single_option_feature.md).

### Import Ghi nhận HSSV từ Excel
Tính năng Import Ghi nhận HSSV cho phép gán nhanh các ghi nhận dựa trên **Mã tiêu chí** do Admin tự định nghĩa, tránh nhầm lẫn do trùng tên hoặc sai khác nội dung. Hỗ trợ preview và báo lỗi chi tiết khi không tìm thấy mã tiêu chí hợp lệ. Chi tiết cách dùng xem tại [Tài liệu Import Ghi nhận HSSV](./docs/import_hssv_record.md).

### Điều hướng ứng dụng (Sidebar)
Ứng dụng sử dụng sidebar làm thanh điều hướng chính trên desktop và màn hình lớn.

**Lưu ý về tương tác:**
- **Điều khiển thủ công:** Trạng thái sidebar (mở rộng hay thu gọn) không còn tự động thay đổi khi di chuột (hover).
- **Tính ổn định:** Việc loại bỏ tính năng tự động mở rộng giúp bố cục trang ổn định, ngăn chặn sự dịch chuyển nội dung chính không mong muốn khi người dùng tương tác với các thành phần điều hướng.

### Cuộn vô hạn trên Mobile (Backend-batched Infinite Scroll)
Các danh sách trên thiết bị di động hiện hỗ trợ tính năng cuộn vô hạn với dữ liệu được chia lô từ backend (backend-batched infinite scroll). Điều này đảm bảo tối ưu hóa việc sử dụng bộ nhớ và hiệu suất mạng bằng cách chỉ tải các phân đoạn dữ liệu khi người dùng thực sự cần đến.

- **Cơ chế hoạt động**: Khi người dùng cuộn gần đến cuối danh sách hiện tại, một lô dữ liệu mới sẽ được tự động yêu cầu từ backend, mang lại trải nghiệm cuộn mượt mà không bị gián đoạn.
- **Lợi ích**: Tốc độ tải trang ban đầu nhanh hơn, giảm tiêu thụ bộ nhớ trên các thiết bị di động, và mang lại trải nghiệm tổng thể mượt mà hơn.

## 🛠 Công nghệ sử dụng (Tech Stack)

- **AI Framework**: MCP (Model Context Protocol)
- **Backend**: (Chưa xác định - Dự kiến Python Fast API hoặc Node.js)
- **Frontend**: (Chưa xác định - Dự kiến React/Next.js)
- **Infrastructure**: Docker & Docker Compose

## 📜 Lịch sử thay đổi (Changelog)
Mọi cập nhật tính năng mới, sửa lỗi và cải tiến (như Hệ thống Xếp hạng Sinh viên, thẻ hiển thị hạng tích cực...) được ghi nhận chi tiết tại file [CHANGELOG.md](./CHANGELOG.md).
