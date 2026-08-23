# Development performance benchmark

`../../scripts/benchmark-dev.sh` ghi một lượt đo Markdown gồm:

- cold pass (request đầu tiên của từng route) và warm pass (request lặp lại);
- thời gian startup frontend/backend nếu truyền `BENCHMARK_START_COMMAND`;
- commit, máy đo, kích thước `frontend/.next` và snapshot `docker stats`;
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

## Quy ước baseline và so sánh

Chạy tối thiểu 3 lượt trên cùng máy cho mỗi cấu hình. Giữa các lượt không xóa volume/database tự động; nếu cần cold cache, thực hiện thủ công và ghi rõ thao tác trong báo cáo. Lấy median của từng route, đồng thời ghi min/max, CPU peak, memory peak và kích thước `.next`.

Mỗi báo cáo cần ghi thêm cấu hình RAM Docker, trạng thái cache, lệnh khởi động và commit. Không dùng một lượt đo duy nhất để kết luận.
