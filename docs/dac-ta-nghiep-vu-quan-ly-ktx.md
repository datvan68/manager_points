# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ
## Phân hệ Quản lý Ký túc xá (KTX)

---

## 1. Giới thiệu

### 1.1 Mục đích
Tài liệu mô tả yêu cầu nghiệp vụ, các tác nhân, use-case, quy tắc nghiệp vụ và dữ liệu cho phân hệ Quản lý Ký túc xá — một module trong hệ thống quản lý sinh viên/nhà trường, phục vụ việc đăng ký ở, phân phòng, thu phí, quản lý vi phạm và bảo trì cơ sở vật chất.

### 1.2 Phạm vi
Phân hệ bao gồm các nhóm chức năng chính:
- Quản lý danh mục (tòa nhà, phòng, giường)
- Đăng ký và xét duyệt ở KTX
- Phân phòng / chuyển phòng / trả phòng
- Quản lý hợp đồng ở KTX
- Quản lý phí (phí phòng, điện nước, dịch vụ)
- Quản lý vi phạm nội quy
- Quản lý bảo trì thiết bị, cơ sở vật chất
- Báo cáo, thống kê

### 1.3 Đối tượng sử dụng tài liệu
Nhóm phân tích nghiệp vụ, lập trình viên, kiểm thử viên, và bộ phận quản lý KTX tham gia góp ý yêu cầu.

---

## 2. Danh sách tác nhân (Actors)

| Mã | Tác nhân | Mô tả |
|---|---|---|
| A01 | Sinh viên | Người đăng ký ở, xem hóa đơn, gửi yêu cầu chuyển/trả phòng, báo hỏng thiết bị |
| A02 | Nhân viên quản lý KTX | Xét duyệt đăng ký, phân phòng, lập hợp đồng, ghi nhận vi phạm |
| A03 | Kế toán/Thu phí | Lập hóa đơn, xác nhận thanh toán, đối soát công nợ |
| A04 | Ban quản lý (cấp trưởng/phó KTX) | Duyệt các trường hợp đặc biệt, xem báo cáo tổng hợp |
| A05 | Kỹ thuật/Bảo trì | Tiếp nhận, xử lý yêu cầu sửa chữa thiết bị |
| A06 | Hệ thống (Admin CNTT) | Quản trị danh mục, phân quyền, sao lưu dữ liệu |

---

## 3. Danh sách Use Case

| Mã UC | Tên Use Case | Tác nhân chính |
|---|---|---|
| UC01 | Đăng ký ở KTX | Sinh viên |
| UC02 | Xét duyệt đăng ký | NV quản lý KTX |
| UC03 | Phân phòng | NV quản lý KTX |
| UC04 | Lập hợp đồng ở KTX | NV quản lý KTX |
| UC05 | Chuyển phòng | Sinh viên, NV quản lý |
| UC06 | Trả phòng / Kết thúc hợp đồng | Sinh viên, NV quản lý |
| UC07 | Lập hóa đơn phí KTX | Kế toán |
| UC08 | Thanh toán phí | Sinh viên, Kế toán |
| UC09 | Ghi nhận vi phạm nội quy | NV quản lý KTX |
| UC10 | Xử lý vi phạm (cảnh cáo/buộc rời KTX) | Ban quản lý |
| UC11 | Gửi yêu cầu sửa chữa thiết bị | Sinh viên |
| UC12 | Xử lý yêu cầu bảo trì | Kỹ thuật/Bảo trì |
| UC13 | Thống kê, báo cáo tình hình KTX | Ban quản lý |
| UC14 | Quản lý danh mục tòa nhà/phòng/giường | Admin |
| UC15 | Quét mã QR xem nhanh thông tin phòng | Sinh viên, Khách, NV quản lý |
| UC16 | Quét mã QR để báo hỏng thiết bị tại chỗ | Sinh viên |
| UC17 | Quét mã QR check-in/check-out phòng | Sinh viên, NV quản lý |

---

## 4. Mô tả chi tiết một số Use Case chính

### UC01 — Đăng ký ở KTX
- **Tác nhân**: Sinh viên
- **Điều kiện trước**: Sinh viên có tài khoản hợp lệ, chưa có hợp đồng KTX đang hiệu lực
- **Luồng chính**:
  1. Sinh viên chọn kỳ học/năm học muốn đăng ký
  2. Hệ thống hiển thị các loại phòng còn chỗ trống (theo tòa nhà, số người/phòng, mức phí)
  3. Sinh viên chọn nguyện vọng phòng, nhập thông tin bổ sung (đối tượng ưu tiên, ghi chú)
  4. Hệ thống lưu đơn đăng ký ở trạng thái "Chờ duyệt"
- **Luồng phụ**: Sinh viên đã có đăng ký "Chờ duyệt" chưa xử lý → hệ thống báo lỗi, không cho tạo đơn mới
- **Kết quả**: Đơn đăng ký được tạo, gửi thông báo tới NV quản lý KTX

### UC02 — Xét duyệt đăng ký
- **Tác nhân**: NV quản lý KTX
- **Luồng chính**:
  1. Xem danh sách đơn đăng ký theo trạng thái "Chờ duyệt"
  2. Kiểm tra điều kiện ưu tiên (diện chính sách, khoảng cách, học lực...) và số chỗ còn trống
  3. Duyệt hoặc từ chối đơn (có lý do khi từ chối)
- **Kết quả**: Đơn chuyển trạng thái "Đã duyệt"/"Từ chối"; nếu duyệt, chuyển sang UC03

### UC03 — Phân phòng
- **Tác nhân**: NV quản lý KTX
- **Điều kiện trước**: Đơn đăng ký đã được duyệt
- **Luồng chính**:
  1. Hệ thống gợi ý phòng còn giường trống phù hợp với nguyện vọng
  2. NV quản lý chọn phòng/giường cụ thể, xác nhận phân phòng
  3. Hệ thống cập nhật số chỗ trống của phòng, sinh mã sinh viên–phòng
- **Kết quả**: Sinh viên được gắn với phòng/giường cụ thể, sẵn sàng lập hợp đồng (UC04)

### UC07 — Lập hóa đơn phí KTX
- **Tác nhân**: Kế toán
- **Luồng chính**:
  1. Hệ thống tự động sinh hóa đơn định kỳ (theo tháng/kỳ) dựa trên hợp đồng đang hiệu lực
  2. Cộng thêm phí phát sinh (điện, nước, dịch vụ, phạt vi phạm nếu có)
  3. Gửi thông báo hóa đơn tới sinh viên
- **Kết quả**: Hóa đơn ở trạng thái "Chưa thanh toán", chuyển sang UC08 khi sinh viên thanh toán

### UC09 — Ghi nhận vi phạm nội quy
- **Tác nhân**: NV quản lý KTX
- **Luồng chính**:
  1. Ghi nhận vi phạm (loại vi phạm, mức độ, ngày, minh chứng)
  2. Hệ thống tự tính điểm trừ/mức phạt theo bảng quy định
  3. Nếu vượt ngưỡng quy định, tạo yêu cầu xử lý chuyển Ban quản lý (UC10)

### UC15 — Quét mã QR xem nhanh thông tin phòng
- **Tác nhân**: Sinh viên, khách, NV quản lý (không cần đăng nhập)
- **Bối cảnh**: Mỗi phòng được dán 1 mã QR tại cửa. Quét mã mở trang thông tin công khai, tải nhanh trên điện thoại.
- **Luồng chính**:
  1. Người dùng quét mã QR dán tại phòng bằng camera điện thoại
  2. Hệ thống mở trang xem nhanh gồm: mã phòng, tòa nhà/tầng, loại phòng, sức chứa, số chỗ trống hiện tại, giá phòng theo kỳ, tiện ích đi kèm, trạng thái (Trống/Đầy/Đang bảo trì)
  3. Nếu người dùng đã đăng nhập (sinh viên), hiển thị thêm nút "Đăng ký nguyện vọng phòng này" để rút ngắn thao tác đăng ký (tự điền UC01)
- **Kết quả**: Xem thông tin phòng tức thời, không cần tìm kiếm thủ công qua nhiều màn hình

### UC16 — Quét QR báo hỏng thiết bị tại chỗ
- **Tác nhân**: Sinh viên
- **Luồng chính**:
  1. Sinh viên quét mã QR của phòng khi phát hiện sự cố (điện, nước, thiết bị hỏng)
  2. Hệ thống tự nhận diện mã phòng, mở sẵn form báo hỏng đã điền trước mã phòng/tòa nhà
  3. Sinh viên chỉ cần chọn loại sự cố, chụp ảnh, gửi — không phải tự nhập lại thông tin phòng
- **Kết quả**: Yêu cầu bảo trì được tạo (UC11) với thời gian thao tác tối thiểu

### UC17 — Quét QR check-in/check-out phòng
- **Tác nhân**: Sinh viên, NV quản lý
- **Luồng chính**:
  1. Khi nhận phòng hoặc trả phòng, sinh viên/NV quản lý quét mã QR gắn tại phòng
  2. Hệ thống tự động đối chiếu hợp đồng, xác nhận nhận/trả phòng, cập nhật trạng thái giường theo thời gian thực
  3. Không cần thao tác thủ công tìm mã sinh viên/mã phòng trên phần mềm
- **Kết quả**: Giảm thao tác nhập liệu thủ công, giảm sai sót khi bàn giao phòng

---

## 5. Yêu cầu chức năng (tóm tắt theo nhóm)

**Nhóm Danh mục**
- FR01: Quản lý tòa nhà, tầng, phòng, giường (thêm/sửa/xóa/khóa phòng)
- FR02: Quản lý loại phòng và bảng giá theo loại phòng

**Nhóm Đăng ký & Phân phòng**
- FR03: Sinh viên đăng ký, hủy đăng ký ở KTX
- FR04: Xét duyệt đăng ký theo tiêu chí ưu tiên có thể cấu hình
- FR05: Phân phòng/giường tự động gợi ý hoặc thủ công
- FR06: Chuyển phòng, trả phòng, gia hạn hợp đồng

**Nhóm Tài chính**
- FR07: Sinh hóa đơn tự động theo chu kỳ cấu hình được
- FR08: Ghi nhận thanh toán (tiền mặt/chuyển khoản/cổng thanh toán)
- FR09: Đối soát công nợ, cảnh báo quá hạn

**Nhóm Nội quy & Bảo trì**
- FR10: Ghi nhận, tra cứu lịch sử vi phạm theo sinh viên
- FR11: Quy trình xử lý vi phạm nhiều cấp (cảnh cáo → buộc rời KTX)
- FR12: Tiếp nhận và theo dõi tiến độ yêu cầu sửa chữa

**Nhóm Báo cáo**
- FR13: Báo cáo tỷ lệ lấp đầy phòng theo tòa nhà/thời gian
- FR14: Báo cáo công nợ, doanh thu theo kỳ
- FR15: Báo cáo vi phạm, bảo trì theo thời gian

**Nhóm QR & Tự động hoá thao tác**
- FR16: Tự động sinh mã QR gắn với từng phòng ngay khi khởi tạo phòng trong danh mục
- FR17: Trang xem nhanh thông tin phòng qua QR không yêu cầu đăng nhập, tải nhẹ (mobile-first)
- FR18: Quét QR tự điền sẵn thông tin phòng vào các form liên quan (đăng ký, báo hỏng, check-in/out) để giảm số trường phải nhập tay
- FR19: Sinh viên đã đăng nhập quét QR có thể thao tác 1-chạm: "Đăng ký phòng này", "Báo hỏng", "Xác nhận nhận/trả phòng"

---

## 6. Yêu cầu phi chức năng

| Loại | Yêu cầu |
|---|---|
| Hiệu năng | Xử lý danh sách 5.000+ sinh viên/phòng không chậm quá 2s cho các thao tác tra cứu thường dùng |
| Bảo mật | Phân quyền theo vai trò (RBAC); dữ liệu cá nhân sinh viên được mã hóa khi lưu trữ |
| Khả dụng | Hệ thống hoạt động 24/7, có cơ chế sao lưu định kỳ |
| Khả mở rộng | Cho phép thêm cơ sở KTX mới, loại phòng mới mà không sửa code lõi |
| Nhật ký | Ghi log mọi thao tác duyệt, phân phòng, thu phí phục vụ truy vết |

---

## 7. Từ điển dữ liệu (Danh sách thực thể chính)

| Thực thể | Thuộc tính chính | Ghi chú |
|---|---|---|
| **ToaNha** | ma_toa_nha, ten, dia_chi | 1 KTX có nhiều tòa nhà |
| **Phong** | ma_phong, ma_toa_nha, tang, loai_phong, so_giuong, trang_thai, **ma_qr, url_xem_nhanh** | trang_thái: Trống/Đầy/Khóa; mã QR sinh tự động khi tạo phòng |
| **Giuong** | ma_giuong, ma_phong, trang_thai | Trống/Đang sử dụng |
| **SinhVien** | mssv, ho_ten, lop, khoa, doi_tuong_uu_tien | Liên kết hệ thống quản lý sinh viên chung |
| **DangKyKTX** | ma_dk, mssv, ky_hoc, nguyen_vong, trang_thai, ly_do_tu_choi | Trạng thái: Chờ duyệt/Đã duyệt/Từ chối |
| **HopDong** | ma_hd, mssv, ma_giuong, ngay_bat_dau, ngay_ket_thuc, trang_thai | Trạng thái: Hiệu lực/Hết hạn/Đã hủy |
| **HoaDon** | ma_hd_don, ma_hd, ky_thu, tong_tien, trang_thai_tt, han_thanh_toan | Chưa TT/Đã TT/Quá hạn |
| **ViPham** | ma_vp, mssv, loai_vi_pham, muc_do, ngay_ghi_nhan, hinh_thuc_xu_ly | |
| **YeuCauBaoTri** | ma_ycbt, ma_phong, mo_ta, nguoi_bao, trang_thai, ky_thuat_vien | Mới/Đang xử lý/Hoàn tất |

---

## 8. Quy tắc nghiệp vụ (Business Rules)

1. Mỗi sinh viên chỉ có tối đa **1 hợp đồng KTX hiệu lực** tại một thời điểm.
2. Không phân phòng vượt quá **sức chứa** đã khai báo của phòng.
3. Sinh viên có **hóa đơn quá hạn > 1 kỳ** sẽ bị khóa chức năng đăng ký chuyển/gia hạn phòng cho tới khi thanh toán.
4. Vi phạm đạt **ngưỡng điểm trừ** (cấu hình được, ví dụ ≥ 3 lần vi phạm nghiêm trọng) → tự động sinh yêu cầu xét buộc rời KTX gửi Ban quản lý.
5. Hợp đồng chỉ được lập sau khi đăng ký ở trạng thái **"Đã duyệt"** và phòng/giường đã được phân.
6. Trả phòng trước hạn cần **NV quản lý xác nhận** và ghi nhận lý do; giường được cập nhật lại trạng thái "Trống" ngay sau xác nhận.

---

## 9. Đề xuất tối ưu hoá & giảm thao tác thủ công

| Điểm thao tác thủ công hiện tại | Giải pháp tối ưu |
|---|---|
| Tìm kiếm phòng trống qua nhiều màn hình lọc | Quét QR tại phòng → xem ngay trạng thái, giá, tiện ích (UC15) |
| Nhập lại mã phòng/tòa nhà khi báo hỏng | QR tự điền sẵn thông tin phòng vào form báo hỏng (UC16) |
| NV quản lý tra cứu hợp đồng để xác nhận nhận/trả phòng | Quét QR đối chiếu hợp đồng tự động, 1-chạm xác nhận (UC17) |
| Lập hóa đơn thủ công từng sinh viên mỗi kỳ | Tự động sinh hóa đơn hàng loạt theo lịch (đã có ở FR07), kèm nhắc hạn tự động qua thông báo/app |
| Xét duyệt đăng ký thủ công từng đơn | Bộ lọc/ưu tiên tự động xếp hạng đơn theo tiêu chí cấu hình sẵn, NV chỉ duyệt hàng loạt (bulk-approve) |
| Phân phòng thủ công từng sinh viên | Gợi ý phân phòng tự động theo nguyện vọng + chỗ trống, NV chỉ xác nhận |
| Theo dõi vi phạm để nhắc xử lý | Tự động cảnh báo/tạo yêu cầu xử lý khi đạt ngưỡng vi phạm (đã có ở Business Rule #4) |

**Nguyên tắc thiết kế xuyên suốt**: mọi màn hình thao tác lặp lại (duyệt, phân phòng, xác nhận) nên hỗ trợ **thao tác hàng loạt (bulk action)** và **gợi ý tự động**, còn các điểm chạm của sinh viên/khách (xem phòng, báo hỏng, check-in/out) nên rút gọn về **1 lần quét QR** thay vì đăng nhập và điều hướng nhiều bước.

---

## 10. Ghi chú triển khai
Tài liệu này là đặc tả nghiệp vụ ở mức phân tích yêu cầu (use-case + business rules + data dictionary), làm cơ sở để:
- Vẽ sơ đồ ERD chi tiết (khóa chính/khóa ngoại, ràng buộc)
- Thiết kế API/backend theo từng nhóm chức năng
- Xây dựng giao diện theo vai trò tác nhân

Nếu cần, mình có thể triển khai tiếp: sơ đồ ERD, thiết kế API, hoặc code backend/frontend theo công nghệ bạn chọn sau.
