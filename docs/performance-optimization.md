
# Hướng dẫn Tối ưu & Cấu hình Tải trọng (Performance Optimization Guide)

## 1. Cơ sở hạ tầng (Database Layer)
Để tối ưu hóa tải cho MongoDB và Redis, hệ thống được cấu hình như sau:

- **MongoDB Service**:
  - Chạy trên container `mongodb`.
  - **Connection Pooling**: Backend NestJS đã được cấu hình connection pool `maxPoolSize: 10` trong `app.module.ts`. Điều này giúp tái sử dụng kết nối, giảm overhead khi tạo kết nối mới liên tục.
  - **Data Persistence**: Volume `db-data` đảm bảo dữ liệu không bị mất khi container restart.

- **Redis Service**:
  - Chạy trên container `redis`.
  - **Purpose**: Sử dụng cho Caching của NestJS backend.
  - **Cache Strategy**: Giảm tải cho MongoDB bằng cách cache các query nặng hoặc ít thay đổi.

## 2. Backend Layer (NestJS)
Các kỹ thuật tối ưu hóa sau đã được áp dụng trong mã nguồn:

- **Compression (Gzip)**: Đã kích hoạt trong `main.ts` (`app.use(compression())`). Giảm đáng kể dung lượng payload trả về cho client.
- **Security Headers (Helmet)**: Đã kích hoạt `helmet()` để tối ưu bảo mật.
- **Caching**: Module `CacheModule` đã được tích hợp Global trong `AppModule`.
  - *Mặc định*: TTL 5 giây, Max 100 items trong memory.
  - *Sử dụng*: Có thể dùng Decorator `@UseInterceptors(CacheInterceptor)` cho các Controller cần cache response.
- **Validation Pipe**: Kích hoạt `transform: true` giúp tự động chuyển đổi kiểu dữ liệu, giảm thiểu code boilerplate xử lý dữ liệu đầu vào.

## 3. Frontend Layer (Next.js)
Frontend hiện tại sử dụng Next.js, framework đã có nhiều tối ưu sẵn. Các khuyến nghị cấu hình thêm:

- **Image Optimization**: Sử dụng component `<Image />` thay vì `<img>` để auto-resize và nén ảnh webp.
- **Lazy Loading**: Sử dụng `dynamic import` cho các component nặng không cần hiển thị ngay.
- **Caching**: Tận dụng cơ chế `ISR` (Incremental Static Regeneration) của Next.js cho các trang public ít thay đổi.

## 4. Hướng dẫn chạy môi trường tối ưu (Docker)
Để chạy toàn bộ hệ thống với cấu hình tối ưu này:

```bash
docker-compose up --build
```

Lệnh này sẽ khởi chạy:
1. `mongodb` (Database)
2. `redis` (Cache)
3. `backend` (API Server)
4. `frontend` (Web App)

Các service sẽ tự động kết nối qua mạng nội bộ Docker `manager-point-network`.
