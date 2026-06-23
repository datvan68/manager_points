# Task Scope: Sắp xếp dữ liệu mới lên đầu và hiện nhãn New trong 6 giờ tại `/students/record`

## 1. Mục tiêu

Điều chỉnh page `frontend/src/app/students/record/page.tsx` để hai bảng trên màn hình ghi nhận/tình hình luôn ưu tiên bản ghi mới nhất lên đầu danh sách, đồng thời nhãn `New` chỉ hiển thị trong 6 giờ đầu sau khi bản ghi được tạo.

Phạm vi áp dụng:

- Bảng `Ghi nhận HSSV` trong tab `student`.
- Bảng `Tình hình lớp học` trong tab `class`.
- Cả 3 cách hiển thị hiện có: mobile card, desktop card và desktop table.

## 2. Hiện trạng đã kiểm tra

- Page đang fetch `academicRecords` bằng `academicRecordApi.getAcademicRecords(...)`, sau đó map sang `mappedRecords`.
- Page đang fetch `classReports` bằng `dailyClassReportApi.getDailyClassReports(...)`, sau đó dùng trực tiếp làm `paginatedClassReports`.
- UI đang hiện badge `New` dựa trên `createdAt < 24 * 60 * 60 * 1000`.
- Lịch sử trong drawer của sinh viên có sort theo `createdAt` giảm dần, nhưng hai danh sách chính phụ thuộc nhiều vào thứ tự backend trả về.
- Cần giữ nguyên filter, search, phân trang, permission xoá, layout table/card hiện tại.

## 3. Yêu cầu chức năng

### 3.1. Sắp xếp dữ liệu mới lên đầu

Thêm helper dùng chung trong `GhiNhanTab`:

```ts
const getCreatedTime = (value?: string) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};
```

Sắp xếp giảm dần theo thời điểm tạo:

- `academicRecords`: ưu tiên `createdAt`, fallback `updatedAt`, sau đó fallback `recorded_at` nếu cần.
- `classReports`: ưu tiên `createdAt`, fallback `updatedAt`, sau đó fallback `report_date` nếu cần.

Việc sắp xếp nên đặt ở tầng dữ liệu hiển thị, vì page hiện tại có nhiều đường render dùng chung `paginatedRecords` và `paginatedClassReports`:

- Với ghi nhận HSSV: sort sau khi map/filter, trước khi gán `paginatedRecords`.
- Với tình hình lớp học: sort `filteredClassReports` trước khi gán `paginatedClassReports`.

Cần đảm bảo item mới tạo/import xong nằm ở đầu trang hiện tại sau khi refetch.

### 3.2. Badge `New` chỉ tồn tại trong 6 giờ

Thêm hằng số dùng chung:

```ts
const NEW_BADGE_WINDOW_MS = 6 * 60 * 60 * 1000;
```

Thêm helper:

```ts
const isNewWithinWindow = (createdAt?: string) =>
  getCreatedTime(createdAt) > 0 &&
  Date.now() - getCreatedTime(createdAt) <= NEW_BADGE_WINDOW_MS;
```

Thay tất cả điều kiện hiện tại đang dùng `24 * 60 * 60 * 1000` trong hai bảng thành helper trên.

Vị trí cần cập nhật:

- Badge `New` của ghi nhận HSSV trong desktop card.
- Badge `New` của ghi nhận HSSV trong desktop table.
- Badge `New` của tình hình lớp học trong desktop card.
- Badge `New` của tình hình lớp học trong desktop table.
- Nếu mobile card cần hiển thị `New`, thêm cùng logic 6 giờ và không làm vỡ layout.

### 3.3. Không làm thay đổi nghiệp vụ khác

- Không đổi API endpoint.
- Không đổi filter theo lớp, ngày, search, người tạo.
- Không đổi permission xoá/chọn nhiều.
- Không đổi import/export.
- Không đổi logic tính điểm, sĩ số, thống kê.

## 4. Chi tiết kỹ thuật đề xuất

Trong `frontend/src/app/students/record/page.tsx`:

1. Thêm `NEW_BADGE_WINDOW_MS`, `getCreatedTime`, `getRecordSortTime`, `getClassReportSortTime`, `isNewWithinWindow`.
2. Tạo `sortedRecords` từ `filteredRecords`:

```ts
const sortedRecords = [...filteredRecords].sort(
  (a, b) => getRecordSortTime(b.original) - getRecordSortTime(a.original),
);

const paginatedRecords = sortedRecords;
```

3. Tạo `sortedClassReports` từ `filteredClassReports`:

```ts
const sortedClassReports = [...filteredClassReports].sort(
  (a, b) => getClassReportSortTime(b) - getClassReportSortTime(a),
);

const paginatedClassReports = sortedClassReports;
```

4. Thay các block badge `New` lặp lại bằng:

```tsx
{isNewWithinWindow(record.original?.createdAt) && (
  <span className="...">New</span>
)}
```

Và với tình hình lớp:

```tsx
{isNewWithinWindow(report.createdAt) && (
  <span className="...">New</span>
)}
```

Nếu muốn tránh duplicate UI, có thể tách `NewBadge` component nhỏ trong cùng file.

## 5. Test cases bắt buộc

### 5.1. Ghi nhận HSSV

- Bản ghi có `createdAt` mới nhất nằm đầu danh sách.
- Bản ghi `createdAt` trong 6 giờ hiện badge `New`.
- Bản ghi `createdAt` lớn hơn 6 giờ không hiện badge `New`.
- Bản ghi thiếu `createdAt` không làm crash page và bị xếp sau các bản ghi có thời gian hợp lệ.
- Search/filter/class/date vẫn giữ đúng kết quả và thứ tự mới nhất lên đầu.

### 5.2. Tình hình lớp học

- Báo cáo có `createdAt` mới nhất nằm đầu danh sách.
- Báo cáo trong 6 giờ hiện badge `New`.
- Báo cáo quá 6 giờ không hiện badge `New`.
- Check select-all/xoá nhiều vẫn đúng sau khi sort.
- Mobile card, desktop card và desktop table đều không bị lệch layout.

### 5.3. Regression

- Import ghi nhận HSSV xong, bản ghi mới hiện đầu danh sách và có badge `New`.
- Import tình hình lớp học xong, báo cáo mới hiện đầu danh sách và có badge `New`.
- Chuyển phân trang/items per page không mất thứ tự sắp xếp mới nhất.

## 6. Tiêu chí nghiệm thu

- Hai bảng trên `/students/record` luôn hiện dữ liệu mới nhất đầu tiên theo thời điểm tạo.
- Badge `New` chỉ hiện khi `createdAt` cách hiện tại không quá 6 giờ.
- Không còn logic `24 * 60 * 60 * 1000` cho badge `New` ở hai bảng này.
- Không phát sinh lỗi console khi dữ liệu thiếu `createdAt`.
- `npm run lint` và `npm run build` frontend pass, hoặc nếu lint script hiện tại lỗi cấu hình ESLint thì cần ghi chú riêng và không tính là lỗi của task này.

## 7. Ngoài phạm vi

- Không sửa backend sorting nếu frontend đã đảm bảo được thứ tự hiển thị trên page hiện tại.
- Không thay đổi schema/API response.
- Không sửa các page khác ngoài `/students/record`.
- Không thay đổi màu sắc/visual style ngoài badge `New` nếu cần tái sử dụng.

## 8. Pipeline đề xuất

`feature_development`

1. `code-agent/search`: Xác định các điểm render/sort/badge trong `frontend/src/app/students/record/page.tsx`.
2. `code-agent/code_gen`: Thêm helper sort/new-window và cập nhật các render path.
3. `test-agent`: Kiểm tra lint/build frontend, và test manual các trường hợp trong 6 giờ/quá 6 giờ.
4. `review-agent`: Review regression với filter, pagination, permission select/delete.
5. `doc-agent`: Cập nhật ghi chú nếu có thay đổi hành vi hiển thị.
