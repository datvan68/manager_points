# Hướng dẫn vận hành PDF Template Designer

1. Mở `PDF templates` từ thanh điều hướng và chọn template theo module/feature.
2. Chọn `Edit template`. Nếu chưa có source, tải lên một PDF tĩnh hợp lệ. Việc thay source sẽ được cảnh báo vì có thể làm vị trí field không còn phù hợp.
3. Chọn field trong palette, kéo hoặc dùng phím mũi tên để di chuyển. Có thể nhập số trực tiếp cho geometry; zoom 50%, 100% và 200% chỉ thay đổi hiển thị, không thay đổi tọa độ lưu.
4. Chọn fixture `Short`, `Long`, `Missing` hoặc `Vietnamese`, rồi bấm `Preview`. Preview chỉ dùng dữ liệu synthetic.
5. Bấm `Save` và xác nhận. Save cập nhật ngay cấu hình hiện hành. Nếu operator khác đã save trước, dữ liệu local được giữ lại và cần reload/retry theo version mới.

Không có trạng thái draft, publish, revision hoặc restore. Không dùng generic designer để xem record thật; KTX export vẫn đi qua route nghiệp vụ và yêu cầu `DORM_REG_READ`.

