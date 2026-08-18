# Vận hành designer template PDF KTX

## Quy trình an toàn

1. Mở `/dormitory/pdf-template` bằng tài khoản có quyền `DORM_PDF_TEMPLATE_READ`.
2. Upload bản PDF tĩnh một trang A4. Hệ thống kiểm tra MIME, magic bytes, kích thước 10 MiB, active content, form, chữ ký, mã hóa và kích thước trang trước khi lưu.
3. Chỉnh field trong canvas. Tọa độ được lưu chuẩn hóa; zoom 50%, 100% và 200% chỉ là hiển thị.
4. Bấm **Lưu draft**, chạy **Validate**, kiểm tra synthetic preview rồi mới **Publish** bằng quyền `DORM_PDF_TEMPLATE_PUBLISH`.
5. Kiểm tra checksum revision và xuất thử một roster trong môi trường development đã được cấp quyền.

## Rollback

Không xóa revision. Chọn revision cũ, tạo draft bằng **Tạo draft từ revision**,
validate lại, sau đó publish revision mới. Export chỉ dùng revision published;
nếu chưa có revision published, export dùng PDF/layout fallback bundled và không
tự ghi MongoDB.

## Gate và dữ liệu

- Không chạy seed execute, migration hoặc gán permission group nếu chưa có G-02.
- Không dùng PDF, preview, log hoặc fixture chứa dữ liệu sinh viên thật; dùng synthetic preview.
- G-01 bắt buộc trước khi thêm package PDF/browser hoặc font binary.
- Seed kiểm tra checksum ở chế độ dry-run:
  `npm run seed:dormitory-pdf-template:dry-run` trong `backend`.

