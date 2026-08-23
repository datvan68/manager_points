# Development performance benchmark

`../../scripts/benchmark-dev.sh` ghi một lượt đo Markdown gồm:

- cold pass (request đầu tiên của từng route) và warm pass (request lặp lại);
- thời gian startup frontend/backend nếu truyền `BENCHMARK_START_COMMAND`;
- commit, máy đo, kích thước `frontend/.next` và peak CPU/memory/PIDs của từng container từ mẫu `docker stats` liên tục trong suốt hai pass;
- các dòng compile/ready/rebuild lấy từ log startup khi script tự khởi động ứng dụng.

## Cách chạy

Khởi động luồng host Node được khuyến nghị, sau đó chạy benchmark:

```bash
./scripts/dev-host.sh
./scripts/benchmark-dev.sh
```

Để script tự khởi động luồng đo và ghi startup log:

```bash
BENCHMARK_START_COMMAND='./scripts/dev-host.sh' ./scripts/benchmark-dev.sh
```

Có thể đổi endpoint và nơi lưu báo cáo bằng `BENCHMARK_FRONTEND_URL`, `BENCHMARK_BACKEND_URL`, `BENCHMARK_OUTPUT` hoặc `BENCHMARK_OUTPUT_DIR`.

Full-Docker development dùng đúng hai file Compose:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
BENCHMARK_COMPOSE_FILES='docker-compose.yml:docker-compose.dev.yml' ./scripts/benchmark-dev.sh
```

Giới hạn CPU/PIDs của frontend chỉ nằm trong `docker-compose.dev.yml` và có thể
kiểm tra bằng `docker compose ... config`. Mặc định frontend được giới hạn ở
1.5 CPU (tương đương tối đa 150% theo giới hạn container; mục tiêu benchmark là
không quá 250% theo cách Docker Desktop báo cáo), 2 GiB RAM
và 512 PIDs. Đây là giới hạn development, không áp dụng cho production Compose.

## Quy ước baseline và so sánh

Chạy tối thiểu 3 lượt trên cùng máy cho mỗi cấu hình. Giữa các lượt không xóa volume/database tự động; nếu cần cold cache, thực hiện thủ công và ghi rõ thao tác trong báo cáo. Lấy median của từng route, đồng thời ghi min/max, CPU peak, memory peak và kích thước `.next`.

Mỗi báo cáo cần ghi thêm cấu hình tài nguyên Docker, trạng thái cache, lệnh khởi
động và commit. Không dùng một lượt đo duy nhất để kết luận. Chuẩn bị cold
cache (nếu cần) là thao tác thủ công; script không xóa `.next`, volume hay dữ
liệu ứng dụng.
