# Vận hành KTX PDF Template Designer

1. Mở `/pdf-templates` bằng tài khoản có `PDF_TEMPLATE_READ` và chọn `Mẫu đơn đăng ký KTX`.
2. Bấm `Edit template`, thay source PDF nếu cần và xác nhận cảnh báo thay nền.
3. Chỉnh field bằng kéo, phím mũi tên hoặc số geometry. Zoom 50%, 100% và 200% chỉ là hiển thị.
4. Chọn fixture synthetic, bấm Preview, xử lý mọi lỗi bounds/field/glyph/overflow rồi bấm Save.
5. Nếu gặp `409`, giữ thay đổi local, tải metadata/version mới và thử lại; không có silent overwrite.

Export `GET /dormitory/roster/:id/application-pdf` giữ nguyên URL, disposition và header. Route này kiểm tra `DORM_REG_READ`; generic designer không nhận record id và không ghi dữ liệu roster. Khi chưa có record template hợp lệ, export dùng PDF/layout bundled và không tạo MongoDB record.

Không chạy seed execute, gán permission, migration hoặc deployment khi chưa qua gate tương ứng. Seed chỉ kiểm tra checksum ở chế độ dry-run:

```text
npm run seed:dormitory-pdf-template:dry-run
```

