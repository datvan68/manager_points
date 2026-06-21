# Changelog: Tối ưu Virtualization cho Slider Danh sách Sinh viên

## 1. Ngữ cảnh và Vấn đề
Trên trang `/grading/score`, danh sách sinh viên được hiển thị dưới dạng slider nằm ngang. Trước đây, để tránh giật lag DOM khi số lượng sinh viên lớn (lên tới hàng trăm hoặc hàng ngàn), hệ thống đã sử dụng cơ chế cắt cứng mảng sinh viên xuống tối đa 30 phần tử thông qua `slice(0, 30)`. 
Tuy nhiên, phương pháp này gây ra các lỗi nghiệp vụ nghiêm trọng:
- Không thể tìm kiếm hoặc thao tác với các sinh viên nằm ngoài top 30.
- Người dù ng không thể tiếp tục cuộnđể xem các sinh viên còn lại trong danh sách khi họ bị ẩn khỏi giao diện.

## 2. Giải pháp: Áp dụng Virtualization
Sử dụng thư viện `@tanstack/react-virtual` để triển khai Virtualization, thay thế hoàn toàn cơ chế cắt mảng cứng:
- **Hiển thị toàn bộ dữ liệu**: Loại bỏ `slice(0, 30)`, hỗ trợ kết xuất danh sách thực tế mà không giới hạn số lượng phần tử.
- **Tối ưu hiệu suất hiển thị (Rendering Performance)**: Chỉ kết xuất các node DOM nằm trong vùng nhìn thấy (viewport) của người dùng cùng với một khoảng dư (overscan). Các node ngoài viewport không được kết xuất, giúp giảm tải bộ nhớ và cải thiện FPS đáng kể.
- **Duy trì UX mượt mà**: Các chức năng liên quan như kéo-thả, cuộn ngang, chuyển trạng thái sticky và tự động cuộn (auto-scroll) đều được bảo toàn hoạt động chuẩn xác.

## 3. Các Cập Nhật Kỹ Thuật (Technical Details)
1. **Khởi tạo và Cấu hình Virtualizer (`useVirtualizer`)**:
   - Sử dụng chế độ cuộn chiều ngang (`horizontal: true`).
   - Tổng số phần tử `count` được ánh xạ bằng với độ dài đầy đủ của mảng danh sách `filteredStudentsForRoster`.
   - Hàm `estimateSize` được cung cấp để tính toán linh hoạt chiều rộng của thẻ, phụ thuộc vào trạng thái `isStudentSliderSticky`.
   - Cấu hình một mức độ `overscan` an toàn nhằm phòng tránh nhấp nháy UI (layout thrashing) khi người dùng cuộn danh sách quá nhanh.

2. **Thay đổi Cấu trúc Container**:
   - Vùng chứa ảo (virtual wrapper) được chỉ định độ rộng cố định tương đương với `virtualizer.getTotalSize()` để thanh cuộn trình duyệt nhận biết tổng kích thước của toàn bộ danh sách.
   - Các phần tử hiển thị (virtual items) được kết xuất với thuộc tính CSS `position: absolute` và đặt vào vị trí tương ứng bằng `transform: translateX(virtualItem.start)`.

3. **Cải tiến Cơ chế Auto-Scroll**:
   - Trước đây, logic dùng DOM query (`document.getElementById`) để tìm thẻ DOM và cuộn tới thẻ đó. Với Virtualization, các thẻ ngoài màn hình không tồn tại trên cây DOM, dẫn đến lỗi nếu tiếp tục sử dụng logic này.
   - **Giải pháp mới**: Xác định chỉ mục (`activeStudentIndex`) của sinh viên dựa trên danh sách, sau đó dùng hàm `studentVirtualizer.scrollToIndex(activeStudentIndex, { align: "center" })` để điều hướng an toàn và chính xác, kể cả khi sinh viên đó hiện không nằm trong vùng viewport.

## 4. Kết Quả Review
- Tính năng Virtualization được nghiệm thu thành công, cải thiện rõ rệt thời gian phản hồi ở trang chấm điểm.
- Trải nghiệm người dùng trơn tru hơn trong thao tác tìm kiếm và cuộn danh sách, không còn xuất hiện giật lag.
- Docstring và code mới tuân thủ chặt chẽ tiêu chuẩn dự án, đảm bảo mã nguồn dễ bảo trì về sau.
