# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🚀 Tính năng mới (New Features)
- **Import Backup Database và Khôi phục dữ liệu:** Cho phép tải lên file sao lưu (định dạng `.gz`, `.archive`, `.zip`), xem trước cấu trúc collections và số lượng bản ghi. Hệ thống hỗ trợ quá trình khôi phục an toàn với cơ chế tự động sao lưu dữ liệu trước khi khôi phục (pre-restore backup) và yêu cầu xác nhận.
- **Hệ thống xếp hạng sinh viên (Student Ranking Tier):** Ra mắt cơ chế tính toán và cấp "Hạng" (Rank) cho sinh viên dựa trên tổng điểm rèn luyện (Diamond, Gold, Silver, Bronze, Unranked). Hạng chỉ được cấp sau khi bảng điểm đã được chốt (Locked).
- **Thẻ hiển thị hạng tích cực (Active Student Rank Card):** Bổ sung UI mới (`ActiveStudentRankCard`) trên Frontend để hiển thị cấp bậc của sinh viên một cách trực quan, bao gồm các hiệu ứng thị giác đặc biệt (phát sáng, tia lửa) đối với các hạng cao như Kim cương (Diamond).

### ⚡ Nâng cấp & Cải thiện (Improvements)
- **Tối ưu tra cứu bảng điểm rèn luyện:** Áp dụng cơ chế đánh chỉ mục bảng băm (O(1) lookup) cho danh sách bảng điểm để cải thiện hiệu năng khi ánh xạ (mapping) dữ liệu giữa danh sách sinh viên và bảng điểm.
- **Tính toán lại điểm thông minh:** Cập nhật logic `recomputeTotalScore` giúp tự động quyết định xếp loại học lực/rèn luyện (Xuất sắc, Tốt, Khá...) ngay khi cập nhật điểm.
- **Cải thiện việc hiển thị Tên lớp (Class Name):** Ràng buộc hiển thị an toàn hơn đối với tên lớp (`class_name`) của sinh viên trên giao diện, đề phòng trường hợp cấu trúc dữ liệu trả về bị thiếu hoặc lỗi do populate.

### 🛡 Sửa lỗi & Logic (Bug Fixes & Logic Adjustments)
- **Kiểm soát tính hợp lệ khi xoá bảng điểm hàng loạt:** Modal xoá bảng điểm (`DeleteSummaryModal`) giờ đây sẽ khóa các hành động xoá nếu phát hiện bảng điểm của sinh viên đó đã được chốt duyệt (Locked). Trạng thái của sinh viên không đủ điều kiện bị xoá sẽ được thể hiện trực quan với nhãn cảnh báo tương ứng.
- **Chặn cập nhật hạng khi ở dạng nháp:** Đảm bảo quá trình "Hủy duyệt" (Cancel Approval) sẽ hoàn tác toàn bộ xếp hạng của sinh viên và đẩy bảng điểm về lại trạng thái Draft một cách an toàn.
