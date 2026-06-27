# Deployment Prerequisites

Khi triển khai hệ thống, đối với tính năng sao lưu và khôi phục cơ sở dữ liệu (Database Backup/Restore), hệ thống hỗ trợ 2 chế độ hoạt động khác nhau tùy thuộc vào các công cụ hệ thống được cài đặt trên server.

## Mode A: Full Mongo archive compatibility
Đây là chế độ ưu tiên và mạnh mẽ nhất, cho phép tạo và khôi phục bản sao lưu với định dạng Archive chuẩn của MongoDB.

### Yêu cầu:
- Phải cài đặt bộ công cụ **MongoDB Database Tools** trên máy chủ ứng dụng (server chạy Node.js).
- Đảm bảo các lệnh `mongodump` và `mongorestore` có sẵn trong biến môi trường PATH của hệ thống.

### Đặc điểm:
- Hiệu suất sao lưu và khôi phục cao.
- Hỗ trợ đầy đủ các tính năng bảo toàn dữ liệu của MongoDB.
- Dung lượng file sao lưu tối ưu.

## Mode B: Application-only fallback backup mode
Nếu server không thể cài đặt MongoDB Database Tools, hệ thống sẽ tự động chuyển sang chế độ dự phòng.

### Yêu cầu:
- Không yêu cầu cài đặt thêm công cụ bên ngoài.

### Đặc điểm:
- Chỉ hỗ trợ định dạng fallback là **NDJSON** (sử dụng Mongoose stream và nén gzip).
- Việc sao lưu và khôi phục được thực hiện thông qua logic của ứng dụng.
- Tốc độ khôi phục có thể chậm hơn so với Mode A đối với dữ liệu lớn.
- **Lưu ý:** Không thể dùng hệ thống này để khôi phục các file được tạo từ `mongodump` (.archive). Nếu người dùng tải lên file `.archive` ở chế độ này, hệ thống sẽ thông báo lỗi yêu cầu cài đặt MongoDB Database Tools.
