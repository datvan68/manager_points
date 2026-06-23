# Task Scope: Giữ trạng thái trang `/students` khi vào chi tiết lớp rồi quay lại

## 1. Mục tiêu

Sửa luồng từ trang `/students` chọn khoa/lớp, vào chi tiết lớp `/students/[classId]`, sau đó quay lại để trang danh sách vẫn giữ đúng trạng thái người dùng đang xem thay vì reset về khoa đầu tiên mặc định.

Trạng thái cần giữ:

- Khoa đang active (`selectedDept`).
- Từ khóa tìm kiếm lớp (`searchTerm`) nếu người dùng đã nhập.
- Từ khóa tìm kiếm khoa (`deptSearchTerm`) nếu người dùng đã nhập.
- Trạng thái mobile đang xem danh sách lớp (`isMobileViewClasses`) khi quay lại trên mobile.
- Trạng thái mở/đóng nhóm hệ Cao đẳng và Trung cấp nếu cần giữ trải nghiệm nhất quán.

## 2. Hiện trạng đã kiểm tra

Các file liên quan:

- `frontend/src/app/students/page.tsx`
- `frontend/src/app/students/[classId]/page.tsx`

Luồng hiện tại:

- `/students` lưu khoa đang chọn bằng local state:

```ts
const [selectedDept, setSelectedDept] = useState<string>("");
```

- Khi load danh sách khoa, nếu `selectedDept` trống thì tự chọn khoa đầu tiên:

```ts
setSelectedDept((prev) => {
  if (prev && fetchedDepts.some((d) => d._id === prev)) {
    return prev;
  }
  return fetchedDepts[0]._id;
});
```

- Khi click vào lớp, page chỉ điều hướng theo `classId`:

```ts
const handleClassClick = (classId: string) => {
  router.push(`/students/${classId}`);
};
```

- Nút quay lại trong chi tiết lớp điều hướng thẳng về `/students`:

```tsx
onClick={() => router.push('/students')}
```

Vì route `/students` bị mount lại và URL không chứa context khoa đang chọn, `selectedDept` trở lại `""`, sau đó `fetchDepartments()` chọn khoa đầu tiên. Đây là nguyên nhân khiến người dùng back lại bị mất trạng thái cũ.

## 3. Yêu cầu chức năng

### 3.1. Giữ khoa đang active khi quay lại từ chi tiết lớp

Khi người dùng click lớp từ `/students`, URL chi tiết lớp cần mang theo context khoa hiện tại, ví dụ:

```ts
router.push(`/students/${classId}?deptId=${selectedDept}`);
```

Khi người dùng bấm nút quay lại ở `/students/[classId]`, cần quay về:

```ts
router.push(`/students?deptId=${deptId}`);
```

Khi `/students` mount, đọc `deptId` từ query string và ưu tiên dùng giá trị này nếu tồn tại trong danh sách khoa.

### 3.2. Không reset về khoa đầu tiên nếu URL đã có state hợp lệ

Trong `fetchDepartments()`, logic auto select khoa đầu tiên cần đổi theo thứ tự ưu tiên:

1. `deptId` trên URL nếu hợp lệ.
2. `selectedDept` hiện tại nếu còn tồn tại trong danh sách khoa.
3. Khoa đầu tiên nếu không có state nào hợp lệ.

Nếu `deptId` không tồn tại hoặc khoa đã bị xóa, fallback về khoa đầu tiên như hiện tại.

### 3.3. Đồng bộ URL khi người dùng đổi khoa

Khi click một khoa ở danh sách trái:

- Cập nhật `selectedDept`.
- Cập nhật URL `/students?deptId=<deptId>` bằng `router.replace` để không tạo lịch sử dư thừa.
- Trên mobile vẫn bật `setIsMobileViewClasses(true)`.

Không nên dùng `router.push` mỗi lần đổi khoa, vì người dùng bấm browser back sẽ phải đi qua từng khoa đã click.

### 3.4. Giữ thêm filter tìm kiếm nếu cần

Nếu muốn giữ đầy đủ trạng thái cũ, query string nên hỗ trợ:

- `deptId`: khoa đang active.
- `classSearch`: search lớp.
- `deptSearch`: search khoa.
- `view=classes`: đang ở panel danh sách lớp trên mobile.
- `caoDang=1|0`, `trungCap=1|0`: trạng thái mở/đóng từng nhóm nếu cần.

Tối thiểu bắt buộc cho bug này là `deptId`. Các field còn lại có thể làm cùng lúc nếu không làm tăng độ phức tạp quá nhiều.

## 4. Chi tiết kỹ thuật đề xuất

Trong `frontend/src/app/students/page.tsx`:

1. Import thêm `useSearchParams` từ `next/navigation`.

```ts
import { useRouter, useSearchParams } from "next/navigation";
```

2. Đọc query params:

```ts
const searchParams = useSearchParams();
const deptIdFromUrl = searchParams.get("deptId");
```

3. Khởi tạo state từ URL cho các filter cần giữ:

```ts
const [selectedDept, setSelectedDept] = useState<string>(() => deptIdFromUrl || "");
const [searchTerm, setSearchTerm] = useState(() => searchParams.get("classSearch") || "");
const [deptSearchTerm, setDeptSearchTerm] = useState(() => searchParams.get("deptSearch") || "");
```

4. Tạo helper cập nhật URL:

```ts
const updateStudentsListUrl = (next: {
  deptId?: string;
  classSearch?: string;
  deptSearch?: string;
  view?: string;
}) => {
  const params = new URLSearchParams(searchParams.toString());

  Object.entries(next).forEach(([key, value]) => {
    if (value) params.set(key, value);
    else params.delete(key);
  });

  const query = params.toString();
  router.replace(query ? `/students?${query}` : "/students", { scroll: false });
};
```

5. Khi chọn khoa:

```tsx
onClick={() => {
  setSelectedDept(dept._id);
  setIsMobileViewClasses(true);
  updateStudentsListUrl({ deptId: dept._id, view: "classes" });
}}
```

6. Khi click lớp:

```ts
const handleClassClick = (classId: string) => {
  const params = new URLSearchParams();
  if (selectedDept) params.set("deptId", selectedDept);
  if (searchTerm) params.set("classSearch", searchTerm);
  if (deptSearchTerm) params.set("deptSearch", deptSearchTerm);
  if (isMobileViewClasses) params.set("view", "classes");

  const query = params.toString();
  router.push(query ? `/students/${classId}?${query}` : `/students/${classId}`);
};
```

7. Trong `fetchDepartments()`, ưu tiên `deptIdFromUrl`:

```ts
const urlDeptIsValid =
  deptIdFromUrl && fetchedDepts.some((dept) => dept._id === deptIdFromUrl);

setSelectedDept((prev) => {
  if (urlDeptIsValid) return deptIdFromUrl;
  if (prev && fetchedDepts.some((dept) => dept._id === prev)) return prev;
  return fetchedDepts[0]._id;
});
```

8. Vì page đang dùng `useSearchParams`, đảm bảo component client được bọc `Suspense` đúng như pattern hiện tại nếu Next build yêu cầu.

Trong `frontend/src/app/students/[classId]/page.tsx`:

1. Import thêm `useSearchParams`.

```ts
import { useRouter, useParams, useSearchParams } from 'next/navigation';
```

2. Đọc query cũ:

```ts
const searchParams = useSearchParams();
```

3. Tạo helper back URL:

```ts
const getStudentsBackUrl = () => {
  const params = new URLSearchParams(searchParams.toString());
  const query = params.toString();
  return query ? `/students?${query}` : "/students";
};
```

4. Thay nút quay lại:

```tsx
onClick={() => router.push(getStudentsBackUrl())}
```

Nếu chi tiết sinh viên `/students/[classId]/[id]` cũng có nút quay về lớp rồi về danh sách, có thể truyền tiếp query string nhưng không bắt buộc trong scope tối thiểu này.

## 5. Test cases bắt buộc

### 5.1. Luồng desktop

- Vào `/students`, chọn khoa thứ 2 hoặc khoa bất kỳ không phải khoa đầu tiên.
- Click một lớp trong khoa đó.
- Bấm nút quay lại trên trang chi tiết lớp.
- Kết quả: `/students` vẫn active đúng khoa đã chọn, không reset về khoa đầu tiên.

### 5.2. Luồng browser back

- Vào `/students?deptId=<id-khoa-2>`.
- Click lớp để sang `/students/<classId>?deptId=<id-khoa-2>`.
- Bấm browser back.
- Kết quả: vẫn ở khoa 2, danh sách lớp tương ứng được hiển thị.

### 5.3. Luồng mobile

- Trên viewport mobile, chọn khoa, UI chuyển sang danh sách lớp.
- Click lớp, vào chi tiết.
- Bấm quay lại.
- Kết quả: quay về đúng khoa và vẫn mở panel danh sách lớp nếu có `view=classes`.

### 5.4. Query không hợp lệ

- Mở `/students?deptId=invalid`.
- Kết quả: không crash, fallback về khoa đầu tiên như hiện tại.

### 5.5. Search/filter

- Nhập search lớp, click lớp, quay lại.
- Nếu implement `classSearch`, search vẫn còn.
- Nếu scope tối thiểu chỉ giữ `deptId`, cần ghi chú rõ search không nằm trong acceptance.

## 6. Tiêu chí nghiệm thu

- `/students` không tự reset về khoa đầu tiên khi quay lại từ `/students/[classId]` nếu trước đó người dùng đang chọn khoa khác.
- URL có thể biểu diễn trạng thái khoa đang active bằng `deptId`.
- Refresh trực tiếp `/students?deptId=<id>` vẫn chọn đúng khoa.
- Nút quay lại trong chi tiết lớp giữ lại query context thay vì push `/students` trống.
- Browser back/forward không làm trạng thái khoa bị sai.
- Không ảnh hưởng permission thêm/sửa/xóa khoa/lớp.
- Không ảnh hưởng popup import lớp và popup thêm lớp.
- Không phát sinh lỗi build do `useSearchParams` thiếu `Suspense`.

## 7. Ngoài phạm vi

- Không thay đổi API backend.
- Không thay đổi schema lớp/khoa/sinh viên.
- Không đổi UI layout của trang `/students`.
- Không sửa luồng `/students/record` hoặc `/students/tasks`.
- Không bắt buộc lưu trạng thái bằng `localStorage`; URL query là nguồn state chính.

## 8. Pipeline đề xuất

`bug_fix`

1. `code-agent/search`: Xác định toàn bộ điểm tạo state, chọn khoa, click lớp, và nút quay lại.
2. `code-agent/code_gen`: Thêm URL state bằng query params và cập nhật back URL.
3. `test-agent`: Test desktop, mobile, browser back, refresh URL có `deptId`, và query invalid.
4. `review-agent`: Review regression với `useSearchParams`, `router.replace`, permission action, popup add/edit/import.
5. `doc-agent`: Cập nhật ghi chú behavior nếu cần.
