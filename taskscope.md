# Taskscope: Đổi vị trí chữ ký trong mẫu Excel PL03 trang /grading

## Mục tiêu
- Điều chỉnh mẫu xuất Excel PL03 từ trang `/grading` để 2 mục chữ ký không còn bị ngược vị trí.
- Vị trí đúng theo yêu cầu:
  - Bên trái: `TRƯỞNG KHOA`
  - Bên phải: `GVCN/CVHT`
- Chỉ thay đổi layout/footer của file Excel xuất ra, không thay đổi dữ liệu điểm, xếp loại, bộ lọc, tên file hoặc API export.

## Hiện trạng đã kiểm tra
- Frontend `/grading` gọi API xuất Excel qua:
  - `frontend/src/api/summaries-point-api.ts`
  - method `exportSummaryExcel(...)`
  - endpoint `POST /summaries-points/export-summary-excel`
- Backend controller trả file Excel tại:
  - `backend/src/summaries-point/summaries-point.controller.ts`
- Backend service tạo file Excel tại:
  - `backend/src/summaries-point/summaries-point.service.ts`
  - method `generateSummaryExcel(...)`
  - gọi `generatePl03Excel(summaries, classObj, semesterObj, departmentObj)`
- Template Excel PL03 nằm tại:
  - `backend/src/summaries-point/export/pl03-summary-excel.service.ts`
- Đoạn footer hiện tại đang merge và gán nhãn:
  - `A{signRow1}:D{signRow1}` = `GVCN/CVHT`
  - `E{signRow1}:G{signRow1}` = `TRƯỞNG KHOA`
- Theo ảnh đối chiếu, 2 mục này đang bị ngược và cần đổi lại.

## Root cause
- Lỗi nằm ở template backend `generatePl03Excel`, phần `// --- Signatures ---`.
- Code đang đặt `GVCN/CVHT` ở cụm cột trái `A:D` và `TRƯỞNG KHOA` ở cụm cột phải `E:G`.
- Frontend không cần sửa để đổi vị trí vì frontend chỉ nhận blob Excel từ backend.

## Phạm vi sửa
- File cần sửa:
  - `backend/src/summaries-point/export/pl03-summary-excel.service.ts`
- Trong phần `// --- Signatures ---`, đổi mapping:
  - `A{signRow1}:D{signRow1}` phải hiển thị `TRƯỞNG KHOA`
  - `E{signRow1}:G{signRow1}` phải hiển thị `GVCN/CVHT`
- Giữ nguyên:
  - merge range hiện có `A:D` và `E:G`
  - font `Times New Roman`
  - size `12`
  - bold
  - alignment center
  - khoảng cách dòng chữ ký
  - các block thống kê phía trên
  - filename `PL03-TONGHOPRL-<LOP>.xlsx`

## Test cần cập nhật
- File test:
  - `backend/src/summaries-point/export/pl03-summary-excel.service.spec.ts`
- Bổ sung test cho footer chữ ký sau khi generate workbook:
  - Tìm dòng chữ ký dựa trên vị trí sau block thống kê, hoặc quét sheet để tìm cell có value `TRƯỞNG KHOA` và `GVCN/CVHT`.
  - Expect `TRƯỞNG KHOA` nằm ở merged cell bên trái, cell đầu là cột `A`.
  - Expect `GVCN/CVHT` nằm ở merged cell bên phải, cell đầu là cột `E`.
- Nên test trực tiếp:
  - `sheet.getCell('A{signRow1}').value === 'TRƯỞNG KHOA'`
  - `sheet.getCell('E{signRow1}').value === 'GVCN/CVHT'`
- Nếu test hiện tại tính row thống kê theo số sinh viên, dùng mock summaries rỗng hoặc số lượng cố định để xác định `signRow1` ổn định.

## Acceptance criteria
- Khi bấm `Xuất Excel` ở trang `/grading`, file PL03 được tải về thành công.
- Trong file Excel, phần chữ ký cuối bảng hiển thị:
  - `TRƯỞNG KHOA` ở bên trái.
  - `GVCN/CVHT` ở bên phải.
- Hai label không còn bị ngược như ảnh người dùng gửi.
- Format chữ ký không bị thay đổi: merge cell, căn giữa, font, bold giữ nguyên.
- Các nội dung khác của file Excel không thay đổi:
  - danh sách sinh viên
  - điểm tổng
  - xếp loại
  - thống kê tổng hợp
  - tên file export

## Lệnh kiểm thử đề xuất
- Chạy test riêng cho template Excel:
  - `npm test -- pl03-summary-excel.service.spec.ts`
- Nếu script backend yêu cầu cwd backend:
  - `cd backend`
  - `npm test -- pl03-summary-excel.service.spec.ts`

## Ngoài phạm vi
- Không sửa UI button xuất Excel.
- Không sửa API export.
- Không sửa logic tính điểm hoặc xếp loại.
- Không sửa PDF/phieu in nếu có template chữ ký riêng.
- Không chỉnh lại encoding tiếng Việt trong file nếu task hiện tại chỉ yêu cầu đổi vị trí chữ ký.
