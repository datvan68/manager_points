# Checklist Rollout: Xuất Excel tổng hợp PL03

Tài liệu này là checklist dành cho quá trình triển khai (rollout) tính năng Xuất Excel tổng hợp theo mẫu PL03.

## 1. Frontend (UI)
- [ ] Xác nhận nút **"Xuất Excel"** hiển thị đúng vị trí trong `FloatingActionBar` tại `/grading`.
- [ ] Nút bị disable khi chưa áp dụng bộ lọc Học kỳ & Lớp.
- [ ] Account role `student` không thấy nút (đã bị redirect).
- [ ] Hiển thị toast thông báo trạng thái "Đang tạo file Excel..." khi thao tác và toast thành công/lỗi khi hoàn thành.
- [ ] File tải về đúng tên định dạng, ví dụ: `PL03_Tong_hop_RL_<ten_lop>_<hoc_ky>.xlsx`.

## 2. Backend (API & Dependencies)
- [ ] **Dependency mới:** Thư viện **`exceljs`** (phiên bản `^4.4.0`) đã được cài đặt trong `backend/package.json` và container đã cài xong `node_modules` mới (chạy `npm install` khi build).
- [ ] File template **`PL03-Tong-hop-RL.xlsx`** nằm đúng tại thư mục `backend/src/summaries-point/templates`.
- [ ] **Docker/Deployment:** Kiểm tra file template đã được đóng gói vào build Image/Server. (Nếu thư mục `templates` nằm trong `src` nhưng không compile được qua `dist`, cần update file cấu hình `nest-cli.json` để giữ file assets, HOẶC copy vào thư mục riêng không dính đến typescript dist).
- [ ] **Phân quyền:** Endpoint `GET /api/summaries-points/export-summary-excel` sử dụng `JwtAuthGuard`. Không cho phép xuất danh sách sinh viên khác lớp ngoài phân công của giáo viên.

## 3. Sanity Test
- [ ] Xuất thử với lớp < 35 sinh viên (file có bị lỗi định dạng không).
- [ ] Xuất thử với lớp = 35 sinh viên.
- [ ] Xuất thử với lớp > 35 sinh viên (file phải tự động render thêm dòng mới, bảng thống kê và chữ ký tự dịch xuống, range `COUNTIF` tính chính xác).
- [ ] Cố tình dùng token của Giáo viên A truy cập lấy file lớp của Giáo viên B -> Kết quả mong muốn: API trả về 403 Forbidden.

## 4. Rollback Plan
- [ ] Nếu chức năng xuất Excel gây tràn bộ nhớ (OOM) vì `exceljs` tốn RAM cho lớp có số lượng rất lớn (ví dụ vài ngàn sinh viên):
  - Tạm thời tắt nút "Xuất Excel" trên Frontend.
  - Tối ưu bộ nhớ trên Backend (chuyển sang stream workbook).
- [ ] Nếu quá trình build trên production bị lỗi liên quan đến file template hoặc dependency: Revert commit và build lại bản cũ.
