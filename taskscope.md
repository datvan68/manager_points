# Task Scope: Chức năng import lớp

## 1. Mục tiêu

Thêm chức năng import danh sách lớp từ file vào hệ thống, giúp quản trị viên tạo nhiều lớp cùng lúc thay vì nhập thủ công từng lớp.

Chức năng phải có bước đọc file, kiểm tra dữ liệu, hiển thị modal preview tổng quan trước khi ghi vào database, sau đó mới cho phép người dùng xác nhận import.

## 2. Phạm vi màn hình

Áp dụng tại khu vực quản lý lớp trong module sinh viên/lớp hiện tại.

Các thay đổi UI cần có:

- Thêm nút `Import lớp` cạnh các thao tác tạo lớp hiện có.
- Cho phép chọn file `.xlsx`, `.xls` hoặc `.csv`.
- Sau khi chọn file, mở modal preview danh sách lớp sẽ import.
- Modal cần hiển thị tổng số dòng đọc được, số dòng hợp lệ, số dòng lỗi, số dòng bị trùng.
- Trong modal có bảng preview các cột chính: tên lớp, khóa/năm học, khoa/phòng ban, cố vấn học tập, hệ đào tạo, cơ sở, trạng thái kiểm tra.
- Cho phép người dùng tải file mẫu để nhập đúng định dạng.
- Chỉ bật nút `Xác nhận import` khi không có lỗi bắt buộc hoặc khi người dùng chọn chế độ bỏ qua dòng lỗi.

## 3. Định dạng dữ liệu import

File import cần hỗ trợ các cột sau:

| Cột trong file | Field backend | Bắt buộc | Ghi chú |
| --- | --- | --- | --- |
| `class_name` hoặc `Tên lớp` | `class_name` | Có | Tên lớp đang unique trong database, không được trùng. |
| `class_year` hoặc `Khóa/Năm học` | `class_year` | Có | Ví dụ: `2024-2027`, `K24`, `2024`. |
| `department_code` hoặc `Mã khoa` | `dept_id` | Có | Dùng để tìm department tương ứng. |
| `advisor_email` hoặc `Email cố vấn` | `advisor_id` | Không | Nếu có thì map sang user cố vấn. |
| `class_course` hoặc `Hệ đào tạo` | `class_course` | Không | Backend hiện hỗ trợ alias `class_type`. |
| `headquarters` hoặc `Cơ sở` | `headquarters` | Không | Ví dụ: phân hiệu/cơ sở đang dùng trong hệ thống. |

Không yêu cầu người dùng nhập trực tiếp `dept_id` hoặc `advisor_id` trong file vì đây là ObjectId nội bộ.

## 4. Luồng xử lý người dùng

1. Người dùng bấm `Import lớp`.
2. Hệ thống mở popup chọn file hoặc mở modal import.
3. Người dùng tải file lên.
4. Frontend gửi file lên endpoint preview.
5. Backend parse file và validate từng dòng.
6. Frontend hiển thị modal preview tổng thể:
   - Dòng hợp lệ.
   - Dòng thiếu dữ liệu bắt buộc.
   - Dòng trùng `class_name` trong file.
   - Dòng trùng `class_name` đã tồn tại trong database.
   - Dòng không tìm thấy khoa theo `department_code`.
   - Dòng không tìm thấy cố vấn theo `advisor_email`.
7. Người dùng chọn:
   - Hủy import.
   - Sửa file rồi upload lại.
   - Import các dòng hợp lệ nếu hệ thống cho phép bỏ qua dòng lỗi.
8. Backend chỉ ghi database sau khi người dùng xác nhận.
9. Sau khi import thành công, danh sách lớp được refresh và cache lớp bị invalidate.

## 5. Backend scope

Thêm API cho import lớp trong module `classes`.

Endpoint đề xuất:

- `POST /api/classes/import/preview`
  - Nhận file import.
  - Parse file.
  - Validate dữ liệu.
  - Không ghi database.
  - Trả về danh sách dòng preview kèm trạng thái.

- `POST /api/classes/import/confirm`
  - Nhận payload các dòng đã được preview hợp lệ hoặc nhận `importSessionId`.
  - Ghi database theo mode đã chọn.
  - Trả về số lượng tạo thành công, số dòng bỏ qua, danh sách lỗi nếu có.

DTO/kiểu dữ liệu cần có:

- `ImportClassRowDto`
- `ImportClassPreviewResultDto`
- `ImportClassConfirmDto`
- `ImportClassResultDto`

Service cần xử lý:

- Parse Excel/CSV bằng thư viện ổn định, không tự tách chuỗi thủ công.
- Chuẩn hóa header tiếng Việt và tiếng Anh.
- Trim khoảng trắng ở mọi field text.
- Map `department_code` sang `dept_id`.
- Map `advisor_email` sang `advisor_id` nếu có.
- Chuẩn hóa `class_type` về `class_course`.
- Kiểm tra trùng `class_name` trong file.
- Kiểm tra trùng `class_name` trong database.
- Trả lỗi rõ ràng theo từng dòng.

## 6. Quyền truy cập

Chỉ người có quyền tạo lớp mới được import lớp.

Đề xuất dùng cùng permission với tạo lớp hiện tại:

- Preview import: yêu cầu `CLASS_CREATE`.
- Confirm import: yêu cầu `CLASS_CREATE`.

Không cho học sinh/sinh viên hoặc tài khoản không có quyền quản lý lớp truy cập endpoint import.

## 7. Quy tắc xử lý trùng dữ liệu

Mặc định không ghi đè lớp cũ.

Các mode đề xuất:

- `skip_duplicates`: bỏ qua dòng trùng `class_name`, chỉ tạo dòng mới hợp lệ.
- `fail_on_duplicates`: nếu có bất kỳ dòng trùng nào thì chặn toàn bộ import.

Không triển khai mode ghi đè ở phiên bản đầu nếu chưa có yêu cầu rõ ràng, vì lớp có thể đang liên kết với sinh viên, báo cáo, điểm danh và dữ liệu điểm.

## 8. Modal preview

Modal import cần có:

- Tên file đã chọn.
- Tổng số dòng.
- Badge thống kê: hợp lệ, lỗi, trùng, sẽ import.
- Bảng preview có phân trang nếu nhiều dòng.
- Bộ lọc theo trạng thái: tất cả, hợp lệ, lỗi, trùng.
- Nút tải lại file khác.
- Nút hủy.
- Nút xác nhận import.
- Cảnh báo rõ rằng thao tác import sẽ thêm lớp mới vào database.

Trạng thái từng dòng nên gồm:

- `valid`
- `missing_required_field`
- `duplicate_in_file`
- `duplicate_in_database`
- `department_not_found`
- `advisor_not_found`
- `invalid_format`

## 9. Frontend scope

Cần cập nhật hoặc thêm:

- API client cho import lớp trong `frontend/src/api/class-api.ts`.
- Component popup/modal import lớp.
- Button mở import tại màn hình quản lý lớp.
- Loading state khi upload/preview/import.
- Error state khi file sai định dạng hoặc backend trả lỗi.
- Toast/thông báo kết quả sau import.
- Refresh danh sách lớp sau import thành công.
- Invalidate cache `classes` sau khi import.

Frontend không tự quyết định dữ liệu nào được ghi database; backend là nơi validate cuối cùng.

## 10. Validation

Validation bắt buộc:

- File không rỗng.
- File đúng định dạng hỗ trợ.
- `class_name` không rỗng.
- `class_year` không rỗng.
- `department_code` tồn tại trong database.
- `class_name` không trùng trong file.
- `class_name` không trùng trong database.

Validation khuyến nghị:

- Giới hạn số dòng mỗi lần import, ví dụ tối đa 500 hoặc 1000 dòng.
- Kiểm tra độ dài `class_name`.
- Kiểm tra `advisor_email` đúng định dạng email nếu có.
- Kiểm tra `class_course` thuộc danh sách cho phép nếu hệ thống đang cố định danh mục.
- Kiểm tra `headquarters` thuộc danh sách cho phép nếu hệ thống đang cố định danh mục.

## 11. Xử lý lỗi

Backend cần trả lỗi theo từng dòng, không chỉ trả message chung.

Ví dụ response preview:

```json
{
  "totalRows": 10,
  "validRows": 8,
  "invalidRows": 2,
  "duplicateRows": 1,
  "rows": [
    {
      "rowNumber": 2,
      "status": "valid",
      "data": {
        "class_name": "CNTT-K24A",
        "class_year": "2024-2027",
        "department_code": "CNTT"
      },
      "errors": []
    },
    {
      "rowNumber": 3,
      "status": "department_not_found",
      "data": {
        "class_name": "QTKD-K24A",
        "class_year": "2024-2027",
        "department_code": "QTKD"
      },
      "errors": ["Không tìm thấy khoa có mã QTKD"]
    }
  ]
}
```

## 12. An toàn dữ liệu

- Preview không được ghi database.
- Confirm import phải validate lại dữ liệu trước khi ghi.
- Không tin hoàn toàn vào dữ liệu preview từ frontend.
- Không ghi đè lớp đã tồn tại ở bản đầu.
- Nếu import nhiều dòng, cần dùng `insertMany` có kiểm soát hoặc transaction nếu MongoDB deployment hỗ trợ.
- Nếu một phần import thất bại, response phải cho biết dòng nào đã tạo, dòng nào lỗi.
- Không log toàn bộ file import nếu có dữ liệu nhạy cảm.

## 13. Kiểm thử

Backend tests:

- Preview file hợp lệ.
- Preview file thiếu `class_name`.
- Preview file thiếu `class_year`.
- Preview file có `department_code` không tồn tại.
- Preview file có `class_name` trùng trong file.
- Preview file có `class_name` trùng database.
- Confirm import chỉ tạo dòng hợp lệ.
- Confirm import không ghi đè dữ liệu cũ.
- Permission: user không có `CLASS_CREATE` bị chặn.

Frontend tests/manual QA:

- Mở modal import.
- Upload file mẫu hợp lệ.
- Upload file sai định dạng.
- Upload file có lỗi và xem preview.
- Lọc dòng lỗi trong modal.
- Confirm import thành công.
- Danh sách lớp refresh sau import.
- Cache lớp không còn dữ liệu cũ sau import.

## 14. Ngoài phạm vi phiên bản đầu

Không bao gồm:

- Restore database toàn hệ thống.
- Ghi đè lớp đã tồn tại.
- Import sinh viên cùng lúc với lớp.
- Tự tạo khoa mới nếu `department_code` chưa tồn tại.
- Tự tạo tài khoản cố vấn nếu `advisor_email` chưa tồn tại.
- Rollback toàn bộ database ngoài phạm vi import lớp.

## 15. Thứ tự triển khai đề xuất

1. Chốt file mẫu và mapping cột.
2. Thêm backend parser và preview endpoint.
3. Thêm backend confirm endpoint.
4. Thêm unit test cho validate/import.
5. Thêm API client frontend.
6. Thêm modal import lớp.
7. Gắn nút import vào màn hình quản lý lớp.
8. Kiểm thử bằng file hợp lệ, file lỗi, file trùng.
9. Bổ sung tài liệu hướng dẫn người dùng tải file mẫu và import.

## 16. Tiêu chí hoàn thành

Feature được xem là hoàn thành khi:

- Người dùng có quyền `CLASS_CREATE` import được danh sách lớp từ file.
- Người dùng xem được preview trước khi ghi database.
- Dòng lỗi được hiển thị rõ lý do.
- Dữ liệu trùng không làm crash backend.
- Import không tự tạo lại dữ liệu mẫu.
- Danh sách lớp cập nhật đúng sau khi import.
- Có test backend cho luồng preview và confirm.
- Có hướng dẫn/file mẫu cho người dùng.
