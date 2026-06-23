# Phân Tích Performance: Trang Grading & Backend Liên Quan

## Tổng Quan

Trang Grading (`/grading`) là một trong những trang phức tạp nhất của hệ thống, với file frontend **1806 dòng (~76KB)** và backend service **1386 dòng (~52KB)**. Phân tích dưới đây bao gồm cả frontend và backend, xác định các bottleneck chính và đề xuất cải thiện.

---

## 🔴 Các Vấn Đề Nghiêm Trọng (Critical)

### 1. Frontend Component Monolith — File quá lớn

**File**: [page.tsx](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx) — **1806 dòng, 76KB**

| Metric | Giá trị | Đánh giá |
|---|---|---|
| Số dòng code | 1806 | 🔴 Quá lớn, nên tối đa ~300-400 dòng/component |
| Số `useState` | **~30+** | 🔴 Re-render cascade khi bất kỳ state nào thay đổi |
| Số `useEffect` | **~10+** | 🟡 Dependency arrays phức tạp, khó kiểm soát |
| Dynamic imports | 3 (SemesterModal, GradingPdfTemplate, ConfirmModal) | 🟢 Tốt |

> [!CAUTION]
> **Mỗi `setState` sẽ gây re-render toàn bộ 1806 dòng component.** Với ~30 state variables, search input `onChange` sẽ trigger re-render liên tục cho toàn bộ cây component mỗi ký tự người dùng nhập.

**Impact cụ thể:**
- Khi user gõ tìm kiếm → `setSearchTerm()` → re-render toàn bộ component (bao gồm tính toán `filteredStudents`, `evaluationCountsMap`, tất cả modals)
- `filteredStudents` được tính lại mỗi render mà **không dùng `useMemo`** (dòng 927-963)
- `evaluationCountsMap` cũng tính lại mỗi render (dòng 992-1017)

---

### 2. Bulk Operations — Sequential API Calls (N+1 Problem Frontend)

**Files liên quan:**
- [page.tsx L313-356](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L313-L356) — `executeDeleteBulk`
- [page.tsx L412-454](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L412-L454) — `executeApproveBulk`
- [page.tsx L546-595](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L546-L595) — `executeCancelApproveBulk`

```javascript
// executeDeleteBulk — gửi N requests song song 
const promises = summaryIds.map(async (id) => {
  await summariesPointApi.deleteSummariesPoint(id);  // 1 request per student
});
await Promise.allSettled(promises);
```

```javascript
// executeApproveBulk — gửi N requests song song
const promises = summaryIds.map(async (id) => {
  await summariesPointApi.approveGrading(id);  // 1 request per student
});
```

```javascript
// executeCancelApproveBulk — GỌI cancelApprovalBulk TỪNG CÁI MỘT
const promises = summaryIds.map(async (id) => {
  await summariesPointApi.cancelApprovalBulk([id]);  // 1 request per student — dùng bulk API nhưng mỗi lần chỉ gửi 1 ID!
});
```

> [!WARNING]
> **`executeCancelApproveBulk` (dòng 546-595):** Mặc dù backend đã có API bulk `cancelApprovalBulk`, frontend lại loop và gọi từng ID một. Điều này tạo ra **N requests thay vì 1 request duy nhất**.

| Thao tác | Số requests/N students | Có bulk API backend? |
|---|---|---|
| Xóa hàng loạt | N requests | ❌ Không |
| Duyệt hàng loạt | N requests | ❌ Không |
| Hủy duyệt hàng loạt | N requests (dùng bulk sai) | ✅ Có nhưng không tận dụng |

**Impact:** Với 50 sinh viên, duyệt hàng loạt sẽ gửi 50 requests song song. Mỗi request `approveGrading` trong backend phải:
1. Kiểm quyền (`assertCanAccessSummary`) → 2-3 DB queries
2. Load summary → 1 DB query
3. Save details → 1 DB write
4. `recomputeTotalScore` → 3 DB queries (categories, criteria, save)
5. Compute rank → 1 DB write  
6. Populate final → 1 DB read

**Tổng: ~50 × 9 = 450 DB operations** cho 1 lần duyệt 50 sinh viên.

---

### 3. Backend `findAll` — Multiple Chained DB Queries

**File**: [summaries-point.service.ts L296-415](file:///Users/nguyendat/Desktop/manager-point/manager_points/backend/src/summaries-point/summaries-point.service.ts#L296-L415)

```
Flow khi gọi GET /summaries-points?classId=X&semesterId=Y:

1. getTeacherStudentIds(requester) — nếu là Teacher:
   a. classModel.find({ advisor_id }) → Query 1
   b. studentModel.find({ class_id: { $in } }) → Query 2

2. studentModel.find({ class_id: classId }) → Query 3 (lặp lại!)

3. summaryPointModel.find(filter).populate() → Query 4 (MAIN QUERY)
   - populate('student_id') → N sub-queries (hoặc 1 nếu dùng populate strategy tốt)
   - populate('semester_id') → thêm sub-queries  
   - populate('period_id') → thêm sub-queries

4. summaryPointModel.countDocuments(filter) → Query 5
```

> [!IMPORTANT]
> **Query 2 và Query 3 trùng lặp hoàn toàn** cho trường hợp teacher truy cập lớp của chính mình. Backend query `studentModel.find({ class_id })` được gọi **2 lần** với cùng dữ liệu.

---

### 4. Fetch Summaries + Pre-existing Counts — Waterfall Request

**File**: [page.tsx L661-704](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L661-L704)

```javascript
const fetchSummaries = async () => {
  // Request 1: Lấy summaries
  const res = await summariesPointApi.getSummariesPoints({...});
  
  // Request 2: Lấy pre-existing counts (chỉ sau khi có summaries)
  const summaryIds = data.map((s) => s._id);
  if (summaryIds.length > 0) {
    const bulkCounts = await evaluationDetailApi.getPreExistingCountsBulk(summaryIds);
  }
};
```

**Waterfall:** Request 2 phụ thuộc vào Request 1 → latency = T1 + T2 (tuần tự, không song song).

Backend `getPreExistingCountsBulk` (dòng 265-369) thực hiện:
1. `summaryPointModel.find({ _id: { $in: summaryIds } })` → Query 1
2. `academicRecordModel.aggregate([...])` với `$lookup` users, `$lookup` roles → Query 2 (nặng!)

---

### 5. `handleConfirmFilter` — Double Fetch + initializeClass

**File**: [page.tsx L885-924](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L885-L924)

```javascript
const handleConfirmFilter = async () => {
  // 1. Gọi initializeClass (POST) — có thể tạo bảng điểm mới
  await summariesPointApi.initializeClass(selectedClass, selectedSemester);
  
  // 2. Gọi fetchData() lại — fetch departments, classes, semesters (THỪA!)
  await fetchData();
  
  // 3. Trigger fetchSummaries qua useEffect khi appliedClass/appliedSemester thay đổi
  setAppliedSemester(selectedSemester);
  setAppliedClass(selectedClass);
};
```

> [!WARNING]
> **`fetchData()` ở bước 2 hoàn toàn thừa.** Departments, classes, semesters không thay đổi khi chỉ khởi tạo bảng điểm cho sinh viên. Điều này tạo thêm **3 API calls không cần thiết** (getDepartments, getClasses, getSemesters).

---

## 🟡 Các Vấn Đề Trung Bình (Medium)

### 6. `tokenStorage.getUser()` Gọi Trong Render Cycle

**File**: [page.tsx L1078-1080](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L1078-L1080)

```javascript
// Bên trong render function của column "actions"
render: (_, student) => {
  const currentUser = tokenStorage.getUser();  // Gọi mỗi row, mỗi render
  const userRoleLower = currentUser?.role?.toLowerCase() || '';
```

Mỗi lần render bảng, `tokenStorage.getUser()` được gọi **N lần** (N = số sinh viên hiển thị). Nếu `getUser()` parse JSON từ localStorage → tốn CPU.

---

### 7. `filteredStudents` Tính Toán Không Memoize

**File**: [page.tsx L927-963](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L927-L963)

```javascript
// Tính lại MỖI RENDER — không dùng useMemo
const filteredStudents = !appliedClass
  ? []
  : (apiSummariesPoints || [])
    .map((summary, idx) => { /* ... complex mapping ... */ })
    .filter(student => { /* ... search filter ... */ });
```

Với 100 sinh viên, map + filter chạy lại mỗi khi **bất kỳ** state nào thay đổi (kể cả mở/đóng modal, checkbox...).

---

### 8. Backend `recomputeTotalScore` — Fetch ALL Categories & Criteria

**File**: [summaries-point.service.ts L483-570](file:///Users/nguyendat/Desktop/manager-point/manager_points/backend/src/summaries-point/summaries-point.service.ts#L483-L570)

```javascript
async recomputeTotalScore(summaryId: string): Promise<void> {
  const categories = await this.categoryModel.find().lean().exec();  // TẤT CẢ categories
  const criteria = await this.criterionModel.find().lean().exec();    // TẤT CẢ criteria
  // ...
}
```

Khi duyệt 50 sinh viên → gọi `recomputeTotalScore` 50 lần → fetch TẤT CẢ categories + criteria **50 lần**. Data này là static (không thay đổi giữa các request).

---

### 9. Backend `approveGrading` — 3 Lần Load + Save Summary

**File**: [summaries-point.service.ts L580-672](file:///Users/nguyendat/Desktop/manager-point/manager_points/backend/src/summaries-point/summaries-point.service.ts#L580-L672)

```
1. findById(summaryId)          → Load #1
2. summary.save()               → Save #1 (details locked)
3. recomputeTotalScore()
   └─ findById(summaryId)       → Load #2
   └─ summary.save()            → Save #2 (total_score updated)
4. findById(summaryId)          → Load #3 (after recompute)
5. recomputedSummary.save()     → Save #3 (rank fields)
6. findById(summaryId).populate()  → Load #4 (final return)
```

**Tổng: 4 loads + 3 saves cho 1 approve operation.** Có thể giảm xuống 2 loads + 1 save.

---

### 10. sessionStorage Sync Effect — Quá Nhiều Dependencies

**File**: [page.tsx L773-794](file:///Users/nguyendat/Desktop/manager-point/manager_points/frontend/src/app/grading/page.tsx#L773-L794)

```javascript
useEffect(() => {
  sessionStorage.setItem('grading_selectedDept', selectedDepartment);
  sessionStorage.setItem('grading_selectedClass', selectedClass);
  // ... 8 items
}, [selectedDepartment, selectedClass, selectedSemester, appliedDepartment, 
    appliedClass, appliedSemester, searchTerm, currentPage, isStateRestored]);
```

Effect này fire mỗi khi **bất kỳ 1 trong 9 dependencies** thay đổi → write 8 items vào sessionStorage. Ví dụ: user gõ tìm kiếm → `searchTerm` thay đổi → write 8 sessionStorage items mỗi ký tự.

---

## 🟢 Điểm Tốt (Đã Làm Đúng)

| Aspect | Chi tiết |
|---|---|
| ✅ Dynamic imports | SemesterModal, GradingPdfTemplate, ConfirmModal lazy-loaded |
| ✅ Pagination | Server-side pagination với page/limit |
| ✅ `classMap`, `semesterMap` dùng `useMemo` | Giảm re-computation cho lookup maps |
| ✅ `select('-details')` trong `findAll` | Backend không trả embedded details khi list → giảm payload |
| ✅ Database indexes | `uq_student_period`, `idx_period_status`, `idx_student_status_updated` đã có |
| ✅ Infinite scroll trên mobile | IntersectionObserver cho mobile view |
| ✅ Bulk pre-existing counts API | Dùng aggregation thay vì N+1 queries |

---

## Đề Xuất Cải Thiện (Theo Ưu Tiên)

### Priority 1 — Quick Wins (Impact cao, Effort thấp)

#### 1.1 Memoize `filteredStudents` và `evaluationCountsMap`

```diff
-const filteredStudents = !appliedClass ? [] : (apiSummariesPoints || []).map(...).filter(...);
+const filteredStudents = React.useMemo(() => {
+  if (!appliedClass) return [];
+  return (apiSummariesPoints || []).map(...).filter(...);
+}, [appliedClass, apiSummariesPoints, searchTerm, classMap]);
```

#### 1.2 Fix `executeCancelApproveBulk` — Sử dụng đúng bulk API

```diff
-const promises = summaryIds.map(async (id) => {
-  const results = await summariesPointApi.cancelApprovalBulk([id]);
-});
+// Gọi 1 lần duy nhất thay vì N lần
+const results = await summariesPointApi.cancelApprovalBulk(summaryIds);
```

#### 1.3 Loại bỏ `fetchData()` thừa trong `handleConfirmFilter`

```diff
 const handleConfirmFilter = async () => {
   const initRes = await summariesPointApi.initializeClass(...);
-  await fetchData();  // ← THỪA: departments/classes/semesters không đổi
   setCurrentPage(1);
   setAppliedSemester(selectedSemester);
   setAppliedClass(selectedClass);
 };
```

#### 1.4 Cache `tokenStorage.getUser()` ngoài render cycle

```diff
+const currentUserRole = React.useMemo(() => {
+  const user = tokenStorage.getUser();
+  const roleLower = (user?.role || '').toLowerCase();
+  return {
+    canApprove: roleLower.includes('admin') || roleLower.includes('supervisor'),
+  };
+}, []);
```

---

### Priority 2 — Backend Optimization (Impact cao, Effort trung bình)

#### 2.1 Thêm bulk approve API

Backend nên có endpoint `PATCH /summaries-points/approve/bulk` nhận `{ summaryIds: string[] }` và thực hiện approve trong 1 transaction/loop server-side, thay vì frontend phải gửi N requests.

#### 2.2 Thêm bulk delete API

Tương tự: `DELETE /summaries-points/bulk` nhận `{ summaryIds: string[] }`.

#### 2.3 Cache categories + criteria trong `recomputeTotalScore`

```diff
+private categoriesCache: any[] | null = null;
+private criteriaCache: any[] | null = null;
+private cacheExpiry: number = 0;

 async recomputeTotalScore(summaryId: string): Promise<void> {
-  const categories = await this.categoryModel.find().lean().exec();
-  const criteria = await this.criterionModel.find().lean().exec();
+  if (!this.categoriesCache || Date.now() > this.cacheExpiry) {
+    const [cats, cris] = await Promise.all([
+      this.categoryModel.find().lean().exec(),
+      this.criterionModel.find().lean().exec(),
+    ]);
+    this.categoriesCache = cats;
+    this.criteriaCache = cris;
+    this.cacheExpiry = Date.now() + 60000; // 1 minute TTL
+  }
```

#### 2.4 Giảm số lần load/save trong `approveGrading`

Gộp `save` rank fields cùng với `recomputeTotalScore` để giảm từ 4 loads + 3 saves → 2 loads + 1 save.

#### 2.5 Loại bỏ duplicate `studentModel.find` trong `findAll`

Khi teacher truy cập lớp của chính mình, `getTeacherStudentIds` và filter `classId` đều query `studentModel.find({ class_id })` → cache hoặc hợp nhất query.

---

### Priority 3 — Tách Component (Impact trung bình, Effort cao)

#### 3.1 Tách `GradingPage` thành sub-components

```
GradingPage (state management + layout)
├── GradingFilters (search + department/class/semester selects)
├── GradingTable (ResponsiveDataView wrapper)
├── GradingBulkActions (FloatingActionBar + confirm modals)
├── GradingProgressDialogs (approve/delete/cancel progress)
└── GradingMobileFilters (mobile filter dialog)
```

#### 3.2 Debounce search input

```diff
-onChange={(e) => setSearchTerm(e.target.value)}
+onChange={(e) => {
+  const value = e.target.value;
+  setSearchTerm(value);  // immediate UI update
+}}
// Hoặc dùng useDeferredValue cho search filtering
+const deferredSearch = React.useDeferredValue(searchTerm);
```

---

## Database Index Analysis

### Có sẵn (Đã cấu hình)

| Collection | Index | Dùng cho |
|---|---|---|
| `summary_points` | `student_id_1` | Filter theo student |
| `summary_points` | `semester_id_1` | Filter theo semester |
| `summary_points` | `period_id_1` | Filter theo period |
| `summary_points` | `status_1` | Filter theo status |
| `summary_points` | `uq_student_period` (unique) | student_id + semester_id + period_id |
| `summary_points` | `idx_period_status` | period_id + status |
| `summary_points` | `idx_student_status_updated` | student_id + status + updatedAt |

### Đề xuất thêm

| Collection | Index đề xuất | Lý do |
|---|---|---|
| `academic_records` | `{ student_id: 1, semester_id: 1, criterion_id: 1, status: 1 }` | `getPreExistingCountsBulk` dùng aggregation match trên 3 field + status |
| `students` | `{ class_id: 1, status: 1 }` | `initializeClass` và `findAll` đều filter theo class_id + status |
| `classes` | `{ advisor_id: 1 }` | `getTeacherClassIds` filter theo advisor_id |

---

## Tổng Kết Impact Ước Tính

| Cải thiện | Giảm API calls | Giảm DB queries | Giảm re-renders |
|---|---|---|---|
| Fix cancelBulk | N → 1 | ~90% | — |
| Bỏ fetchData thừa | 3 calls | 3 queries | — |
| Memoize filteredStudents | — | — | ~60-70% |
| Bulk approve API | N → 1 | ~80% | — |
| Cache categories/criteria | — | ~95% (khi bulk) | — |
| Reduce approveGrading loads | — | ~50% per approve | — |

## Open Questions

> [!IMPORTANT]
> 1. **Có muốn tôi triển khai các cải thiện Priority 1 (Quick Wins) ngay không?** Đây là các thay đổi an toàn, impact cao, effort thấp.
> 2. **Backend bulk APIs (Priority 2.1, 2.2):** Cần confirm có muốn thêm endpoint mới `POST /summaries-points/approve/bulk` và `DELETE /summaries-points/bulk` không?
> 3. **Component splitting (Priority 3):** Có muốn tách component hay giữ nguyên cấu trúc hiện tại?
> 4. **Database indexes:** Có quyền truy cập MongoDB để kiểm tra và thêm index cho collection `academic_records` và `students` không?
