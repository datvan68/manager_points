# Tài liệu API Import Lớp

## 1. Preview Import Classes

Endpoint này nhận file Excel hoặc CSV chứa danh sách lớp, phân tích cú pháp, kiểm tra dữ liệu và trả về kết quả preview cho người dùng trước khi thực sự lưu vào cơ sở dữ liệu.

- **URL:** `/classes/import/preview`
- **Method:** `POST`
- **Authentication:** Yêu cầu đăng nhập (`Bearer Token`)
- **Permissions:** Yêu cầu quyền `CLASS_CREATE`

### Request Format

- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `file`: File Excel (.xlsx, .xls) hoặc CSV (.csv). (Bắt buộc)

### Response Structure

```json
{
  "total_rows": 10,
  "valid_rows": 8,
  "invalid_rows": 2,
  "preview_data": [
    {
      "row_number": 2,
      "is_valid": true,
      "errors": [],
      "data": {
        "class_name": "CTK44",
        "class_year": "2020-2024",
        "department_code": "CNTT",
        "advisor_email": "advisor@example.com",
        "class_course": "K44",
        "headquarters": "Cơ sở 1"
      }
    },
    {
      "row_number": 3,
      "is_valid": false,
      "errors": ["Department code is required"],
      "data": {
        "class_name": "CTK45",
        "class_year": "2021-2025",
        "department_code": null,
        "advisor_email": null,
        "class_course": "K45",
        "headquarters": "Cơ sở 1"
      }
    }
  ]
}
```

---

## 2. Confirm Import Classes

Endpoint này nhận danh sách dữ liệu lớp đã được xác nhận hợp lệ từ phía client và tiến hành lưu vào cơ sở dữ liệu.

- **URL:** `/classes/import/confirm`
- **Method:** `POST`
- **Authentication:** Yêu cầu đăng nhập (`Bearer Token`)
- **Permissions:** Yêu cầu quyền `CLASS_CREATE`

### Request Format

- **Content-Type:** `application/json`
- **Body Parameters:**

```json
{
  "rows": [
    {
      "class_name": "string (Bắt buộc)",
      "class_year": "string (Bắt buộc)",
      "department_code": "string (Bắt buộc)",
      "advisor_email": "string (Tuỳ chọn)",
      "class_course": "string (Tuỳ chọn)",
      "headquarters": "string (Tuỳ chọn)"
    }
  ],
  "mode": "string (Tuỳ chọn) - Mặc định là 'skip_duplicates', có thể là 'fail_on_duplicates'"
}
```

### Response Structure

```json
{
  "success": true,
  "imported_count": 8,
  "skipped_count": 0,
  "failed_count": 0,
  "message": "Import thành công 8 lớp"
}
```
