# Tài liệu: Ứng dụng Virtualization cho Slider Danh sách Sinh viên

## 1. Giới thiệu
Tài liệu này giải thích về cơ chế Virtualization được áp dụng trong slider danh sách sinh viên tại trang `/grading/score` nhằm thay thế cho cơ chế cắt cứng mảng (`slice(0, 30)`) cũ.

## 2. Mục đích và Giải pháp
Trước đây, danh sách sinh viên có thể lên tới hàng trăm hoặc ngàn nhưng client chỉ hiển thị tối đa 30 thẻ sinh viên đầu tiên (dùng hàm `.slice(0, 30)`) để tránh bị giật lag DOM. Điều này gây ra lỗi nghiệp vụ khi người dùng tìm kiếm sinh viên nằm ngoài top 30 hoặc cố tình cuộn chuột để xem sinh viên tiếp theo.

Bằng cách áp dụng thư viện `@tanstack/react-virtual`:
- Cho phép hiển thị danh sách với số lượng thực tế mà không giới hạn 30 phần tử.
- Cải thiện đáng kể hiệu năng bằng cách chỉ kết xuất (render) các thẻ sinh viên đang lọt trong vùng nhìn thấy (viewport) của slider và một lượng thẻ thừa (overscan) xung quanh vùng này.
- Bảo toàn toàn bộ chức năng liên quan tới kéo-thả, cuộn mượt (smooth scroll), chuyển trạng thái sticky và khả năng tự động cuộn (auto-scroll) tới sinh viên đang được chọn.

## 3. Bản nháp Docstring

Dưới đây là bản nháp docstring (bằng Tiếng Anh, tuân thủ `global.md`) dùng để thêm vào phần khai báo logic hoặc component Virtualizer trong tệp `frontend/src/app/grading/score/page.tsx`:

```tsx
/**
 * @description Virtualized Student Slider Component / Logic
 * 
 * Implements a horizontal virtualizer using `@tanstack/react-virtual` to optimize the rendering 
 * of large student rosters. Instead of hard-limiting the rendered DOM nodes via `.slice(0, 30)`, 
 * this approach only renders the elements currently visible in the viewport plus a predefined overscan buffer.
 * 
 * Key Modifications:
 * - Removed `slice(0, 30)` to support rendering and searching across the entire filtered roster.
 * - Replaced native DOM-based auto-scroll (`document.getElementById`) with `studentVirtualizer.scrollToIndex()`.
 * - Maintains dynamic sizing for elements based on the sticky and non-sticky states via `estimateSize`.
 * - Prevents layout thrashing by providing a fixed-width container matching `virtualizer.getTotalSize()` 
 *   with absolutely positioned virtual items matching their translated offsets.
 * 
 * @dependencies `@tanstack/react-virtual`
 */
```

## 4. Giải thích chi tiết các thay đổi kỹ thuật
1. **Khởi tạo Virtualizer (`useVirtualizer`):**
   - Đặt chiều cuộn là ngang (`horizontal: true`).
   - `count` nhận độ dài của mảng `filteredStudentsForRoster` đầy đủ.
   - Trỏ `getScrollElement` đến `sliderRef.current` chứa slider.
   - Cung cấp `estimateSize` để đảm bảo kích thước thẻ khớp chính xác với state `isStudentSliderSticky` (thẻ sticky và non-sticky có độ rộng khác nhau).
   - Thêm `overscan` (khoảng 4 đến 8) để buffer một số thẻ sinh viên, tránh hiện tượng trắng trang khi cuộn ngang đột ngột.
2. **Cấu trúc lại Container chứa danh sách:**
   - Phần tử bọc trong cùng (inner wrapper) được gán thuộc tính `width: virtualizer.getTotalSize()` để thanh cuộn (scrollbar) trình duyệt nhận biết tổng kích thước cuộn thực sự.
   - Mỗi thẻ con render qua `virtualizer.getVirtualItems()` được thiết lập `position: absolute` và `transform: translateX(virtualItem.start)` để dịch chuyển thẻ đến đúng vị trí ảo.
3. **Chuyển đổi Auto-Scroll sang dạng Index:**
   - Việc cuộn tự động trước kia dựa vào DOM Id (`document.getElementById('student-card-...')`). Điều này hoàn toàn không còn tác dụng trên virtualization khi item chưa nằm trong viewport thì Node DOM đó hoàn toàn không tồn tại.
   - Giải pháp thay thế là sử dụng `activeStudentIndex` lấy từ vị trí của sinh viên trong danh sách `filteredStudentsForRoster`. Sau đó, kích hoạt tự động `studentVirtualizer.scrollToIndex(activeStudentIndex, { align: "center" })` để đưa sinh viên vào vùng viewport một cách an toàn.
